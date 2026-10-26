import { NextResponse } from 'next/server';
import { missingConfig } from '@/server/env';
import { sse } from '@/server/http';
import { startSync, subscribe, syncStatus } from '@/server/sync';
import type { SyncEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(syncStatus());
}

/** Starts a sync (or joins the one already running) and streams its progress. */
export function POST() {
  if (missingConfig().length) {
    return NextResponse.json({ error: 'Missing configuration' }, { status: 412 });
  }
  let unsubscribe = () => {};
  return sse<SyncEvent>(
    async (send) => {
      unsubscribe = subscribe(send);
      await startSync();
      unsubscribe();
    },
    () => unsubscribe(),
  );
}
