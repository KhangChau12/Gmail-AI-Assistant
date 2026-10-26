import { InboxView } from '@/components/inbox/InboxView';
import type { View } from '@/lib/types';

const VIEWS: View[] = ['inbox', 'action', 'unread', 'starred'];

export default function InboxPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const view = VIEWS.includes(searchParams.view as View) ? (searchParams.view as View) : 'inbox';
  const category = Number(searchParams.category) || null;
  return (
    <InboxView
      key={`${view}-${category}-${searchParams.drafts ?? ''}-${searchParams.q ?? ''}`}
      view={view}
      categoryId={category}
      initialQuery={searchParams.q ?? ''}
      initialId={Number(searchParams.id) || null}
      drafts={searchParams.drafts !== undefined}
    />
  );
}
