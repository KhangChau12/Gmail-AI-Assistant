import { AssistantView } from '@/components/assistant/AssistantView';

export default function AssistantPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const conversation = Number(searchParams.c) || null;
  return (
    <AssistantView
      key={conversation ?? `new-${searchParams.q ?? ''}`}
      conversationId={conversation}
      initialQuestion={searchParams.q ?? null}
      emailId={Number(searchParams.email) || null}
    />
  );
}
