'use client';

import { ArrowUp, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CategoryBadge, catColor } from '@/lib/categories';
import { displayName, dueDay, longDate, weekdayShort } from '@/lib/format';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { Category, EmailListItem, TodayData } from '@/lib/types';
import { useApp } from '../shell/AppShell';
import { Sparkle } from '../shell/NavRail';
import { Avatar } from '../ui';

function greetingKey(): MessageKey {
  const hour = new Date().getHours();
  if (hour < 11) return 'today.morning';
  if (hour < 18) return 'today.afternoon';
  return 'today.evening';
}

export function Today() {
  const { t, lang } = useI18n();
  const { version, categories, sync, openComposer } = useApp();
  const router = useRouter();
  const [data, setData] = useState<TodayData | null>(null);
  const [question, setQuestion] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    void api<TodayData>('/api/today').then(setData).catch(() => undefined);
  }, [version]);

  const ask = (text: string) => {
    if (text.trim()) router.push(`/assistant?q=${encodeURIComponent(text.trim())}`);
  };

  const name = data?.userName;
  const examples: MessageKey[] = ['ai.example1', 'ai.example2', 'ai.example3'];
  const maxActivity = Math.max(1, ...(data?.activity.map((d) => d.count) ?? [1]));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-8 pb-14 pt-10 xl:px-12">
        <header className="flex flex-wrap items-end justify-between gap-4 animate-rise-in">
          <div>
            <div className="eyebrow">{longDate(new Date(), lang)}</div>
            <h1 className="mt-1.5 font-display text-[44px] font-bold leading-[1.05]">
              {t(greetingKey())}
              {name ? `, ${name}` : ''}.
            </h1>
            <p className="mt-2.5 text-[16px] text-muted">
              {data ? (
                <>
                  {t('today.newMail', { n: data.newCount })}{' '}
                  {data.action.length > 0 ? (
                    <strong className="font-semibold text-accent-ink">{t('today.needYou', { n: data.action.length })}</strong>
                  ) : (
                    t('today.allClear')
                  )}
                </>
              ) : sync.running && !sync.lastSyncedAt ? (
                t('list.firstSync')
              ) : (
                ' '
              )}
            </p>
          </div>
          <div className="flex gap-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/inbox?q=${encodeURIComponent(search)}`);
              }}
              className="flex h-[42px] min-w-[240px] items-center gap-2 rounded-[11px] border border-line bg-panel px-3.5 text-faint focus-within:border-accent/60"
            >
              <Search className="size-4" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('list.search')}
                aria-label={t('list.search')}
                className="min-w-0 flex-1 bg-transparent text-fg placeholder:text-faint focus:outline-none"
              />
            </form>
            <button onClick={() => openComposer()} className="btn-primary h-[42px] rounded-[11px] px-[18px]">
              <Plus className="size-4" /> {t('nav.compose')}
            </button>
          </div>
        </header>

        <section aria-label={t('today.askTitle')} className="card flex flex-col gap-4 rounded-[22px] p-[22px] pb-[18px] animate-rise-in [animation-delay:40ms]">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ai/15 text-ai">
              <Sparkle className="size-5" />
            </span>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-ai">{t('today.askTitle')}</span>
              <textarea
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(question);
                  }
                }}
                placeholder={t('today.askPlaceholder')}
                className="resize-none bg-transparent text-[20px] leading-[1.45] text-fg placeholder:text-faint focus:outline-none"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {examples.map((key) => (
              <button key={key} onClick={() => ask(t(key))} className="chip">
                {t(key)}
              </button>
            ))}
            <span className="flex-1" />
            <span className="hidden font-mono text-xs text-faint md:inline">{t('today.askHint')}</span>
            <button
              onClick={() => ask(question)}
              disabled={!question.trim()}
              aria-label={t('shortcut.send')}
              className="flex size-11 items-center justify-center rounded-[14px] bg-accent text-accent-fg transition-opacity disabled:opacity-40"
            >
              <ArrowUp className="size-5" strokeWidth={2.4} />
            </button>
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-7">
          <section aria-label={t('nav.categories')} className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[22px] font-semibold">{t('nav.categories')}</h2>
              <span className="text-sm text-faint">{t('today.categoriesHint')}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
              {categories.map((c, i) => (
                <CategoryTile key={c.id} category={c} stats={data?.categories.find((s) => s.id === c.id)} delay={i * 30} />
              ))}
              {categories.length === 0 && <p className="text-sm text-faint">{t('today.noCategories')}</p>}
            </div>
          </section>

          <aside aria-label={t('nav.action')} className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[22px] font-semibold">{t('nav.action')}</h2>
              <Link href="/inbox?view=action" className="text-sm font-semibold text-accent-ink hover:underline">
                {t('today.seeAll')}
              </Link>
            </div>
            <div className="card overflow-hidden">
              {data?.action.map((email) => <ActionRow key={email.id} email={email} />)}
              {data && data.action.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <p className="font-display text-lg font-semibold">{t('today.nothingTitle')}</p>
                  <p className="mt-1 text-sm text-muted">{t('today.nothingBody')}</p>
                </div>
              )}
              {!data && <div className="h-40" />}
            </div>

            {data && (
              <div className="card px-[18px] py-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{t('today.activity')}</span>
                  <span className="font-mono text-xs text-faint">{t('today.last7')}</span>
                </div>
                <div className="mt-3.5 flex h-[72px] items-end gap-2" aria-hidden>
                  {data.activity.map((d, i) => (
                    <div
                      key={d.date}
                      title={String(d.count)}
                      className={i === 6 ? 'flex-1 rounded-[5px] bg-accent' : 'flex-1 rounded-[5px] bg-line-strong'}
                      style={{ height: `${Math.max(6, (d.count / maxActivity) * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex gap-2 font-mono text-2xs text-faint">
                  {data.activity.map((d, i) => (
                    <span key={d.date} className={i === 6 ? 'flex-1 text-center text-accent-ink' : 'flex-1 text-center'}>
                      {i === 6 ? t('today.now') : weekdayShort(d.date, lang)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function CategoryTile({ category, stats, delay }: { category: Category; stats?: TodayData['categories'][number]; delay: number }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/inbox?category=${category.id}`}
      style={{ animationDelay: `${80 + delay}ms` }}
      className="card group flex min-h-[196px] flex-col gap-3.5 p-[18px] transition-[transform,border-color] duration-150 animate-rise-in hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-center justify-between">
        <CategoryBadge icon={category.icon} color={category.color} />
        {!!stats?.unread && (
          <span
            className="rounded-[7px] px-2 py-0.5 font-mono text-xs font-medium"
            style={{ color: catColor(category.color), background: catColor(category.color, 0.14) }}
          >
            {t('today.newBadge', { n: stats.unread })}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-display text-[20px] font-semibold">{category.name}</div>
        <div className="line-clamp-1 text-sm text-faint">
          {t('today.emailCount', { n: stats?.total ?? 0 })}
          {category.description ? ` · ${category.description}` : ''}
        </div>
      </div>
      <div className="mt-auto truncate border-t border-dashed border-line pt-3 text-sm text-muted">
        {stats?.latest ? (
          <>
            <strong className="font-semibold text-fg">{displayName(stats.latest.fromName, stats.latest.fromAddress)}</strong> ·{' '}
            {stats.latest.subject}
          </>
        ) : (
          <span className="text-faint">{t('list.empty')}</span>
        )}
      </div>
    </Link>
  );
}

function ActionRow({ email }: { email: EmailListItem }) {
  const { t } = useI18n();
  const { categoryMap } = useApp();
  const category = email.categoryId ? categoryMap.get(email.categoryId) : undefined;
  const replyPrompt = t('today.replyPrompt', { subject: email.subject });
  return (
    <div className="flex flex-col gap-2 border-b border-line px-[18px] py-4 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <Avatar name={email.fromName} address={email.fromAddress} size={30} color={category?.color} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{displayName(email.fromName, email.fromAddress)}</div>
          <div className="truncate text-sm text-muted">{email.subject}</div>
        </div>
        <EmailBadge email={email} />
      </div>
      {email.summary && (
        <p className="text-sm text-muted">
          <span className="text-ai">✦</span> {email.summary}
        </p>
      )}
      <div className="flex gap-2">
        <Link
          href={`/assistant?q=${encodeURIComponent(replyPrompt)}&email=${email.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-ai/15 px-3 text-sm font-semibold text-ai hover:bg-ai/20"
        >
          ✦ {t('today.replyWithAi')}
        </Link>
        <Link href={`/inbox?view=action&id=${email.id}`} className="inline-flex h-8 items-center rounded-[9px] border border-line px-3 text-sm text-muted hover:text-fg">
          {t('today.open')}
        </Link>
      </div>
    </div>
  );
}

/** Deadline, "needs reply" or "important" — the single most useful tag for an email. */
export function EmailBadge({ email }: { email: EmailListItem }) {
  const { t, lang } = useI18n();
  let text: string | null = null;
  if (email.dueDate) text = t('due', { day: dueDay(email.dueDate, lang, { today: t('due.today'), tomorrow: t('due.tomorrow') }) });
  else if (email.needsReply && !email.repliedAt) text = t('badge.needsReply');
  else if (email.priority === 'high') text = t('badge.important');
  if (!text) return null;
  return <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 font-mono text-2xs font-medium text-accent-ink">{text}</span>;
}

