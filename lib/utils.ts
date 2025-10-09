import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { processEmailContent } from './encoding-fix';

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Date formatting helpers
export function formatEmailDate(date: string | Date): string {
  const emailDate = typeof date === 'string' ? parseISO(date) : date;
  
  if (isToday(emailDate)) {
    return format(emailDate, 'HH:mm');
  } else if (isYesterday(emailDate)) {
    return 'Hôm qua';
  } else {
    return format(emailDate, 'dd/MM');
  }
}

export function formatRelativeTime(date: string | Date): string {
  const emailDate = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(emailDate, { addSuffix: true });
}

export function formatFullDate(date: string | Date): string {
  const emailDate = typeof date === 'string' ? parseISO(date) : date;
  return format(emailDate, 'dd/MM/yyyy HH:mm');
}

// Text processing helpers
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function extractTextFromHtml(html: string): string {
  // Simple HTML to text conversion
  return html
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export function sanitizeHtml(html: string): string {
  // First fix Vietnamese encoding issues
  let cleanHtml = processEmailContent(html);
  
  // Basic HTML sanitization - remove dangerous tags
  return cleanHtml
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
}

// Detect and parse raw MIME content
export function isRawMimeContent(content: string): boolean {
  return content.includes('Content-Type:') && 
         content.includes('Content-Transfer-Encoding:') &&
         (content.includes('--_----') || content.includes('--000000000000') || content.includes('boundary='));
}

// General email content formatter (works with any email content)
export function formatEmailText(content: string): string {
  // Apply Vietnamese encoding fixes first
  const fixedContent = processEmailContent(content);
  return formatEmailContent(fixedContent);
}

export function parseRawMimeContent(content: string): string {
  try {
    console.log('Parsing raw MIME content...');
    
    // Split by MIME boundaries to get parts
    const boundaryMatches = content.match(/--(_----[^-\s]+|[0-9a-f]{12,})/g);
    if (boundaryMatches && boundaryMatches.length > 0) {
      const boundary = boundaryMatches[0];
      console.log('Found boundary:', boundary);
      
      const parts = content.split(boundary);
      
      for (const part of parts) {
        if (part.trim() === '' || part.trim() === '--') continue;
        
        // Check if this part contains text/plain content
        if (part.includes('Content-Type: text/plain')) {
          console.log('Found text/plain part');
          
          // Split headers and body
          const headerBodySplit = part.split(/\n\s*\n/);
          if (headerBodySplit.length >= 2) {
            const headers = headerBodySplit[0];
            const body = headerBodySplit.slice(1).join('\n\n');
            
            // Check encoding
            if (headers.includes('Content-Transfer-Encoding: 7bit')) {
              // Plain text, return as-is
              const cleanBody = body.replace(/--_----[^-\s]+.*$/s, '').trim();
              return formatEmailContent(cleanBody);
            } else if (headers.includes('Content-Transfer-Encoding: base64')) {
              // Decode base64
              try {
                const cleanBase64 = body.replace(/\s/g, '');
                const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
                return formatEmailContent(decoded);
              } catch (e) {
                console.warn('Failed to decode base64:', e);
              }
            } else if (headers.includes('Content-Transfer-Encoding: quoted-printable')) {
              // Decode quoted-printable
              const decoded = decodeQuotedPrintable(body);
              return formatEmailContent(decoded);
            }
          }
        }
      }
    }
    
    // Fallback: Look for base64 encoded content anywhere
    const base64Match = content.match(/Content-Transfer-Encoding:\s*base64\s*\n\s*\n([A-Za-z0-9+/=\s]+)/i);
    if (base64Match) {
      try {
        const cleanBase64 = base64Match[1].replace(/\s/g, '');
        const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
        return formatEmailContent(decoded);
      } catch (e) {
        console.warn('Failed to decode base64 from raw MIME:', e);
      }
    }
    
    // Another fallback: Look for text content after text/plain header
    const textPlainMatch = content.match(/Content-Type:\s*text\/plain[^\n]*\n\s*\n([^-]+?)(?=--_----|\n--[0-9a-f]|$)/is);
    if (textPlainMatch) {
      return formatEmailContent(textPlainMatch[1].trim());
    }
    
    // Last resort: return original content
    return content;
  } catch (error) {
    console.error('Error parsing raw MIME content:', error);
    return content;
  }
}

// Format email content for better readability with Vietnamese encoding support
function formatEmailContent(content: string): string {
  // First, fix any Vietnamese encoding issues
  let cleanContent = processEmailContent(content);
  
  // Apply basic quoted-printable decoding if needed
  if (isQuotedPrintableEncoded(cleanContent)) {
    cleanContent = decodeQuotedPrintable(cleanContent);
    // Re-apply Vietnamese encoding fixes after decoding
    cleanContent = processEmailContent(cleanContent);
  }

  // If content is still mostly garbage/encoded, show a user-friendly message
  const garbageRatio = (cleanContent.match(/[=\x00-\x1F\x7F-\x9F]/g) || []).length / cleanContent.length;
  if (garbageRatio > 0.3) {
    return '<div class="text-center py-8 text-gray-500"><p>Email này chứa nội dung được mã hóa và không thể hiển thị đúng cách.</p><p class="text-sm mt-2">Email có thể sử dụng định dạng mã hóa không được hỗ trợ.</p></div>';
  }

  // Convert URLs to clickable links
  cleanContent = cleanContent
    .replace(/([^(\n]+?)\s*\(\s*(https?:\/\/[^\s)]+)\s*\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
    .replace(/(?<!href=")(?<!>)https?:\/\/[^\s<]+(?![^<]*<\/a>)/g, '<a href="$&" target="_blank" rel="noopener" class="text-blue-600 hover:text-blue-800 underline">$&</a>');

  // Better paragraph formatting:
  // 1. Split into logical sections and paragraphs
  let sections = cleanContent
    // Split more conservatively to avoid losing content
    .split(/\n\s*\n\s*\n+|\n\s*\n(?=\w+\s*:)/);

  // 2. Process each section
  const formattedSections = sections
    .map(section => section.trim())
    .filter(section => section.length > 0)
    .map(section => {
      // Convert single line breaks to spaces within sections
      let formattedSection = section.replace(/(?<!\n)\n(?!\n)/g, ' ').trim();
      
      // Detect and format different types of content
      
      // Headers with multiple stars or special formatting
      if (formattedSection.match(/^\*{3,}.*\*{3,}$/)) {
        return `<h3 class="text-xl font-bold text-gray-900 mt-4 mb-2 text-center">${formattedSection.replace(/\*/g, '').trim()}</h3>`;
      }
      
      // Section dividers
      if (formattedSection.match(/^[\*\-=]{3,}$/)) {
        return '<hr class="my-3 border-gray-300">';
      }
      
      // Short lines that look like headers (standalone lines under 50 chars, title case)
      // But skip if it's a duplicate of what we might add later
      if (formattedSection.length < 50 && 
          formattedSection.match(/^[A-Z][^.!?]*[^.]$/) && 
          !formattedSection.includes('http') &&
          formattedSection !== 'Get the App' &&
          formattedSection !== 'Stay Tuned') {
        return `<h4 class="text-lg font-semibold text-gray-900 mt-4 mb-2">${formattedSection}</h4>`;
      }
      
      // App store links section (special formatting)
      if (formattedSection.includes('Apple App Store') || formattedSection.includes('Google Play')) {
        // If it's just the header, skip it (we'll handle it with the content)
        if (formattedSection.trim() === 'Get the App') {
          return '';
        }
        // If it starts with the header, just show the content part
        if (formattedSection.startsWith('Get the App')) {
          const content = formattedSection.replace('Get the App', '').trim();
          return `<div class="text-center my-3">
            <h4 class="text-lg font-semibold text-gray-900 mb-2">Get the App</h4>
            <p class="text-gray-600">${content}</p>
          </div>`;
        } else {
          return `<div class="text-center my-3">
            <h4 class="text-lg font-semibold text-gray-900 mb-2">Get the App</h4>
            <p class="text-gray-600">${formattedSection}</p>
          </div>`;
        }
      }
      
      // Social media links section
      if (formattedSection.includes('Facebook') && formattedSection.includes('Instagram')) {
        // If it's just the header, skip it (we'll handle it with the content)
        if (formattedSection.trim() === 'Stay Tuned') {
          return '';
        }
        // If it starts with the header, just show the content part
        if (formattedSection.startsWith('Stay Tuned')) {
          const content = formattedSection.replace('Stay Tuned', '').trim();
          return `<div class="text-center my-3">
            <h4 class="text-lg font-semibold text-gray-900 mb-2">Stay Tuned</h4>
            <p class="text-gray-600">${content}</p>
          </div>`;
        } else {
          return `<div class="text-center my-3">
            <h4 class="text-lg font-semibold text-gray-900 mb-2">Stay Tuned</h4>
            <p class="text-gray-600">${formattedSection}</p>
          </div>`;
        }
      }
      
      // Copyright/footer text
      if (formattedSection.includes('Copyright') || formattedSection.includes('All rights reserved') || formattedSection.includes('Unsubscribe')) {
        return `<div class="text-sm text-gray-500 mt-8 pt-4 border-t border-gray-200">
          <p>${formattedSection}</p>
        </div>`;
      }
      
      // Regular paragraph
      return `<p class="text-gray-700 mb-3 leading-relaxed">${formattedSection}</p>`;
    });

  // Simple paragraph formatting - preserve line breaks but clean up spacing
  const paragraphs = cleanContent
    .split(/\n\s*\n/)
    .map(p => p.trim().replace(/\n/g, ' ').replace(/\s+/g, ' '))
    .filter(p => p.length > 0);

  return paragraphs
    .map(p => `<p class="text-gray-700 mb-3 leading-relaxed">${p}</p>`)
    .join('\n');
}

// Helper function to decode quoted-printable
function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=([0-9A-F]{2})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/=\r?\n/g, '')
    .replace(/=$/gm, '')
    .replace(/=\s*$/gm, '');
}

// Check if content is mostly quoted-printable encoded
function isQuotedPrintableEncoded(content: string): boolean {
  // Look for patterns like =0A, =3D, =C2, etc.
  const qpPattern = /=[0-9A-F]{2}/gi;
  const matches = content.match(qpPattern);
  if (!matches) return false;
  
  // If more than 10% of content looks like quoted-printable encoding, consider it encoded
  const encodedLength = matches.length * 3; // each match is 3 chars (=XX)
  const ratio = encodedLength / content.length;
  return ratio > 0.1;
}

// Email address helpers
export function getEmailDisplayName(email: string, name?: string): string {
  if (name && name.trim()) {
    return name.trim();
  }
  
  // Extract name from email if no name provided
  const localPart = email.split('@')[0];
  return localPart
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Search helpers
export function fuzzyMatch(query: string, text: string): boolean {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Exact match
  if (textLower.includes(queryLower)) return true;
  
  // Check if all characters in query exist in text in order
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  
  return queryIndex === queryLower.length;
}

export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
}

// Color utilities
export function getContrastColor(backgroundColor: string): string {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function generateCategoryColor(): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#6366f1', // indigo
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

// URL helpers
export function createEmailDetailUrl(emailId: string): string {
  return `/email/${emailId}`;
}

export function createComposeUrl(params?: {
  to?: string;
  subject?: string;
  replyTo?: string;
}): string {
  const url = '/email/compose';
  if (!params) return url;
  
  const searchParams = new URLSearchParams();
  if (params.to) searchParams.set('to', params.to);
  if (params.subject) searchParams.set('subject', params.subject);
  if (params.replyTo) searchParams.set('replyTo', params.replyTo);
  
  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

// Data formatting helpers
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Local storage helpers (for UI state only)
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage errors
  }
}

// Debounce helper
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Vietnamese text helpers
export function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd');
}

export function vietnameseSearch(query: string, text: string): boolean {
  const normalizedQuery = normalizeVietnamese(query);
  const normalizedText = normalizeVietnamese(text);
  return normalizedText.includes(normalizedQuery);
}