import 'server-only';
import { triageEmail } from './ai';
import { env } from './env';
import { INBOX, fetchMessages, snapshotMailbox } from './mail';
import * as repo from './repo';
import type { SyncEvent, SyncStatus } from '@/lib/types';

/*
 * Sync pipeline
 *
 *   1. snapshot   UIDs + flags of the whole INBOX (tiny payload)
 *   2. fetch      full source only for UIDs newer than the last sync → parse → insert
 *   3. flags      mirror read/star changes and messages archived/deleted from other clients
 *   4. triage     one LLM call per new email (category + priority + summary), N in parallel
 *
 * Triage state lives in the database, so an interrupted run simply resumes on the next sync.
 */

const TRIAGE_CONCURRENCY = 4;

type Listener = (event: SyncEvent) => void;

interface SyncRuntime {
  running: Promise<void> | null;
  listeners: Set<Listener>;
  /** Latest phase/progress event, replayed to clients that subscribe mid-run. */
  current: SyncEvent | null;
  lastError: string | null;
}

const globalForSync = globalThis as unknown as { __sync?: SyncRuntime };
const runtime: SyncRuntime =
  globalForSync.__sync ?? (globalForSync.__sync = { running: null, listeners: new Set(), current: null, lastError: null });

function emit(event: SyncEvent) {
  if (event.type === 'phase' || event.type === 'progress') runtime.current = event;
  for (const listener of runtime.listeners) listener(event);
}

/** Starts a sync unless one is already running; either way, resolves when the active run ends. */
export function startSync(): Promise<void> {
  if (!runtime.running) {
    runtime.lastError = null;
    runtime.running = run()
      .catch((error) => {
        console.error('[sync] failed:', error);
        runtime.lastError = error instanceof Error ? error.message : String(error);
        emit({ type: 'error', message: runtime.lastError });
      })
      .finally(() => {
        runtime.running = null;
        runtime.current = null;
      });
  }
  return runtime.running;
}

export function subscribe(listener: Listener): () => void {
  runtime.listeners.add(listener);
  if (runtime.current) listener(runtime.current);
  return () => runtime.listeners.delete(listener);
}

export function syncStatus(): SyncStatus {
  return {
    running: runtime.running !== null,
    lastSyncedAt: repo.getSyncState(INBOX)?.lastSyncedAt ?? null,
    pendingTriage: repo.countPendingTriage(),
    lastError: runtime.lastError,
  };
}

async function run() {
  emit({ type: 'phase', phase: 'connecting' });
  const snapshot = await snapshotMailbox(INBOX);

  let state = repo.getSyncState(INBOX);
  if (state && state.uidValidity !== snapshot.uidValidity) {
    repo.resetFolder(INBOX);
    state = undefined;
  }

  const allUids = [...snapshot.flags.keys()].sort((a, b) => a - b);
  const newUids = (state ? allUids.filter((uid) => uid > state!.lastUid) : allUids.slice(-env.syncInitialLimit)).reverse();

  let added = 0;
  if (newUids.length) {
    emit({ type: 'phase', phase: 'fetching', total: newUids.length });
    let done = 0;
    await fetchMessages(newUids, snapshot.uidValidity, (batch) => {
      added += repo.insertEmails(batch);
      done += batch.length;
      emit({ type: 'progress', phase: 'fetching', done, total: newUids.length });
    });
  }
  repo.saveSyncState(INBOX, snapshot.uidValidity, allUids.at(-1) ?? state?.lastUid ?? 0);

  emit({ type: 'phase', phase: 'flags' });
  repo.applyRemoteFlags(INBOX, snapshot.uidValidity, snapshot.flags);

  const triaged = await triagePending();
  emit({ type: 'done', added, triaged, finishedAt: new Date().toISOString() });
}

async function triagePending(): Promise<number> {
  const pending = repo.pendingTriage();
  if (!pending.length || !env.openaiApiKey) return 0;

  const categories = repo.listCategories();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rules = repo.getSenderRules();
  const lang = repo.getLanguage();

  emit({ type: 'phase', phase: 'triage', total: pending.length });
  let done = 0;
  let fatal: unknown = null;

  const queue = [...pending];
  const worker = async () => {
    for (let email = queue.shift(); email && !fatal; email = queue.shift()) {
      const rule = rules.get(email.fromAddress);
      try {
        const result = await triageEmail({ ...email, senderHint: rule && byId.get(rule.categoryId) }, categories, lang);
        // A rule the user taught by hand always wins over the model's guess.
        if (rule?.source === 'user') result.categoryId = rule.categoryId;
        repo.saveTriage(email.id, result);
        if (result.categoryId !== null && !rule) {
          repo.upsertSenderRule(email.fromAddress, result.categoryId, 'ai');
          rules.set(email.fromAddress, { categoryId: result.categoryId, source: 'ai' });
        }
      } catch (error) {
        // Bad key / quota: stop the whole run instead of failing every remaining email one by one.
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403 || status === 429) {
          fatal = error;
          return;
        }
        repo.failTriage(email.id, error instanceof Error ? error.message : String(error));
      }
      done++;
      emit({ type: 'progress', phase: 'triage', done, total: pending.length });
    }
  };

  await Promise.all(Array.from({ length: TRIAGE_CONCURRENCY }, worker));
  if (fatal) throw fatal;
  return done;
}
