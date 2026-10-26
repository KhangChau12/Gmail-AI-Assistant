import { NextResponse } from 'next/server';
import { resetTriage } from '@/server/repo';
import { startSync } from '@/server/sync';

export const dynamic = 'force-dynamic';

/** Re-classifies and re-summarises every email (e.g. after editing categories or switching language). */
export function POST() {
  resetTriage();
  void startSync();
  return NextResponse.json({ ok: true });
}
