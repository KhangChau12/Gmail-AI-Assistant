import { NextResponse } from 'next/server';
import { notFound, parseId } from '@/server/http';
import { conversationExists, deleteConversation, getChatMessages } from '@/server/repo';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export function GET(_: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id || !conversationExists(id)) return notFound();
  return NextResponse.json(getChatMessages(id));
}

export function DELETE(_: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id) return notFound();
  deleteConversation(id);
  return NextResponse.json({ ok: true });
}
