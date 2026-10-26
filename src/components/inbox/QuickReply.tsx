'use client';

import { ChevronDown, Maximize2 } from 'lucide-react';
import { forwardRef, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { displayName } from '@/lib/format';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { EmailDetail } from '@/lib/types';
import { useApp } from '../shell/AppShell';
import { Sparkle } from '../shell/NavRail';
import { Spinner } from '../ui';

export const TONES: { key: MessageKey; instruction: string }[] = [
  { key: 'tone.polite', instruction: 'Use a polite, professional tone.' },
  { key: 'tone.friendly', instruction: 'Use a warm, friendly tone.' },
  { key: 'tone.short', instruction: 'Keep it as short as possible.' },
  { key: 'tone.english', instruction: 'Write it in English.' },
];

function replySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

/**
 * Reply box that lives under every email: one-tap AI intents, free text, or "write it for me".
 * Sending marks the email as replied, which takes it out of "Needs you".
 */
export const QuickReply = forwardRef<HTMLTextAreaElement, { email: EmailDetail; onSent: () => void }>(function QuickReply(
  { email, onSent },
  ref,
) {
  const { t } = useI18n();
  const { notify, openComposer } = useApp();
  const [body, setBody] = useState('');
  const [suggestions, setSuggestions] = useState<string[] | null>(email.quickReplies);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [tone, setTone] = useState(0);
  const [writing, setWriting] = useState(false);
  const [sending, setSending] = useState(false);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      setSuggestions(await api<string[]>(`/api/emails/${email.id}/replies`, { method: 'POST' }));
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Emails that expect an answer get suggestions right away; others on request (each costs an AI call).
  useEffect(() => {
    if (!email.quickReplies && email.needsReply && !email.repliedAt) void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email.id]);

  const write = async (intent?: string) => {
    if (writing) return;
    setWriting(true);
    try {
      const instruction = [intent ?? (body.trim() ? `Turn these notes into the reply: ${body}` : 'Write a suitable reply.'), TONES[tone].instruction].join(' ');
      const result = await api<{ body: string }>('/api/compose', {
        method: 'POST',
        json: { instruction, to: email.fromAddress, subject: replySubject(email.subject), body: intent ? '' : body, replyToEmailId: email.id },
      });
      setBody(result.body);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setWriting(false);
    }
  };

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await api('/api/send', {
        method: 'POST',
        json: { to: email.fromAddress, subject: replySubject(email.subject), body, replyToEmailId: email.id },
      });
      setBody('');
      notify(t('compose.sent'));
      onSent();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      aria-label={t('reply.title')}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="card mx-7 mb-6 flex flex-col gap-2.5 rounded-[20px] border-line-strong px-4 py-3.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ai">✦ {t('reply.title')}</span>
        {suggestions?.map((s) => (
          <button key={s} type="button" onClick={() => void write(s)} disabled={writing} className="chip h-[30px] bg-elevated text-fg">
            {s}
          </button>
        ))}
        {loadingSuggestions && <Spinner className="text-ai" />}
        {!suggestions && !loadingSuggestions && (
          <button type="button" onClick={loadSuggestions} className="chip h-[30px]">
            {t('reply.suggest')}
          </button>
        )}
        {email.repliedAt && <span className="ml-auto text-xs text-success">✓ {t('reply.replied')}</span>}
      </div>
      <label className="block">
        <span className="sr-only">{t('reply.title')}</span>
        <textarea
          ref={ref}
          rows={body.split('\n').length > 2 ? Math.min(12, body.split('\n').length + 1) : 2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void send();
            }
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          disabled={writing}
          placeholder={writing ? t('compose.aiWorking') : t('reply.placeholder', { name: displayName(email.fromName, email.fromAddress) })}
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-fg placeholder:text-faint focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void write()} disabled={writing} className="btn-ai h-[34px] rounded-[10px]">
          {writing ? <Spinner /> : <Sparkle className="size-3.5" />} {t('reply.write')}
        </button>
        <label className="relative flex items-center font-mono text-xs text-faint">
          <span className="sr-only">{t('reply.tone')}</span>
          <select
            value={tone}
            onChange={(e) => setTone(Number(e.target.value))}
            className="appearance-none bg-transparent py-1 pl-1 pr-5 text-xs text-faint hover:text-fg focus:outline-none"
          >
            {TONES.map((tn, i) => (
              <option key={tn.key} value={i} className="bg-panel text-fg">
                {t('reply.toneLabel', { tone: t(tn.key) })}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-0 size-3.5" />
        </label>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => openComposer({ to: email.fromAddress, subject: replySubject(email.subject), body, replyToEmailId: email.id })}
          className="btn-ghost h-[34px] px-2.5"
          title={t('reply.expand')}
          aria-label={t('reply.expand')}
        >
          <Maximize2 className="size-4" />
        </button>
        <span className="hidden font-mono text-xs text-faint sm:inline">⌘↵</span>
        <button type="submit" disabled={!body.trim() || sending} className="btn-primary h-[38px] rounded-[11px] px-5">
          {sending ? <Spinner /> : null}
          {t('compose.send')}
        </button>
      </div>
    </form>
  );
});
