import 'server-only';
import { db } from './db';
import { env } from './env';
import type {
  ActionItem,
  Address,
  Attachment,
  Category,
  ChatMessage,
  ChatMeta,
  Conversation,
  Counts,
  Draft,
  EmailDetail,
  EmailListItem,
  Language,
  Priority,
  TodayData,
  View,
} from '@/lib/types';

// ─── Row mapping ─────────────────────────────────────────────────────────────

interface EmailRow {
  id: number;
  folder: string;
  uid_validity: number;
  uid: number;
  message_id: string | null;
  from_name: string;
  from_address: string;
  to_json: string;
  cc_json: string;
  subject: string;
  snippet: string;
  body_text: string;
  body_html: string | null;
  attachments_json: string;
  received_at: string;
  is_read: number;
  is_starred: number;
  category_id: number | null;
  summary: string | null;
  priority: Priority | null;
  needs_reply: number;
  due_date: string | null;
  replied_at: string | null;
  actions_json: string;
  quick_replies_json: string | null;
  triage_status: EmailListItem['triageStatus'];
}

const LIST_FIELDS = [
  'id', 'from_name', 'from_address', 'subject', 'snippet', 'summary', 'received_at', 'is_read', 'is_starred',
  'attachments_json', 'category_id', 'priority', 'needs_reply', 'due_date', 'replied_at', 'triage_status',
];
const LIST_COLUMNS = LIST_FIELDS.join(', ');

function toListItem(row: EmailRow): EmailListItem {
  return {
    id: row.id,
    fromName: row.from_name,
    fromAddress: row.from_address,
    subject: row.subject,
    snippet: row.snippet,
    summary: row.summary,
    receivedAt: row.received_at,
    isRead: row.is_read === 1,
    isStarred: row.is_starred === 1,
    hasAttachments: row.attachments_json !== '[]',
    categoryId: row.category_id,
    priority: row.priority,
    needsReply: row.needs_reply === 1,
    dueDate: row.due_date,
    repliedAt: row.replied_at,
    triageStatus: row.triage_status,
  };
}

function toDetail(row: EmailRow): EmailDetail {
  return {
    ...toListItem(row),
    messageId: row.message_id,
    to: JSON.parse(row.to_json) as Address[],
    cc: JSON.parse(row.cc_json) as Address[],
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    attachments: JSON.parse(row.attachments_json) as Attachment[],
    actions: JSON.parse(row.actions_json) as ActionItem[],
    quickReplies: row.quick_replies_json ? (JSON.parse(row.quick_replies_json) as string[]) : null,
  };
}

/** Turns free text into a safe FTS5 prefix query: `foo bar` → `"foo"* "bar"*` (or `… OR …`). */
function ftsQuery(text: string, anyTerm = false): string | null {
  const terms = text
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter(Boolean);
  return terms.length ? terms.map((t) => `"${t}"*`).join(anyTerm ? ' OR ' : ' ') : null;
}

// ─── Emails ──────────────────────────────────────────────────────────────────

/**
 * "Needs you": the AI flagged it (reply expected or high priority), you haven't replied from here,
 * and it is still current — a deadline at most 3 days past, or, without a deadline, received in the last 14 days.
 */
const actionWhere = (p: string) =>
  `${p}replied_at IS NULL AND (${p}needs_reply = 1 OR ${p}priority = 'high') AND CASE WHEN ${p}due_date IS NOT NULL
     THEN ${p}due_date >= date('now', 'localtime', '-3 days')
     ELSE ${p}received_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days') END`;
const ACTION_WHERE = actionWhere('');
const ACTION_WHERE_E = actionWhere('e.');

export interface EmailFilter {
  view?: View;
  categoryId?: number;
  query?: string;
  /** Match emails containing any query term instead of all of them (used by the assistant). */
  anyTerm?: boolean;
  from?: string;
  unread?: boolean;
  after?: string;
  before?: string;
  limit?: number;
  offset?: number;
}

export function listEmails(filter: EmailFilter): EmailListItem[] {
  const where: string[] = ['e.in_inbox = 1'];
  const params: Record<string, unknown> = {};

  switch (filter.view) {
    case 'unread':
      where.push('e.is_read = 0');
      break;
    case 'action':
      where.push(ACTION_WHERE_E);
      break;
    case 'starred':
      where.push('e.is_starred = 1');
      break;
  }
  if (filter.categoryId !== undefined) {
    where.push('e.category_id = @categoryId');
    params.categoryId = filter.categoryId;
  }
  if (filter.unread !== undefined) {
    where.push('e.is_read = @isRead');
    params.isRead = filter.unread ? 0 : 1;
  }
  if (filter.from) {
    where.push('(e.from_address LIKE @from OR e.from_name LIKE @from)');
    params.from = `%${filter.from}%`;
  }
  if (filter.after) {
    where.push('e.received_at >= @after');
    params.after = filter.after;
  }
  if (filter.before) {
    where.push('e.received_at < @before');
    params.before = filter.before;
  }

  const match = filter.query ? ftsQuery(filter.query, filter.anyTerm) : null;
  if (match) {
    where.push('e.id IN (SELECT rowid FROM emails_fts WHERE emails_fts MATCH @match)');
    params.match = match;
  }

  params.limit = Math.min(filter.limit ?? 50, 200);
  params.offset = filter.offset ?? 0;

  const rows = db
    .prepare(
      `SELECT ${LIST_FIELDS.map((f) => `e.${f}`).join(', ')} FROM emails e
       WHERE ${where.join(' AND ')}
       ORDER BY e.received_at DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all(params) as EmailRow[];
  return rows.map(toListItem);
}

export function getEmail(id: number): EmailDetail | null {
  const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined;
  return row ? toDetail(row) : null;
}

export function getEmailsByIds(ids: number[]): EmailListItem[] {
  if (!ids.length) return [];
  const rows = db
    .prepare(`SELECT ${LIST_COLUMNS} FROM emails WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as EmailRow[];
  const byId = new Map(rows.map((r) => [r.id, toListItem(r)]));
  return ids.map((id) => byId.get(id)).filter((e): e is EmailListItem => !!e);
}

/** Location of the message on the IMAP server, needed for flag changes and moves. */
export function getEmailLocation(id: number) {
  return db.prepare('SELECT folder, uid_validity AS uidValidity, uid FROM emails WHERE id = ?').get(id) as
    | { folder: string; uidValidity: number; uid: number }
    | undefined;
}

export function getCounts(): Counts {
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS inbox,
              COALESCE(SUM(is_read = 0), 0) AS unread,
              COALESCE(SUM(${ACTION_WHERE}), 0) AS action,
              COALESCE(SUM(is_starred = 1), 0) AS starred,
              (SELECT COUNT(*) FROM drafts) AS drafts
       FROM emails WHERE in_inbox = 1`,
    )
    .get() as Omit<Counts, 'categories'>;
  const perCategory = db
    .prepare(
      `SELECT category_id AS id, COUNT(*) AS total, SUM(is_read = 0) AS unread
       FROM emails WHERE in_inbox = 1 AND category_id IS NOT NULL GROUP BY category_id`,
    )
    .all() as { id: number; total: number; unread: number }[];

  const categories: Counts['categories'] = {};
  for (const c of perCategory) categories[c.id] = { total: c.total, unread: c.unread };
  return { ...totals, categories };
}

export function setRead(id: number, isRead: boolean) {
  db.prepare('UPDATE emails SET is_read = ? WHERE id = ?').run(isRead ? 1 : 0, id);
}

export function setStarred(id: number, isStarred: boolean) {
  db.prepare('UPDATE emails SET is_starred = ? WHERE id = ?').run(isStarred ? 1 : 0, id);
}

export function markReplied(id: number) {
  db.prepare(`UPDATE emails SET replied_at = datetime('now') WHERE id = ?`).run(id);
}

export function setActionDone(id: number, index: number, done: boolean) {
  const row = db.prepare('SELECT actions_json FROM emails WHERE id = ?').get(id) as { actions_json: string } | undefined;
  if (!row) return;
  const actions = JSON.parse(row.actions_json) as ActionItem[];
  if (!actions[index]) return;
  actions[index].done = done;
  db.prepare('UPDATE emails SET actions_json = ? WHERE id = ?').run(JSON.stringify(actions), id);
}

export function saveQuickReplies(id: number, replies: string[]) {
  db.prepare('UPDATE emails SET quick_replies_json = ? WHERE id = ?').run(JSON.stringify(replies), id);
}

export function removeFromInbox(id: number) {
  db.prepare('UPDATE emails SET in_inbox = 0 WHERE id = ?').run(id);
}

/** Manual recategorisation also teaches a rule for every future email from that sender. */
export function setCategory(id: number, categoryId: number | null) {
  db.transaction(() => {
    db.prepare('UPDATE emails SET category_id = ? WHERE id = ?').run(categoryId, id);
    const email = db.prepare('SELECT from_address FROM emails WHERE id = ?').get(id) as
      | { from_address: string }
      | undefined;
    if (!email?.from_address) return;
    if (categoryId === null) {
      db.prepare('DELETE FROM sender_rules WHERE sender_address = ?').run(email.from_address);
    } else {
      upsertSenderRule(email.from_address, categoryId, 'user');
    }
  })();
}

// ─── Sync support ────────────────────────────────────────────────────────────

export interface NewEmail {
  folder: string;
  uidValidity: number;
  uid: number;
  messageId: string | null;
  from: Address;
  to: Address[];
  cc: Address[];
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string | null;
  attachments: Attachment[];
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
}

const insertEmailStmt = () =>
  db.prepare(
    `INSERT OR IGNORE INTO emails
       (folder, uid_validity, uid, message_id, from_name, from_address, to_json, cc_json, subject, snippet,
        body_text, body_html, attachments_json, received_at, is_read, is_starred)
     VALUES
       (@folder, @uidValidity, @uid, @messageId, @fromName, @fromAddress, @toJson, @ccJson, @subject, @snippet,
        @bodyText, @bodyHtml, @attachmentsJson, @receivedAt, @isRead, @isStarred)`,
  );

export function insertEmails(emails: NewEmail[]): number {
  const stmt = insertEmailStmt();
  let added = 0;
  db.transaction(() => {
    for (const e of emails) {
      const result = stmt.run({
        folder: e.folder,
        uidValidity: e.uidValidity,
        uid: e.uid,
        messageId: e.messageId,
        fromName: e.from.name,
        fromAddress: e.from.address.toLowerCase(),
        toJson: JSON.stringify(e.to),
        ccJson: JSON.stringify(e.cc),
        subject: e.subject,
        snippet: e.snippet,
        bodyText: e.bodyText,
        bodyHtml: e.bodyHtml,
        attachmentsJson: JSON.stringify(e.attachments),
        receivedAt: e.receivedAt,
        isRead: e.isRead ? 1 : 0,
        isStarred: e.isStarred ? 1 : 0,
      });
      added += result.changes;
    }
  })();
  return added;
}

export function getSyncState(folder: string) {
  return db
    .prepare('SELECT uid_validity AS uidValidity, last_uid AS lastUid, last_synced_at AS lastSyncedAt FROM sync_state WHERE folder = ?')
    .get(folder) as { uidValidity: number; lastUid: number; lastSyncedAt: string | null } | undefined;
}

export function saveSyncState(folder: string, uidValidity: number, lastUid: number) {
  db.prepare(
    `INSERT INTO sync_state (folder, uid_validity, last_uid, last_synced_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (folder) DO UPDATE SET uid_validity = excluded.uid_validity, last_uid = excluded.last_uid,
       last_synced_at = excluded.last_synced_at`,
  ).run(folder, uidValidity, lastUid, new Date().toISOString());
}

/** Gmail can reset UIDVALIDITY; when it does, every stored UID for that folder is meaningless. */
export function resetFolder(folder: string) {
  db.transaction(() => {
    db.prepare('DELETE FROM emails WHERE folder = ?').run(folder);
    db.prepare('DELETE FROM sync_state WHERE folder = ?').run(folder);
  })();
}

export function knownUids(folder: string, uidValidity: number): number[] {
  return (
    db.prepare('SELECT uid FROM emails WHERE folder = ? AND uid_validity = ? AND in_inbox = 1').all(folder, uidValidity) as {
      uid: number;
    }[]
  ).map((r) => r.uid);
}

/** Mirrors server-side flag changes and messages that left the folder (archived/deleted elsewhere). */
export function applyRemoteFlags(
  folder: string,
  uidValidity: number,
  flags: Map<number, { seen: boolean; flagged: boolean }>,
) {
  const update = db.prepare(
    'UPDATE emails SET is_read = ?, is_starred = ? WHERE folder = ? AND uid_validity = ? AND uid = ? AND (is_read != ? OR is_starred != ?)',
  );
  const remove = db.prepare('UPDATE emails SET in_inbox = 0 WHERE folder = ? AND uid_validity = ? AND uid = ?');
  db.transaction(() => {
    for (const uid of knownUids(folder, uidValidity)) {
      const f = flags.get(uid);
      if (!f) {
        remove.run(folder, uidValidity, uid);
        continue;
      }
      const read = f.seen ? 1 : 0;
      const star = f.flagged ? 1 : 0;
      update.run(read, star, folder, uidValidity, uid, read, star);
    }
  })();
}

export interface PendingTriage {
  id: number;
  fromName: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: string;
}

export function pendingTriage(limit = 500): PendingTriage[] {
  return db
    .prepare(
      `SELECT id, from_name AS fromName, from_address AS fromAddress, subject, body_text AS bodyText, received_at AS receivedAt
       FROM emails WHERE triage_status = 'pending' ORDER BY received_at DESC LIMIT ?`,
    )
    .all(limit) as PendingTriage[];
}

export function countPendingTriage(): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM emails WHERE triage_status = 'pending'`).get() as { n: number }).n;
}

export interface TriageFields {
  categoryId: number | null;
  summary: string;
  priority: Priority;
  needsReply: boolean;
  dueDate: string | null;
  actions: string[];
}

export function saveTriage(id: number, result: TriageFields) {
  const actions: ActionItem[] = result.actions.map((text) => ({ text, done: false }));
  db.prepare(
    `UPDATE emails SET category_id = COALESCE(category_id, ?), summary = ?, priority = ?, needs_reply = ?, due_date = ?,
       actions_json = ?, quick_replies_json = NULL, triage_status = 'done', triage_error = NULL WHERE id = ?`,
  ).run(result.categoryId, result.summary, result.priority, result.needsReply ? 1 : 0, result.dueDate, JSON.stringify(actions), id);
}

export function failTriage(id: number, error: string) {
  db.prepare(`UPDATE emails SET triage_status = 'failed', triage_error = ? WHERE id = ?`).run(error.slice(0, 500), id);
}

export function retryFailedTriage() {
  db.prepare(`UPDATE emails SET triage_status = 'pending' WHERE triage_status = 'failed'`).run();
}

// ─── Sender rules ────────────────────────────────────────────────────────────

export function getSenderRules(): Map<string, { categoryId: number; source: 'user' | 'ai' }> {
  const rows = db.prepare('SELECT sender_address, category_id, source FROM sender_rules').all() as {
    sender_address: string;
    category_id: number;
    source: 'user' | 'ai';
  }[];
  return new Map(rows.map((r) => [r.sender_address, { categoryId: r.category_id, source: r.source }]));
}

export function upsertSenderRule(sender: string, categoryId: number, source: 'user' | 'ai') {
  // An AI guess never overwrites a rule the user set by hand.
  db.prepare(
    `INSERT INTO sender_rules (sender_address, category_id, source) VALUES (?, ?, ?)
     ON CONFLICT (sender_address) DO UPDATE SET category_id = excluded.category_id, source = excluded.source,
       updated_at = datetime('now')
     WHERE sender_rules.source = 'ai' OR excluded.source = 'user'`,
  ).run(sender.toLowerCase(), categoryId, source);
}

// ─── Categories ──────────────────────────────────────────────────────────────

type CategoryInput = Pick<Category, 'name' | 'description' | 'color' | 'icon'>;

const DEFAULT_CATEGORIES: Record<Language, CategoryInput[]> = {
  en: [
    { name: 'Work', icon: 'briefcase', color: 'indigo', description: 'Work and projects: meetings, clients, colleagues, partner organisations.' },
    { name: 'School', icon: 'school', color: 'sky', description: 'School and studies: classes, exams, teachers, school offices, clubs.' },
    { name: 'Finance', icon: 'wallet', color: 'mint', description: 'Receipts, invoices, bank and payment notifications, subscriptions and bills.' },
    { name: 'Newsletters', icon: 'newspaper', color: 'violet', description: 'Newsletters, digests, marketing and promotions sent to many recipients.' },
    { name: 'Notifications', icon: 'bell', color: 'sand', description: 'Automated notifications from apps and services: security alerts, account activity.' },
    { name: 'Personal', icon: 'heart', color: 'coral', description: 'Messages written personally to me by friends, family or other individuals.' },
  ],
  vi: [
    { name: 'Công việc', icon: 'briefcase', color: 'indigo', description: 'Công việc và dự án: họp, khách hàng, đồng nghiệp, tổ chức hợp tác.' },
    { name: 'Học tập', icon: 'school', color: 'sky', description: 'Trường lớp: lịch học, lịch thi, thầy cô, phòng ban của trường, câu lạc bộ.' },
    { name: 'Tài chính', icon: 'wallet', color: 'mint', description: 'Hoá đơn, biên lai, thông báo ngân hàng và thanh toán, gói đăng ký.' },
    { name: 'Bản tin', icon: 'newspaper', color: 'violet', description: 'Newsletter, bản tin tổng hợp, quảng cáo và khuyến mãi gửi cho nhiều người.' },
    { name: 'Thông báo', icon: 'bell', color: 'sand', description: 'Thông báo tự động từ ứng dụng và dịch vụ: bảo mật, hoạt động tài khoản.' },
    { name: 'Cá nhân', icon: 'heart', color: 'coral', description: 'Thư viết riêng cho tôi từ bạn bè, gia đình hoặc cá nhân khác.' },
  ],
};

/** Starter set of databases created before v0.2 (English only, no School). */
const LEGACY_DEFAULTS = ['Work', 'Personal', 'Finance', 'Newsletters', 'Notifications'];

/**
 * Fresh databases get starter categories in the user's language, once; deleting them all later is respected.
 * Databases still holding the untouched legacy English set are upgraded to the current starter set instead.
 */
function seedCategories() {
  if (db.prepare(`SELECT 1 FROM settings WHERE key = 'categories_seeded'`).get()) return;
  db.transaction(() => {
    const existing = db.prepare('SELECT id, name FROM categories ORDER BY id').all() as { id: number; name: string }[];
    const defaults = DEFAULT_CATEGORIES[getLanguage()];
    if (existing.length === 0) {
      for (const c of defaults) createCategory(c);
    } else if (existing.map((c) => c.name).join() === LEGACY_DEFAULTS.join()) {
      // Same order as DEFAULT_CATEGORIES minus "School": map by English name, then add the new one.
      const englishIndex = (name: string) => DEFAULT_CATEGORIES.en.findIndex((c) => c.name === name);
      for (const c of existing) {
        const next = defaults[englishIndex(c.name)];
        db.prepare('UPDATE categories SET name = ?, description = ?, color = ?, icon = ?, position = ? WHERE id = ?').run(
          next.name, next.description, next.color, next.icon, englishIndex(c.name), c.id,
        );
      }
      const school = defaults[englishIndex('School')];
      db.prepare('INSERT INTO categories (name, description, color, icon, position) VALUES (?, ?, ?, ?, ?)').run(
        school.name, school.description, school.color, school.icon, englishIndex('School'),
      );
    }
    db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('categories_seeded', '1')`).run();
  })();
}

export function listCategories(): Category[] {
  seedCategories();
  return db.prepare('SELECT id, name, description, color, icon, position FROM categories ORDER BY position, id').all() as Category[];
}

export function createCategory(input: CategoryInput): Category {
  const position = (db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM categories').get() as { p: number }).p;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO categories (name, description, color, icon, position) VALUES (?, ?, ?, ?, ?)')
    .run(input.name, input.description, input.color, input.icon, position);
  return { id: Number(lastInsertRowid), position, ...input };
}

export function updateCategory(id: number, input: Partial<CategoryInput>) {
  const current = db.prepare('SELECT name, description, color, icon FROM categories WHERE id = ?').get(id) as CategoryInput | undefined;
  if (!current) return;
  const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const next = { ...current, ...changes };
  db.prepare('UPDATE categories SET name = ?, description = ?, color = ?, icon = ? WHERE id = ?').run(
    next.name,
    next.description,
    next.color,
    next.icon,
    id,
  );
}

export function deleteCategory(id: number) {
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

/** Re-runs AI triage for everything, e.g. after category descriptions change. */
export function resetTriage() {
  db.transaction(() => {
    db.prepare(`DELETE FROM sender_rules WHERE source = 'ai'`).run();
    db.prepare(
      `UPDATE emails SET triage_status = 'pending',
         category_id = CASE WHEN from_address IN (SELECT sender_address FROM sender_rules) THEN category_id ELSE NULL END`,
    ).run();
  })();
}

// ─── Drafts ──────────────────────────────────────────────────────────────────

interface DraftRow {
  id: number;
  to_addr: string;
  subject: string;
  body: string;
  reply_to_email_id: number | null;
  updated_at: string;
}

const toDraft = (r: DraftRow): Draft => ({
  id: r.id,
  to: r.to_addr,
  subject: r.subject,
  body: r.body,
  replyToEmailId: r.reply_to_email_id,
  updatedAt: r.updated_at,
});

export function listDrafts(): Draft[] {
  return (db.prepare('SELECT * FROM drafts ORDER BY updated_at DESC').all() as DraftRow[]).map(toDraft);
}

export function saveDraft(input: { id?: number; to: string; subject: string; body: string; replyToEmailId?: number | null }): Draft {
  if (input.id) {
    db.prepare(
      `UPDATE drafts SET to_addr = ?, subject = ?, body = ?, reply_to_email_id = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(input.to, input.subject, input.body, input.replyToEmailId ?? null, input.id);
    return toDraft(db.prepare('SELECT * FROM drafts WHERE id = ?').get(input.id) as DraftRow);
  }
  const { lastInsertRowid } = db
    .prepare('INSERT INTO drafts (to_addr, subject, body, reply_to_email_id) VALUES (?, ?, ?, ?)')
    .run(input.to, input.subject, input.body, input.replyToEmailId ?? null);
  return toDraft(db.prepare('SELECT * FROM drafts WHERE id = ?').get(lastInsertRowid) as DraftRow);
}

export function deleteDraft(id: number) {
  db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
}

// ─── Contacts (derived from mail history) ────────────────────────────────────

export function searchContacts(query: string, limit = 8): Address[] {
  return db
    .prepare(
      `SELECT from_address AS address, MAX(from_name) AS name, COUNT(*) AS n FROM emails
       WHERE from_address LIKE @q OR from_name LIKE @q
       GROUP BY from_address ORDER BY n DESC LIMIT @limit`,
    )
    .all({ q: `%${query}%`, limit }) as Address[];
}

// ─── Stats for the assistant ─────────────────────────────────────────────────

export function inboxStats(after?: string, before?: string) {
  const range = { after: after ?? '0000', before: before ?? '9999' };
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(is_read = 0), 0) AS unread, COALESCE(SUM(${ACTION_WHERE}), 0) AS needs_action
       FROM emails WHERE in_inbox = 1 AND received_at >= @after AND received_at < @before`,
    )
    .get(range);
  const topSenders = db
    .prepare(
      `SELECT from_address AS address, MAX(from_name) AS name, COUNT(*) AS count FROM emails
       WHERE in_inbox = 1 AND received_at >= @after AND received_at < @before
       GROUP BY from_address ORDER BY count DESC LIMIT 5`,
    )
    .all(range);
  const byCategory = db
    .prepare(
      `SELECT COALESCE(c.name, '—') AS category, COUNT(*) AS count, SUM(e.is_read = 0) AS unread
       FROM emails e LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.in_inbox = 1 AND e.received_at >= @after AND e.received_at < @before
       GROUP BY e.category_id ORDER BY count DESC`,
    )
    .all(range);
  return { ...(totals as object), topSenders, byCategory };
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function getLanguage(): Language {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'language'`).get() as { value: string } | undefined;
  return row?.value === 'en' || row?.value === 'vi' ? row.value : env.defaultLanguage;
}

export function setLanguage(language: Language) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('language', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  ).run(language);
}

// ─── Today ───────────────────────────────────────────────────────────────────

export function getToday(): TodayData {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const newCount = (db.prepare('SELECT COUNT(*) AS n FROM emails WHERE in_inbox = 1 AND received_at >= ?').get(dayAgo) as { n: number }).n;

  // Deadlines first (soonest), then high priority, then newest.
  const action = (
    db
      .prepare(
        `SELECT ${LIST_COLUMNS} FROM emails WHERE in_inbox = 1 AND ${ACTION_WHERE}
         ORDER BY due_date IS NULL, due_date, priority != 'high', received_at DESC LIMIT 5`,
      )
      .all() as EmailRow[]
  ).map(toListItem);

  const statsStmt = db.prepare(
    'SELECT COUNT(*) AS total, COALESCE(SUM(is_read = 0), 0) AS unread FROM emails WHERE in_inbox = 1 AND category_id = ?',
  );
  const latestStmt = db.prepare(
    `SELECT id, from_name AS fromName, from_address AS fromAddress, subject FROM emails
     WHERE in_inbox = 1 AND category_id = ? ORDER BY received_at DESC LIMIT 1`,
  );
  const categories = listCategories().map((c) => {
    const stats = statsStmt.get(c.id) as { total: number; unread: number };
    const latest = latestStmt.get(c.id) as TodayData['categories'][number]['latest'] | undefined;
    return { id: c.id, ...stats, latest: latest ?? null };
  });

  const activity: TodayData['activity'] = [];
  const countStmt = db.prepare('SELECT COUNT(*) AS n FROM emails WHERE received_at >= ? AND received_at < ?');
  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    activity.push({ date: start.toISOString(), count: (countStmt.get(start.toISOString(), end.toISOString()) as { n: number }).n });
  }

  return { userName: env.userName, newCount, action, categories, activity };
}

// ─── Assistant conversations ─────────────────────────────────────────────────

export function listConversations(limit = 30): Conversation[] {
  return db
    .prepare('SELECT id, title, updated_at AS updatedAt FROM conversations ORDER BY updated_at DESC, id DESC LIMIT ?')
    .all(limit) as Conversation[];
}

export function createConversation(title: string): Conversation {
  const { lastInsertRowid } = db.prepare('INSERT INTO conversations (title) VALUES (?)').run(title.slice(0, 80));
  return db.prepare('SELECT id, title, updated_at AS updatedAt FROM conversations WHERE id = ?').get(lastInsertRowid) as Conversation;
}

export function deleteConversation(id: number) {
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function conversationExists(id: number): boolean {
  return !!db.prepare('SELECT 1 FROM conversations WHERE id = ?').get(id);
}

export function addChatMessage(conversationId: number, role: 'user' | 'assistant', content: string, meta: ChatMeta = {}): number {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO chat_messages (conversation_id, role, content, meta_json) VALUES (?, ?, ?, ?)')
    .run(conversationId, role, content, JSON.stringify(meta));
  db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(conversationId);
  return Number(lastInsertRowid);
}

export function getChatMessages(conversationId: number): ChatMessage[] {
  const rows = db
    .prepare('SELECT id, role, content, meta_json FROM chat_messages WHERE conversation_id = ? ORDER BY id')
    .all(conversationId) as { id: number; role: 'user' | 'assistant'; content: string; meta_json: string }[];
  return rows.map((r) => {
    const meta = JSON.parse(r.meta_json) as ChatMeta;
    return { id: r.id, role: r.role, content: r.content, meta, emails: getEmailsByIds(meta.emailIds ?? []) };
  });
}

export function updateChatDraft(messageId: number, draft: ChatMeta['draft']) {
  const row = db.prepare('SELECT meta_json FROM chat_messages WHERE id = ?').get(messageId) as { meta_json: string } | undefined;
  if (!row) return;
  const meta = JSON.parse(row.meta_json) as ChatMeta;
  db.prepare('UPDATE chat_messages SET meta_json = ? WHERE id = ?').run(JSON.stringify({ ...meta, draft }), messageId);
}
