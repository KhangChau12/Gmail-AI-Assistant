'use client';

import { useState, useEffect } from 'react';
import { Mail, MailOpen, Star, Archive, Trash2, MoveRight, Search, Filter, Tag } from 'lucide-react';
import { ProcessedEmail, Category, EmailCardProps } from '@/types';
import { cn, formatEmailDate, truncateText, getEmailDisplayName } from '@/lib/utils';

interface EmailListProps {
  categoryId?: string;
  searchQuery?: string;
  onEmailClick: (email: ProcessedEmail) => void;
  onEmailAction?: (email: ProcessedEmail, action: string) => void;
  onSyncStatusChange?: (status: SyncStatus) => void;
}

interface SyncStatus {
  isActive: boolean;
  message: string;
  progress: number;
  processedCount: number;
  totalEmails: number;
}

export default function EmailList({ 
  categoryId, 
  searchQuery, 
  onEmailClick,
  onEmailAction,
  onSyncStatusChange
}: EmailListProps) {
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'sender' | 'subject'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchEmails();
    fetchCategories();
  }, [categoryId]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const url = categoryId 
        ? `/api/db?resource=emails&category=${categoryId}`
        : '/api/db?resource=emails';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setEmails(data);
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/db?resource=categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };


  // Filter and sort emails
  const filteredEmails = emails
    .filter(email => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          email.subject?.toLowerCase().includes(query) ||
          email.sender_name?.toLowerCase().includes(query) ||
          email.sender_email?.toLowerCase().includes(query) ||
          email.summary?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.received_date || 0).getTime() - new Date(b.received_date || 0).getTime();
          break;
        case 'sender':
          comparison = (a.sender_name || a.sender_email || '').localeCompare(b.sender_name || b.sender_email || '');
          break;
        case 'subject':
          comparison = (a.subject || '').localeCompare(b.subject || '');
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const handleEmailSelect = (emailId: string, selected: boolean) => {
    const newSelected = new Set(selectedEmails);
    if (selected) {
      newSelected.add(emailId);
    } else {
      newSelected.delete(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedEmails.size === 0) return;

    for (const emailId of selectedEmails) {
      const email = emails.find(e => e.id === emailId);
      if (email && onEmailAction) {
        await onEmailAction(email, action);
      }
    }

    setSelectedEmails(new Set());
    await fetchEmails();
  };

  const getCategoryById = (id: string) => {
    return categories.find(c => c.id === id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
          </h2>
          
          <div className="flex items-center space-x-2">
            {/* Sort options */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as any);
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="date-desc">Mới nhất</option>
              <option value="date-asc">Cũ nhất</option>
              <option value="sender-asc">Người gửi A-Z</option>
              <option value="sender-desc">Người gửi Z-A</option>
              <option value="subject-asc">Tiêu đề A-Z</option>
              <option value="subject-desc">Tiêu đề Z-A</option>
            </select>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedEmails.size > 0 && (
          <div className="flex items-center space-x-2 p-3 bg-primary-50 rounded-lg">
            <span className="text-sm text-primary-700">
              Đã chọn {selectedEmails.size} email
            </span>
            <div className="flex space-x-1 ml-auto">
              <button
                onClick={() => handleBulkAction('markRead')}
                className="text-xs px-3 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
              >
                Đánh dấu đã đọc
              </button>
              <button
                onClick={() => handleBulkAction('archive')}
                className="text-xs px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Lưu trữ
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Mail className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-lg font-medium">Không có email nào</p>
            <p className="text-sm">
              {searchQuery 
                ? 'Không tìm thấy email phù hợp với từ khóa tìm kiếm'
                : 'Chưa có email nào trong danh mục này'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {/* Select all */}
            <div className="p-3 bg-gray-50 border-b">
              <label className="flex items-center space-x-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={selectedEmails.size === filteredEmails.length && filteredEmails.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>Chọn tất cả</span>
              </label>
            </div>

            {filteredEmails.map((email) => (
              <EmailCard
                key={email.id}
                email={email}
                category={email.category_id ? getCategoryById(email.category_id) : undefined}
                isSelected={selectedEmails.has(email.id)}
                onSelect={(selected) => handleEmailSelect(email.id, selected)}
                onClick={() => onEmailClick(email)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Email card component
function EmailCard({ 
  email, 
  category, 
  isSelected, 
  onSelect, 
  onClick 
}: EmailCardProps & {
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const isUnread = !email.message_id; // Simple unread logic
  const displayName = getEmailDisplayName(email.sender_email || '', email.sender_name);

  return (
    <div
      className={cn(
        'group relative bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer rounded-lg mb-2',
        isUnread && 'border-l-4 border-l-blue-500 bg-blue-50/30',
        isSelected && 'ring-2 ring-blue-500 bg-blue-50'
      )}
      onClick={onClick}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
          />

          {/* Email Status Icon */}
          <div className="flex-shrink-0">
            {isUnread ? (
              <Mail className="w-5 h-5 text-blue-600" />
            ) : (
              <MailOpen className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {/* Sender Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className={cn(
                'font-medium text-sm truncate',
                isUnread ? 'text-gray-900' : 'text-gray-700'
              )}>
                {displayName}
              </h3>
              {category && (
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                  style={{
                    backgroundColor: category.color + '15',
                    color: category.color,
                    border: `1px solid ${category.color}30`
                  }}
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {category.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Date & Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-xs text-gray-500">
            {formatEmailDate(email.received_date || new Date())}
          </span>
          
          {/* Quick Actions */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Handle star
              }}
              className="p-1.5 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 rounded transition-colors"
              title="Đánh dấu sao"
            >
              <Star className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Handle archive
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
              title="Lưu trữ"
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Subject */}
      <div className="px-4 pb-2">
        <h4 className={cn(
          'text-sm leading-5',
          isUnread ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'
        )}>
          {email.subject || 'Không có tiêu đề'}
        </h4>
      </div>

      {/* Summary Section - Enhanced for better readability */}
      {email.summary && 
       email.summary !== 'Email không có nội dung để tóm tắt.' && 
       email.summary !== 'Nội dung email quá ngắn để tóm tắt.' && 
       email.summary.trim().length > 10 && (
        <div className="px-4 pb-3">
          <div className="bg-gray-50 rounded-md p-3 border-l-3 border-l-gray-300">
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
              {email.summary}
            </p>
          </div>
        </div>
      )}

      {/* Footer with parsing status if available */}
      {email.parsing_status && email.parsing_status !== 'success' && (
        <div className="px-4 pb-2">
          <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Email có thể hiển thị không đầy đủ
          </div>
        </div>
      )}
    </div>
  );
}