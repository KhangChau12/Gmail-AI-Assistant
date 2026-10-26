import { NextResponse } from 'next/server';
import { badRequest, errorMessage } from '@/server/http';
import { sendMail } from '@/server/mail';
import { deleteDraft, getEmail, markReplied } from '@/server/repo';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json()) as { to?: string; subject?: string; body?: string; replyToEmailId?: number | null; draftId?: number };
  if (!body.to?.trim()) return badRequest('Recipient is required');

  const replyTo = body.replyToEmailId ? getEmail(body.replyToEmailId) : null;
  try {
    await sendMail({ to: body.to.trim(), subject: body.subject ?? '', text: body.body ?? '', inReplyTo: replyTo?.messageId });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 });
  }
  if (body.draftId) deleteDraft(body.draftId);
  if (replyTo) markReplied(replyTo.id);
  return NextResponse.json({ ok: true });
}
