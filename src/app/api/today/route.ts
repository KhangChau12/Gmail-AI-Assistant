import { NextResponse } from 'next/server';
import { getToday } from '@/server/repo';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(getToday());
}
