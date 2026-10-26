'use client';

import { clsx } from 'clsx';
import { CornerDownLeft, Mail, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { displayName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { EmailListItem } from '@/lib/types';
import { Kbd, Modal } from './ui';

export interface Command {
  id: string;
  group: 'actions' | 'go';
  label: string;
  icon: ReactNode;
  shortcut?: string;
  run: () => void;
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').toLowerCase();

export function CommandPalette({
  commands,
  onClose,
  onOpenEmail,
}: {
  commands: Command[];
  onClose: () => void;
  onOpenEmail: (id: number) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setEmails([]);
      return;
    }
    const timer = setTimeout(() => {
      api<EmailListItem[]>(`/api/emails?q=${encodeURIComponent(query)}&limit=6`).then(setEmails).catch(() => setEmails([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const items = useMemo(() => {
    const q = normalize(query.trim());
    const matched = q ? commands.filter((c) => normalize(c.label).includes(q)) : commands;
    const emailItems: Command[] = emails.map((e) => ({
      id: `email-${e.id}`,
      group: 'go',
      label: `${displayName(e.fromName, e.fromAddress)} — ${e.subject}`,
      icon: <Mail className="size-3.5" />,
      run: () => onOpenEmail(e.id),
    }));
    return [
      ...matched.filter((c) => c.group === 'actions').map((c) => ({ ...c, heading: t('palette.actions') })),
      ...matched.filter((c) => c.group === 'go').map((c) => ({ ...c, heading: t('palette.go') })),
      ...emailItems.map((c) => ({ ...c, heading: t('palette.emails') })),
    ];
  }, [commands, emails, query, onOpenEmail, t]);

  useEffect(() => setActive(0), [query, emails]);

  const run = (item: Command | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <Modal onClose={onClose} align="top" className="w-full max-w-[560px] overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4 text-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(items[active]);
            }
          }}
          placeholder={t('palette.placeholder')}
          className="h-12 flex-1 bg-transparent text-base placeholder:text-faint focus:outline-none"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div className="max-h-[52vh] overflow-y-auto p-1.5">
        {items.map((item, i) => (
          <div key={item.id}>
            {(i === 0 || items[i - 1].heading !== item.heading) && (
              <div className="px-2.5 pb-1 pt-2.5 text-2xs font-medium uppercase tracking-wider text-faint">{item.heading}</div>
            )}
            <button
              onMouseMove={() => setActive(i)}
              onClick={() => run(item)}
              className={clsx(
                'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm',
                i === active ? 'bg-selected text-fg' : 'text-muted',
              )}
            >
              <span className="flex size-4 items-center justify-center text-faint">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
              {i === active && !item.shortcut && <CornerDownLeft className="size-3.5 text-faint" />}
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-faint">—</div>}
      </div>
    </Modal>
  );
}
