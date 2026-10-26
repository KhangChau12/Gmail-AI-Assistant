import 'server-only';
import { ImapFlow, type MailboxObject } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import nodemailer from 'nodemailer';
import { env } from './env';
import type { Address } from '@/lib/types';
import type { NewEmail } from './repo';

export const INBOX = 'INBOX';

function createClient() {
  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: env.gmailAddress, pass: env.gmailAppPassword },
    logger: false,
  });
}

/**
 * Opens a short-lived connection with INBOX locked for the duration of `fn`.
 * Connections are cheap compared to the bugs of keeping a shared one alive across requests.
 */
async function withMailbox<T>(fn: (client: ImapFlow, mailbox: MailboxObject) => Promise<T>, folder = INBOX): Promise<T> {
  const client = createClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      return await fn(client, client.mailbox as MailboxObject);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export interface MailboxSnapshot {
  uidValidity: number;
  flags: Map<number, { seen: boolean; flagged: boolean }>;
}

/** UIDs + flags of every message in the folder. Only a few bytes per message, so cheap even for big inboxes. */
export function snapshotMailbox(folder = INBOX): Promise<MailboxSnapshot> {
  return withMailbox(async (client, mailbox) => {
    const flags: MailboxSnapshot['flags'] = new Map();
    if (mailbox.exists > 0) {
      for await (const msg of client.fetch('1:*', { uid: true, flags: true })) {
        flags.set(msg.uid, { seen: msg.flags?.has('\\Seen') ?? false, flagged: msg.flags?.has('\\Flagged') ?? false });
      }
    }
    return { uidValidity: Number(mailbox.uidValidity), flags };
  }, folder);
}

const FETCH_BATCH = 25;
/** Above this size, embedded images are dropped from stored HTML to keep the database small. */
const MAX_HTML = 1_500_000;

/** Downloads and parses full messages, newest first, reporting progress after each batch. */
export async function fetchMessages(
  uids: number[],
  uidValidity: number,
  onBatch: (emails: NewEmail[]) => void,
  folder = INBOX,
): Promise<void> {
  await withMailbox(async (client) => {
    for (let i = 0; i < uids.length; i += FETCH_BATCH) {
      const batch = uids.slice(i, i + FETCH_BATCH);
      // Collect first: issuing other IMAP commands while a FETCH is streaming deadlocks ImapFlow.
      const raw: { uid: number; flags: Set<string>; source: Buffer; internalDate?: Date | string }[] = [];
      for await (const msg of client.fetch(batch.join(','), { uid: true, flags: true, source: true, internalDate: true }, { uid: true })) {
        if (msg.source) raw.push({ uid: msg.uid, flags: msg.flags ?? new Set(), source: msg.source, internalDate: msg.internalDate });
      }
      const parsed = await Promise.all(raw.map((m) => parseMessage(m, uidValidity, folder)));
      onBatch(parsed);
    }
  }, folder);
}

async function parseMessage(
  msg: { uid: number; flags: Set<string>; source: Buffer; internalDate?: Date | string },
  uidValidity: number,
  folder: string,
): Promise<NewEmail> {
  // Inline (cid:) images are turned into data: URIs so they render offline in the sandboxed reader.
  const mail = await simpleParser(msg.source, { skipTextToHtml: true });
  let html = mail.html || null;
  if (html && html.length > MAX_HTML) html = dropLargeDataUris(html);
  const bodyText = (mail.text ?? (mail.html ? htmlToText(mail.html) : '')).trim();
  const from = addresses(mail.from)[0] ?? { name: '', address: '' };
  const received = mail.date ?? (msg.internalDate ? new Date(msg.internalDate) : new Date());

  return {
    folder,
    uidValidity,
    uid: msg.uid,
    messageId: mail.messageId ?? null,
    from,
    to: addresses(mail.to),
    cc: addresses(mail.cc),
    subject: mail.subject?.trim() ?? '',
    snippet: bodyText.replace(/\s+/g, ' ').slice(0, 200),
    bodyText,
    bodyHtml: html,
    attachments: mail.attachments
      .filter((a) => a.contentDisposition !== 'inline')
      .map((a) => ({ filename: a.filename ?? 'attachment', contentType: a.contentType, size: a.size })),
    receivedAt: received.toISOString(),
    isRead: msg.flags.has('\\Seen'),
    isStarred: msg.flags.has('\\Flagged'),
  };
}

/**
 * Removes big embedded `data:` images. Done with indexOf rather than a regex: a quantified
 * regex over multi-megabyte base64 strings overflows V8's stack.
 */
function dropLargeDataUris(html: string): string {
  const marker = 'src="data:';
  let out = '';
  let cursor = 0;
  for (let start = html.indexOf(marker); start !== -1; start = html.indexOf(marker, cursor)) {
    const end = html.indexOf('"', start + marker.length);
    if (end === -1) break;
    out += html.slice(cursor, start) + (end - start > 2000 ? 'src=""' : html.slice(start, end + 1));
    cursor = end + 1;
  }
  return out + html.slice(cursor);
}

function addresses(field: AddressObject | AddressObject[] | undefined): Address[] {
  if (!field) return [];
  return (Array.isArray(field) ? field : [field])
    .flatMap((group) => group.value)
    .filter((a) => a.address)
    .map((a) => ({ name: a.name ?? '', address: a.address! }));
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n');
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function setFlag(uid: number, flag: '\\Seen' | '\\Flagged', on: boolean, folder = INBOX) {
  return withMailbox(async (client) => {
    if (on) await client.messageFlagsAdd(String(uid), [flag], { uid: true });
    else await client.messageFlagsRemove(String(uid), [flag], { uid: true });
  }, folder);
}

/**
 * Gmail localises folder names ("[Gmail]/Tất cả thư"), so find them by their special-use attribute.
 * Moving to All Mail = archive; moving to Trash = delete.
 */
export function moveMessage(uid: number, target: '\\All' | '\\Trash', folder = INBOX) {
  return withMailbox(async (client) => {
    const folders = await client.list();
    const destination = folders.find((f) => f.specialUse === target)?.path;
    if (!destination) throw new Error(`No ${target} folder found on this account`);
    await client.messageMove(String(uid), destination, { uid: true });
  }, folder);
}

export async function sendMail(input: { to: string; subject: string; text: string; inReplyTo?: string | null }) {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: env.gmailAddress, pass: env.gmailAppPassword },
  });
  await transport.sendMail({
    from: env.gmailAddress,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo, references: input.inReplyTo } : {}),
  });
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await withMailbox(async () => undefined);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
