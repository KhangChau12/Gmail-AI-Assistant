'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { postStream } from '@/lib/api';
import type { SyncEvent, SyncStatus } from '@/lib/types';

const AUTO_SYNC_MS = 5 * 60 * 1000;
/** While a sync is importing, refresh the visible list at most this often. */
const REFRESH_THROTTLE_MS = 1500;

export interface SyncState {
  running: boolean;
  phase: 'connecting' | 'fetching' | 'flags' | 'triage' | null;
  done: number;
  total: number;
  lastSyncedAt: string | null;
  error: string | null;
}

/**
 * Drives `/api/sync`: runs once on mount, then every 5 minutes while the tab is visible.
 * Incremental syncs only download new messages, so this is cheap.
 */
export function useSync(initial: SyncStatus, onChange: () => void) {
  const [state, setState] = useState<SyncState>({
    running: false,
    phase: null,
    done: 0,
    total: 0,
    lastSyncedAt: initial.lastSyncedAt,
    error: initial.lastError,
  });
  const runningRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const lastRefresh = useRef(0);
  const refreshSoon = useCallback((force = false) => {
    const now = Date.now();
    if (force || now - lastRefresh.current > REFRESH_THROTTLE_MS) {
      lastRefresh.current = now;
      onChangeRef.current();
    }
  }, []);

  const sync = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setState((s) => ({ ...s, running: true, phase: 'connecting', done: 0, total: 0, error: null }));
    try {
      await postStream<SyncEvent>('/api/sync', {}, (event) => {
        switch (event.type) {
          case 'phase':
            setState((s) => ({ ...s, phase: event.phase, done: 0, total: event.total ?? 0 }));
            break;
          case 'progress':
            setState((s) => ({ ...s, phase: event.phase, done: event.done, total: event.total }));
            refreshSoon();
            break;
          case 'done':
            setState((s) => ({ ...s, lastSyncedAt: event.finishedAt }));
            refreshSoon(true);
            break;
          case 'error':
            setState((s) => ({ ...s, error: event.message }));
            break;
        }
      });
    } catch (error) {
      setState((s) => ({ ...s, error: error instanceof Error ? error.message : String(error) }));
    } finally {
      runningRef.current = false;
      setState((s) => ({ ...s, running: false, phase: null }));
    }
  }, [refreshSoon]);

  useEffect(() => {
    void sync();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void sync();
    }, AUTO_SYNC_MS);
    return () => clearInterval(timer);
  }, [sync]);

  return { state, sync };
}
