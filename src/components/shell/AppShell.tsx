'use client';

import { Inbox, Languages, MessageSquare, Moon, PenSquare, RefreshCw, Settings, Sun, Zap } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { CategoryGlyph } from '@/lib/categories';
import { useI18n } from '@/lib/i18n';
import { currentTheme, setTheme } from '@/lib/theme';
import type { Category, ComposeState, Counts, EmailDetail, SyncStatus } from '@/lib/types';
import { CommandPalette, type Command } from '../CommandPalette';
import { Composer } from '../Composer';
import { SettingsDialog } from '../SettingsDialog';
import { Toast, type ToastState } from '../ui';
import { useSync, type SyncState } from '../useSync';
import { NavRail } from './NavRail';

interface AppContextValue {
  account: string;
  categories: Category[];
  categoryMap: Map<number, Category>;
  counts: Counts;
  sync: SyncState;
  /** Bumps whenever synced data may have changed, so pages can refetch. */
  version: number;
  refresh: () => Promise<void>;
  runSync: () => void;
  openComposer: (state?: ComposeState) => void;
  notify: (message: string, tone?: ToastState['tone']) => void;
  /** True while a modal is open — pages ignore their single-key shortcuts then. */
  overlayOpen: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppShell');
  return ctx;
}

const EMPTY_COMPOSE: ComposeState = { to: '', subject: '', body: '' };

interface Props {
  account: string;
  model: string;
  initialSync: SyncStatus;
  initialCategories: Category[];
  initialCounts: Counts;
  children: ReactNode;
}

export function AppShell({ account, model, initialSync, initialCategories, initialCounts, children }: Props) {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const [categories, setCategories] = useState(initialCategories);
  const [counts, setCounts] = useState(initialCounts);
  const [version, setVersion] = useState(0);
  const [composer, setComposer] = useState<{ state: ComposeState; replyTo: EmailDetail | null } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((message: string, tone: ToastState['tone'] = 'default') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const refresh = useCallback(async () => {
    const [nextCounts, nextCategories] = await Promise.all([api<Counts>('/api/counts'), api<Category[]>('/api/categories')]).catch(
      () => [null, null] as const,
    );
    if (nextCounts) setCounts(nextCounts);
    if (nextCategories) setCategories(nextCategories);
    setVersion((v) => v + 1);
  }, []);

  const { state: sync, sync: startSync } = useSync(initialSync, refresh);
  const runSync = useCallback(() => void startSync(), [startSync]);

  const openComposer = useCallback(async (state: ComposeState = EMPTY_COMPOSE) => {
    const replyTo = state.replyToEmailId ? await api<EmailDetail>(`/api/emails/${state.replyToEmailId}`).catch(() => null) : null;
    setComposer({ state, replyTo });
  }, []);

  const overlayOpen = composer !== null || paletteOpen || settingsOpen;

  // Global shortcuts; page-specific ones (j/k/e/r…) live in the pages.
  const handler = useRef<(e: KeyboardEvent) => void>(() => undefined);
  handler.current = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'k' && !composer) {
      e.preventDefault();
      setPaletteOpen((o) => !o);
      return;
    }
    if (mod && key === 'j') {
      e.preventDefault();
      router.push('/assistant');
      return;
    }
    if (overlayOpen || mod || e.altKey) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
    if (key === 'c') {
      e.preventDefault();
      void openComposer();
    } else if (e.key === ',') {
      e.preventDefault();
      setSettingsOpen(true);
    } else if (key === 'g') {
      // "g" then a letter, Gmail-style: g t = Today, g i = Inbox, g a = Needs action.
      const next = (ev: KeyboardEvent) => {
        window.removeEventListener('keydown', next, true);
        const target = { t: '/', i: '/inbox', a: '/inbox?view=action' }[ev.key.toLowerCase()];
        if (target) {
          ev.preventDefault();
          ev.stopPropagation();
          router.push(target);
        }
      };
      window.addEventListener('keydown', next, true);
      setTimeout(() => window.removeEventListener('keydown', next, true), 1200);
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => handler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const commands: Command[] = [
    { id: 'compose', group: 'actions', label: t('nav.compose'), icon: <PenSquare className="size-3.5" />, shortcut: 'C', run: () => void openComposer() },
    { id: 'sync', group: 'actions', label: t('sync.now'), icon: <RefreshCw className="size-3.5" />, run: runSync },
    {
      id: 'theme',
      group: 'actions',
      label: t('palette.toggleTheme'),
      icon: <Moon className="size-3.5" />,
      run: () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'),
    },
    { id: 'lang', group: 'actions', label: t('palette.toggleLang'), icon: <Languages className="size-3.5" />, run: () => setLang(lang === 'vi' ? 'en' : 'vi') },
    { id: 'settings', group: 'actions', label: t('nav.settings'), icon: <Settings className="size-3.5" />, shortcut: ',', run: () => setSettingsOpen(true) },
    { id: 'go-today', group: 'go', label: t('nav.today'), icon: <Sun className="size-3.5" />, shortcut: 'G T', run: () => router.push('/') },
    { id: 'go-inbox', group: 'go', label: t('nav.inbox'), icon: <Inbox className="size-3.5" />, shortcut: 'G I', run: () => router.push('/inbox') },
    { id: 'go-action', group: 'go', label: t('nav.action'), icon: <Zap className="size-3.5" />, shortcut: 'G A', run: () => router.push('/inbox?view=action') },
    { id: 'go-assistant', group: 'go', label: t('nav.assistant'), icon: <MessageSquare className="size-3.5" />, shortcut: '⌘J', run: () => router.push('/assistant') },
    ...categories.map<Command>((c) => ({
      id: `go-cat-${c.id}`,
      group: 'go',
      label: c.name,
      icon: <CategoryGlyph icon={c.icon} className="size-3.5" />,
      run: () => router.push(`/inbox?category=${c.id}`),
    })),
  ];

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const value = useMemo<AppContextValue>(
    () => ({ account, categories, categoryMap, counts, sync, version, refresh, runSync, openComposer, notify, overlayOpen }),
    [account, categories, categoryMap, counts, sync, version, refresh, runSync, openComposer, notify, overlayOpen],
  );

  return (
    <AppContext.Provider value={value}>
      <div className="flex h-full min-h-0">
        <Suspense>
          <NavRail onSettings={() => setSettingsOpen(true)} onCompose={() => void openComposer()} />
        </Suspense>
        <main key={pathname} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>

      {composer && (
        <Composer
          initial={composer.state}
          replyTo={composer.replyTo}
          onClose={() => {
            setComposer(null);
            void refresh();
          }}
          onSent={() => {
            setComposer(null);
            notify(t('compose.sent'));
            void refresh();
          }}
          onError={(message) => notify(message, 'error')}
        />
      )}
      {paletteOpen && (
        <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} onOpenEmail={(id) => router.push(`/inbox?id=${id}`)} />
      )}
      {settingsOpen && (
        <SettingsDialog
          account={account}
          model={model}
          categories={categories}
          onCategoriesChange={() => void refresh()}
          onClose={() => setSettingsOpen(false)}
          onToast={(message) => {
            notify(message);
            runSync();
          }}
        />
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppContext.Provider>
  );
}
