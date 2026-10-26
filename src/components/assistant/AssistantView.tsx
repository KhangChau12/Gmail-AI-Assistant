'use client';

import { clsx } from 'clsx';
import { ArrowUp, Square } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, postStream } from '@/lib/api';
import { catColor } from '@/lib/categories';
import { displayName, fullDate, shortDate } from '@/lib/format';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { ChatEvent, ChatMessage, EmailDetail, EmailListItem } from '@/lib/types';
import { useApp } from '../shell/AppShell';
import { CONVERSATIONS_CHANGED, Sparkle } from '../shell/NavRail';
import { EmailBadge } from '../today/Today';
import { Avatar, Spinner } from '../ui';
import { DraftCard } from './DraftCard';

interface UiMessage extends ChatMessage {
  /** Stable React key: `id` changes from a temporary to the stored one once the answer is saved. */
  uiKey?: number;
  pending?: boolean;
  error?: boolean;
}

let tempId = -1;

interface Props {
  conversationId: number | null;
  initialQuestion: string | null;
  emailId: number | null;
}

export function AssistantView({ conversationId: initialConversation, initialQuestion, emailId }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversation);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [contextId, setContextId] = useState<number | null>(emailId);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = messages.some((m) => m.pending);

  // Load an existing conversation.
  useEffect(() => {
    if (!initialConversation) return;
    void api<ChatMessage[]>(`/api/conversations/${initialConversation}`)
      .then((list) => {
        setMessages(list);
        setTitle(list.find((m) => m.role === 'user')?.content ?? null);
        const last = [...list].reverse().find((m) => m.meta.contextEmailId);
        if (last?.meta.contextEmailId) setContextId(last.meta.contextEmailId);
      })
      .catch(() => router.replace('/assistant'));
  }, [initialConversation, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => inputRef.current?.focus(), []);

  const update = (id: number, fn: (m: UiMessage) => UiMessage) => setMessages((list) => list.map((m) => (m.id === id ? fn(m) : m)));

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setInput('');
      const userKey = tempId--;
      const user: UiMessage = { id: userKey, uiKey: userKey, role: 'user', content: question, meta: {}, emails: [] };
      const replyKey = tempId--;
      const reply: UiMessage = { id: replyKey, uiKey: replyKey, role: 'assistant', content: '', meta: { steps: [] }, emails: [], pending: true };
      let replyId = reply.id;
      setMessages((list) => [...list, user, reply]);
      if (!title) setTitle(question);

      const controller = new AbortController();
      abortRef.current = controller;
      const onEvent = (event: ChatEvent) => {
        switch (event.type) {
          case 'conversation':
            if (event.id !== conversationId) {
              setConversationId(event.id);
              window.history.replaceState(window.history.state, '', `/assistant?c=${event.id}`);
              window.dispatchEvent(new Event(CONVERSATIONS_CHANGED));
            }
            break;
          case 'delta':
            update(replyId, (m) => ({ ...m, content: m.content + event.text }));
            break;
          case 'tool':
            update(replyId, (m) => ({ ...m, meta: { ...m.meta, steps: [...(m.meta.steps ?? []), { name: event.name, label: event.label }] } }));
            break;
          case 'emails':
            update(replyId, (m) => ({ ...m, emails: mergeEmails(m.emails, event.emails) }));
            break;
          case 'draft':
            update(replyId, (m) => ({ ...m, meta: { ...m.meta, draft: event.draft } }));
            break;
          case 'context':
            setContextId(event.emailId);
            break;
          case 'open_email':
            router.push(`/inbox?id=${event.emailId}`);
            break;
          case 'saved': {
            const saved = event.messageId;
            update(replyId, (m) => ({ ...m, id: saved }));
            replyId = saved;
            break;
          }
          case 'error':
            update(replyId, (m) => ({ ...m, error: true, content: m.content || t('ai.error') }));
            break;
        }
      };

      try {
        await postStream<ChatEvent>(
          '/api/chat',
          { conversationId: conversationId ?? undefined, message: question, openEmailId: contextId ?? undefined },
          onEvent,
          controller.signal,
        );
      } catch {
        if (!controller.signal.aborted) update(replyId, (m) => ({ ...m, error: true, content: m.content || t('ai.error') }));
      } finally {
        update(replyId, (m) => ({ ...m, pending: false }));
        abortRef.current = null;
        window.dispatchEvent(new Event(CONVERSATIONS_CHANGED));
      }
    },
    [busy, conversationId, contextId, router, t, title],
  );

  // A question handed over from another page (?q=…) is sent once.
  const autoAsked = useRef(false);
  useEffect(() => {
    if (initialQuestion && !initialConversation && !autoAsked.current) {
      autoAsked.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion, initialConversation, ask]);

  const examples: MessageKey[] = ['ai.example1', 'ai.example2', 'ai.example3', 'ai.example4'];
  const empty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col px-10 pb-6 pt-7">
        <header className="flex items-center gap-3 border-b border-line pb-[18px]">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-ai/15 text-ai">
            <Sparkle className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[22px] font-semibold">{title ?? t('assistant.title')}</h1>
            <div className="text-xs text-faint">{t('assistant.subtitle')}</div>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-[26px] py-7">
            {empty && (
              <div className="pt-[8vh] animate-rise-in">
                <h2 className="font-display text-[34px] font-bold leading-tight">{t('assistant.emptyTitle')}</h2>
                <p className="mt-2 max-w-[560px] text-muted">{t('assistant.emptyBody')}</p>
                <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {examples.map((key) => (
                    <button
                      key={key}
                      onClick={() => void ask(t(key))}
                      className="card px-4 py-3.5 text-left text-[15px] shadow-none transition-colors hover:border-line-strong"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div
                  key={m.uiKey ?? m.id}
                  className="max-w-[80%] self-end whitespace-pre-wrap rounded-[18px] rounded-br-md border border-line bg-elevated px-4 py-3 text-[15px]"
                >
                  {m.content}
                </div>
              ) : (
                <AssistantMessage key={m.uiKey ?? m.id} message={m} />
              ),
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="card mx-auto flex w-full max-w-[820px] flex-col gap-2.5 rounded-[20px] border-line-strong py-3.5 pl-[18px] pr-3.5"
        >
          <label className="block">
            <span className="sr-only">{t('assistant.placeholder')}</span>
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              placeholder={empty ? t('assistant.placeholder') : t('assistant.followUp')}
              className="w-full resize-none bg-transparent text-base leading-relaxed placeholder:text-faint focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            {contextId && (
              <button type="button" onClick={() => setContextId(null)} className="chip h-8 text-xs" title={t('assistant.clearContext')}>
                @ {t('assistant.aboutEmail')} ×
              </button>
            )}
            <span className="flex-1" />
            <span className="hidden font-mono text-xs text-faint sm:inline">{t('today.askHint')}</span>
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label={t('assistant.stop')}
                className="flex size-10 items-center justify-center rounded-xl border border-line text-muted hover:text-fg"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label={t('shortcut.send')}
                className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-fg disabled:opacity-40"
              >
                <ArrowUp className="size-[18px]" strokeWidth={2.4} />
              </button>
            )}
          </div>
        </form>
      </section>

      <ContextPanel emailId={contextId} onAsk={(text) => void ask(text)} />
    </div>
  );
}

function mergeEmails(current: EmailListItem[], incoming: EmailListItem[]): EmailListItem[] {
  const seen = new Set(current.map((e) => e.id));
  return [...current, ...incoming.filter((e) => !seen.has(e.id))].slice(0, 8);
}

function AssistantMessage({ message }: { message: UiMessage }) {
  const { t } = useI18n();
  const steps = message.meta.steps ?? [];
  return (
    <div className="flex gap-3.5 animate-rise-in">
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-ai/15 text-sm text-ai">✦</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {steps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 font-mono text-xs text-faint">
            {steps.map((s, i) => (
              <span key={i} className="rounded-md border border-line px-2 py-0.5">
                → {t(`ai.tool.${s.name}` as MessageKey)}
                {s.label ? ` · ${s.label}` : ''}
              </span>
            ))}
          </div>
        )}
        {message.content ? (
          <div className={clsx('prose-chat text-[15px] leading-relaxed', message.error && 'text-danger')}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          message.pending && !steps.length && <Spinner className="text-faint" />
        )}
        {message.emails.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
            {message.emails.map((e) => (
              <EmailCard key={e.id} email={e} />
            ))}
          </div>
        )}
        {message.meta.draft && <DraftCard draft={message.meta.draft} messageId={message.id > 0 ? message.id : null} />}
        {message.pending && steps.length > 0 && !message.content && <Spinner className="text-faint" />}
      </div>
    </div>
  );
}

function EmailCard({ email }: { email: EmailListItem }) {
  const { t, lang } = useI18n();
  const { categoryMap } = useApp();
  const category = email.categoryId ? categoryMap.get(email.categoryId) : undefined;
  return (
    <Link
      href={`/inbox?id=${email.id}`}
      className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-panel p-3.5 transition-colors hover:border-line-strong"
    >
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-[3px]" style={{ background: catColor(category?.color) }} />
        <span className={clsx('min-w-0 flex-1 truncate', email.isRead ? 'font-medium' : 'font-bold')}>
          {displayName(email.fromName, email.fromAddress)}
        </span>
        <span className="shrink-0 font-mono text-2xs text-faint">{shortDate(email.receivedAt, lang, t('time.yesterday'))}</span>
      </div>
      <div className="line-clamp-1 text-sm font-medium">{email.subject}</div>
      {email.summary && <div className="line-clamp-2 text-xs text-muted">{email.summary}</div>}
      <div className="flex empty:hidden">
        <EmailBadge email={email} />
      </div>
    </Link>
  );
}

function ContextPanel({ emailId, onAsk }: { emailId: number | null; onAsk: (text: string) => void }) {
  const { t, lang } = useI18n();
  const { categoryMap, version } = useApp();
  const [email, setEmail] = useState<EmailDetail | null>(null);

  useEffect(() => {
    if (!emailId) {
      setEmail(null);
      return;
    }
    void api<EmailDetail>(`/api/emails/${emailId}`).then(setEmail).catch(() => setEmail(null));
  }, [emailId, version]);

  const toggle = (index: number, done: boolean) => {
    if (!email) return;
    setEmail({ ...email, actions: email.actions.map((a, i) => (i === index ? { ...a, done } : a)) });
    void api(`/api/emails/${email.id}`, { method: 'PATCH', json: { action: { index, done } } });
  };

  const category = email?.categoryId ? categoryMap.get(email.categoryId) : undefined;

  return (
    <aside aria-label={t('assistant.context')} className="hidden w-[320px] shrink-0 flex-col gap-[18px] overflow-y-auto border-l border-line bg-rail px-[22px] py-7 lg:flex">
      {email ? (
        <>
          <div className="eyebrow">{t('assistant.context')}</div>
          <div className="card flex flex-col gap-2.5 p-4 shadow-none">
            <div className="flex items-center gap-2.5">
              <Avatar name={email.fromName} address={email.fromAddress} size={34} color={category?.color} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{displayName(email.fromName, email.fromAddress)}</div>
                <div className="truncate font-mono text-2xs text-faint">{fullDate(email.receivedAt, lang)}</div>
              </div>
            </div>
            <div className="font-display text-[17px] font-semibold leading-snug">{email.subject}</div>
            <p className="line-clamp-4 text-sm text-muted">{email.summary ?? email.snippet}</p>
            <Link href={`/inbox?id=${email.id}`} className="text-sm font-semibold text-accent-ink hover:underline">
              {t('assistant.openFull')} →
            </Link>
          </div>

          {email.actions.length > 0 && (
            <>
              <div className="eyebrow pt-1.5">{t('assistant.actions')}</div>
              {email.actions.map((a, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="checkbox" checked={a.done} onChange={(e) => toggle(i, e.target.checked)} className="mt-[3px] accent-[rgb(var(--accent))]" />
                  <span className={a.done ? 'text-faint line-through' : ''}>{a.text}</span>
                </label>
              ))}
            </>
          )}

          <div className="eyebrow pt-1.5">{t('assistant.next')}</div>
          <button onClick={() => onAsk(t('today.replyPrompt', { subject: email.subject }))} className="card px-3 py-2.5 text-left text-sm shadow-none hover:border-line-strong">
            {t('assistant.nextReply')}
          </button>
          <button
            onClick={() => onAsk(t('assistant.nextSender', { name: displayName(email.fromName, email.fromAddress) }))}
            className="card px-3 py-2.5 text-left text-sm shadow-none hover:border-line-strong"
          >
            {t('assistant.nextSender', { name: displayName(email.fromName, email.fromAddress) })}
          </button>
        </>
      ) : (
        <>
          <div className="eyebrow">{t('assistant.tipsTitle')}</div>
          {(['assistant.tip1', 'assistant.tip2', 'assistant.tip3'] as MessageKey[]).map((key) => (
            <p key={key} className="text-sm leading-relaxed text-muted">
              {t(key)}
            </p>
          ))}
        </>
      )}
    </aside>
  );
}
