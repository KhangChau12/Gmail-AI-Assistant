// Database Types (Simplified for single user)
export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  gmail_label?: string;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  aliases: string[];
  category?: string;
  notes?: string;
  extracted_from_email: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailAssignment {
  id: string;
  sender_email: string;
  sender_name?: string;
  category_id: string;
  confidence_score: number;
  assigned_at: string;
}

export interface Draft {
  id: string;
  to_email: string;
  to_name?: string;
  subject: string;
  body: string;
  reply_to_message_id?: string;
  session_id?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CompositionSession {
  id: string;
  draft_id?: string;
  reply_to_message_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CompositionChatMessage {
  id: string;
  session_id: string;
  user_message: string;
  ai_response: string;
  suggested_subject?: string;
  suggested_body?: string;
  suggestion_applied: boolean;
  created_at: string;
}

export interface ProcessedEmail {
  id: string;
  imap_uid: string;
  message_id?: string;
  sender_email?: string;
  sender_name?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  category_id?: string;
  summary?: string;
  received_date?: string;
  processed_at: string;
  parsing_status?: 'success' | 'failed' | 'partial';
  content_length?: number;
  parsing_errors?: string[];
  last_reprocessed?: string;
  is_read: boolean;  // Track email read status from IMAP flags
}

// Gmail IMAP Types
export interface GmailCredentials {
  email: string;
  appPassword: string;
}

export interface IMAPMessage {
  uid: string;
  messageId?: string;
  from: {
    name?: string;
    address: string;
  };
  to: Array<{
    name?: string;
    address: string;
  }>;
  subject: string;
  date: Date;
  bodyText?: string;
  bodyHtml?: string;
  parseSuccess?: boolean;
  flags: string[];
}

export interface IMAPFolder {
  name: string;
  path: string;
  delimiter: string;
  flags: string[];
  specialUse?: string;
}

// AI Agent Types
export interface ClassificationResult {
  category_id: string | null;
  confidence: number;
}

export interface SummaryResult {
  summary: string;
}

export interface ChatResponse {
  response_text: string;
  action: 'navigate' | 'compose' | 'search' | 'sync' | 'searchAndAnalyze' | 'none';
  navigation_url?: string;
  compose_data?: {
    to_email?: string;
    to_name?: string;
    subject?: string;
  };
  search_params?: {
    query: string;
    category_id?: string;
  };
  sync_folder?: string;
  analysis_data?: {
    totalEmails: number;
    unreadCount: number;
    categoryBreakdown: Array<{
      category: {
        id: string;
        name: string;
        description: string;
        color: string;
      };
      count: number;
      unreadCount: number;
    }>;
    topSenders: Array<{
      email: string;
      name?: string;
      count: number;
    }>;
    insights: string[];
    summaries: Array<{
      email_id: string;
      subject: string;
      sender: string;
      summary: string;
      received_date: string;
      is_read: boolean;
    }>;
  };
}

export interface ComposeResponse {
  response_text: string;
  subject: string;
  body: string;
}

// UI Context Types
export interface AppContext {
  currentPage: string;
  currentEmail?: ProcessedEmail;
  currentDraft?: Draft;
  gmailFolders: IMAPFolder[];
}

export interface EmailSummary {
  total: number;
  unread: number;
  categories: Array<{
    category: Category;
    count: number;
    unread: number;
  }>;
}

// Component Props
export interface EmailCardProps {
  email: ProcessedEmail;
  category?: Category;
  onClick: () => void;
}

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ChatBoxProps {
  context: AppContext;
  onActionReceived: (action: ChatResponse) => void;
}