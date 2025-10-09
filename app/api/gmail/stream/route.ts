import { NextRequest } from 'next/server';
import { gmailClient } from '@/lib/gmail';
import { 
  createProcessedEmail, 
  getEmailByImapUid, 
  updateProcessedEmail,
  createContact,
  findContactByEmail,
  getEmailAssignments,
  createEmailAssignment,
  getCategories,
  assignEmailCategories
} from '@/lib/db';
import { IMAPMessage } from '@/types';

// Content validation helper (reused from main route)
interface ContentValidationResult {
  isValid: boolean;
  content: string;
  issues: string[];
}

function validateEmailContent(content: string, parseSuccess?: boolean): ContentValidationResult {
  const issues: string[] = [];
  let processedContent = content;
  
  if (parseSuccess === false) {
    issues.push('MIME parsing failed');
  }
  
  if (!content || content.trim().length === 0) {
    issues.push('Empty content');
    processedContent = 'Email có thể chưa được tải đầy đủ hoặc không có nội dung.';
  } else if (content.trim().length < 10) {
    issues.push('Very short content');
  }
  
  if (content.includes('Content-Type:') && content.includes('Content-Transfer-Encoding:')) {
    issues.push('Contains raw MIME headers');
  }
  
  const base64Pattern = /^[A-Za-z0-9+/]{50,}={0,2}$/m;
  if (base64Pattern.test(content)) {
    issues.push('Contains undecoded base64');
  }
  
  const qpPattern = /=[0-9A-F]{2}/g;
  const qpMatches = content.match(qpPattern);
  if (qpMatches && qpMatches.length > content.length * 0.1) {
    issues.push('Contains undecoded quoted-printable');
  }
  
  const nonPrintableCount = (content.match(/[\x00-\x08\x0E-\x1F\x7F]/g) || []).length;
  if (nonPrintableCount > content.length * 0.05) {
    issues.push('Contains many non-printable characters');
  }
  
  if (content.includes('â[]') || content.includes('â€') || content.includes('Â ')) {
    issues.push('Contains encoding artifacts');
  }
  
  return {
    isValid: issues.length === 0,
    content: processedContent,
    issues
  };
}

// Helper functions for AI processing
async function callClassifyAgent(
  email: { from: string; subject: string; body: string },
  categories: any[],
  assignments: any[]
) {
  try {
    const { classifyEmail } = await import('../../ai-internal');
    return await classifyEmail(email, categories, assignments);
  } catch (error) {
    console.error('Classification agent error:', error);
    return { category_id: null, confidence: 0 };
  }
}

async function callSummaryAgent(emailBody: string) {
  try {
    const { summarizeEmail } = await import('../../ai-internal');
    return await summarizeEmail(emailBody);
  } catch (error) {
    console.error('Summary agent error:', error);
    return { summary: 'Không thể tóm tắt email này.' };
  }
}

// Streaming sync function
async function streamEmailSync(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  folder: string = 'INBOX',
  limit: number = 500,
  onlyUnread: boolean = true
) {
  
  // Move writeSSE outside try block to avoid closure issues
  const writeSSE = (data: any) => {
    try {
      // Better check for stream state
      if (!controller || controller.desiredSize === null) {
        console.log('Stream closed, cannot write data - controller state:', controller?.desiredSize);
        return false;
      }
      // Add keep-alive ping
      if (data.type === 'ping') {
        controller.enqueue(encoder.encode(`:ping\n\n`));
      } else {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
      return true;
    } catch (error) {
      console.log('Failed to write to stream:', error.message, 'controller state:', controller?.desiredSize);
      return false;
    }
  };

  try {
    
    writeSSE({
      type: 'status',
      message: 'Connecting to Gmail...',
      progress: 0
    });
    

    // Get emails from Gmail IMAP
    const imapEmails = await gmailClient.getEmails(folder, limit);

    // Filter for unread emails if requested
    const emailsToProcess = onlyUnread 
      ? imapEmails.filter(email => !email.flags.includes('\\Seen'))
      : imapEmails;
    

    writeSSE({
      type: 'status',
      message: `Found ${emailsToProcess.length} ${onlyUnread ? 'unread' : ''} emails to process`,
      totalEmails: emailsToProcess.length,
      progress: 5
    });

    if (emailsToProcess.length === 0) {
      writeSSE({
        type: 'completed',
        message: 'No new emails to process',
        processedCount: 0
      });
      return;
    }
    

    // Get categories and assignments for AI classification
    const categories = await getCategories();
    
    const assignments = await getEmailAssignments();

    writeSSE({
      type: 'status',
      message: 'Starting email processing...',
      progress: 10
    });
    

    let processedCount = 0;
    let skippedCount = 0;
    let newEmailsCount = 0;
    const totalToProcess = emailsToProcess.length;
    
    // Process in smaller chunks to prevent overwhelming the stream
    const CHUNK_SIZE = 25; // Reduced from 50 for better stability
    const chunks = [];
    for (let i = 0; i < emailsToProcess.length; i += CHUNK_SIZE) {
      chunks.push(emailsToProcess.slice(i, i + CHUNK_SIZE));
    }
    

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      if (!writeSSE({
        type: 'status',
        message: `Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} emails)`,
        progress: Math.round((chunkIndex / chunks.length) * 80) + 10
      })) {
        console.log('Stream closed during chunk processing, stopping...');
        break;
      }

      for (const [indexInChunk, imapEmail] of chunk.entries()) {
        const index = chunkIndex * CHUNK_SIZE + indexInChunk;
        
        try {
        // Send periodic keep-alive messages to prevent timeout
        if (index % 10 === 0) {
          if (!writeSSE({
            type: 'status',
            message: `Processing batch: ${index + 1}/${totalToProcess} emails`,
            progress: Math.round(((index) / totalToProcess) * 80) + 10
          })) {
            console.log('Stream closed during processing, stopping...');
            break;
          }
          
          // Increased delay to prevent overwhelming the stream
          await new Promise(resolve => setTimeout(resolve, 200)); // Increased from 100ms
          
          // Send keep-alive ping
          writeSSE({ type: 'ping' });
        }

        // Check if email already processed
        const existing = await getEmailByImapUid(imapEmail.uid);
        
        if (existing) {
          console.log(`Email UID ${imapEmail.uid} already exists in database, skipping`);
          skippedCount++;
          // Don't send individual messages for existing emails to reduce stream load
          continue;
        }
        
        newEmailsCount++;
        console.log(`Processing new email UID: ${imapEmail.uid}, From: ${imapEmail.from.address}, Subject: ${imapEmail.subject}`);

        // Only send detailed processing messages for every 5th email to reduce stream load
        if (index % 5 === 0) {
          if (!writeSSE({
            type: 'processing',
            message: `Processing email ${index + 1} of ${totalToProcess}: ${imapEmail.subject?.substring(0, 50)}...`,
            emailSubject: imapEmail.subject,
            emailFrom: imapEmail.from.address,
            progress: Math.round(((index + 0.2) / totalToProcess) * 80) + 10
          })) break;
        }

        // Extract and save contact if not exists
        if (imapEmail.from.address) {
          const existingContact = await findContactByEmail(imapEmail.from.address);
          
          if (!existingContact) {
            try {
              await createContact({
                name: imapEmail.from.name || imapEmail.from.address.split('@')[0],
                email: imapEmail.from.address,
                aliases: [],
                extracted_from_email: true
              });
            } catch (error) {
              console.error('Error creating contact:', error);
            }
          }
        }

        // Validate email content parsing
        const emailBodyContent = imapEmail.bodyText || imapEmail.bodyHtml || '';
        const contentValid = validateEmailContent(emailBodyContent, imapEmail.parseSuccess);
        
        // Prepare email data for AI processing
        const emailForAI = {
          from: `${imapEmail.from.name || ''} <${imapEmail.from.address}>`,
          subject: imapEmail.subject,
          body: contentValid.content
        };

        // Reduce AI processing status messages
        if (index % 10 === 0) {
          if (!writeSSE({
            type: 'ai_processing',
            message: 'Analyzing email content...',
            progress: Math.round(((index + 0.4) / totalToProcess) * 80) + 10
          })) break;
        }

        // AI Classification - optimized for speed
        let categoryId = null;
        try {
          const classification = await callClassifyAgent(emailForAI, categories, assignments);

          if (classification && classification.categories && classification.categories.length > 0) {
            // Use the highest confidence category (already sorted)
            const bestCategory = classification.categories[0];
            categoryId = bestCategory.category_id;
            
            // Save assignment for learning (only if confidence is high)
            if (bestCategory.confidence >= 0.75) {
              await createEmailAssignment({
                sender_email: imapEmail.from.address,
                sender_name: imapEmail.from.name,
                category_id: bestCategory.category_id,
                confidence_score: bestCategory.confidence
              });
            }
          }
        } catch (error) {
          console.error('Classification failed:', error);
        }

        // Reduce summary processing status messages  
        if (index % 15 === 0) {
          if (!writeSSE({
            type: 'ai_processing',
            message: 'Generating summary...',
            progress: Math.round(((index + 0.6) / totalToProcess) * 80) + 10
          })) break;
        }

        // AI Summary - only if content is valid and substantial
        let summary = '';
        try {
          if (contentValid.isValid && contentValid.content.trim().length > 50) {
            const summaryResult = await callSummaryAgent(contentValid.content);

            if (summaryResult && summaryResult.summary) {
              summary = summaryResult.summary;
            }
          } else if (contentValid.issues.length > 0) {
            summary = `Email parsing issues: ${contentValid.issues.join(', ')}.`;
          } else {
            summary = 'Email không có nội dung để tóm tắt.';
          }
        } catch (error) {
          console.error('Summary failed:', error);
          summary = 'Không thể tóm tắt email này.';
        }

        // Determine parsing status
        const parsingStatus = contentValid.isValid ? 'success' : 
                             (contentValid.content && contentValid.content.trim().length > 10) ? 'partial' : 'failed';
        
        // Calculate content length
        const contentLength = (imapEmail.bodyText || '').length + (imapEmail.bodyHtml || '').length;

        // Reduce saving status messages
        if (index % 20 === 0) {
          if (!writeSSE({
            type: 'saving',
            message: 'Saving to database...',
            progress: Math.round(((index + 0.8) / totalToProcess) * 80) + 10
          })) break;
        }

        // Save processed email with parsing metadata
        console.log(`Attempting to save email UID: ${imapEmail.uid}, Subject: ${imapEmail.subject}`);
        
        let processedEmail = null;
        try {
          processedEmail = await createProcessedEmail({
            imap_uid: imapEmail.uid,
            message_id: imapEmail.messageId,
            sender_email: imapEmail.from.address,
            sender_name: imapEmail.from.name,
            subject: imapEmail.subject,
            body_text: imapEmail.bodyText,
            body_html: imapEmail.bodyHtml,
            category_id: categoryId || undefined,
            summary,
            received_date: imapEmail.date.toISOString(),
            parsing_status: parsingStatus,
            content_length: contentLength,
            parsing_errors: contentValid.issues.length > 0 ? contentValid.issues : undefined
          });

          console.log(`Successfully saved email to database with ID: ${processedEmail.id}`);
          processedCount++;
        } catch (dbError) {
          console.error(`Failed to save email UID ${imapEmail.uid} to database:`, dbError);
          // Continue processing even if individual email save fails
        }

        // Only send completed email messages for every 10th email (and only if email was saved successfully)
        if (processedEmail && (index % 10 === 0 || index === totalToProcess - 1)) {
          if (!writeSSE({
            type: 'email_processed',
            email: processedEmail,
            message: `Processed ${processedCount} emails`,
            progress: Math.round(((index + 1) / totalToProcess) * 80) + 10
          })) break;
        }

      } catch (emailError) {
        console.error(`Error processing email ${imapEmail.uid}:`, emailError);
        // Don't break on individual email errors, just log and continue
        const errorSent = writeSSE({
          type: 'email_error',
          error: `Failed to process email: ${emailError.message}`,
          emailSubject: imapEmail.subject,
          progress: Math.round(((index + 1) / totalToProcess) * 80) + 10
        });
        
        // Only break if stream is closed, not for processing errors
        if (!errorSent) {
          console.log('Stream closed, stopping processing');
          break;
        }
        // Continue to next email
        }
      }
      
      // Longer pause between chunks for stability
      if (chunkIndex < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Increased from 500ms
        
        if (!writeSSE({
          type: 'status',
          message: `Completed chunk ${chunkIndex + 1}/${chunks.length}. Processed ${processedCount} emails so far.`,
          progress: Math.round(((chunkIndex + 1) / chunks.length) * 80) + 10
        })) {
          console.log('Stream closed after chunk completion, stopping...');
          break;
        }
      }
    }

    // Final completion message
    const completionMessage = `Sync completed! Found ${newEmailsCount} new emails, ${skippedCount} already existed. Saved ${processedCount} to database.`;
    console.log(`🏁 FINAL RESULT: ${completionMessage}`);
    
    writeSSE({
      type: 'completed',
      message: completionMessage,
      processedCount,
      totalEmails: totalToProcess,
      newEmails: newEmailsCount,
      skippedEmails: skippedCount,
      progress: 100
    });

  } catch (error) {
    console.error('Streaming sync error:', error);
    // Try to send error message, but don't throw if stream is closed
    writeSSE({
      type: 'error',
      error: 'Sync failed: ' + error.message
    });
  }
}

// Main streaming endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder') || 'INBOX';
  const limit = parseInt(searchParams.get('limit') || '500'); // Default to 500 newest emails
  const onlyUnread = searchParams.get('onlyUnread') !== 'false';

  const encoder = new TextEncoder();
  
  // Add abort controller for better cleanup
  const abortController = new AbortController();

  const customReadable = new ReadableStream({
    start(controller) {
      // Track if stream is manually closed
      let streamClosed = false;
      
      // Set up periodic keep-alive to prevent timeout
      const keepAliveInterval = setInterval(() => {
        try {
          if (controller.desiredSize !== null) {
            controller.enqueue(encoder.encode(`:keep-alive\n\n`));
          } else {
            clearInterval(keepAliveInterval);
          }
        } catch (e) {
          clearInterval(keepAliveInterval);
        }
      }, 30000); // Send keep-alive every 30 seconds
      
      // Start the streaming sync
      streamEmailSync(controller, encoder, folder, limit, onlyUnread)
        .then(() => {
          console.log('Stream sync completed successfully');
          clearInterval(keepAliveInterval);
          try {
            if (!streamClosed && controller.desiredSize !== null) {
              console.log('Closing controller after successful completion');
              controller.close();
            }
          } catch (error) {
            console.log('Controller already closed:', error.message);
          }
        })
        .catch((error) => {
          console.error('Stream error:', error);
          clearInterval(keepAliveInterval);
          try {
            if (!streamClosed && controller.desiredSize !== null) {
              console.log('Closing controller due to error');
              controller.error(error);
            }
          } catch (controllerError) {
            console.log('Controller already closed during error handling:', controllerError.message);
          }
        });
    },
    cancel() {
      console.log('Stream cancelled by client');
      abortController.abort();
    }
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  // For manual trigger via POST
  return GET(request);
}