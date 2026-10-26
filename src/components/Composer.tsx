'use client';

import { ArrowUp, CornerUpLeft, Sparkles, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { displayName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Address, ComposeState, Draft, EmailDetail } from '@/lib/types';
import { IconButton, Kbd, Modal, Spinner } from './ui';

interface Props {
  initial: ComposeState;
  replyTo: EmailDetail | null;
  onClose: () => void;
  onSent: () => void;
  onError: (message: string) => void;
}

const AUTOSAVE_MS = 1200;

export function Composer({ initial, replyTo, onClose, onSent, onError }: Props) {
  const { t } = useI18n();
  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [draftId, setDraftId] = useState(initial.draftId);
  const [instruction, setInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [previous, setPrevious] = useState<{ subject: string; body: string } | null>(null);
  const [sending, setSending] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const aiRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (initial.to ? bodyRef : toRef).current?.focus();
  }, [initial.to]);

  // Autosave to local drafts so closing the composer never loses text.
  const latest = useRef({ to, subject, body, draftId });
  latest.current = { to, subject, body, draftId };
  const dirty = to !== initial.to || subject !== initial.subject || body !== initial.body;
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(async () => {
      const draft = await api<Draft>('/api/drafts', {
        method: 'POST',
        json: { id: latest.current.draftId, to, subject, body, replyToEmailId: initial.replyToEmailId ?? null },
      }).catch(() => null);
      if (draft) setDraftId(draft.id);
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [to, subject, body, dirty, initial.replyToEmailId]);

  const askAi = async () => {
    if (!instruction.trim() || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const result = await api<{ subject: string; body: string; note: string }>('/api/compose', {
        method: 'POST',
        json: { instruction, to, subject, body, replyToEmailId: initial.replyToEmailId ?? null },
      });
      setPrevious({ subject, body });
      setSubject(result.subject || subject);
      setBody(result.body);
      setAiNote(result.note);
      setInstruction('');
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setAiBusy(false);
    }
  };

  const undo = () => {
    if (!previous) return;
    setSubject(previous.subject);
    setBody(previous.body);
    setPrevious(null);
    setAiNote(null);
  };

  const send = useCallback(async () => {
    const current = latest.current;
    if (!current.to.trim() || sending) return;
    setSending(true);
    try {
      await api('/api/send', {
        method: 'POST',
        json: { ...current, draftId: current.draftId, replyToEmailId: initial.replyToEmailId ?? null },
      });
      onSent();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      setSending(false);
    }
  }, [sending, initial.replyToEmailId, onSent, onError]);

  const discard = async () => {
    if (draftId) await api(`/api/drafts/${draftId}`, { method: 'DELETE' }).catch(() => undefined);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void send();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      aiRef.current?.focus();
    }
  };

  return (
    <Modal onClose={onClose} className="flex max-h-[86vh] w-full max-w-[720px] flex-col">
      <div onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line pl-4 pr-2">
          {replyTo ? (
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
              <CornerUpLeft className="size-3.5 shrink-0" />
              <span className="truncate">
                {t('compose.reply')} · {displayName(replyTo.fromName, replyTo.fromAddress)}
              </span>
            </span>
          ) : (
            <span className="text-sm font-medium">{t('compose.new')}</span>
          )}
          <IconButton label={t('shortcut.close')} shortcut="Esc" onClick={onClose} className="ml-auto">
            <X className="size-4" />
          </IconButton>
        </header>

        <div className="border-b border-line px-4">
          <RecipientField inputRef={toRef} value={to} onChange={setTo} label={t('compose.to')} />
        </div>
        <div className="border-b border-line px-4">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('compose.subject')}
            className="h-10 w-full bg-transparent text-sm font-medium placeholder:font-normal placeholder:text-faint focus:outline-none"
          />
        </div>

        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('compose.body')}
          className="min-h-[260px] flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-faint focus:outline-none"
        />

        <div className="px-3 pb-3">
          {aiNote && (
            <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted animate-fade-in">
              <Sparkles className="size-3 text-ai" />
              <span className="flex-1">{aiNote}</span>
              {previous && (
                <button onClick={undo} className="text-ai hover:underline">
                  {t('compose.undo')}
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-line bg-panel py-1 pl-3 pr-1 focus-within:border-accent/60">
            <Sparkles className="size-3.5 shrink-0 text-ai" />
            <input
              ref={aiRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  void askAi();
                }
              }}
              placeholder={aiBusy ? t('compose.aiWorking') : t('compose.aiPlaceholder')}
              disabled={aiBusy}
              className="h-7 min-w-0 flex-1 bg-transparent text-sm placeholder:text-faint focus:outline-none"
            />
            {aiBusy ? (
              <Spinner className="mr-1.5 text-ai" />
            ) : instruction ? (
              <IconButton label="Generate" onClick={askAi} className="size-6 bg-accent text-accent-fg hover:bg-accent/90 hover:text-accent-fg">
                <ArrowUp className="size-3.5" />
              </IconButton>
            ) : (
              <Kbd className="mr-1">⌘K</Kbd>
            )}
          </div>
        </div>

        <footer className="flex h-12 shrink-0 items-center gap-2 border-t border-line px-3">
          <button onClick={send} disabled={!to.trim() || sending} className="btn-primary">
            {sending ? <Spinner /> : null}
            {sending ? t('compose.sending') : t('compose.send')}
            {!sending && <span className="font-mono text-2xs opacity-70">⌘↵</span>}
          </button>
          {draftId && !sending && <span className="text-xs text-faint">{t('compose.saved')}</span>}
          <IconButton label={t('compose.discard')} onClick={discard} className="ml-auto">
            <Trash2 className="size-4" />
          </IconButton>
        </footer>
      </div>
    </Modal>
  );
}

/** Recipient input with suggestions from people who have emailed you. */
function RecipientField({
  value,
  onChange,
  label,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const [suggestions, setSuggestions] = useState<Address[]>([]);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

  // Suggest for the address currently being typed (after the last comma).
  const term = value.split(',').pop()!.trim();
  useEffect(() => {
    if (!focused || term.length < 2 || term.includes('@')) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api<Address[]>(`/api/contacts?q=${encodeURIComponent(term)}`)
        .then((list) => {
          setSuggestions(list);
          setActive(0);
        })
        .catch(() => setSuggestions([]));
    }, 120);
    return () => clearTimeout(timer);
  }, [term, focused]);

  const pick = (a: Address) => {
    const parts = value.split(',').slice(0, -1).map((p) => p.trim()).filter(Boolean);
    onChange([...parts, a.address].join(', ') + ', ');
    setSuggestions([]);
  };

  return (
    <div className="relative flex h-10 items-center gap-3">
      <span className="w-12 shrink-0 text-xs text-faint">{label}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            pick(suggestions[active]);
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <div className="absolute left-12 top-10 z-30 w-80 rounded-lg bg-elevated p-1 shadow-pop">
          {suggestions.map((s, i) => (
            <button
              key={s.address}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              className={`flex w-full flex-col rounded-md px-2 py-1 text-left ${i === active ? 'bg-selected' : 'hover:bg-hover'}`}
            >
              <span className="text-sm">{s.name || s.address}</span>
              {s.name && <span className="text-xs text-faint">{s.address}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
