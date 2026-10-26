import { NextResponse } from 'next/server';
import { listDrafts, saveDraft } from '@/server/repo';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(listDrafts());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: number; to?: string; subject?: string; body?: string; replyToEmailId?: number | null };
  return NextResponse.json(
    saveDraft({ id: body.id, to: body.to ?? '', subject: body.subject ?? '', body: body.body ?? '', replyToEmailId: body.replyToEmailId }),
  );
}
