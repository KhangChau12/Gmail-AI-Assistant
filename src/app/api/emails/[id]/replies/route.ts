import { NextResponse } from 'next/server';
import { suggestReplies } from '@/server/ai';
import { errorMessage, notFound, parseId } from '@/server/http';
import { getEmail, getLanguage, saveQuickReplies } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** Quick-reply intents for an email; generated once, then served from the database. */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  const email = id ? getEmail(id) : null;
  if (!id || !email) return notFound();
  if (email.quickReplies) return NextResponse.json(email.quickReplies);
  try {
    const replies = await suggestReplies(email, getLanguage());
    saveQuickReplies(id, replies);
    return NextResponse.json(replies);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 });
  }
}
