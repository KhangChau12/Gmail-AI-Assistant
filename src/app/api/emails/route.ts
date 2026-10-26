import { NextResponse } from 'next/server';
import { listEmails } from '@/server/repo';
import type { View } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VIEWS: View[] = ['inbox', 'action', 'unread', 'starred'];

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const view = params.get('view') as View | null;
  const category = Number(params.get('category'));
  return NextResponse.json(
    listEmails({
      view: view && VIEWS.includes(view) ? view : 'inbox',
      categoryId: category > 0 ? category : undefined,
      query: params.get('q') ?? undefined,
      limit: Number(params.get('limit')) || 50,
      offset: Number(params.get('offset')) || 0,
    }),
  );
}
