'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Minimize2, Maximize2, Loader2, Brain, Search, Mail, CheckCircle, XCircle, Sparkles, Zap, Bot } from 'lucide-react';
import { ChatBoxProps, ChatMessage, ChatResponse } from '@/types';
import { cn, formatRelativeTime } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ProgressStep {
  type: 'progress';
  step: string;
  status: 'thinking' | 'processing' | 'completed' | 'error';
  timestamp: string;
}

interface ThinkingMessage extends ChatMessage {
  isThinking?: boolean;
  progressSteps?: ProgressStep[];
  isComplete?: boolean;
}

export default function ChatBox({ context, onActionReceived }: ChatBoxProps) {
  const [messages, setMessages] = useState<ThinkingMessage[]>([
    {
      id: '1',
      text: '👋 Xin chào! Tôi là trợ lý AI Gmail của bạn.\n\n✨ Tôi có thể giúp bạn:\n• 📧 Quản lý và tìm kiếm email\n• ✍️ Soạn thư và trả lời email\n• 📝 Tóm tắt nội dung quan trọng\n• 🗂️ Phân loại và sắp xếp email\n\nHãy thử hỏi tôi điều gì đó nhé! 🚀',
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatbox-position');
      return saved ? JSON.parse(saved) : { x: 24, y: 24 };
    }
    return { x: 24, y: 24 };
  }); 
  const [size, setSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatbox-size');
      return saved ? JSON.parse(saved) : { width: 450, height: 600 };
    }
    return { width: 450, height: 600 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatboxRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isMinimized) {
      inputRef.current?.focus();
    }
  }, [isMinimized]);

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    
    if (isResizing) return;
    setIsDragging(true);
    
    // Calculate the offset from mouse to the current position
    const rect = chatboxRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({ 
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      // Calculate new top-left position
      const newLeft = e.clientX - dragStart.x;
      const newTop = e.clientY - dragStart.y;
      
      // Convert to bottom-right positioning and apply bounds
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      
      const newX = Math.max(0, Math.min(maxX, window.innerWidth - newLeft - size.width));
      const newY = Math.max(0, Math.min(maxY, window.innerHeight - newTop - size.height));
      
      setPosition({ x: newX, y: newY });
    }
    
    if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      // For bottom-right positioning, we need to adjust the position when resizing
      const newWidth = Math.max(300, Math.min(800, resizeStart.width + deltaX));
      const newHeight = Math.max(400, Math.min(800, resizeStart.height + deltaY));
      
      // Adjust position to keep the chatbox anchored at bottom-right
      const widthDiff = newWidth - size.width;
      const heightDiff = newHeight - size.height;
      
      setSize({ width: newWidth, height: newHeight });
      setPosition({ 
        x: Math.max(0, position.x - widthDiff), 
        y: Math.max(0, position.y - heightDiff) 
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Resize functionality
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ 
      x: e.clientX, 
      y: e.clientY, 
      width: size.width, 
      height: size.height 
    });
  };

  // Add global mouse events
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, position, size]);

  // Save position and size to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbox-position', JSON.stringify(position));
    }
  }, [position]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbox-size', JSON.stringify(size));
    }
  }, [size]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'thinking':
        return <Sparkles className="w-3 h-3 text-blue-500 animate-pulse" />;
      case 'processing':
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Search className="w-3 h-3 text-gray-400" />;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ThinkingMessage = {
      id: Date.now().toString(),
      text: input.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create thinking message
    const thinkingMessageId = (Date.now() + 1).toString();
    const thinkingMessage: ThinkingMessage = {
      id: thinkingMessageId,
      text: '',
      isUser: false,
      timestamp: new Date(),
      isThinking: true,
      progressSteps: [],
      isComplete: false
    };

    setMessages(prev => [...prev, thinkingMessage]);

    try {
      // Get email summary for context
      const summaryResponse = await fetch('/api/db?resource=summary');
      const emailSummary = summaryResponse.ok ? await summaryResponse.json() : {};

      // Get contacts for context
      const contactsResponse = await fetch('/api/db?resource=contacts');
      const contacts = contactsResponse.ok ? await contactsResponse.json() : [];

      // Process chat with streaming
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          userMessage: input.trim(),
          context,
          emailSummary,
          contacts
        })
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                // Update thinking message with progress
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === thinkingMessageId 
                      ? {
                          ...msg,
                          progressSteps: [...(msg.progressSteps || []), data]
                        }
                      : msg
                  )
                );
              } else if (data.type === 'final') {
                // Final response received
                const finalMessage: ThinkingMessage = {
                  id: (Date.now() + 2).toString(),
                  text: data.response_text,
                  isUser: false,
                  timestamp: new Date(),
                  isComplete: true
                };

                // Remove thinking message and add final message
                setMessages(prev => [
                  ...prev.filter(msg => msg.id !== thinkingMessageId),
                  finalMessage
                ]);

                // Execute action if needed
                if (data.action !== 'none') {
                  onActionReceived(data as ChatResponse);
                }
                break;
              } else if (data.type === 'error') {
                // Error occurred
                const errorMessage: ThinkingMessage = {
                  id: (Date.now() + 2).toString(),
                  text: 'Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.',
                  isUser: false,
                  timestamp: new Date(),
                  isComplete: true
                };

                setMessages(prev => [
                  ...prev.filter(msg => msg.id !== thinkingMessageId),
                  errorMessage
                ]);
                break;
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      
      // Remove thinking message and show error
      const errorMessage: ThinkingMessage = {
        id: (Date.now() + 2).toString(),
        text: 'Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.',
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [
        ...prev.filter(msg => msg.id !== thinkingMessageId),
        errorMessage
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="float-animation group bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-blue-500/25"
        >
          <Mail className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={chatboxRef}
      className={cn(
        "fixed z-50 select-none transition-shadow duration-200",
        isDragging && "chatbox-dragging shadow-2xl",
        isResizing && "chatbox-resizing shadow-2xl"
      )}
      style={{ 
        bottom: `${position.y}px`, 
        right: `${position.x}px`,
        width: `${size.width}px`,
        height: `${size.height}px`
      }}
    >
      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 h-full flex flex-col relative">
        {/* Header */}
        <div 
          className={cn(
            "flex items-center justify-between p-4 bg-blue-600 text-white cursor-move transition-all duration-200",
            isDragging && "bg-blue-700 shadow-lg"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Trợ lý AI Gmail</h3>
              <p className="text-xs text-white/80">Luôn sẵn sàng hỗ trợ</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all duration-200 flex-shrink-0"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="chatbox-messages flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/50 to-white">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                'flex animate-in slide-in-from-bottom-2 duration-300',
                message.isUser ? 'justify-end' : 'justify-start'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* AI Avatar */}
              {!message.isUser && (
                <div className="flex-shrink-0 mr-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
              
              <div
                className={cn(
                  'message-bubble p-4 text-sm relative group w-full',
                  message.isUser
                    ? 'bg-blue-600 text-white rounded-2xl rounded-br-md shadow-lg hover:shadow-lg'
                    : 'bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-gray-100 hover:shadow-md'
                )}
                style={{
                  maxWidth: size.width > 500 ? 
                    (message.isUser ? `${size.width * 0.75}px` : `${size.width * 0.8}px`) :
                    (message.isUser ? '85%' : '90%')
                }}
              >
                {/* Thinking Process Display */}
                {message.isThinking && message.progressSteps && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-blue-600 animate-pulse" />
                        </div>
                        <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-30"></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">AI đang suy nghĩ...</span>
                    </div>
                    
                    <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                      {message.progressSteps.map((step, index) => (
                        <div key={index} className="flex items-center space-x-3 text-xs animate-in fade-in duration-300" style={{ animationDelay: `${index * 200}ms` }}>
                          <div className="flex-shrink-0">
                            {getStatusIcon(step.status)}
                          </div>
                          <span className={cn(
                            'transition-all duration-300 flex-1',
                            step.status === 'completed' ? 'text-green-700 font-medium' :
                            step.status === 'error' ? 'text-red-700 font-medium' :
                            'text-gray-600'
                          )}>
                            {step.step}
                          </span>
                          {step.status === 'completed' && (
                            <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                          )}
                        </div>
                      ))}
                      
                      {/* Active step indicator */}
                      {message.progressSteps.length > 0 && !message.isComplete && (
                        <div className="flex items-center space-x-3 text-xs">
                          <div className="relative">
                            <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                          </div>
                          <span className="text-blue-600 font-medium animate-pulse">Đang xử lý...</span>
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-blue-400 rounded-full typing-indicator"></div>
                            <div className="w-1 h-1 bg-blue-400 rounded-full typing-indicator"></div>
                            <div className="w-1 h-1 bg-blue-400 rounded-full typing-indicator"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Normal Message */}
                {!message.isThinking && (
                  <>
                    <div className="leading-relaxed prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="ml-2" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                          em: ({node, ...props}) => <em className="italic" {...props} />,
                          code: ({node, className, children, ...props}) => {
                            const isInline = !className;
                            return isInline ? (
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                {children}
                              </code>
                            ) : (
                              <code className="block bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto" {...props}>
                                {children}
                              </code>
                            );
                          },
                          a: ({node, ...props}) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100/50">
                      <p
                        className={cn(
                          'text-xs opacity-70',
                          message.isUser ? 'text-blue-100' : 'text-gray-500'
                        )}
                      >
                        {formatRelativeTime(message.timestamp)}
                      </p>
                      {!message.isUser && (
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              {/* User Avatar */}
              {message.isUser && (
                <div className="flex-shrink-0 ml-3">
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">U</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 bg-white/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Nhập câu hỏi hoặc yêu cầu..."
                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-sm transition-all duration-200 placeholder-gray-500"
                disabled={isLoading}
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                'p-3 rounded-2xl transition-all duration-200 transform',
                input.trim() && !isLoading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              <Send className={cn(
                'w-4 h-4 transition-transform duration-200',
                input.trim() && !isLoading ? 'translate-x-0.5' : ''
              )} />
            </button>
          </div>
          
          {/* Quick suggestions */}
          <div className="mt-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {['📬 Tìm email mới nhất', '✍️ Soạn email mới', '📊 Tóm tắt inbox'].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setInput(suggestion.split(' ').slice(1).join(' '))}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded-full transition-all duration-200 border border-gray-200 hover:border-blue-200"
                  disabled={isLoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {['🔍 Tìm email từ...', '📁 Phân loại email', '🗂️ Tạo danh mục mới'].map((suggestion, index) => (
                <button
                  key={index + 3}
                  onClick={() => setInput(suggestion.split(' ').slice(1).join(' '))}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded-full transition-all duration-200 border border-gray-200 hover:border-blue-200"
                  disabled={isLoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div 
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
        ></div>
      </div>
    </div>
  );
}

// Context suggestions component
export function ChatSuggestions({ suggestions, onSelect }: {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="p-3 border-t border-gray-200 bg-gray-50">
      <p className="text-xs text-gray-500 mb-2">Gợi ý:</p>
      <div className="space-y-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className="block w-full text-left text-xs text-gray-600 hover:text-primary-600 p-1 rounded hover:bg-gray-100 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}