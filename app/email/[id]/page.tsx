'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  Star,
  MoreVertical,
  Mail,
  Clock,
  Tag,
  Download,
  Flag
} from 'lucide-react';
import ChatBox from '@/components/ChatBox';
import ComposeForm from '@/components/ComposeForm';
import EmailComposerWithChat from '@/components/EmailComposerWithChat';
import { 
  ProcessedEmail, 
  Category, 
  AppContext, 
  ChatResponse, 
  Draft 
} from '@/types';
import { 
  cn, 
  formatFullDate, 
  getEmailDisplayName, 
  sanitizeHtml, 
  extractTextFromHtml,
  isRawMimeContent,
  parseRawMimeContent,
  formatEmailText
} from '@/lib/utils';

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const emailId = params.id as string;
  const isCompose = emailId === 'compose';
  
  const [email, setEmail] = useState<ProcessedEmail | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(!isCompose);
  const [isReplying, setIsReplying] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showRawContent, setShowRawContent] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // Compose mode initial data from URL params
  const initialTo = searchParams.get('to') || '';
  const initialSubject = searchParams.get('subject') || '';
  const replyToId = searchParams.get('replyTo') || '';

  // App context for ChatBox
  const appContext: AppContext = {
    currentPage: isCompose ? 'compose' : 'email-detail',
    currentEmail: email || undefined,
    gmailFolders: []
  };

  useEffect(() => {
    if (!isCompose) {
      fetchEmailDetail();
    }
  }, [emailId, isCompose]);

  const fetchEmailDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/db?resource=emails&id=${emailId}`);
      
      if (response.ok) {
        const emailData = await response.json();
        setEmail(emailData);
        
        // Mark as read
        await fetch(`/api/gmail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'markRead',
            uid: emailData.imap_uid
          })
        });

        // Fetch category if exists
        if (emailData.category_id) {
          const categoryResponse = await fetch('/api/db?resource=categories');
          if (categoryResponse.ok) {
            const categories = await categoryResponse.json();
            const emailCategory = categories.find((c: Category) => c.id === emailData.category_id);
            setCategory(emailCategory || null);
          }
        }
      } else if (response.status === 404) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching email:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = () => {
    setIsReplying(true);
  };

  const handleReprocessEmail = async () => {
    if (!email || reprocessing) return;

    try {
      setReprocessing(true);
      
      // Call the reprocess API for this specific email
      const response = await fetch('/api/gmail?action=reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: email.id,
          imapUid: email.imap_uid
        })
      });

      if (response.ok) {
        // Reload the email data
        await fetchEmailDetail();
        alert('Email đã được xử lý lại thành công!');
      } else {
        const error = await response.json();
        console.error('Reprocess failed:', error);
        alert('Không thể xử lý lại email. Vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error('Reprocess error:', error);
      alert('Đã có lỗi xảy ra khi xử lý lại email.');
    } finally {
      setReprocessing(false);
    }
  };

  const handleEmailAction = async (action: string) => {
    if (!email) return;

    try {
      switch (action) {
        case 'archive':
          await fetch('/api/gmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'move',
              uid: email.imap_uid,
              targetFolder: '[Gmail]/All Mail'
            })
          });
          router.push('/');
          break;

        case 'delete':
          await fetch('/api/gmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'move',
              uid: email.imap_uid,
              targetFolder: '[Gmail]/Trash'
            })
          });
          router.push('/');
          break;

        case 'star':
          // Implementation for starring
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Error performing email action:', error);
      alert('Không thể thực hiện thao tác này. Vui lòng thử lại.');
    }
  };

  const handleChatAction = (action: ChatResponse) => {
    switch (action.action) {
      case 'navigate':
        if (action.navigation_url) {
          router.push(action.navigation_url);
        }
        break;

      case 'compose':
        if (action.compose_data) {
          const params = new URLSearchParams();
          if (action.compose_data.to_email) params.set('to', action.compose_data.to_email);
          if (action.compose_data.subject) params.set('subject', action.compose_data.subject);
          router.push(`/email/compose?${params.toString()}`);
        }
        break;

      default:
        break;
    }
  };

  const handleSendSuccess = () => {
    router.push('/');
  };

  const handleDraftSave = (draft: Draft) => {
    // Update context for chat
    appContext.currentDraft = draft;
  };

  if (isCompose) {
    const initialDraft: Partial<Draft> = {
      to_email: initialTo,
      subject: initialSubject
    };

    return (
      <EmailComposerWithChat
        initialDraft={initialDraft}
        onSend={handleSendSuccess}
        onSave={handleDraftSave}
        onClose={() => router.back()}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Email không tồn tại</h2>
          <p className="text-gray-600 mb-6">Email này có thể đã bị xóa hoặc di chuyển.</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Chi tiết email</h1>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReply}
              className="btn-secondary"
            >
              <Reply className="w-4 h-4" />
              Trả lời
            </button>

            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="btn-ghost"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showActions && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => handleEmailAction('star')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <Star className="w-4 h-4" />
                    <span>Đánh dấu sao</span>
                  </button>
                  <button
                    onClick={() => handleEmailAction('archive')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Lưu trữ</span>
                  </button>
                  <button
                    onClick={() => handleEmailAction('delete')}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Email Header */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {email.subject || 'Không có tiêu đề'}
                  </h1>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Từ:</span>
                      <span>{getEmailDisplayName(email.sender_email || '', email.sender_name)}</span>
                      <span className="text-gray-400">({email.sender_email})</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatFullDate(email.received_date || new Date())}</span>
                    </div>
                    
                    {category && (
                      <div className="flex items-center space-x-2">
                        <Tag className="w-4 h-4" />
                        <span 
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: category.color + '20',
                            color: category.color
                          }}
                        >
                          {category.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Summary */}
              {email.summary && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-primary-800 mb-2">Tóm tắt AI:</h3>
                  <p className="text-primary-700">{email.summary}</p>
                </div>
              )}
            </div>
          </div>

          {/* Email Content */}
          <div className="card">
            <div className="card-body">
              <div className="prose max-w-none">
                {(() => {
                  // Check if content is raw MIME and needs parsing
                  const htmlContent = email.body_html;
                  const textContent = email.body_text;
                  
                  // If HTML content exists and is not raw MIME, use it
                  if (htmlContent && !isRawMimeContent(htmlContent)) {
                    return (
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: sanitizeHtml(htmlContent) 
                        }} 
                        className="email-content"
                      />
                    );
                  }
                  
                  // If text content exists and is not raw MIME, still apply formatting
                  if (textContent && !isRawMimeContent(textContent)) {
                    const formattedContent = formatEmailText(textContent);
                    return (
                      <div 
                        className="email-content"
                        dangerouslySetInnerHTML={{ __html: formattedContent }}
                      />
                    );
                  }
                  
                  // If HTML content is raw MIME, try to parse it
                  if (htmlContent && isRawMimeContent(htmlContent)) {
                    const parsedContent = parseRawMimeContent(htmlContent);
                    return (
                      <div 
                        className="email-content"
                        dangerouslySetInnerHTML={{ __html: parsedContent }}
                      />
                    );
                  }
                  
                  // If text content is raw MIME, try to parse it
                  if (textContent && isRawMimeContent(textContent)) {
                    const parsedContent = parseRawMimeContent(textContent);
                    return (
                      <div 
                        className="email-content"
                        dangerouslySetInnerHTML={{ __html: parsedContent }}
                      />
                    );
                  }
                  
                  // Enhanced fallback with better error handling and reprocessing option
                  const fallbackContent = textContent || htmlContent;
                  if (!fallbackContent || fallbackContent.trim() === '') {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-lg font-medium">Không có nội dung email</p>
                        <p className="text-sm mb-4">Email này có thể chưa được tải đầy đủ hoặc không có nội dung text.</p>
                        <button
                          onClick={() => handleReprocessEmail()}
                          disabled={reprocessing}
                          className="btn-secondary text-sm disabled:opacity-50"
                        >
                          {reprocessing ? 'Đang tải lại...' : 'Thử tải lại nội dung'}
                        </button>
                      </div>
                    );
                  }
                  
                  // Check if content looks like it has parsing issues
                  const hasParsingIssues = fallbackContent.includes('Content-Type:') || 
                                          fallbackContent.includes('Content-Transfer-Encoding:') ||
                                          /=[0-9A-F]{2}/.test(fallbackContent);
                  
                  if (hasParsingIssues) {
                    return (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-yellow-600 text-sm">⚠</span>
                          </div>
                          <h3 className="text-lg font-medium text-yellow-800">Email chưa được xử lý đầy đủ</h3>
                        </div>
                        <p className="text-yellow-700 mb-4">
                          Nội dung email này chứa dữ liệu chưa được giải mã hoặc định dạng đúng cách.
                        </p>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleReprocessEmail()}
                            disabled={reprocessing}
                            className="btn-primary text-sm disabled:opacity-50"
                          >
                            {reprocessing ? 'Đang xử lý...' : 'Xử lý lại email'}
                          </button>
                          <button
                            onClick={() => setShowRawContent(!showRawContent)}
                            className="btn-secondary text-sm"
                          >
                            {showRawContent ? 'Ẩn' : 'Hiện'} nội dung thô
                          </button>
                        </div>
                        {showRawContent && (
                          <div className="mt-4 p-3 bg-gray-100 rounded text-sm font-mono text-gray-700 max-h-40 overflow-y-auto">
                            {fallbackContent.substring(0, 1000)}
                            {fallbackContent.length > 1000 && '...'}
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  const formattedContent = formatEmailText(fallbackContent);
                  return (
                    <div 
                      className="email-content"
                      dangerouslySetInnerHTML={{ __html: formattedContent }}
                    />
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Reply Form */}
          {isReplying && (
            <div className="fixed inset-0 bg-white z-50">
              <EmailComposerWithChat
                replyToEmail={email || undefined}
                onSend={() => {
                  setIsReplying(false);
                  router.push('/');
                }}
                onSave={handleDraftSave}
                onClose={() => setIsReplying(false)}
              />
            </div>
          )}
        </div>
      </main>

      {/* Chat */}
      <ChatBox context={appContext} onActionReceived={handleChatAction} />
    </div>
  );
}