import { runAssistant } from '@/server/assistant';
import { badRequest, sse } from '@/server/http';
import { conversationExists, createConversation, getLanguage } from '@/server/repo';
import type { ChatEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Sends one message to the assistant, creating the conversation on the first message. */
export async function POST(request: Request) {
  const body = (await request.json()) as { conversationId?: number; message?: string; openEmailId?: number };
  const message = body.message?.trim();
  if (!message) return badRequest('message is required');

  const conversation =
    body.conversationId && conversationExists(body.conversationId) ? { id: body.conversationId, title: '' } : createConversation(message);

  return sse<ChatEvent>(async (send) => {
    send({ type: 'conversation', id: conversation.id, title: conversation.title });
    await runAssistant(conversation.id, message, getLanguage(), body.openEmailId, send);
    send({ type: 'done' });
  });
}
