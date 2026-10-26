import { NextResponse } from 'next/server';
import { notFound, parseId } from '@/server/http';
import { updateChatDraft } from '@/server/repo';
import type { ChatDraft } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Saves edits to (or the sent state of) a draft that lives inside an assistant message. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return notFound();
  const draft = (await request.json()) as ChatDraft;
  updateChatDraft(id, {
    to: String(draft.to ?? ''),
    subject: String(draft.subject ?? ''),
    body: String(draft.body ?? ''),
    replyToEmailId: draft.replyToEmailId ?? null,
    sent: draft.sent === true,
  });
  return NextResponse.json({ ok: true });
}
