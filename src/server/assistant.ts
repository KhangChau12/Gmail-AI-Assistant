import 'server-only';
import type OpenAI from 'openai';
import { cleanBody, languageName, openai, signature } from './ai';
import { env } from './env';
import * as repo from './repo';
import type { ChatEvent, ChatMeta, Language } from '@/lib/types';

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type Tool = OpenAI.Chat.Completions.ChatCompletionTool;

const MAX_STEPS = 6;

const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'search_emails',
      description:
        'Search the inbox. All filters are optional and combined with AND. Use it for any question about what emails exist, e.g. "what did X send me", "unread mail this week", "anything about the invoice".',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'A few keywords matched against subject, sender, summary and body (any keyword matches). Emails may be in Vietnamese or English, so include keywords in both when unsure, e.g. "scholarship học bổng".',
          },
          from: { type: 'string', description: 'Part of the sender name or address.' },
          category: { type: 'string', description: 'Exact category name.' },
          unread: { type: 'boolean' },
          needs_action: { type: 'boolean', description: 'Only emails that still need the owner: a reply is expected or the AI marked them high priority.' },
          after: { type: 'string', description: 'Inclusive start date, YYYY-MM-DD (local time).' },
          before: { type: 'string', description: 'Exclusive end date, YYYY-MM-DD (local time).' },
          limit: { type: 'integer', description: 'Max results, default 15, max 40.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_email',
      description: 'Read the full content of one email by id. Use before answering detailed questions about a specific email.',
      parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inbox_stats',
      description: 'Counts (total, unread, important), top senders and per-category breakdown, optionally for a date range.',
      parameters: {
        type: 'object',
        properties: {
          after: { type: 'string', description: 'YYYY-MM-DD' },
          before: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_email',
      description:
        'Write an email. It appears as an editable draft card in the chat; the user reviews and sends it. Call this whenever the user asks to write, draft, reply to, forward or revise an email — writing the text in chat instead is wrong. To revise the previous draft, call it again with the full new version.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient address. Look it up with search_emails if only a name is given.' },
          subject: { type: 'string' },
          body: { type: 'string', description: 'Plain-text body.' },
          reply_to_email_id: { type: 'integer', description: 'Set when replying to an email in the inbox.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_email',
      description: 'Show a specific email to the user in the reader.',
      parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
    },
  },
];

/** 'YYYY-MM-DD' in local time → ISO timestamp comparable with stored received_at values. */
function localDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

function systemPrompt(lang: Language, openEmailId?: number): string {
  const now = new Date();
  const categories = repo.listCategories().map((c) => c.name).join(', ');
  const open = openEmailId ? repo.getEmail(openEmailId) : null;
  return `You are the inbox assistant for ${env.gmailAddress}. You can search and read their synced Gmail inbox with tools.
Today is ${now.toLocaleDateString('en-CA')} (${now.toLocaleDateString('en-US', { weekday: 'long' })}), timezone offset UTC${-now.getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-now.getTimezoneOffset() / 60}.
Categories: ${categories || 'none'}.
${open ? `The user currently has this email open: id ${open.id}, "${open.subject}" from ${open.fromName || open.fromAddress}. "This email" refers to it.` : ''}

Guidelines:
- Reply in ${languageName(lang)} unless the user writes in another language.
- For any question about their mail, call tools first and answer from the results. Do not ask clarifying questions when a search could answer it — make a reasonable search, then refine if needed (e.g. "urgent" / "needs action" → important:true). Only add filters such as unread, important or dates when the user's request implies them.
- Every email has an AI priority, a needs-reply flag, an optional deadline and a one-line summary; use them.
- Never invent emails, senders, dates or numbers. If a search finds nothing, say so and suggest a broader search.
- Be brief. Use short markdown lists when listing emails: bold sender, then subject, then a few words of why it matters.
- The UI already shows the matching emails as clickable cards after a search, so don't paste long lists of every result.
- Drafts: plain text, no markdown, never invent facts. ${signature()}
- When the user asks you to write, reply to or forward an email, you MUST finish by calling draft_email in the same turn (find and read the original first if needed, and pass reply_to_email_id when replying). Don't repeat the draft text in the chat; just say in one line what you wrote — the draft card is shown right below your message.`;
}

/** Previous turns as the model should see them; a draft the assistant wrote is replayed so it can be revised. */
function historyMessages(conversationId: number): Message[] {
  return repo
    .getChatMessages(conversationId)
    .slice(-12)
    .map((m): Message => {
      if (m.role === 'user' || !m.meta.draft) return { role: m.role, content: m.content };
      const d = m.meta.draft;
      const note = `\n\n[Draft shown to the user${d.sent ? ', since sent' : ''}${d.replyToEmailId ? `, replying to email ${d.replyToEmailId}` : ''}]\nTo: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`;
      return { role: 'assistant', content: m.content + note };
    });
}

/**
 * Runs one assistant turn: stores the user's message, streams the answer with tool use,
 * then stores the answer together with what it produced (steps, email cards, draft, context email).
 */
export async function runAssistant(
  conversationId: number,
  userText: string,
  lang: Language,
  openEmailId: number | undefined,
  emit: (event: ChatEvent) => void,
) {
  const messages: Message[] = [{ role: 'system', content: systemPrompt(lang, openEmailId) }, ...historyMessages(conversationId)];
  messages.push({ role: 'user', content: userText });
  repo.addChatMessage(conversationId, 'user', userText);

  const memory: ToolMemory = { meta: { steps: [] } };
  if (openEmailId) memory.meta.contextEmailId = openEmailId;
  const tracked = (event: ChatEvent) => {
    if (event.type === 'tool') memory.meta.steps!.push({ name: event.name, label: event.label });
    emit(event);
  };

  let answer = '';
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const stream = await openai.chat.completions.create({
        model: env.openaiModel,
        temperature: 0.3,
        messages,
        tools,
        stream: true,
      });

      let content = '';
      const calls: { id: string; name: string; args: string }[] = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          content += delta.content;
          emit({ type: 'delta', text: delta.content });
        }
        for (const call of delta.tool_calls ?? []) {
          const slot = (calls[call.index] ??= { id: '', name: '', args: '' });
          if (call.id) slot.id = call.id;
          if (call.function?.name) slot.name += call.function.name;
          if (call.function?.arguments) slot.args += call.function.arguments;
        }
      }
      answer += content;
      if (!calls.length) break;

      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } })),
      });
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.args || '{}');
        } catch {
          // fall through with empty args; the tool result will tell the model what went wrong
        }
        const result = executeTool(call.name, args, tracked, memory);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
  } finally {
    // Keep whatever was produced, even if the stream failed half-way.
    if (answer || memory.meta.draft || memory.meta.emailIds?.length) {
      const messageId = repo.addChatMessage(conversationId, 'assistant', answer, memory.meta);
      emit({ type: 'saved', messageId });
    }
  }
}

/** State shared between tool calls of one assistant turn. */
interface ToolMemory {
  lastReadEmail?: { id: number; fromAddress: string };
  meta: ChatMeta;
}

function executeTool(
  name: string,
  args: Record<string, unknown>,
  emit: (event: ChatEvent) => void,
  memory: ToolMemory,
): unknown {
  if (process.env.DEBUG_ASSISTANT) console.log('[assistant]', name, JSON.stringify(args));
  switch (name) {
    case 'search_emails': {
      const category =
        typeof args.category === 'string'
          ? repo.listCategories().find((c) => c.name.toLowerCase() === (args.category as string).toLowerCase())
          : undefined;
      const label = [args.query, args.from, args.category].filter((v) => typeof v === 'string' && v).join(' · ');
      emit({ type: 'tool', name, label });
      const emails = repo.listEmails({
        query: typeof args.query === 'string' ? args.query : undefined,
        anyTerm: true,
        from: typeof args.from === 'string' ? args.from : undefined,
        categoryId: category?.id,
        unread: typeof args.unread === 'boolean' ? args.unread : undefined,
        view: args.needs_action === true ? 'action' : undefined,
        after: localDate(args.after),
        before: localDate(args.before),
        limit: Math.min(Number(args.limit) || 15, 40),
      });
      if (emails.length) {
        const shown = emails.slice(0, 8);
        const ids = new Set(memory.meta.emailIds ?? []);
        for (const e of shown) ids.add(e.id);
        memory.meta.emailIds = [...ids].slice(0, 8);
        emit({ type: 'emails', emails: shown });
      }
      return emails.map((e) => ({
        id: e.id,
        from: e.fromName ? `${e.fromName} <${e.fromAddress}>` : e.fromAddress,
        subject: e.subject,
        date: e.receivedAt,
        read: e.isRead,
        priority: e.priority,
        needs_reply: e.needsReply && !e.repliedAt,
        due: e.dueDate,
        summary: e.summary ?? e.snippet,
      }));
    }
    case 'read_email': {
      const email = repo.getEmail(Number(args.id));
      emit({ type: 'tool', name, label: email?.subject ?? '' });
      if (!email) return { error: 'No email with that id' };
      memory.lastReadEmail = { id: email.id, fromAddress: email.fromAddress };
      memory.meta.contextEmailId = email.id;
      emit({ type: 'context', emailId: email.id });
      return {
        id: email.id,
        from: `${email.fromName} <${email.fromAddress}>`,
        to: email.to.map((a) => a.address),
        date: email.receivedAt,
        subject: email.subject,
        attachments: email.attachments.map((a) => a.filename),
        body: cleanBody(email.bodyText, 6000),
        next: 'If the user asked to reply to this email, call draft_email now with reply_to_email_id set to this id.',
      };
    }
    case 'inbox_stats': {
      emit({ type: 'tool', name, label: '' });
      return repo.inboxStats(localDate(args.after), localDate(args.before));
    }
    case 'draft_email': {
      emit({ type: 'tool', name, label: String(args.to ?? '') });
      // Small models often forget reply_to_email_id; infer it from the email just read for this recipient.
      const to = String(args.to ?? '').toLowerCase();
      const replyTo =
        Number(args.reply_to_email_id) ||
        (memory.lastReadEmail && to.includes(memory.lastReadEmail.fromAddress) ? memory.lastReadEmail.id : null);
      const draft = { to: String(args.to ?? ''), subject: String(args.subject ?? ''), body: String(args.body ?? ''), replyToEmailId: replyTo };
      memory.meta.draft = draft;
      if (replyTo) {
        memory.meta.contextEmailId = replyTo;
        emit({ type: 'context', emailId: replyTo });
      }
      emit({ type: 'draft', draft });
      return { ok: true, note: 'The draft is shown to the user as an editable card below your reply.' };
    }
    case 'open_email': {
      const id = Number(args.id);
      if (!repo.getEmail(id)) return { error: 'No email with that id' };
      emit({ type: 'open_email', emailId: id });
      return { ok: true };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
