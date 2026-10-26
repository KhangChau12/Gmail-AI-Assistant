export type Priority = 'high' | 'normal' | 'low';
export type TriageStatus = 'pending' | 'done' | 'failed';
/** `action` = needs a reply or is high priority, and hasn't been replied to from the app yet. */
export type View = 'inbox' | 'action' | 'unread' | 'starred';
export type Language = 'vi' | 'en';

export interface Address {
  name: string;
  address: string;
}

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailListItem {
  id: number;
  fromName: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  summary: string | null;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  categoryId: number | null;
  priority: Priority | null;
  needsReply: boolean;
  /** YYYY-MM-DD the AI found in the email, if any. */
  dueDate: string | null;
  repliedAt: string | null;
  triageStatus: TriageStatus;
}

export interface ActionItem {
  text: string;
  done: boolean;
}

export interface EmailDetail extends EmailListItem {
  messageId: string | null;
  to: Address[];
  cc: Address[];
  bodyText: string;
  bodyHtml: string | null;
  attachments: Attachment[];
  actions: ActionItem[];
  /** Short reply intents generated on demand; null until requested. */
  quickReplies: string[] | null;
}

/** Theme-aware palette keys; the actual colours live in CSS variables (`--c-<key>`). */
export const CATEGORY_COLORS = ['indigo', 'sky', 'mint', 'violet', 'sand', 'coral'] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const CATEGORY_ICONS = [
  'briefcase', 'school', 'wallet', 'newspaper', 'bell', 'heart', 'user', 'tag', 'plane', 'cart', 'code', 'star',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export interface Category {
  id: number;
  name: string;
  description: string;
  color: CategoryColor;
  icon: CategoryIcon;
  position: number;
}

export interface Counts {
  inbox: number;
  unread: number;
  action: number;
  starred: number;
  drafts: number;
  categories: Record<number, { total: number; unread: number }>;
}

export interface TodayData {
  userName: string;
  /** Emails received in the last 24 hours. */
  newCount: number;
  action: EmailListItem[];
  categories: { id: number; total: number; unread: number; latest: Pick<EmailListItem, 'id' | 'fromName' | 'fromAddress' | 'subject'> | null }[];
  /** Emails received per day, oldest first, last 7 days including today. */
  activity: { date: string; count: number }[];
}

export interface Draft {
  id: number;
  to: string;
  subject: string;
  body: string;
  replyToEmailId: number | null;
  updatedAt: string;
}

export interface ComposeState {
  draftId?: number;
  to: string;
  subject: string;
  body: string;
  replyToEmailId?: number | null;
}

export type SyncEvent =
  | { type: 'phase'; phase: 'connecting' | 'fetching' | 'flags' | 'triage'; total?: number }
  | { type: 'progress'; phase: 'fetching' | 'triage'; done: number; total: number }
  | { type: 'done'; added: number; triaged: number; finishedAt: string }
  | { type: 'error'; message: string };

export interface SyncStatus {
  running: boolean;
  lastSyncedAt: string | null;
  pendingTriage: number;
  lastError: string | null;
}

// ─── Assistant ───────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolStep {
  name: string;
  label: string;
}

export interface ChatDraft extends ComposeState {
  sent?: boolean;
}

/** What an assistant message carries besides its text; stored with the message. */
export interface ChatMeta {
  steps?: ToolStep[];
  emailIds?: number[];
  draft?: ChatDraft;
  /** The email the answer was mainly about (read or replied to), shown in the context panel. */
  contextEmailId?: number;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  meta: ChatMeta;
  emails: EmailListItem[];
}

export interface Conversation {
  id: number;
  title: string;
  updatedAt: string;
}

export type ChatEvent =
  | { type: 'conversation'; id: number; title: string }
  | { type: 'tool'; name: string; label: string }
  | { type: 'delta'; text: string }
  | { type: 'emails'; emails: EmailListItem[] }
  | { type: 'draft'; draft: ChatDraft }
  | { type: 'context'; emailId: number }
  | { type: 'open_email'; emailId: number }
  | { type: 'saved'; messageId: number }
  | { type: 'done' }
  | { type: 'error'; message: string };
