import { NextResponse } from 'next/server';
import { listConversations } from '@/server/repo';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(listConversations());
}
