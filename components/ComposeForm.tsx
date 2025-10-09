'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Save, X, UserPlus, Paperclip, Smile, Bold, Italic, Underline, List, Link } from 'lucide-react';
import { Draft, Contact, ProcessedEmail, ComposeResponse } from '@/types';
import { cn, debounce, isValidEmail } from '@/lib/utils';

interface ComposeFormProps {
  initialDraft?: Partial<Draft>;
  replyToEmail?: ProcessedEmail;
  onSave?: (draft: Draft) => void;
  onSend?: (emailData: { to: string; subject: string; body: string; replyToMessageId?: string }) => void;
  onClose?: () => void;
  className?: string;
}

export default function ComposeForm({
  initialDraft,
  replyToEmail,
  onSave,
  onSend,
  onClose,
  className
}: ComposeFormProps) {
  const [toEmail, setToEmail] = useState(initialDraft?.to_email || '');
  const [toName, setToName] = useState(initialDraft?.to_name || '');
  const [subject, setSubject] = useState(initialDraft?.subject || '');
  const [body, setBody] = useState(initialDraft?.body || '');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState(initialDraft?.id);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContacts();
    
    // Setup reply if needed
    if (replyToEmail && !initialDraft) {
      setToEmail(replyToEmail.sender_email || '');
      setToName(replyToEmail.sender_name || '');
      setSubject(replyToEmail.subject?.startsWith('Re: ') 
        ? replyToEmail.subject 
        : `Re: ${replyToEmail.subject}`
      );
      
      // Add quoted original email
      const quotedBody = `\n\n--- Email gốc ---\nTừ: ${replyToEmail.sender_name || replyToEmail.sender_email}\nTiêu đề: ${replyToEmail.subject}\n\n${replyToEmail.body_text || replyToEmail.body_html || ''}`;
      setBody(quotedBody);
    }
  }, [replyToEmail, initialDraft]);

  // Auto-save functionality
  const debouncedSave = debounce(async () => {
    if (toEmail && subject) {
      await handleSave();
    }
  }, 2000);

  useEffect(() => {
    if (toEmail || subject || body) {
      debouncedSave();
    }
  }, [toEmail, subject, body]);

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/db?resource=contacts');
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const handleToEmailChange = (value: string) => {
    setToEmail(value);
    
    if (value.length > 0) {
      const filtered = contacts.filter(contact => 
        contact.name.toLowerCase().includes(value.toLowerCase()) ||
        contact.email.toLowerCase().includes(value.toLowerCase()) ||
        contact.aliases.some(alias => alias.toLowerCase().includes(value.toLowerCase()))
      );
      setFilteredContacts(filtered);
      setShowContactSuggestions(filtered.length > 0);
    } else {
      setShowContactSuggestions(false);
    }
  };

  const selectContact = (contact: Contact) => {
    setToEmail(contact.email);
    setToName(contact.name);
    setShowContactSuggestions(false);
  };

  const handleSave = async () => {
    if (!toEmail || !subject) return;

    setIsSaving(true);
    try {
      const draftData = {
        to_email: toEmail,
        to_name: toName,
        subject,
        body,
        reply_to_message_id: replyToEmail?.message_id,
        version: 1
      };

      let response;
      if (currentDraftId) {
        // Update existing draft
        response = await fetch('/api/db?resource=drafts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentDraftId, ...draftData })
        });
      } else {
        // Create new draft
        response = await fetch('/api/db?resource=drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData)
        });
      }

      if (response.ok) {
        const savedDraft = await response.json();
        setCurrentDraftId(savedDraft.id);
        setLastSaved(new Date());
        if (onSave) onSave(savedDraft);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!toEmail || !subject || !isValidEmail(toEmail)) {
      alert('Vui lòng kiểm tra địa chỉ email và tiêu đề');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          to: toEmail,
          subject,
          body: formatBodyForSending(body),
          replyToMessageId: replyToEmail?.message_id
        })
      });

      if (response.ok) {
        // Delete draft after sending
        if (currentDraftId) {
          await fetch(`/api/db?resource=drafts&id=${currentDraftId}`, {
            method: 'DELETE'
          });
        }

        if (onSend) {
          onSend({
            to: toEmail,
            subject,
            body: formatBodyForSending(body),
            replyToMessageId: replyToEmail?.message_id
          });
        }

        // Reset form
        setToEmail('');
        setToName('');
        setSubject('');
        setBody('');
        setCurrentDraftId(undefined);
        
        alert('Email đã được gửi thành công!');
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Gửi email thất bại. Vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  };

  const formatBodyForSending = (text: string): string => {
    // Convert line breaks to HTML
    return text.replace(/\n/g, '<br>');
  };

  const handleAIAssist = async (request: string) => {
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'compose',
          request,
          composeType: replyToEmail ? 'reply' : 'edit',
          originalEmail: replyToEmail,
          currentDraft: { subject, body }
        })
      });

      if (response.ok) {
        const result: ComposeResponse = await response.json();
        setSubject(result.subject);
        setBody(result.body);
        
        // Show AI response in some way (could be a toast or modal)
        console.log('AI Assistant:', result.response_text);
      }
    } catch (error) {
      console.error('AI assist error:', error);
    }
  };

  const insertTextAtCursor = (text: string) => {
    if (bodyRef.current) {
      const start = bodyRef.current.selectionStart;
      const end = bodyRef.current.selectionEnd;
      const before = body.substring(0, start);
      const after = body.substring(end);
      const newBody = before + text + after;
      setBody(newBody);
      
      // Set cursor position after inserted text
      setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.selectionStart = start + text.length;
          bodyRef.current.selectionEnd = start + text.length;
          bodyRef.current.focus();
        }
      }, 0);
    }
  };

  return (
    <div className={cn('bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-gray-900">
          {replyToEmail ? 'Trả lời email' : 'Soạn email mới'}
        </h2>
        
        <div className="flex items-center space-x-2">
          {/* Auto-save indicator */}
          {isSaving && (
            <span className="text-xs text-gray-500">Đang lưu...</span>
          )}
          {lastSaved && !isSaving && (
            <span className="text-xs text-gray-500">
              Đã lưu {lastSaved.toLocaleTimeString()}
            </span>
          )}
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        {/* To field */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Đến
          </label>
          <div className="relative">
            <input
              ref={toInputRef}
              type="email"
              value={toEmail}
              onChange={(e) => handleToEmailChange(e.target.value)}
              onFocus={() => setShowContactSuggestions(filteredContacts.length > 0)}
              placeholder="Nhập địa chỉ email hoặc tên người nhận"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            
            {/* Contact suggestions */}
            {showContactSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => selectContact(contact)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{contact.name}</p>
                      <p className="text-sm text-gray-500">{contact.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Subject field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tiêu đề
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Nhập tiêu đề email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Formatting toolbar */}
        <div className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
          <button
            onClick={() => insertTextAtCursor('**')}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertTextAtCursor('*')}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <button
            onClick={() => insertTextAtCursor('\n• ')}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            title="Bullet list"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertTextAtCursor('[link text](url)')}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            title="Link"
          >
            <Link className="w-4 h-4" />
          </button>
          
          {/* AI Assistant buttons */}
          <div className="w-px h-4 bg-gray-300" />
          <div className="flex space-x-1">
            <button
              onClick={() => handleAIAssist('Viết email lịch sự và chuyên nghiệp')}
              className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
            >
              AI: Lịch sự
            </button>
            <button
              onClick={() => handleAIAssist('Viết email ngắn gọn và súc tích')}
              className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
            >
              AI: Ngắn gọn
            </button>
            <button
              onClick={() => handleAIAssist('Cải thiện ngữ pháp và văn phong')}
              className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
            >
              AI: Sửa lỗi
            </button>
          </div>
        </div>

        {/* Body field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nội dung
          </label>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Nhập nội dung email..."
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !toEmail || !subject}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors',
                toEmail && subject
                  ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  : 'text-gray-400 bg-gray-50 cursor-not-allowed'
              )}
            >
              <Save className="w-4 h-4" />
              <span>Lưu nháp</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSend}
              disabled={isSending || !toEmail || !subject || !isValidEmail(toEmail)}
              className={cn(
                'flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors',
                toEmail && subject && isValidEmail(toEmail) && !isSending
                  ? 'bg-primary-500 hover:bg-primary-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Đang gửi...' : 'Gửi email'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reply context */}
      {replyToEmail && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Đang trả lời:</h4>
          <div className="text-sm text-gray-600">
            <p><span className="font-medium">Từ:</span> {replyToEmail.sender_name || replyToEmail.sender_email}</p>
            <p><span className="font-medium">Tiêu đề:</span> {replyToEmail.subject}</p>
            <p><span className="font-medium">Thời gian:</span> {new Date(replyToEmail.received_date || '').toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}