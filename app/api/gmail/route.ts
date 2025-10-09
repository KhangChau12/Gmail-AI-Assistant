import { NextRequest, NextResponse } from 'next/server';
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
  assignEmailCategories,
  updateEmailReadStatus
} from '@/lib/db';
import { IMAPMessage } from '@/types';

// Content validation helper
interface ContentValidationResult {
  isValid: boolean;
  content: string;
  issues: string[];
}

function validateEmailContent(content: string, parseSuccess?: boolean): ContentValidationResult {
  const issues: string[] = [];
  let processedContent = content;
  
  // Check if parsing was successful
  if (parseSuccess === false) {
    issues.push('MIME parsing failed');
  }
  
  // Check content length
  if (!content || content.trim().length === 0) {
    issues.push('Empty content');
    processedContent = 'Email có thể chưa được tải đầy đủ hoặc không có nội dung.';
  } else if (content.trim().length < 10) {
    issues.push('Very short content');
  }
  
  // Check for raw MIME content that wasn't properly parsed
  if (content.includes('Content-Type:') && content.includes('Content-Transfer-Encoding:')) {
    issues.push('Contains raw MIME headers');
  }
  
  // Check for base64 patterns that weren't decoded
  const base64Pattern = /^[A-Za-z0-9+/]{50,}={0,2}$/m;
  if (base64Pattern.test(content)) {
    issues.push('Contains undecoded base64');
  }
  
  // Check for quoted-printable patterns
  const qpPattern = /=[0-9A-F]{2}/g;
  const qpMatches = content.match(qpPattern);
  if (qpMatches && qpMatches.length > content.length * 0.1) {
    issues.push('Contains undecoded quoted-printable');
  }
  
  // Check for non-printable characters
  const nonPrintableCount = (content.match(/[\x00-\x08\x0E-\x1F\x7F]/g) || []).length;
  if (nonPrintableCount > content.length * 0.05) {
    issues.push('Contains many non-printable characters');
  }
  
  // Check for excessive encoding artifacts
  if (content.includes('â[]') || content.includes('â€') || content.includes('Â ')) {
    issues.push('Contains encoding artifacts');
  }
  
  return {
    isValid: issues.length === 0,
    content: processedContent,
    issues
  };
}

// Helper functions to call AI API internally with proper typing
async function callClassifyAgent(
  email: { from: string; subject: string; body: string },
  categories: any[],
  assignments: any[]
) {
  try {
    const { classifyEmail } = await import('../ai-internal');
    return await classifyEmail(email, categories, assignments);
  } catch (error) {
    console.error('Classification agent error:', error);
    return { category_id: null, confidence: 0 };
  }
}

async function callSummaryAgent(emailBody: string) {
  try {
    const { summarizeEmail } = await import('../ai-internal');
    return await summarizeEmail(emailBody);
  } catch (error) {
    console.error('Summary agent error:', error);
    return { summary: 'Không thể tóm tắt email này.' };
  }
}

// Test Gmail connection
async function testConnection() {
  try {
    const result = await gmailClient.testConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Connection test failed:', error);
    return NextResponse.json(
      { error: 'Connection failed', details: error },
      { status: 500 }
    );
  }
}

// Get Gmail folders
async function getFolders() {
  try {
    const folders = await gmailClient.getFolders();
    return NextResponse.json(folders);
  } catch (error) {
    console.error('Get folders failed:', error);
    return NextResponse.json(
      { error: 'Failed to get folders', details: error },
      { status: 500 }
    );
  }
}

// Sync emails from specific folder
async function syncEmails(folder: string = 'INBOX', limit: number = 500) {
  try {
    console.log(`Syncing emails from ${folder}...`);
    
    // Get emails from Gmail IMAP (limit to 500 newest emails)
    const imapEmails = await gmailClient.getEmails(folder, limit);
    console.log(`Found ${imapEmails.length} emails in ${folder}`);

    // Get categories and assignments for AI classification
    const categories = await getCategories();
    const assignments = await getEmailAssignments();

    const processedEmails = [];
    
    for (const imapEmail of imapEmails) {
      // Check if email already processed
      const existing = await getEmailByImapUid(imapEmail.uid);
      
      if (existing) {
        processedEmails.push(existing);
        continue;
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
      
      // Log parsing issues for monitoring
      if (!contentValid.isValid) {
        console.warn(`Email parsing issue for UID ${imapEmail.uid}:`, contentValid.issues);
      }
      
      // Prepare email data for AI processing
      const emailForAI = {
        from: `${imapEmail.from.name || ''} <${imapEmail.from.address}>`,
        subject: imapEmail.subject,
        body: contentValid.content
      };

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

      // Determine if email is read from IMAP flags
      const isRead = imapEmail.flags.includes('\\Seen');

      // Save processed email with parsing metadata and read status
      const processedEmail = await createProcessedEmail({
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
        parsing_errors: contentValid.issues.length > 0 ? contentValid.issues : undefined,
        is_read: isRead  // Store actual read status from IMAP
      });

      processedEmails.push(processedEmail);
    }

    return NextResponse.json({
      success: true,
      folder,
      synced: processedEmails.length,
      emails: processedEmails
    });

  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error },
      { status: 500 }
    );
  }
}

// Send email via SMTP
async function sendEmail(to: string, subject: string, body: string, replyToMessageId?: string) {
  try {
    await gmailClient.sendEmail(to, subject, body, replyToMessageId);
    
    return NextResponse.json({
      success: true,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Send email failed:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error },
      { status: 500 }
    );
  }
}

// Mark email as read
async function markAsRead(uid: string, folder: string = 'INBOX') {
  try {
    // Mark as read in Gmail IMAP
    await gmailClient.markAsRead(uid, folder);

    // Also update the database to reflect the change
    await updateEmailReadStatus(uid, true);

    return NextResponse.json({
      success: true,
      message: 'Email marked as read'
    });
  } catch (error) {
    console.error('Mark as read failed:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read', details: error },
      { status: 500 }
    );
  }
}

// Move email to folder
async function moveToFolder(uid: string, targetFolder: string, sourceFolder: string = 'INBOX') {
  try {
    await gmailClient.moveToFolder(uid, targetFolder, sourceFolder);
    
    return NextResponse.json({
      success: true,
      message: `Email moved to ${targetFolder}`
    });
  } catch (error) {
    console.error('Move to folder failed:', error);
    return NextResponse.json(
      { error: 'Failed to move email', details: error },
      { status: 500 }
    );
  }
}

// Create Gmail label
async function createLabel(name: string) {
  try {
    await gmailClient.createLabel(name);
    
    return NextResponse.json({
      success: true,
      message: `Label "${name}" created successfully`
    });
  } catch (error) {
    console.error('Create label failed:', error);
    return NextResponse.json(
      { error: 'Failed to create label', details: error },
      { status: 500 }
    );
  }
}

// Get single email by UID
async function getEmailByUid(uid: string, folder: string = 'INBOX') {
  try {
    const email = await gmailClient.getEmailByUid(uid, folder);
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(email);
  } catch (error) {
    console.error('Get email failed:', error);
    return NextResponse.json(
      { error: 'Failed to get email', details: error },
      { status: 500 }
    );
  }
}

// Re-process emails that have raw MIME content
async function reprocessRawEmails(emailId?: string | null, imapUid?: string | null) {
  try {
    console.log('Re-processing emails with raw MIME content...');
    
    let emails: any[] = [];
    
    if (emailId && imapUid) {
      // Single email reprocessing
      console.log(`Re-processing single email: ${emailId} (UID: ${imapUid})`);
      const { data: email, error } = await import('@/lib/db').then(db => 
        db.supabase
          .from('processed_emails')
          .select('*')
          .eq('id', emailId)
          .single()
      );
      
      if (error) throw error;
      if (email) emails = [email];
    } else {
      // Batch reprocessing
      const { data: allEmails, error } = await import('@/lib/db').then(db => 
        db.supabase
          .from('processed_emails')
          .select('*')
          .order('processed_at', { ascending: false })
      );
      
      if (error) throw error;
      emails = allEmails || [];
    }
    
    let reprocessedCount = 0;
    const { updateProcessedEmail } = await import('@/lib/db');
    
    for (const email of emails) {
      // Check if email has raw MIME content or parsing issues
      const hasRawMime = (email.body_text?.includes('Content-Type:') && 
                         email.body_text?.includes('Content-Transfer-Encoding:')) ||
                        (email.body_html?.includes('Content-Type:') && 
                         email.body_html?.includes('Content-Transfer-Encoding:'));
      
      const hasParsingIssues = !email.body_text?.trim() || 
                              email.body_text?.includes('Content-Type:') ||
                              /=[0-9A-F]{2}/.test(email.body_text || '');
      
      if (hasRawMime || hasParsingIssues || emailId) {
        console.log(`Re-processing email ${email.id} with content issues`);
        
        try {
          // Get fresh email from IMAP with enhanced parsing
          const freshEmail = await gmailClient.getEmailByUid(email.imap_uid);
          
          if (freshEmail) {
            // Validate the new content
            const contentValid = validateEmailContent(
              freshEmail.bodyText || freshEmail.bodyHtml || '', 
              freshEmail.parseSuccess
            );
            
            // Generate new summary if content is valid
            let summary = email.summary;
            if (contentValid.isValid && contentValid.content.trim().length > 50) {
              try {
                const summaryResult = await callSummaryAgent(contentValid.content);
                if (summaryResult?.summary) {
                  summary = summaryResult.summary;
                }
              } catch (summaryError) {
                console.warn('Summary generation failed during reprocessing:', summaryError);
              }
            }
            
            // Determine new parsing status
            const newParsingStatus = contentValid.isValid ? 'success' : 
                                   (contentValid.content && contentValid.content.trim().length > 10) ? 'partial' : 'failed';
            
            const newContentLength = (freshEmail.bodyText || '').length + (freshEmail.bodyHtml || '').length;
            
            // Update the database with reprocessed content
            await updateProcessedEmail(email.id, {
              body_text: freshEmail.bodyText,
              body_html: freshEmail.bodyHtml,
              summary: summary,
              parsing_status: newParsingStatus,
              content_length: newContentLength,
              parsing_errors: contentValid.issues.length > 0 ? contentValid.issues : null,
              last_reprocessed: new Date().toISOString()
            });
            
            reprocessedCount++;
            console.log(`Updated email ${email.id} with reprocessed content`);
          }
        } catch (emailError) {
          console.error(`Failed to reprocess email ${email.id}:`, emailError);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: emailId 
        ? `Re-processed email successfully`
        : `Re-processed ${reprocessedCount} emails with content issues`,
      reprocessedCount
    });
    
  } catch (error) {
    console.error('Re-process emails failed:', error);
    return NextResponse.json(
      { error: 'Failed to re-process emails', details: error },
      { status: 500 }
    );
  }
}

// Main API Route Handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'test':
      return testConnection();
    
    case 'folders':
      return getFolders();
    
    case 'email':
      const uid = searchParams.get('uid');
      const folder = searchParams.get('folder') || 'INBOX';
      if (!uid) {
        return NextResponse.json({ error: 'UID required' }, { status: 400 });
      }
      return getEmailByUid(uid, folder);
    
    case 'reprocess':
      const emailId = searchParams.get('emailId');
      const imapUid = searchParams.get('imapUid');
      return reprocessRawEmails(emailId, imapUid);
    
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'sync':
        return syncEmails(params.folder, params.limit);
      
      case 'send':
        return sendEmail(
          params.to,
          params.subject,
          params.body,
          params.replyToMessageId
        );
      
      case 'markRead':
        return markAsRead(params.uid, params.folder);
      
      case 'move':
        return moveToFolder(params.uid, params.targetFolder, params.sourceFolder);
      
      case 'createLabel':
        return createLabel(params.name);
      
      case 'reprocess':
        return reprocessRawEmails(params.emailId, params.imapUid);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Gmail API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}