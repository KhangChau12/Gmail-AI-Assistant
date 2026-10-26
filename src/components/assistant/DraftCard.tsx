'use client';

import { clsx } from 'clsx';
import { Check, CornerUpLeft, Maximize2, PenLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { ChatDraft } from '@/lib/types';
import { TONES } from '../inbox/QuickReply';
import { useApp } from '../shell/AppShell';
import { Spinner } from '../ui';

/**
 * A draft the assistant wrote, editable in place. Edits are saved back into the chat message
 * (`messageId`), so reopening the conversation shows the latest version — or that it was sent.
 */
export function DraftCard({ draft: initial, messageId }: { draft: ChatDraft; messageId: number | null }) {
  const { t } = useI18n();
  const { notify, openComposer, refresh } = useApp();
  const [draft, setDraft] = useState(initial);
  const [busyTone, setBusyTone] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(true);

  // The assistant may revise the draft while streaming; follow it until the user starts editing.
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) setDraft(initial);
  }, [initial]);

  useEffect(() => {
    if (!messageId || saved) return;
    const timer = setTimeout(() => {
      void api(`/api/chat-drafts/${messageId}`, { method: 'PUT', json: draft }).then(() => setSaved(true));
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, messageId, saved]);

  const change = (patch: Partial<ChatDraft>) => {
    edited.current = true;
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const retone = async (index: number) => {
    setBusyTone(index);
    try {
      const result = await api<{ subject: string; body: string }>('/api/compose', {
        method: 'POST',
        json: { instruction: `Rewrite this draft. ${TONES[index].instruction}`, ...draft },
      });
      change({ subject: result.subject || draft.subject, body: result.body });
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setBusyTone(null);
    }
  };

  const send = async () => {
    if (!draft.to.trim() || sending) return;
    setSending(true);
    try {
      await api('/api/send', { method: 'POST', json: draft });
      const sent = { ...draft, sent: true };
      setDraft(sent);
      if (messageId) void api(`/api/chat-drafts/${messageId}`, { method: 'PUT', json: sent });
      notify(t('compose.sent'));
      void refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setSending(false);
    }
  };

  if (draft.sent) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3 text-sm">
        <span className="flex size-7 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="font-semibold">{t('draft.sent')}</div>
          <div className="truncate text-muted">
            {draft.to} · {draft.subject}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      aria-label={t('draft.title')}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="overflow-hidden rounded-card border border-line-strong bg-panel shadow-card animate-rise-in"
    >
      <div className="flex items-center gap-2.5 border-b border-line bg-elevated px-4 py-3">
        {draft.replyToEmailId ? <CornerUpLeft className="size-4 text-ai" /> : <PenLine className="size-4 text-ai" />}
        <span className="flex-1 truncate text-sm font-semibold">
          {draft.replyToEmailId ? t('draft.reply') : t('draft.new')} · {draft.subject}
        </span>
        <span className="font-mono text-2xs text-faint">{saved ? t('draft.saved') : '…'}</span>
      </div>
      <label className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="w-14 text-sm text-faint">{t('compose.to')}</span>
        <input value={draft.to} onChange={(e) => change({ to: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none" />
      </label>
      <label className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="w-14 text-sm text-faint">{t('compose.subject')}</span>
        <input
          value={draft.subject}
          onChange={(e) => change({ subject: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold focus:outline-none"
        />
      </label>
      <label className="block px-4 py-3.5">
        <span className="sr-only">{t('compose.body')}</span>
        <textarea
          value={draft.body}
          onChange={(e) => change({ body: e.target.value })}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void send();
            }
          }}
          rows={Math.min(14, Math.max(5, draft.body.split('\n').length + 1))}
          className="w-full resize-y bg-transparent text-[15px] leading-relaxed focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {TONES.map((tone, i) => (
          <button
            key={tone.key}
            type="button"
            onClick={() => void retone(i)}
            disabled={busyTone !== null}
            className={clsx('chip h-8', busyTone === i && 'border-ai text-ai')}
          >
            {busyTone === i && <Spinner className="size-3" />}
            {t(tone.key)}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => openComposer({ to: draft.to, subject: draft.subject, body: draft.body, replyToEmailId: draft.replyToEmailId })}
          className="btn-outline h-[38px] rounded-[11px]"
        >
          <Maximize2 className="size-3.5" /> {t('draft.openComposer')}
        </button>
        <button type="submit" disabled={!draft.to.trim() || sending} className="btn-primary h-[38px] rounded-[11px] px-[18px]">
          {sending && <Spinner />}
          {t('compose.send')} <span className="font-mono text-2xs opacity-70">⌘↵</span>
        </button>
      </div>
    </form>
  );
}
