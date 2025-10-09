'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Save, X, Bot, Loader2, MessageSquare, Mail, ArrowRight, Sparkles, Check, User, ChevronDown, Maximize2, Minimize2, PenTool } from 'lucide-react';
import { Draft, Contact, ProcessedEmail, ComposeResponse } from '@/types';
import { cn, debounce, isValidEmail } from '@/lib/utils';

interface ComposerChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  suggestionApplied?: boolean;
}

interface AIComposerResponse {
  dialogue: string;
  emailContent: {
    subject: string;
    body: string;
  };
}

interface EmailComposerWithChatProps {
  initialDraft?: Partial<Draft>;
  replyToEmail?: ProcessedEmail;
  onSave?: (draft: Draft) => void;
  onSend?: (emailData: { to: string; subject: string; body: string; replyToMessageId?: string }) => void;
  onClose?: () => void;
  className?: string;
}

export default function EmailComposerWithChat({
  initialDraft,
  replyToEmail,
  onSave,
  onSend,
  onClose,
  className
}: EmailComposerWithChatProps) {
  // Email form state
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
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ComposerChatMessage[]>([
    {
      id: '1',
      text: '👋 Hello! I\'m your AI writing assistant, here to help you craft perfect emails.\n\n✨ I can help you with:\n• Writing emails from scratch\n• Editing and improving content\n• Adjusting tone and style\n• Grammar and structure optimization\n• Professional formatting\n\nJust describe what kind of email you\'d like to write, and I\'ll help you create it! 🚀',
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [chatPanelWidth, setChatPanelWidth] = useState(384); // w-96 = 384px
  const [isResizing, setIsResizing] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<{ subject: string; body: string } | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchContacts();
    createCompositionSession();
    
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

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-resize function
  const autoResizeTextarea = () => {
    if (bodyRef.current) {
      const textarea = bodyRef.current;
      // Reset height to get accurate scrollHeight
      textarea.style.height = 'auto';
      // Calculate needed height
      const scrollHeight = textarea.scrollHeight;
      // Set height with only minimum constraint: min 150px, no maximum limit
      const newHeight = Math.max(150, scrollHeight + 8); // +8 for padding/border
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    autoResizeTextarea();
  }, [body]);

  // Initial resize on component mount and when reply email is loaded
  useEffect(() => {
    if (bodyRef.current) {
      // Use setTimeout to ensure the DOM is fully rendered
      setTimeout(() => {
        autoResizeTextarea();
      }, 100);
    }
  }, [replyToEmail]);

  const createCompositionSession = async () => {
    try {
      const response = await fetch('/api/composition-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          replyToMessageId: replyToEmail?.message_id
        })
      });
      
      if (response.ok) {
        const session = await response.json();
        setSessionId(session.id);
      }
    } catch (error) {
      console.error('Error creating composition session:', error);
    }
  };

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
        session_id: sessionId,
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

        // Clean up composition session
        if (sessionId) {
          await fetch(`/api/composition-session/${sessionId}`, {
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
        setSessionId(null);
        
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

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ComposerChatMessage = {
      id: Date.now().toString(),
      text: chatInput.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'compose-chat',
          userMessage: chatInput.trim(),
          currentDraft: {
            to_email: toEmail,
            to_name: toName,
            subject,
            body
          },
          replyToEmail,
          sessionId,
          conversationHistory: chatMessages.filter(m => !m.suggestionApplied)
        })
      });

      if (response.ok) {
        const result: AIComposerResponse = await response.json();
        
        // Add AI response to chat
        const aiMessage: ComposerChatMessage = {
          id: (Date.now() + 1).toString(),
          text: result.dialogue,
          isUser: false,
          timestamp: new Date()
        };
        
        setChatMessages(prev => [...prev, aiMessage]);
        
        // Set pending suggestion if email content is provided
        if (result.emailContent && (result.emailContent.subject || result.emailContent.body)) {
          setPendingSuggestion(result.emailContent);
        }

        // Save chat message to session
        if (sessionId) {
          await fetch('/api/composition-session/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              userMessage: userMessage.text,
              aiResponse: result.dialogue,
              suggestedSubject: result.emailContent?.subject,
              suggestedBody: result.emailContent?.body
            })
          });
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: ComposerChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.',
        isUser: false,
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const applySuggestion = () => {
    if (pendingSuggestion) {
      if (pendingSuggestion.subject) {
        setSubject(pendingSuggestion.subject);
      }
      if (pendingSuggestion.body) {
        setBody(pendingSuggestion.body);
      }
      
      // Mark last AI message as applied
      setChatMessages(prev => 
        prev.map((msg, index) => 
          index === prev.length - 1 && !msg.isUser 
            ? { ...msg, suggestionApplied: true }
            : msg
        )
      );
      
      setPendingSuggestion(null);
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setChatPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className={cn('fixed inset-0 h-screen flex bg-slate-50 z-50', isResizing && 'cursor-col-resize', className)}>
      {/* AI Chat Panel */}
      <div
        className={cn(
          'flex flex-col bg-white border-r border-slate-200 shadow-xl transition-all duration-300',
          !isChatExpanded && 'w-16'
        )}
        style={isChatExpanded ? { width: `${chatPanelWidth}px` } : undefined}
      >
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200" style={{height: '60px'}}>
          {isChatExpanded && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-sm">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="font-semibold text-slate-900 text-sm leading-tight">AI Assistant</h3>
                <p className="text-xs text-slate-500 flex items-center leading-tight mt-0.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></div>
                  Ready to help
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            className="p-1.5 hover:bg-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-slate-200"
            title={isChatExpanded ? "Collapse assistant" : "Expand assistant"}
          >
            {isChatExpanded ? (
              <Minimize2 className="w-4 h-4 text-slate-600" />
            ) : (
              <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        </div>

        {isChatExpanded && (
          <>
            {/* Chat Messages */}
            <div
              ref={chatMessagesRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 chatbox-messages"
            >
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-start gap-4',
                    message.isUser && 'flex-row-reverse'
                  )}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {message.isUser ? (
                      <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center shadow-sm">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className={cn('flex-1 min-w-0 max-w-[85%]')}>
                    <div
                      className={cn(
                        'p-4 rounded-2xl text-sm leading-relaxed message-bubble shadow-sm',
                        message.isUser
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-slate-800 border border-slate-200',
                        message.suggestionApplied && 'ring-2 ring-emerald-300 bg-emerald-50 border-emerald-200'
                      )}
                    >
                      <div className="whitespace-pre-wrap">
                        {message.text}
                      </div>
                      {message.suggestionApplied && (
                        <div className="flex items-center mt-4 pt-3 border-t border-emerald-200">
                          <div className="flex items-center justify-center w-5 h-5 bg-emerald-500 rounded-full mr-2">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-emerald-700">Applied to email</span>
                        </div>
                      )}
                    </div>
                    <div className={cn(
                      "mt-2 text-xs text-slate-500",
                      message.isUser ? "text-right" : "text-left"
                    )}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm max-w-[85%]">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      <span className="text-sm text-slate-600">AI is thinking...</span>
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse"></div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse delay-100"></div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse delay-200"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestion Apply Bar */}
            {pendingSuggestion && (
              <div className="mx-6 mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-amber-100 rounded-lg">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-amber-900">
                        New email suggestion ready
                      </span>
                      <p className="text-xs text-amber-700 mt-0.5">
                        AI has generated content for your email
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={applySuggestion}
                    className="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Apply Now</span>
                  </button>
                </div>
              </div>
            )}

            {/* Chat Input */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <div className="space-y-3">
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <input
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleChatKeyPress}
                      placeholder="Describe the email you want to write..."
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder-slate-500 bg-white transition-all duration-200 shadow-sm hover:border-slate-300"
                      disabled={isChatLoading}
                    />
                  </div>
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isChatLoading}
                    className={cn(
                      'p-2.5 rounded-lg transition-all duration-200 shadow-sm',
                      chatInput.trim() && !isChatLoading
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Thank you email', icon: '🙏' },
                    { label: 'Apology letter', icon: '🤝' },
                    { label: 'Meeting invitation', icon: '📅' },
                    { label: 'Follow-up', icon: '📋' }
                  ].map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setChatInput(suggestion.label === 'Thank you email' ? 'Write a professional thank you email' :
                                                suggestion.label === 'Apology letter' ? 'Draft a polite apology email' :
                                                suggestion.label === 'Meeting invitation' ? 'Create a meeting invitation email' :
                                                'Write a project follow-up email')}
                      className="flex items-center space-x-1.5 text-xs px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-all duration-200 font-medium hover:border-slate-300"
                      disabled={isChatLoading}
                    >
                      <span>{suggestion.icon}</span>
                      <span>{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Resizer */}
      {isChatExpanded && (
        <div
          ref={resizerRef}
          className={cn(
            'w-1 bg-slate-200 hover:bg-blue-500 cursor-col-resize transition-colors relative group',
            isResizing && 'bg-blue-500'
          )}
          onMouseDown={handleResizeStart}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-500/10" />
        </div>
      )}

      {/* Email Composer Panel */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200" style={{height: '60px'}}>
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-12 h-12 bg-slate-100 rounded-lg">
              <PenTool className="w-8 h-8 text-slate-700" />
            </div>
            <div className="flex items-center justify-center">
              <h1 className="text-base font-semibold text-slate-900">
                {replyToEmail ? 'Reply to Email' : 'Compose New Email'}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Auto-save indicator */}
            {isSaving && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span className="text-xs font-medium text-blue-800">Saving</span>
              </div>
            )}
            {lastSaved && !isSaving && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span className="text-xs font-medium text-emerald-800">Saved</span>
              </div>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                title="Close composer"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            )}
          </div>
        </div>

        {/* Email Form */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-4">
            <div className="bg-white rounded-xl shadow-soft border border-slate-200 overflow-hidden">
              <div className="p-4 space-y-4">
                {/* To field */}
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-semibold text-slate-900">
                    <Mail className="w-3 h-3 mr-2 text-slate-600" />
                    To
                  </label>
                  <div className="relative">
                    <input
                      ref={toInputRef}
                      type="email"
                      value={toEmail}
                      onChange={(e) => handleToEmailChange(e.target.value)}
                      onFocus={() => setShowContactSuggestions(filteredContacts.length > 0)}
                      placeholder="Enter recipient email address"
                      className="w-full h-11 px-3 py-3 bg-white border-2 border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:border-slate-300"
                    />

                    {/* Contact suggestions */}
                    {showContactSuggestions && (
                      <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-strong max-h-40 overflow-y-auto">
                        {filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            onClick={() => selectContact(contact)}
                            className="w-full px-3 py-3 text-left hover:bg-slate-50 transition-all duration-200 border-b border-slate-100 last:border-b-0 first:rounded-t-lg last:rounded-b-lg group"
                          >
                            <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors text-sm">
                              {contact.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{contact.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Subject field */}
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-semibold text-slate-900">
                    <PenTool className="w-3 h-3 mr-2 text-slate-600" />
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject"
                    className="w-full h-11 px-3 py-3 bg-white border-2 border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:border-slate-300"
                  />
                </div>

                {/* Body field */}
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-semibold text-slate-900">
                    <MessageSquare className="w-3 h-3 mr-2 text-slate-600" />
                    Message
                  </label>
                  <div>
                    <textarea
                      ref={bodyRef}
                      value={body}
                      onChange={(e) => {
                        setBody(e.target.value);
                        // Trigger resize after state update
                        setTimeout(() => autoResizeTextarea(), 0);
                      }}
                      placeholder="Write your email content here..."
                      className="w-full px-3 py-3 bg-white border-2 border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-500 resize-none leading-relaxed transition-height duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:border-slate-300"
                      style={{ minHeight: '150px', height: '150px', overflow: 'hidden' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white">
          {/* Reply context */}
          {replyToEmail && (
            <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-center space-x-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0 flex items-center">
                  <div className="text-sm text-slate-600 truncate">
                    <span className="font-medium">Replying to:</span> {replyToEmail.sender_name || replyToEmail.sender_email} • {replyToEmail.subject}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="px-4 py-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <button
                onClick={handleSave}
                disabled={isSaving || !toEmail || !subject}
                className={cn(
                  'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border',
                  toEmail && subject && !isSaving
                    ? 'text-slate-700 border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50 shadow-sm'
                    : 'text-slate-400 border-slate-200 bg-slate-100 cursor-not-allowed'
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    <span>Save Draft</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSend}
                disabled={isSending || !toEmail || !subject || !isValidEmail(toEmail)}
                className={cn(
                  'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm',
                  toEmail && subject && isValidEmail(toEmail) && !isSending
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                )}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Send Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}