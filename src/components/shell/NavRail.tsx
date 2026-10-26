'use client';

import { clsx } from 'clsx';
import { AlertCircle, Inbox, MessageSquare, Moon, PenLine, Plus, Settings, Sun, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { catColor } from '@/lib/categories';
import { timeAgo } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { currentTheme, setTheme, type Theme } from '@/lib/theme';
import type { Conversation } from '@/lib/types';
import { Kbd, Spinner } from '../ui';
import type { SyncState } from '../useSync';
import { useApp } from './AppShell';

/** Fired by the assistant page when a conversation is created or renamed. */
export const CONVERSATIONS_CHANGED = 'inbox:conversations-changed';

export function NavRail({ onSettings, onCompose }: { onSettings: () => void; onCompose: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { categories, counts, sync, runSync } = useApp();
  const pathname = usePathname();
  const params = useSearchParams();

  const onInbox = pathname === '/inbox';
  const view = params.get('view');
  const category = Number(params.get('category')) || null;
  const isActive = {
    today: pathname === '/',
    inbox: onInbox && !view && !category && !params.has('drafts'),
    action: onInbox && view === 'action',
    drafts: onInbox && params.has('drafts'),
    assistant: pathname === '/assistant',
  };

  return (
    <nav
      aria-label={t('nav.main')}
      className="flex w-[244px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-rail px-3.5 pb-4 pt-5"
    >
      <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
        <Logo />
        <span className="font-display text-[17px] font-bold">Inbox Assistant</span>
      </Link>

      <button onClick={onCompose} className="btn-primary mb-4 h-10 justify-between rounded-[11px] px-3">
        <span className="flex items-center gap-2">
          <PenLine className="size-4" /> {t('nav.compose')}
        </span>
        <span className="font-mono text-2xs opacity-70">C</span>
      </button>

      <RailLink href="/" active={isActive.today} icon={<Sun className="size-[18px] text-accent" />}>
        {t('nav.today')}
      </RailLink>
      <RailLink href="/inbox" active={isActive.inbox} icon={<Inbox className="size-[18px]" />} count={counts.unread}>
        {t('nav.inbox')}
      </RailLink>
      <RailLink
        href="/inbox?view=action"
        active={isActive.action}
        icon={<Zap className="size-[18px]" />}
        badge={counts.action > 0 ? counts.action : undefined}
      >
        {t('nav.action')}
      </RailLink>
      <RailLink href="/assistant" active={isActive.assistant} icon={<Sparkle className="size-[18px] text-ai" />} hint="⌘J">
        {t('nav.assistant')}
      </RailLink>
      <RailLink href="/inbox?drafts=1" active={isActive.drafts} icon={<MessageSquare className="size-[18px]" />} count={counts.drafts}>
        {t('nav.drafts')}
      </RailLink>

      {pathname === '/assistant' ? (
        <Conversations />
      ) : (
        <>
          <div className="eyebrow px-3 pb-2 pt-6">{t('nav.categories')}</div>
          {categories.map((c) => (
            <RailLink
              key={c.id}
              href={`/inbox?category=${c.id}`}
              active={onInbox && category === c.id}
              small
              icon={<span className="size-[9px] rounded-[3px]" style={{ background: catColor(c.color) }} />}
              count={counts.categories[c.id]?.unread}
            >
              {c.name}
            </RailLink>
          ))}
        </>
      )}

      <div className="min-h-6 flex-1" />
      <SyncCard sync={sync} onSync={runSync} />
      <div className="mt-2.5 flex gap-1.5">
        <SegButton active={lang === 'vi'} onClick={() => setLang('vi')} label="Tiếng Việt">
          VI
        </SegButton>
        <SegButton active={lang === 'en'} onClick={() => setLang('en')} label="English">
          EN
        </SegButton>
        <ThemeButton />
        <button
          onClick={onSettings}
          aria-label={t('nav.settings')}
          title={`${t('nav.settings')}  ,`}
          className="flex h-[34px] w-10 items-center justify-center rounded-[9px] text-muted hover:bg-hover hover:text-fg"
        >
          <Settings className="size-4" />
        </button>
      </div>
    </nav>
  );
}

function RailLink({
  href,
  active,
  icon,
  count,
  badge,
  hint,
  small,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  count?: number;
  badge?: number;
  hint?: string;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex shrink-0 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors',
        small ? 'h-[34px]' : 'h-10',
        active ? 'bg-panel font-semibold text-fg shadow-card' : 'text-muted hover:bg-panel/60 hover:text-fg',
      )}
    >
      <span className="flex w-[18px] justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge !== undefined && <span className="rounded-md bg-accent px-1.5 font-mono text-xs font-medium text-accent-fg">{badge}</span>}
      {!!count && <span className="font-mono text-xs text-faint">{count}</span>}
      {hint && <Kbd>{hint}</Kbd>}
    </Link>
  );
}

function Conversations() {
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const current = Number(params.get('c')) || null;
  const [items, setItems] = useState<Conversation[]>([]);

  useEffect(() => {
    const load = () => void api<Conversation[]>('/api/conversations').then(setItems).catch(() => undefined);
    load();
    window.addEventListener(CONVERSATIONS_CHANGED, load);
    return () => window.removeEventListener(CONVERSATIONS_CHANGED, load);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between px-3 pb-2 pt-6">
        <span className="eyebrow">{t('assistant.history')}</span>
        <Link href="/assistant" aria-label={t('assistant.new')} title={t('assistant.new')} className="text-faint hover:text-fg">
          <Plus className="size-4" />
        </Link>
      </div>
      {items.length === 0 && <p className="px-3 text-xs text-faint">{t('assistant.historyEmpty')}</p>}
      {items.map((c) => (
        <Link
          key={c.id}
          href={`/assistant?c=${c.id}`}
          className={clsx(
            'block shrink-0 rounded-[10px] px-3 py-2 text-sm',
            c.id === current ? 'bg-elevated text-fg' : 'text-muted hover:bg-panel/60 hover:text-fg',
          )}
        >
          <span className="line-clamp-1">{c.title}</span>
          <span className="block font-mono text-2xs text-faint">{timeAgo(c.updatedAt.replace(' ', 'T') + 'Z', lang)}</span>
        </Link>
      ))}
    </>
  );
}

function SyncCard({ sync, onSync }: { sync: SyncState; onSync: () => void }) {
  const { t, lang } = useI18n();
  const progress = sync.total ? Math.round((sync.done / sync.total) * 100) : sync.running ? 8 : 100;
  const label = sync.running
    ? sync.phase === 'triage'
      ? t('sync.triage', { done: sync.done, total: sync.total })
      : sync.phase === 'fetching'
        ? t('sync.fetching', { done: sync.done, total: sync.total })
        : t('sync.connecting')
    : sync.error
      ? t('sync.error')
      : sync.lastSyncedAt
        ? t('sync.synced')
        : t('sync.never');

  return (
    <button
      onClick={onSync}
      disabled={sync.running}
      title={sync.error ?? t('sync.now')}
      className="card flex flex-col gap-2 px-3.5 py-3 text-left shadow-none transition-colors hover:border-line-strong disabled:cursor-default"
    >
      <span className="flex items-center gap-2 text-sm">
        {sync.running ? (
          <Spinner className="text-ai" />
        ) : sync.error ? (
          <AlertCircle className="size-3.5 text-danger" />
        ) : (
          <span className="size-2 rounded-full bg-success" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {!sync.running && sync.lastSyncedAt && <span className="font-mono text-xs text-faint">{timeAgo(sync.lastSyncedAt, lang)}</span>}
      </span>
      <span className="h-1 overflow-hidden rounded bg-line">
        <span className="block h-full rounded bg-ai transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </span>
      <span className="text-xs text-muted">{sync.running ? t('sync.working') : t('sync.now')}</span>
    </button>
  );
}

function SegButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        'h-[34px] flex-1 rounded-[9px] border text-sm',
        active ? 'border-line-strong bg-panel font-semibold text-fg' : 'border-transparent text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function ThemeButton() {
  const { t } = useI18n();
  const [theme, setThemeState] = useState<Theme>('dark');
  useEffect(() => setThemeState(currentTheme()), []);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      onClick={() => {
        setTheme(next);
        setThemeState(next);
      }}
      aria-label={t('palette.toggleTheme')}
      className="flex h-[34px] w-10 items-center justify-center rounded-[9px] text-muted hover:bg-hover hover:text-fg"
    >
      {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center bg-accent text-accent-fg"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7l8 6 8-6" />
        <rect x="3" y="5" width="18" height="14" rx="3" />
      </svg>
    </span>
  );
}

/** The four-point star used for everything AI-made. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </svg>
  );
}
