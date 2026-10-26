import { NextResponse } from 'next/server';
import { env, missingConfig } from '@/server/env';
import { testConnection } from '@/server/mail';
import { getLanguage } from '@/server/repo';
import { syncStatus } from '@/server/sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const missing = missingConfig();
  const check = new URL(request.url).searchParams.get('check') === '1';
  return NextResponse.json({
    account: env.gmailAddress,
    model: env.openaiModel,
    missing,
    language: getLanguage(),
    sync: syncStatus(),
    imap: check && !missing.length ? await testConnection() : undefined,
  });
}
