import { NextResponse } from 'next/server';
import { errorMessage, notFound, parseId } from '@/server/http';
import { moveMessage, setFlag } from '@/server/mail';
import * as repo from '@/server/repo';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export function GET(_: Request, { params }: Params) {
  const id = parseId(params.id);
  const email = id && repo.getEmail(id);
  return email ? NextResponse.json(email) : notFound();
}

interface Patch {
  read?: boolean;
  starred?: boolean;
  categoryId?: number | null;
  move?: 'archive' | 'trash';
  /** Ticks an AI-extracted action item. */
  action?: { index: number; done: boolean };
}

/**
 * Local state changes immediately so the UI stays instant; the IMAP write happens after the response.
 * If it fails, the next sync's flag snapshot puts the local copy back in line with Gmail.
 */
export async function PATCH(request: Request, { params }: Params) {
  const id = parseId(params.id);
  const location = id ? repo.getEmailLocation(id) : undefined;
  if (!id || !location) return notFound();

  const patch = (await request.json()) as Patch;
  const remote: (() => Promise<unknown>)[] = [];

  const { read, starred, categoryId, move, action } = patch;
  if (action) repo.setActionDone(id, action.index, action.done);
  if (typeof read === 'boolean') {
    repo.setRead(id, read);
    remote.push(() => setFlag(location.uid, '\\Seen', read, location.folder));
  }
  if (typeof starred === 'boolean') {
    repo.setStarred(id, starred);
    remote.push(() => setFlag(location.uid, '\\Flagged', starred, location.folder));
  }
  if (categoryId !== undefined) {
    repo.setCategory(id, categoryId);
  }
  if (move) {
    repo.removeFromInbox(id);
    remote.push(() => moveMessage(location.uid, move === 'archive' ? '\\All' : '\\Trash', location.folder));
  }

  // Run IMAP writes one after another: Gmail rejects too many parallel logins.
  void remote
    .reduce((chain, next) => chain.then(next), Promise.resolve<unknown>(undefined))
    .catch((error) => console.error(`[imap] update for email ${id} failed:`, errorMessage(error)));

  return NextResponse.json({ ok: true });
}
