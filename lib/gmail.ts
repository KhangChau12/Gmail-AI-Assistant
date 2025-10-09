import { ImapFlow } from 'imapflow';
import * as nodemailer from 'nodemailer';
import { GmailCredentials, IMAPMessage, IMAPFolder } from '@/types';
import { processEmailContent } from './encoding-fix';

export class GmailClient {
  private imapClient: ImapFlow | null = null;
  private smtpTransporter: nodemailer.Transporter | null = null;
  private credentials: GmailCredentials;

  constructor() {
    this.credentials = {
      email: process.env.GMAIL_ADDRESS!,
      appPassword: process.env.GMAIL_APP_PASSWORD!
    };
  }

  // IMAP Connection
  async connectIMAP(): Promise<void> {
    if (this.imapClient) {
      try {
        await this.imapClient.getQuota();
        return; // Already connected
      } catch {
        // Connection lost, disconnect and reconnect
        try {
          await this.imapClient.logout();
        } catch {
          // Ignore logout errors
        }
        this.imapClient = null;
      }
    }

    this.imapClient = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: this.credentials.email,
        pass: this.credentials.appPassword
      },
      logger: false,
      // More conservative timeout settings to prevent drops  
      socketTimeout: 2 * 60 * 1000, // 2 minutes socket timeout
      greetingTimeout: 30 * 1000, // 30 seconds greeting timeout
      connectionTimeout: 60 * 1000 // 1 minute connection timeout
    });

    await this.imapClient.connect();
    console.log('IMAP connected successfully with enhanced timeout settings');
  }

  async disconnectIMAP(): Promise<void> {
    if (this.imapClient) {
      try {
        // Check if connection is still active before logout
        if (!this.imapClient.usable) {
          console.log('IMAP connection not usable, forcing cleanup');
        } else {
          await this.imapClient.logout();
        }
      } catch (error) {
        console.log('Error during IMAP logout (connection may be already closed):', error.message);
      } finally {
        this.imapClient = null;
      }
    }
  }

  // SMTP Connection
  async connectSMTP(): Promise<void> {
    if (this.smtpTransporter) {
      try {
        await this.smtpTransporter.verify();
        return; // Already connected
      } catch {
        // Connection lost, reconnect
      }
    }

    this.smtpTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: this.credentials.email,
        pass: this.credentials.appPassword
      },
      debug:true,
      logger:true
    });

    await this.smtpTransporter.verify();
    console.log('SMTP connected successfully');
  }

  // Get Gmail folders
  async getFolders(): Promise<IMAPFolder[]> {
    await this.connectIMAP();
    if (!this.imapClient) throw new Error('IMAP not connected');

    const folders = await this.imapClient.list();
    return folders.map(folder => ({
      name: folder.name,
      path: folder.path,
      delimiter: folder.delimiter,
      flags: Array.from(folder.flags),
      specialUse: folder.specialUse
    }));
  }

  // Get emails from specific folder with improved retry logic
  async getEmails(folder: string = 'INBOX', limit: number = 0): Promise<IMAPMessage[]> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} to fetch emails from ${folder}`);
        
        // Force fresh connection on retry attempts
        if (attempt > 1) {
          await this.disconnectIMAP();
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
        }
        
        await this.connectIMAP();
        if (!this.imapClient) throw new Error('IMAP not connected');

        const lock = await this.imapClient.getMailboxLock(folder);
        try {
          const mailbox = await this.imapClient.mailboxOpen(folder);
          console.log(`Mailbox ${folder} has ${mailbox.exists} emails total, requested limit: ${limit}`);
          console.log('Mailbox info:', {
            exists: mailbox.exists,
            flags: mailbox.flags,
            permanentFlags: mailbox.permanentFlags,
            uidNext: mailbox.uidNext,
            uidValidity: mailbox.uidValidity,
            highestModseq: mailbox.highestModseq
          });
          
          // For large mailboxes, use batched fetching to prevent timeouts
          // But respect the limit parameter (default limit is now 500)
          if (mailbox.exists > 500 && limit === 0) {
            console.log('Large mailbox detected, using batched fetching approach for all emails');
            return await this.getBatchedEmails(folder, mailbox.exists);
          } else if (mailbox.exists > 500 && limit >= 500) {
            console.log(`Large mailbox detected, using batched fetching for ${limit} newest emails`);
            return await this.getBatchedEmails(folder, limit);
          }
          
          // Use UID-based fetching to get ALL emails including newest ones
          let fetchQuery: string;
          let useUidFetch = true;
          
          if (limit > 0) {
            // For limited fetch, get UIDs close to the highest UID
            const maxUid = mailbox.uidNext - 1;
            const startUid = Math.max(1, maxUid - limit * 3); // Get 3x more than needed to account for gaps
            fetchQuery = `${startUid}:${maxUid}`;
            console.log(`Getting latest ${limit} emails using UID range: ${startUid}:${maxUid}`);
          } else {
            // Get ALL emails using UID range from 1 to uidNext-1
            const maxUid = mailbox.uidNext - 1;
            fetchQuery = `1:${maxUid}`;
            console.log(`Getting ALL emails using UID range: 1:${maxUid}`);
          }
          
          console.log(`Using UID fetch query: ${fetchQuery} (total exists: ${mailbox.exists})`);
          console.log(`IMAP uidNext: ${mailbox.uidNext} (next UID that will be assigned)`);
          console.log(`Expected to fetch UIDs: 1 to ${mailbox.uidNext - 1}`);
            
          const messages = await this.imapClient.fetch(fetchQuery, {
            envelope: true,
            bodyStructure: true,
            source: true,
            flags: true
          }, { uid: true });
          
          console.log('Fetching messages with UIDs...');

          const emails: IMAPMessage[] = [];
          const allMessages: any[] = [];
          
          // First, collect all messages
          for await (let message of messages) {
            allMessages.push(message);
          }
          
          // Sort by UID descending (newest first) and take limit if specified
          allMessages.sort((a, b) => Number(b.uid) - Number(a.uid));
          const messagesToProcess = limit > 0 ? allMessages.slice(0, limit) : allMessages;
          
          console.log(`Collected ${allMessages.length} messages, processing ${messagesToProcess.length}`);
          if (allMessages.length > 0) {
            console.log(`UID range found: ${allMessages[allMessages.length-1].uid} to ${allMessages[0].uid}`);
          }

          for (let message of messagesToProcess) {
        const uid = message.uid.toString();
        const envelope = message.envelope;
        
        // Parse email content with proper UTF-8 encoding
        const sourceBuffer = message.source;
        const source = sourceBuffer ? sourceBuffer.toString('utf8') : '';
        const { bodyText, bodyHtml, parseSuccess } = this.parseEmailBody(source);

        const email: IMAPMessage = {
          uid,
          messageId: envelope.messageId,
          from: {
            name: envelope.from?.[0]?.name || undefined,
            address: envelope.from?.[0]?.address || ''
          },
          to: envelope.to?.map(addr => ({
            name: addr.name || undefined,
            address: addr.address || ''
          })) || [],
          subject: processEmailContent(envelope.subject || 'No Subject'),
          date: envelope.date || new Date(),
          bodyText: processEmailContent(bodyText),
          bodyHtml: processEmailContent(bodyHtml),
          parseSuccess,
          flags: (() => {
            if (!message.flags) return [];
            if (Array.isArray(message.flags)) return message.flags;
            if (message.flags instanceof Set) return Array.from(message.flags);
            return [];
          })()
        };

        emails.push(email);
      }

        console.log(`Found ${emails.length} emails in ${folder}`);
        return emails; // Already sorted newest first by UID
        } finally {
          lock.release();
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        lastError = error as Error;
        
        // Force reconnection on next attempt
        if (this.imapClient) {
          try {
            await this.imapClient.logout();
          } catch {
            // Ignore logout errors
          }
          this.imapClient = null;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to fetch emails after all retries');
  }

  // Batched email fetching - process ALL requested emails in smaller chunks  
  private async getBatchedEmails(folder: string, emailLimit: number): Promise<IMAPMessage[]> {
    const BATCH_SIZE = 50; // Process emails in chunks of 50
    const emails: IMAPMessage[] = [];
    
    // Get mailbox info to determine UID range for newest emails
    const mailbox = await this.imapClient!.mailboxOpen(folder);
    const maxUid = mailbox.uidNext - 1;
    
    console.log(`Processing ${emailLimit} newest emails in batches of ${BATCH_SIZE}`);
    console.log(`Mailbox contains ${mailbox.exists} emails, max UID: ${maxUid}`);
    
    // Calculate UID range to target the newest emails
    let startUid: number;
    if (emailLimit > 0 && emailLimit < mailbox.exists) {
      // Get a wider range to account for UID gaps, then filter to newest emails
      startUid = Math.max(1, maxUid - emailLimit * 2);
    } else {
      startUid = 1;
    }
    
    console.log(`Target UID range: ${startUid} to ${maxUid}`);
    
    // First, get all UIDs in the target range to work with
    const lock = await this.imapClient!.getMailboxLock(folder);
    let allTargetUids: number[] = [];
    
    try {
      console.log('Fetching UIDs in target range...');
      const uidMessages = await this.imapClient!.fetch(`${startUid}:${maxUid}`, { uid: true }, { uid: true });
      
      for await (let msg of uidMessages) {
        allTargetUids.push(Number(msg.uid));
      }
      
      // Sort by UID descending (newest first) and take exactly what we need
      allTargetUids.sort((a, b) => b - a);
      if (emailLimit > 0 && allTargetUids.length > emailLimit) {
        allTargetUids = allTargetUids.slice(0, emailLimit);
      }
      
      console.log(`Found ${allTargetUids.length} UIDs to process`);
      console.log(`UID range to process: ${allTargetUids[allTargetUids.length-1]} to ${allTargetUids[0]}`);
      
    } finally {
      lock.release();
    }
    
    // Process UIDs in batches of BATCH_SIZE
    for (let i = 0; i < allTargetUids.length; i += BATCH_SIZE) {
      const batchUids = allTargetUids.slice(i, i + BATCH_SIZE);
      const batchStart = i + 1;
      const batchEnd = Math.min(i + BATCH_SIZE, allTargetUids.length);
      
      console.log(`Processing batch ${Math.ceil(batchStart/BATCH_SIZE)}/${Math.ceil(allTargetUids.length/BATCH_SIZE)} (emails ${batchStart}-${batchEnd})`);
      
      try {
        const batchEmails = await this.fetchEmailChunk(folder, batchUids);
        emails.push(...batchEmails);
        
        console.log(`Batch completed: ${batchEmails.length} emails processed`);
        
        // Small delay between batches to prevent overwhelming the connection
        if (i + BATCH_SIZE < allTargetUids.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Error processing batch ${Math.ceil(batchStart/BATCH_SIZE)}:`, error);
        
        // Try to reconnect and retry this batch once
        try {
          console.log('Reconnecting and retrying batch...');
          await this.disconnectIMAP();
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.connectIMAP();
          
          const batchEmails = await this.fetchEmailChunk(folder, batchUids);
          emails.push(...batchEmails);
          console.log(`Batch retry successful: ${batchEmails.length} emails processed`);
          
        } catch (retryError) {
          console.error(`Batch retry also failed:`, retryError);
          // Continue with next batch instead of failing completely
        }
      }
    }
    
    // Sort final results by UID descending (newest first)
    emails.sort((a, b) => Number(b.uid) - Number(a.uid));
    
    console.log(`Completed batched processing: ${emails.length} emails total`);
    return emails;
  }

  // Fetch a specific chunk of emails by UIDs
  private async fetchEmailChunk(folder: string, uids: number[]): Promise<IMAPMessage[]> {
    if (uids.length === 0) return [];
    
    const emails: IMAPMessage[] = [];
    const uidRange = uids.join(','); // Use comma-separated UIDs for precise fetching
    
    const lock = await this.imapClient!.getMailboxLock(folder);
    try {
      const messages = await this.imapClient!.fetch(uidRange, {
        envelope: true,
        bodyStructure: true,
        source: true,
        flags: true
      }, { uid: true });
      
      for await (let message of messages) {
        const uid = message.uid.toString();
        const envelope = message.envelope;
        
        // Parse email content with proper UTF-8 encoding
        const sourceBuffer = message.source;
        const source = sourceBuffer ? sourceBuffer.toString('utf8') : '';
        const { bodyText, bodyHtml, parseSuccess } = this.parseEmailBody(source);

        const email: IMAPMessage = {
          uid,
          messageId: envelope.messageId,
          from: {
            name: envelope.from?.[0]?.name || undefined,
            address: envelope.from?.[0]?.address || ''
          },
          to: envelope.to?.map(addr => ({
            name: addr.name || undefined,
            address: addr.address || ''
          })) || [],
          subject: processEmailContent(envelope.subject || 'No Subject'),
          date: envelope.date || new Date(),
          bodyText: processEmailContent(bodyText),
          bodyHtml: processEmailContent(bodyHtml),
          parseSuccess,
          flags: (() => {
            if (!message.flags) return [];
            if (Array.isArray(message.flags)) return message.flags;
            if (message.flags instanceof Set) return Array.from(message.flags);
            return [];
          })()
        };

        emails.push(email);
      }
    } finally {
      lock.release();
    }
    
    return emails;
  }

  // Get single email by UID
  async getEmailByUid(uid: string, folder: string = 'INBOX'): Promise<IMAPMessage | null> {
    await this.connectIMAP();
    if (!this.imapClient) throw new Error('IMAP not connected');

    const lock = await this.imapClient.getMailboxLock(folder);
    try {
      const messages = await this.imapClient.fetch(uid, {
        envelope: true,
        bodyStructure: true,
        source: true,
        flags: true
      }, { uid: true });

      for await (let message of messages) {
        const envelope = message.envelope;
        // Parse with proper UTF-8 encoding
        const sourceBuffer = message.source;
        const source = sourceBuffer ? sourceBuffer.toString('utf8') : '';
        const { bodyText, bodyHtml, parseSuccess } = this.parseEmailBody(source);

        return {
          uid: message.uid.toString(),
          messageId: envelope.messageId,
          from: {
            name: envelope.from?.[0]?.name || undefined,
            address: envelope.from?.[0]?.address || ''
          },
          to: envelope.to?.map(addr => ({
            name: addr.name || undefined,
            address: addr.address || ''
          })) || [],
          subject: envelope.subject || 'No Subject',
          date: envelope.date || new Date(),
          bodyText,
          bodyHtml,
          parseSuccess,
          flags: (() => {
            if (!message.flags) return [];
            if (Array.isArray(message.flags)) return message.flags;
            if (message.flags instanceof Set) return Array.from(message.flags);
            return [];
          })()
        };
      }

      return null;
    } finally {
      lock.release();
    }
  }

  // Mark email as read
  async markAsRead(uid: string, folder: string = 'INBOX'): Promise<void> {
    await this.connectIMAP();
    if (!this.imapClient) throw new Error('IMAP not connected');

    const lock = await this.imapClient.getMailboxLock(folder);
    try {
      await this.imapClient.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  }

  // Move email to folder
  async moveToFolder(uid: string, targetFolder: string, sourceFolder: string = 'INBOX'): Promise<void> {
    await this.connectIMAP();
    if (!this.imapClient) throw new Error('IMAP not connected');

    const lock = await this.imapClient.getMailboxLock(sourceFolder);
    try {
      await this.imapClient.messageMove(uid, targetFolder, { uid: true });
    } finally {
      lock.release();
    }
  }

  // Create Gmail label
  async createLabel(name: string): Promise<void> {
    await this.connectIMAP();
    if (!this.imapClient) throw new Error('IMAP not connected');

    try {
      await this.imapClient.mailboxCreate(name);
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  // Send email via SMTP
  async sendEmail(to: string, subject: string, bodyHtml: string, replyToMessageId?: string): Promise<void> {
    await this.connectSMTP();
    if (!this.smtpTransporter) throw new Error('SMTP not connected');

    const mailOptions: any = {
      from: this.credentials.email,
      to,
      subject,
      html: bodyHtml
    };

    if (replyToMessageId) {
      mailOptions.inReplyTo = replyToMessageId;
      mailOptions.references = replyToMessageId;
    }

    await this.smtpTransporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  }

  // Parse email body from raw source with improved MIME handling
  private parseEmailBody(source: string): { bodyText?: string; bodyHtml?: string; parseSuccess: boolean } {
    try {
      // First, let's check if this is already parsed content (not raw MIME)
      if (!source.includes('Content-Type:') && !source.includes('boundary=')) {
        // Basic content validation
        const isValidContent = source.trim().length > 0 && !source.includes('\x00');
        return { 
          bodyText: source, 
          parseSuccess: isValidContent 
        };
      }

      // Enhanced header-body split with multiple strategies
      let headers = '';
      let body = '';
      
      // Strategy 1: Double newline split
      const doubleLfSplit = source.split(/\r?\n\r?\n/);
      if (doubleLfSplit.length >= 2) {
        headers = doubleLfSplit[0];
        body = doubleLfSplit.slice(1).join('\n\n');
      } else {
        // Strategy 2: Find first empty line
        const lines = source.split(/\r?\n/);
        let headerEnd = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === '') {
            headerEnd = i;
            break;
          }
        }
        
        if (headerEnd === -1) {
          // Strategy 3: Look for content-type boundary as header end
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes('content-type:') && 
                i + 1 < lines.length && 
                !lines[i + 1].startsWith(' ') && 
                !lines[i + 1].startsWith('\t')) {
              headerEnd = i;
              break;
            }
          }
        }
        
        if (headerEnd === -1) {
          console.warn('Could not find header-body boundary, treating as plain text');
          return { 
            bodyText: source.replace(/^[^\n]*Content-Type:[^\n]*\n/gm, '').trim(),
            parseSuccess: true 
          };
        }
        
        headers = lines.slice(0, headerEnd).join('\n');
        body = lines.slice(headerEnd + 1).join('\n');
      }
      
      // Additional validation for malformed headers
      if (headers.length < 50 || !headers.includes(':')) {
        console.warn('Headers appear malformed, length:', headers.length);
        // Try to find actual headers in the content
        const headerMatch = source.match(/^((?:[A-Za-z-]+:\s*[^\n\r]*[\n\r]+)+)[\n\r]*([\s\S]*)$/);
        if (headerMatch) {
          headers = headerMatch[1];
          body = headerMatch[2];
          console.log('Recovered headers using regex pattern');
        } else {
          // Last resort: treat as plain text
          return { 
            bodyText: source.trim(),
            parseSuccess: false 
          };
        }
      }
      
      const result = this.parseEmailContent(headers, body);
      
      // Validate parsing success
      const hasValidContent = (result.bodyText && result.bodyText.trim().length > 10) || 
                             (result.bodyHtml && result.bodyHtml.trim().length > 10);
      
      // If parsing failed completely, try to extract any readable text from the source
      if (!hasValidContent) {
        console.warn('Email parsing failed to extract content, trying fallback extraction');
        const fallbackText = this.extractFallbackContent(source);
        if (fallbackText && fallbackText.trim().length > 10) {
          return {
            bodyText: fallbackText,
            parseSuccess: false // Mark as failed parsing but with fallback content
          };
        }
      }
      
      return {
        ...result,
        parseSuccess: hasValidContent
      };
      
    } catch (error) {
      console.error('Error parsing email body:', error);
      return { 
        bodyText: this.extractFallbackContent(source),
        parseSuccess: false 
      };
    }
  }

  // Extract usable content when parsing fails
  private extractFallbackContent(source: string): string {
    try {
      console.log('Attempting fallback content extraction...');
      
      // Strategy 1: Look for plain text content in the source
      const lines = source.split(/\r?\n/);
      let potentialContent: string[] = [];
      let inHeaders = true;
      
      for (const line of lines) {
        // Skip header section
        if (inHeaders) {
          if (line.trim() === '') {
            inHeaders = false;
          }
          continue;
        }
        
        // Skip MIME boundaries and headers
        if (line.startsWith('--') || 
            line.match(/^Content-[^:]+:/i) ||
            line.match(/^[A-Za-z-]+:\s/)) {
          continue;
        }
        
        // Look for actual text content
        const trimmed = line.trim();
        if (trimmed.length > 5 && 
            !trimmed.match(/^[A-Za-z0-9+/=]{20,}$/) && // Skip base64
            !trimmed.match(/^=[0-9A-F]{2}/) && // Skip quoted-printable encoding
            trimmed.includes(' ')) { // Likely readable text
          potentialContent.push(trimmed);
        }
      }
      
      let extractedText = potentialContent.join('\n').trim();
      
      // Strategy 2: If no readable text found, try to extract from any quoted-printable or base64
      if (extractedText.length < 20) {
        console.log('No readable text found, trying content decoding...');
        
        // Look for base64 blocks
        const base64Blocks = source.match(/([A-Za-z0-9+/]{50,}={0,2})/g);
        if (base64Blocks) {
          for (const block of base64Blocks) {
            try {
              const decoded = Buffer.from(block.replace(/\s/g, ''), 'base64').toString('utf8');
              if (decoded.length > 20 && decoded.includes(' ') && !decoded.includes('\x00')) {
                extractedText = decoded;
                console.log('Successfully extracted text from base64');
                break;
              }
            } catch {
              // Continue to next block
            }
          }
        }
        
        // Look for quoted-printable content
        if (extractedText.length < 20) {
          const qpContent = source.match(/((?:=[0-9A-F]{2}|\S)+(?:\s+(?:=[0-9A-F]{2}|\S)+)*)/g);
          if (qpContent) {
            for (const qp of qpContent) {
              if (qp.includes('=')) {
                try {
                  const decoded = this.decodeQuotedPrintable(qp);
                  if (decoded.length > 20 && decoded.includes(' ')) {
                    extractedText = decoded;
                    console.log('Successfully extracted text from quoted-printable');
                    break;
                  }
                } catch {
                  // Continue to next content
                }
              }
            }
          }
        }
      }
      
      // Clean up the extracted content
      extractedText = extractedText
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (extractedText.length > 10) {
        console.log(`Fallback extraction successful, extracted ${extractedText.length} characters`);
        return extractedText;
      }
      
      return 'Email content could not be parsed properly.';
    } catch (error) {
      console.error('Fallback extraction failed:', error);
      return 'Email content parsing failed.';
    }
  }

  // Extract email content based on headers and body
  private parseEmailContent(headers: string, body: string, overrideContentType?: string, overrideEncoding?: string): { bodyText?: string; bodyHtml?: string } {
    
    // Use override values if provided, otherwise parse from headers
    let contentType = overrideContentType || '';
    let encoding = overrideEncoding || '';
    
    if (!contentType) {
      const contentTypeMatch = headers.match(/^content-type:\s*([^;\n\r]+)/im);
      contentType = contentTypeMatch?.[1]?.toLowerCase().trim() || '';
    }
    
    if (!encoding) {
      const encodingMatch = headers.match(/^content-transfer-encoding:\s*([^\n\r;]+)/im);
      encoding = encodingMatch?.[1]?.toLowerCase().trim() || '';
    }
    
    // Handle malformed headers where content-type line is corrupted
    if (!overrideContentType && (contentType.includes(':') || contentType.length > 50)) {
      console.warn('Malformed content-type detected:', contentType);
      // Try to extract a valid content type from the corrupted string
      const validTypeMatch = contentType.match(/(text\/plain|text\/html|multipart\/\w+|application\/\w+)/);
      if (validTypeMatch) {
        console.log('Extracted valid content type:', validTypeMatch[1]);
        contentType = validTypeMatch[1];
      } else {
        // Default to text/plain for unknown types
        console.log('Defaulting to text/plain for malformed header');
        return { bodyText: body.trim() };
      }
    }
    
    
    // Enhanced boundary detection with multiple patterns
    let boundary = null;
    const boundaryPatterns = [
      /boundary[=:]\s*"([^"]+)"/i,           // quoted boundary
      /boundary[=:]\s*([^";\n\r\s]+)/i,     // unquoted boundary
      /boundary[=:]\s*([^;\n\r]+)/i         // flexible boundary
    ];
    
    for (const pattern of boundaryPatterns) {
      const match = headers.match(pattern);
      if (match && match[1]) {
        boundary = match[1].trim();
        break;
      }
    }
    
    if (contentType.includes('multipart') && boundary) {
      const multipartResult = this.parseMultipartBody(body, '--' + boundary);
      return {
        bodyText: multipartResult.text,
        bodyHtml: multipartResult.html
      };
    } else {
      // Single part email - decode the content with enhanced error handling
      let content = body.trim();
      
      // Decode based on encoding with better error recovery
      if (encoding === 'base64') {
        content = this.decodeBase64Content(content);
      } else if (encoding === 'quoted-printable') {
        content = this.decodeQuotedPrintable(content);
      } else if (encoding === '7bit' || encoding === '8bit') {
        // Content should already be readable
        content = content;
      }
      
      // Content type specific handling
      if (contentType.includes('text/html')) {
        return {
          bodyHtml: content,
          bodyText: this.htmlToText(content)
        };
      } else if (contentType.includes('text/plain') || contentType === '') {
        return { bodyText: content };
      } else {
        // Unknown content type, try to extract readable text
        console.warn('Unknown content type:', contentType);
        return { bodyText: content };
      }
    }
  }

  // Enhanced base64 decoding with error recovery
  private decodeBase64Content(content: string): string {
    try {
      
      // Clean the base64 content more thoroughly
      let cleanBase64 = content
        .replace(/[\r\n\s]/g, '')           // Remove whitespace
        .replace(/[^A-Za-z0-9+/=]/g, '');   // Remove invalid base64 chars
      
      // Ensure proper padding
      while (cleanBase64.length % 4 !== 0) {
        cleanBase64 += '=';
      }
      
      // Explicitly use UTF-8 decoding
      const buffer = Buffer.from(cleanBase64, 'base64');
      const decoded = buffer.toString('utf8');
      
      // Validate decoded content
      if (decoded.length > 0 && !decoded.includes('\x00') && decoded.trim().length > 0) {
        // Apply encoding fix for double-encoded text
        return processEmailContent(decoded);
      } else {
        return content; // Return original if decoded content is suspicious
      }
      
    } catch (e) {
      console.warn('Failed to decode base64 content:', e);
      
      // Try alternative decoding strategies
      try {
        // Maybe it's chunked base64, try removing more patterns
        const chunks = content.split(/\r?\n/);
        const concatenated = chunks.join('').replace(/[^A-Za-z0-9+/=]/g, '');
        const buffer = Buffer.from(concatenated, 'base64');
        const decoded = buffer.toString('utf8');
        
        if (decoded.length > 0 && decoded.trim().length > 0) {
          console.log('Successfully decoded chunked base64');
          // Apply encoding fix for double-encoded text
          return processEmailContent(decoded);
        }
      } catch (e2) {
        console.warn('Alternative base64 decoding also failed:', e2);
      }
      
      return content; // Return original content as last resort
    }
  }
  
  // Parse multipart email body
  private parseMultipartBody(body: string, boundary: string): { text?: string; html?: string } {
    const parts = body.split(boundary);
    let text: string | undefined;
    let html: string | undefined;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const trimmedPart = part.trim();
      
      // Skip empty parts and boundary delimiters
      if (trimmedPart === '' || trimmedPart === '--' || trimmedPart.startsWith('--')) {
        continue;
      }
      
      // Split part into headers and body
      const partSplit = part.split(/\r?\n\r?\n/);
      if (partSplit.length < 2) {
        continue;
      }
      
      const partHeaders = partSplit[0];
      const partBody = partSplit.slice(1).join('\n\n').trim();
      
      // Parse content type and encoding for this part
      const partContentTypeMatch = partHeaders.match(/content-type:\s*([^;\n\r]+)/i);
      const partContentType = partContentTypeMatch?.[1]?.toLowerCase().trim() || '';
      
      const partEncodingMatch = partHeaders.match(/content-transfer-encoding:\s*([^\n\r]+)/i);
      const partEncoding = partEncodingMatch?.[1]?.toLowerCase().trim() || '';
      
      // Skip non-text content types to avoid wasting time
      if (partContentType.includes('image/') || 
          partContentType.includes('application/') ||
          partContentType.includes('video/') ||
          partContentType.includes('audio/')) {
        continue;
      }
      
      // Handle nested multipart (like multipart/alternative inside multipart/related)
      if (partContentType.includes('multipart/')) {
        const nestedBoundaryMatch = partHeaders.match(/boundary[=:]\s*"?([^";\n\r\s]+)"?/i);
        if (nestedBoundaryMatch) {
          const nestedBoundary = '--' + nestedBoundaryMatch[1].trim();
          const nestedResult = this.parseMultipartBody(partBody, nestedBoundary);
          if (nestedResult.text && !text) text = nestedResult.text;
          if (nestedResult.html && !html) html = nestedResult.html;
        }
        continue;
      }
      
      let content = partBody;
      
      // Decode based on encoding using enhanced methods
      if (partEncoding === 'base64') {
        const decoded = this.decodeBase64Content(content);
        if (decoded === content) {
          // Base64 decoding failed, skip this part
          continue;
        }
        content = decoded;
      } else if (partEncoding === 'quoted-printable') {
        content = this.decodeQuotedPrintable(content);
      }
      
      // Assign to appropriate type based on content type
      if (partContentType.includes('text/plain')) {
        text = content;
      } else if (partContentType.includes('text/html')) {
        html = content;
      }
      
      // Break early if we have both text and html
      if (text && html) {
        break;
      }
    }
    
    // If we have HTML but no text, generate text version
    if (html && !text) {
      text = this.htmlToText(html);
    }
    
    return { text, html };
  }
  
  // Decode quoted-printable encoding with proper UTF-8 support
  private decodeQuotedPrintable(input: string): string {
    try {
      // First, handle soft line breaks
      let decoded = input.replace(/=\r?\n/g, '');
      
      // Then decode hex sequences to bytes
      const bytes: number[] = [];
      let i = 0;
      
      while (i < decoded.length) {
        if (decoded[i] === '=' && i + 2 < decoded.length) {
          const hex = decoded.substr(i + 1, 2);
          if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
            bytes.push(parseInt(hex, 16));
            i += 3;
          } else {
            // Not a valid hex sequence, keep the character
            bytes.push(decoded.charCodeAt(i));
            i++;
          }
        } else {
          // Regular character
          bytes.push(decoded.charCodeAt(i));
          i++;
        }
      }
      
      // Convert bytes to UTF-8 string and fix any double-encoding
      const decodedText = Buffer.from(bytes).toString('utf8');
      return processEmailContent(decodedText);
    } catch (e) {
      console.warn('Failed to decode quoted-printable:', e);
      // Fallback to simple decoding
      return input
        .replace(/=([0-9A-Fa-f]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/=\r?\n/g, '');
    }
  }
  
  // Convert HTML to plain text
  private htmlToText(html: string): string {
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Test connection
  async testConnection(): Promise<{ imap: boolean; smtp: boolean }> {
    const result = { imap: false, smtp: false };

    try {
      await this.connectIMAP();
      result.imap = true;
    } catch (error) {
      console.error('IMAP connection failed:', error);
    }

    try {
      await this.connectSMTP();
      result.smtp = true;
    } catch (error) {
      console.error('SMTP connection failed:', error);
    }

    return result;
  }
}

// Singleton instance
export const gmailClient = new GmailClient();