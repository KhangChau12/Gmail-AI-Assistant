import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';

// Each entry upgrades the schema by one version. Never edit a shipped migration — append a new one.
const migrations: string[] = [
  `
  CREATE TABLE categories (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#8b8d98',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE emails (
    id               INTEGER PRIMARY KEY,
    folder           TEXT NOT NULL,
    uid_validity     INTEGER NOT NULL,
    uid              INTEGER NOT NULL,
    message_id       TEXT,
    from_name        TEXT NOT NULL DEFAULT '',
    from_address     TEXT NOT NULL DEFAULT '',
    to_json          TEXT NOT NULL DEFAULT '[]',
    cc_json          TEXT NOT NULL DEFAULT '[]',
    subject          TEXT NOT NULL DEFAULT '',
    snippet          TEXT NOT NULL DEFAULT '',
    body_text        TEXT NOT NULL DEFAULT '',
    body_html        TEXT,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    received_at      TEXT NOT NULL,
    is_read          INTEGER NOT NULL DEFAULT 0,
    is_starred       INTEGER NOT NULL DEFAULT 0,
    in_inbox         INTEGER NOT NULL DEFAULT 1,
    category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    summary          TEXT,
    priority         TEXT CHECK (priority IN ('high', 'normal', 'low')),
    triage_status    TEXT NOT NULL DEFAULT 'pending' CHECK (triage_status IN ('pending', 'done', 'failed')),
    triage_error     TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (folder, uid_validity, uid)
  );
  CREATE INDEX emails_received ON emails (in_inbox, received_at DESC);
  CREATE INDEX emails_category ON emails (category_id, received_at DESC);
  CREATE INDEX emails_sender ON emails (from_address);
  CREATE INDEX emails_triage ON emails (triage_status);

  CREATE VIRTUAL TABLE emails_fts USING fts5 (
    subject, from_name, from_address, summary, body_text,
    content = 'emails', content_rowid = 'id', tokenize = 'unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER emails_ai AFTER INSERT ON emails BEGIN
    INSERT INTO emails_fts (rowid, subject, from_name, from_address, summary, body_text)
    VALUES (new.id, new.subject, new.from_name, new.from_address, new.summary, new.body_text);
  END;
  CREATE TRIGGER emails_ad AFTER DELETE ON emails BEGIN
    INSERT INTO emails_fts (emails_fts, rowid, subject, from_name, from_address, summary, body_text)
    VALUES ('delete', old.id, old.subject, old.from_name, old.from_address, old.summary, old.body_text);
  END;
  CREATE TRIGGER emails_au AFTER UPDATE OF subject, from_name, from_address, summary, body_text ON emails BEGIN
    INSERT INTO emails_fts (emails_fts, rowid, subject, from_name, from_address, summary, body_text)
    VALUES ('delete', old.id, old.subject, old.from_name, old.from_address, old.summary, old.body_text);
    INSERT INTO emails_fts (rowid, subject, from_name, from_address, summary, body_text)
    VALUES (new.id, new.subject, new.from_name, new.from_address, new.summary, new.body_text);
  END;

  -- Remembers which category a sender belongs to. 'user' rules (set by recategorising an
  -- email by hand) skip the AI classifier entirely; 'ai' rules are only hints for the prompt.
  CREATE TABLE sender_rules (
    sender_address TEXT PRIMARY KEY,
    category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    source         TEXT NOT NULL CHECK (source IN ('user', 'ai')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE drafts (
    id                   INTEGER PRIMARY KEY,
    to_addr              TEXT NOT NULL DEFAULT '',
    subject              TEXT NOT NULL DEFAULT '',
    body                 TEXT NOT NULL DEFAULT '',
    reply_to_email_id    INTEGER REFERENCES emails(id) ON DELETE SET NULL,
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sync_state (
    folder         TEXT PRIMARY KEY,
    uid_validity   INTEGER NOT NULL,
    last_uid       INTEGER NOT NULL,
    last_synced_at TEXT
  );

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  `,
  // v2 — action tracking, quick replies, category icons + theme colour keys, saved assistant chats.
  `
  ALTER TABLE emails ADD COLUMN needs_reply INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE emails ADD COLUMN due_date TEXT;
  ALTER TABLE emails ADD COLUMN actions_json TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE emails ADD COLUMN quick_replies_json TEXT;
  ALTER TABLE emails ADD COLUMN replied_at TEXT;
  CREATE INDEX emails_action ON emails (in_inbox, replied_at, needs_reply, priority);

  ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'tag';
  UPDATE categories SET
    color = CASE color WHEN '#26b5ce' THEN 'coral' WHEN '#4cb782' THEN 'mint' WHEN '#f2994a' THEN 'violet'
                       WHEN '#8b8d98' THEN 'sand' ELSE 'indigo' END,
    icon = CASE name WHEN 'Work' THEN 'briefcase' WHEN 'Personal' THEN 'heart' WHEN 'Finance' THEN 'wallet'
                     WHEN 'Newsletters' THEN 'newspaper' WHEN 'Notifications' THEN 'bell' ELSE 'tag' END;

  -- Triage now also extracts reply-needed, deadline and action items: re-run it once.
  UPDATE emails SET triage_status = 'pending';

  CREATE TABLE conversations (
    id         INTEGER PRIMARY KEY,
    title      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE chat_messages (
    id              INTEGER PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    meta_json       TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX chat_messages_conversation ON chat_messages (conversation_id, id);
  `,
];

function open(): Database.Database {
  const file = path.resolve(process.cwd(), env.databasePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // IMMEDIATE takes the write lock up front, so parallel processes (e.g. `next build` workers)
  // queue up and each re-reads the version instead of racing to apply the same migration.
  db.transaction(() => {
    const current = db.pragma('user_version', { simple: true }) as number;
    for (let version = current; version < migrations.length; version++) db.exec(migrations[version]);
    if (current < migrations.length) db.pragma(`user_version = ${migrations.length}`);
  }).immediate();
  return db;
}

// Next.js dev mode re-evaluates modules on every change; keep a single connection per process.
const globalForDb = globalThis as unknown as { __inboxDb?: Database.Database };
export const db = globalForDb.__inboxDb ?? (globalForDb.__inboxDb = open());
