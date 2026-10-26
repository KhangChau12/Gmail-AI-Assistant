import { NextResponse } from 'next/server';
import { badRequest } from '@/server/http';
import { setLanguage } from '@/server/repo';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const body = (await request.json()) as { language?: string };
  if (body.language !== 'vi' && body.language !== 'en') return badRequest('language must be vi or en');
  setLanguage(body.language);
  return NextResponse.json({ ok: true });
}
