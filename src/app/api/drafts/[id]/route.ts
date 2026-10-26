import { NextResponse } from 'next/server';
import { notFound, parseId } from '@/server/http';
import { deleteDraft } from '@/server/repo';

export const dynamic = 'force-dynamic';

export function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return notFound();
  deleteDraft(id);
  return NextResponse.json({ ok: true });
}
