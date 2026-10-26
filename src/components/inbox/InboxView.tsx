'use client';

import { clsx } from 'clsx';
import { Archive, ChevronDown, Inbox, Mail, MessageSquare, Paperclip, Search, Star, Trash2, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { CategoryBadge, CategoryGlyph, catColor } from '@/lib/categories';
import { dayGroup, displayName, fileSize, fullDate, shortDate } from '@/lib/format';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { Address, Category, Draft, EmailDetail, EmailListItem, View } from '@/lib/types';
import { useApp } from '../shell/AppShell';
import { Avatar, IconButton, Kbd, Spinner } from '../ui';
import { EmailBadge } from '../today/Today';
import { HtmlFrame } from './HtmlFrame';
import { QuickReply } from './QuickReply';

const PAGE = 60;

type Filter = 'all' | 'unread' | 'action';

interface Props {
  view: View;
  categoryId: number | null;
  initialQuery: string;
  initialId: number | null;
  drafts: boolean;
}

export function InboxView({ view, categoryId, initialQuery, initialId, drafts }: Props) {
  const { t, lang } = useI18n();
  const { categoryMap, counts, version, refresh, notify, overlayOpen, openComposer } = useApp();
  const category = categoryId ? categoryMap.get(categoryId) : undefined;

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [draftList, setDraftList] = useState<Draft[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(initialId);
  const [detail, setDetail] = useState<EmailDetail | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const effectiveView: View = view !== 'inbox' ? view : filter === 'all' ? 'inbox' : filter;
  const listUrl = useCallback(
    (offset: number, limit: number) => {
      const params = new URLSearchParams({ view: effectiveView, offset: String(offset), limit: String(limit) });
      if (categoryId) params.set('category', String(categoryId));
      if (debounced) params.set('q', debounced);
      return `/api/emails?${params}`;
    },
    [effectiveView, categoryId, debounced],
  );

  const shown = useRef(0);
  shown.current = emails.length;

  // Reload on filter changes; refresh in place (keeping the scroll length) when synced data changes.
  const lastUrl = useRef('');
  useEffect(() => {
    if (drafts) {
      void api<Draft[]>('/api/drafts').then(setDraftList).finally(() => setLoading(false));
      return;
    }
    const sameList = lastUrl.current === listUrl(0, 0);
    lastUrl.current = listUrl(0, 0);
    const limit = sameList ? Math.max(PAGE, shown.current) : PAGE;
    if (!sameList) setLoading(true);
    let cancelled = false;
    api<EmailListItem[]>(listUrl(0, limit))
      .then((list) => {
        if (cancelled) return;
        setEmails(list);
        setHasMore(list.length === limit);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [listUrl, version, drafts]);

  const loadMore = async () => {
    const more = await api<EmailListItem[]>(listUrl(emails.length, PAGE)).catch(() => []);
    setEmails((list) => [...list, ...more]);
    setHasMore(more.length === PAGE);
  };

  // Keep the URL shareable/reload-safe without re-rendering the server page on every click.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set('id', String(selectedId));
    else url.searchParams.delete('id');
    window.history.replaceState(window.history.state, '', url);
  }, [selectedId]);

  const updateLocal = useCallback((id: number, change: Partial<EmailDetail>) => {
    setEmails((list) => list.map((e) => (e.id === id ? { ...e, ...change } : e)));
    setDetail((d) => (d && d.id === id ? { ...d, ...change } : d));
  }, []);

  const patch = useCallback(
    (id: number, body: Record<string, unknown>) =>
      api(`/api/emails/${id}`, { method: 'PATCH', json: body })
        .then(() => refresh())
        .catch(() => notify(t('toast.error'), 'error')),
    [notify, refresh, t],
  );

  // Open the selected email; marking it read is the only side effect.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    api<EmailDetail>(`/api/emails/${selectedId}`)
      .then((email) => {
        if (cancelled) return;
        setDetail(email);
        if (!email.isRead) {
          updateLocal(email.id, { isRead: true });
          void patch(email.id, { read: true });
        }
      })
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [selectedId, updateLocal, patch]);

  const move = (id: number, to: 'archive' | 'trash') => {
    const index = emails.findIndex((e) => e.id === id);
    const next = emails[index + 1] ?? emails[index - 1];
    setEmails((list) => list.filter((e) => e.id !== id));
    setSelectedId(next?.id ?? null);
    void patch(id, { move: to });
    notify(t(to === 'archive' ? 'toast.archived' : 'toast.trashed'));
  };
  const toggleStar = (id: number, current: boolean) => {
    updateLocal(id, { isStarred: !current });
    void patch(id, { starred: !current });
  };
  const markUnread = (id: number) => {
    updateLocal(id, { isRead: false });
    void patch(id, { read: false });
  };

  // ── Keyboard ────────────────────────────────────────────────────────────
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e: KeyboardEvent) => {
    if (overlayOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
    const index = emails.findIndex((m) => m.id === selectedId);
    const current = detail && detail.id === selectedId ? detail : null;
    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        if (emails[index + 1] ?? (index < 0 && emails[0])) setSelectedId((emails[index + 1] ?? emails[0]).id);
        break;
      case 'k':
      case 'ArrowUp':
        if (index > 0) setSelectedId(emails[index - 1].id);
        break;
      case 'e':
        if (selectedId) move(selectedId, 'archive');
        break;
      case '#':
        if (selectedId) move(selectedId, 'trash');
        break;
      case 's':
        if (current) toggleStar(current.id, current.isStarred);
        break;
      case 'u':
        if (current) markUnread(current.id);
        break;
      case 'r':
        replyRef.current?.focus();
        break;
      case '/':
        searchRef.current?.focus();
        break;
      case 'Escape':
        setSelectedId(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  useEffect(() => {
    if (selectedId) document.querySelector(`[data-email="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  // ── Header ──────────────────────────────────────────────────────────────
  const title = drafts ? t('nav.drafts') : category ? category.name : t(VIEW_TITLE[view]);
  const total = category ? counts.categories[category.id]?.total ?? 0 : null;
  const unread = category ? counts.categories[category.id]?.unread ?? 0 : counts.unread;
  const groups = useMemo(() => groupByDay(emails), [emails]);

  return (
    <div className="flex min-h-0 flex-1">
      <section aria-label={title} className="flex w-[400px] shrink-0 flex-col border-r border-line xl:w-[440px]">
        <header className="flex flex-col gap-3.5 border-b border-line px-[22px] pb-4 pt-6">
          <div className="flex items-center gap-3">
            {category ? <CategoryBadge icon={category.icon} color={category.color} size={40} /> : <ViewBadge view={drafts ? 'drafts' : view} />}
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-2xl font-bold">{title}</h1>
              {!drafts && (
                <div className="text-sm text-faint">
                  {total !== null ? `${t('today.emailCount', { n: total })} · ` : ''}
                  {t('list.unreadCount', { n: unread })}
                </div>
              )}
            </div>
          </div>
          {!drafts && (
            <>
              {view === 'inbox' && (
                <div role="tablist" aria-label={t('list.filter')} className="flex gap-1.5">
                  {(['all', 'unread', 'action'] as Filter[]).map((f) => (
                    <button
                      key={f}
                      role="tab"
                      aria-selected={filter === f}
                      onClick={() => setFilter(f)}
                      className={clsx(
                        'h-[30px] rounded-full px-3 text-sm',
                        filter === f ? 'bg-fg font-semibold text-bg' : 'border border-line text-muted hover:text-fg',
                      )}
                    >
                      {t(FILTER_LABEL[f])}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setQuery('');
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Enter' || e.key === 'ArrowDown') e.currentTarget.blur();
                  }}
                  placeholder={t('list.search')}
                  aria-label={t('list.search')}
                  className="input h-9 pl-9 pr-9"
                />
                {query ? (
                  <button onClick={() => setQuery('')} aria-label={t('shortcut.close')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-fg">
                    <X className="size-4" />
                  </button>
                ) : (
                  <Kbd className="absolute right-2.5 top-1/2 -translate-y-1/2">/</Kbd>
                )}
              </div>
            </>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {loading && emails.length === 0 && !drafts && (
            <div className="flex justify-center py-10 text-faint">
              <Spinner />
            </div>
          )}

          {drafts &&
            (draftList.length ? (
              <div className="px-2.5 pt-3">
                {draftList.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => openComposer({ draftId: d.id, to: d.to, subject: d.subject, body: d.body, replyToEmailId: d.replyToEmailId })}
                    className="block w-full rounded-[14px] p-3 text-left hover:bg-panel"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate font-semibold">{d.to || t('compose.noRecipient')}</span>
                      <span className="font-mono text-2xs text-faint">{shortDate(d.updatedAt.replace(' ', 'T') + 'Z', lang, t('time.yesterday'))}</span>
                    </div>
                    <div className="truncate text-sm font-medium">{d.subject || '—'}</div>
                    <div className="truncate text-sm text-muted">{d.body || '…'}</div>
                  </button>
                ))}
              </div>
            ) : (
              <Empty text={t('list.noDrafts')} />
            ))}

          {!drafts && !loading && emails.length === 0 && (
            <Empty text={debounced ? t('list.noResults', { q: debounced }) : view === 'action' || filter === 'action' ? t('list.noAction') : t('list.empty')} />
          )}

          {!drafts &&
            groups.map(([group, items]) => (
              <div key={group}>
                <div className="eyebrow px-[22px] pb-1.5 pt-4">{t(GROUP_LABEL[group])}</div>
                <div className="flex flex-col gap-1 px-2.5">
                  {items.map((email) => (
                    <Row
                      key={email.id}
                      email={email}
                      selected={email.id === selectedId}
                      category={email.categoryId ? categoryMap.get(email.categoryId) : undefined}
                      onClick={() => setSelectedId(email.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

          {hasMore && !drafts && (
            <div className="p-3 text-center">
              <button onClick={loadMore} className="btn-ghost text-sm">
                {t('list.loadMore')}
              </button>
            </div>
          )}
        </div>
      </section>

      {detail && detail.id === selectedId ? (
        <ReaderPane
          email={detail}
          replyRef={replyRef}
          onArchive={() => move(detail.id, 'archive')}
          onTrash={() => move(detail.id, 'trash')}
          onToggleStar={() => toggleStar(detail.id, detail.isStarred)}
          onMarkUnread={() => markUnread(detail.id)}
          onSetCategory={(value) => {
            updateLocal(detail.id, { categoryId: value });
            void patch(detail.id, { categoryId: value });
          }}
          onToggleAction={(index, done) => {
            setDetail((d) => (d ? { ...d, actions: d.actions.map((a, i) => (i === index ? { ...a, done } : a)) } : d));
            void patch(detail.id, { action: { index, done } });
          }}
          onReplied={() => {
            updateLocal(detail.id, { repliedAt: new Date().toISOString() });
            void refresh();
          }}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          {selectedId ? (
            <Spinner className="text-faint" />
          ) : (
            <>
              <Mail className="size-6 text-faint" strokeWidth={1.5} />
              <p className="text-muted">{t('reader.empty')}</p>
              <p className="text-sm text-faint">
                {t('reader.emptyHint1')} <Kbd>J</Kbd> <Kbd>K</Kbd> {t('reader.emptyHint2')}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const VIEW_TITLE: Record<View, MessageKey> = { inbox: 'nav.inbox', action: 'nav.action', unread: 'nav.unread', starred: 'nav.starred' };
const FILTER_LABEL: Record<Filter, MessageKey> = { all: 'list.all', unread: 'nav.unread', action: 'nav.action' };
const GROUP_LABEL: Record<ReturnType<typeof dayGroup>, MessageKey> = {
  today: 'group.today',
  yesterday: 'group.yesterday',
  week: 'group.week',
  earlier: 'group.earlier',
};

function groupByDay(emails: EmailListItem[]) {
  const groups: [ReturnType<typeof dayGroup>, EmailListItem[]][] = [];
  for (const email of emails) {
    const group = dayGroup(email.receivedAt);
    const last = groups[groups.length - 1];
    if (last && last[0] === group) last[1].push(email);
    else groups.push([group, [email]]);
  }
  return groups;
}

function ViewBadge({ view }: { view: View | 'drafts' }) {
  const Icon = { inbox: Inbox, action: Zap, unread: Mail, starred: Star, drafts: MessageSquare }[view];
  const tone = view === 'action' ? 'bg-accent/15 text-accent-ink' : 'bg-elevated text-muted';
  return (
    <span className={clsx('flex size-10 items-center justify-center rounded-xl', tone)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-6 py-16 text-center text-sm text-faint">{text}</div>;
}

function Row({ email, selected, category, onClick }: { email: EmailListItem; selected: boolean; category?: Category; onClick: () => void }) {
  const { t, lang } = useI18n();
  const unread = !email.isRead;
  return (
    <button
      data-email={email.id}
      onClick={onClick}
      className={clsx(
        'flex w-full gap-3 rounded-[14px] p-3 text-left transition-colors',
        selected ? 'bg-panel shadow-card' : 'hover:bg-panel/60',
      )}
      style={selected ? { outline: `2px solid ${catColor(category?.color, 0.45)}`, outlineOffset: -2 } : undefined}
    >
      <Avatar name={email.fromName} address={email.fromAddress} size={34} color={category?.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {unread && <span className="size-[7px] shrink-0 rounded-full bg-accent" aria-label={t('nav.unread')} />}
          <span className={clsx('min-w-0 flex-1 truncate', unread ? 'font-bold' : 'font-medium text-muted')}>
            {displayName(email.fromName, email.fromAddress)}
          </span>
          {email.isStarred && <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-hidden />}
          {email.hasAttachments && <Paperclip className="size-3.5 shrink-0 text-faint" aria-hidden />}
          <span className="shrink-0 font-mono text-2xs text-faint">{shortDate(email.receivedAt, lang, t('time.yesterday'))}</span>
        </div>
        <div className={clsx('truncate text-sm', unread ? 'font-semibold' : 'text-muted')}>{email.subject || '—'}</div>
        <div className="truncate text-sm text-muted">
          {email.summary ? (
            <>
              <span className="text-ai">✦</span> {email.summary}
            </>
          ) : email.triageStatus === 'pending' ? (
            <span className="text-faint">{t('list.analyzing')}</span>
          ) : (
            email.snippet
          )}
        </div>
        <div className="mt-1.5 flex gap-1.5 empty:hidden">
          <EmailBadge email={email} />
        </div>
      </div>
    </button>
  );
}

function ReaderPane({
  email,
  replyRef,
  onArchive,
  onTrash,
  onToggleStar,
  onMarkUnread,
  onSetCategory,
  onToggleAction,
  onReplied,
}: {
  email: EmailDetail;
  replyRef: React.RefObject<HTMLTextAreaElement>;
  onArchive: () => void;
  onTrash: () => void;
  onToggleStar: () => void;
  onMarkUnread: () => void;
  onSetCategory: (id: number | null) => void;
  onToggleAction: (index: number, done: boolean) => void;
  onReplied: () => void;
}) {
  const { t, lang } = useI18n();
  const { categories, categoryMap } = useApp();
  const category = email.categoryId ? categoryMap.get(email.categoryId) : undefined;

  return (
    <article className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-[60px] shrink-0 items-center gap-1 border-b border-line px-7">
        <IconButton label={t('reader.archive')} shortcut="E" onClick={onArchive} className="size-9 rounded-[10px]">
          <Archive className="size-[18px]" />
        </IconButton>
        <IconButton label={t('reader.trash')} shortcut="#" onClick={onTrash} className="size-9 rounded-[10px]">
          <Trash2 className="size-[18px]" />
        </IconButton>
        <IconButton label={email.isStarred ? t('reader.unstar') : t('reader.star')} shortcut="S" onClick={onToggleStar} className="size-9 rounded-[10px]">
          <Star className={clsx('size-[18px]', email.isStarred && 'fill-accent text-accent')} />
        </IconButton>
        <IconButton label={t('reader.markUnread')} shortcut="U" onClick={onMarkUnread} className="size-9 rounded-[10px]">
          <Mail className="size-[18px]" />
        </IconButton>
        <span className="flex-1" />
        <CategoryPicker current={category} categories={categories} onChange={onSetCategory} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-12 pb-6 pt-8">
        <div className="mx-auto flex max-w-[760px] flex-col gap-[22px]">
          <h2 className="font-display text-[30px] font-bold leading-[1.15]">{email.subject || '—'}</h2>
          <div className="flex items-center gap-3">
            <Avatar name={email.fromName} address={email.fromAddress} size={42} color={category?.color} />
            <div className="min-w-0 flex-1">
              <div className="truncate">
                <strong>{displayName(email.fromName, email.fromAddress)}</strong>{' '}
                <span className="text-sm text-faint">{email.fromAddress}</span>
              </div>
              <div className="truncate text-sm text-muted">
                {fullDate(email.receivedAt, lang)}
                {email.to.length > 0 && ` · ${t('reader.to')} ${addressList(email.to)}`}
              </div>
            </div>
          </div>

          {(email.summary || email.actions.length > 0) && (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-ai/25 bg-ai/10 px-[18px] py-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-ai">
                ✦ {t('reader.summary')}
                <EmailBadge email={email} />
              </div>
              {email.summary && <p className="text-[15px]">{email.summary}</p>}
              {email.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {email.actions.map((action, i) => (
                    <label key={i} className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-panel px-2.5 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={action.done}
                        onChange={(e) => onToggleAction(i, e.target.checked)}
                        className="accent-[rgb(var(--accent))]"
                      />
                      <span className={action.done ? 'text-faint line-through' : ''}>{action.text}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {email.triageStatus === 'failed' && <p className="text-sm text-danger">{t('reader.triageFailed')}</p>}

          {email.bodyHtml ? (
            <HtmlFrame html={email.bodyHtml} />
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.7]">{email.bodyText}</pre>
          )}

          {email.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              {email.attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm">
                  <span className="font-mono text-[10px] font-semibold uppercase text-ai">{a.filename.split('.').pop()?.slice(0, 4)}</span>
                  <span className="max-w-[220px] truncate">{a.filename}</span>
                  <span className="text-faint">{fileSize(a.size)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <QuickReply key={email.id} ref={replyRef} email={email} onSent={onReplied} />
    </article>
  );
}

function addressList(list: Address[]): string {
  return list.map((a) => a.name || a.address).join(', ');
}

function CategoryPicker({ current, categories, onChange }: { current?: Category; categories: Category[]; onChange: (id: number | null) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (id: number | null) => {
    setOpen(false);
    if (id !== (current?.id ?? null)) onChange(id);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-2 rounded-full border border-line px-3 text-sm hover:border-line-strong"
      >
        {current ? (
          <span className="size-2 rounded-[3px]" style={{ background: catColor(current.color) }} />
        ) : (
          <span className="size-2 rounded-[3px] border border-faint" />
        )}
        {current?.name ?? t('reader.noCategory')}
        <ChevronDown className="size-3.5 text-faint" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-64 rounded-xl bg-elevated p-1.5 shadow-pop animate-pop-in">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => choose(c.id)}
              className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-hover', c.id === current?.id && 'font-semibold')}
            >
              <span style={{ color: catColor(c.color) }}>
                <CategoryGlyph icon={c.icon} className="size-4" />
              </span>
              {c.name}
            </button>
          ))}
          <button onClick={() => choose(null)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted hover:bg-hover">
            <span className="size-4" /> {t('reader.noCategory')}
          </button>
          <p className="border-t border-line px-2.5 pb-1 pt-2 text-xs text-faint">{t('reader.categoryHint')}</p>
        </div>
      )}
    </div>
  );
}
