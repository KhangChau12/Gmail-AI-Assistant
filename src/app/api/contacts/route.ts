import { NextResponse } from 'next/server';
import { searchContacts } from '@/server/repo';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json(searchContacts(q));
}
