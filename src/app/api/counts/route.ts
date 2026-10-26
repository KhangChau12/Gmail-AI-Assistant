import { NextResponse } from 'next/server';
import { getCounts } from '@/server/repo';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(getCounts());
}
