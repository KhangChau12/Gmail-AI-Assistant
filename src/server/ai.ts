import 'server-only';
import OpenAI from 'openai';
import { env } from './env';
import type { Category, EmailDetail, Language, Priority } from '@/lib/types';

const globalForAi = globalThis as unknown as { __openai?: OpenAI };
export const openai =
  globalForAi.__openai ?? (globalForAi.__openai = new OpenAI({ apiKey: env.openaiApiKey, baseURL: env.openaiBaseUrl }));

export const languageName = (lang: Language) => (lang === 'vi' ? 'Vietnamese' : 'English');

/** How drafts are signed; never a placeholder like "[Your name]" the user would have to spot and replace. */
export const signature = () =>
  env.userName ? `Sign off with the name "${env.userName}".` : 'End with a short closing but no name or placeholder (the sender adds it).';

/** Drops quoted reply chains and collapses whitespace so the model sees the new content, not the thread. */
export function cleanBody(text: string, max = 3000): string {
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .slice(0, max)
    .trim();
}

// ─── Triage: category + summary + priority in a single call ──────────────────

export interface TriageInput {
  fromName: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  /** Category this sender was given before, if any. */
  senderHint?: Category;
}

export interface TriageResult {
  categoryId: number | null;
  summary: string;
  priority: Priority;
  needsReply: boolean;
  dueDate: string | null;
  actions: string[];
}

/** Received date helps the model resolve "this Friday" into an absolute date. */
function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function triageEmail(
  input: TriageInput & { receivedAt: string },
  categories: Category[],
  lang: Language,
): Promise<TriageResult> {
  const categoryList = categories.map((c) => `- ${c.id}: ${c.name} — ${c.description}`).join('\n');
  const system = `You triage the inbox of ${env.gmailAddress}.
For each email return:
- category: the id of the best matching category below, or "none" if nothing fits.
${categoryList}
- priority: "high" only if the owner personally needs to read or act on it soon (a real person asking something, deadlines, security problems, money owed). "low" for bulk mail, marketing and routine notifications. Otherwise "normal".
- summary: one sentence of at most 25 words in ${languageName(lang)} stating what the email is about and any action or deadline. No preamble like "This email".
- needs_reply: true only if a real person is personally waiting for the owner to answer (a question, a request, an invitation needing RSVP). Never for newsletters, notifications or no-reply senders.
- due_date: the deadline the owner must act by as YYYY-MM-DD, resolved against the received date; null if there is none.
- actions: up to 3 concrete things the owner has to do, each at most 8 words in ${languageName(lang)}, imperative ("Send the slides before Thursday"). Empty for anything that needs no action.`;

  const user = `From: ${input.fromName} <${input.fromAddress}>
Subject: ${input.subject}
Received: ${isoDay(new Date(input.receivedAt))}
${input.senderHint ? `(Earlier emails from this sender were filed under "${input.senderHint.name}".)\n` : ''}
${cleanBody(input.bodyText) || '(empty body)'}`;

  const completion = await openai.chat.completions.create({
    model: env.openaiModel,
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'triage',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'priority', 'summary', 'needs_reply', 'due_date', 'actions'],
          properties: {
            category: { type: 'string', enum: [...categories.map((c) => String(c.id)), 'none'] },
            priority: { type: 'string', enum: ['high', 'normal', 'low'] },
            summary: { type: 'string' },
            needs_reply: { type: 'boolean' },
            due_date: { type: ['string', 'null'] },
            actions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  });

  const parsed = JSON.parse(completion.choices[0]?.message.content ?? '{}') as {
    category?: string;
    priority?: Priority;
    summary?: string;
    needs_reply?: boolean;
    due_date?: string | null;
    actions?: string[];
  };
  const categoryId = Number(parsed.category);
  return {
    categoryId: categories.some((c) => c.id === categoryId) ? categoryId : null,
    priority: parsed.priority === 'high' || parsed.priority === 'low' ? parsed.priority : 'normal',
    summary: (parsed.summary ?? '').trim(),
    needsReply: parsed.needs_reply === true,
    dueDate: typeof parsed.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date) ? parsed.due_date : null,
    actions: (parsed.actions ?? []).map((a) => a.trim()).filter(Boolean).slice(0, 3),
  };
}

// ─── Quick replies ───────────────────────────────────────────────────────────

/** Three one-tap reply intents shown under an email; the full reply is written when one is picked. */
export async function suggestReplies(email: EmailDetail, lang: Language): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: `Suggest 3 different ways ${env.gmailAddress} could reply to this email, e.g. accept / decline / ask a question.
Each is a short reply intent of at most 7 words in the language of the email (if unclear, ${languageName(lang)}), written as the gist of the reply, not as a full sentence to send. Be specific to the email (mention the time, item or person).`,
      },
      {
        role: 'user',
        content: `From: ${email.fromName} <${email.fromAddress}>\nSubject: ${email.subject}\n\n${cleanBody(email.bodyText, 2500)}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'quick_replies',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['replies'],
          properties: { replies: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
  });
  const parsed = JSON.parse(completion.choices[0]?.message.content ?? '{}') as { replies?: string[] };
  return (parsed.replies ?? []).map((r) => r.trim()).filter(Boolean).slice(0, 3);
}

// ─── Drafting ────────────────────────────────────────────────────────────────

export interface DraftRequest {
  instruction: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: EmailDetail | null;
}

export interface DraftResult {
  subject: string;
  body: string;
  note: string;
}

export async function writeDraft(req: DraftRequest, lang: Language): Promise<DraftResult> {
  const system = `You help ${env.gmailAddress} write emails. Rewrite or create the draft according to the instruction.
Rules:
- Write the email in the language the instruction or the original email uses; if unclear, use ${languageName(lang)}.
- Plain text only, no markdown. Keep it as short as the purpose allows. Never invent facts, dates or numbers.
- ${signature()}
- If replying, the subject should be "Re: <original subject>" unless the user asks otherwise.
- "note" is one short sentence in ${languageName(lang)} telling the user what you changed.`;

  const context = [
    req.replyTo
      ? `ORIGINAL EMAIL (being replied to)\nFrom: ${req.replyTo.fromName} <${req.replyTo.fromAddress}>\nSubject: ${req.replyTo.subject}\n\n${cleanBody(req.replyTo.bodyText, 2500)}`
      : null,
    `CURRENT DRAFT\nTo: ${req.to || '(empty)'}\nSubject: ${req.subject || '(empty)'}\n\n${req.body || '(empty)'}`,
    `INSTRUCTION\n${req.instruction}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');

  const completion = await openai.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.5,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: context },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'draft',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['subject', 'body', 'note'],
          properties: { subject: { type: 'string' }, body: { type: 'string' }, note: { type: 'string' } },
        },
      },
    },
  });

  return JSON.parse(completion.choices[0]?.message.content ?? '{}') as DraftResult;
}
