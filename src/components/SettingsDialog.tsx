'use client';

import { clsx } from 'clsx';
import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { currentTheme, setTheme, type Theme } from '@/lib/theme';
import { CategoryBadge, CategoryGlyph, catColor } from '@/lib/categories';
import { CATEGORY_COLORS, CATEGORY_ICONS, type Category } from '@/lib/types';
import { IconButton, Kbd, Modal, Spinner } from './ui';

type Tab = 'general' | 'categories' | 'shortcuts';


const SHORTCUTS: [string[], MessageKey][] = [
  [['J', 'K'], 'shortcut.next'],
  [['E'], 'shortcut.archive'],
  [['#'], 'shortcut.trash'],
  [['S'], 'shortcut.star'],
  [['U'], 'shortcut.unread'],
  [['R'], 'shortcut.reply'],
  [['C'], 'shortcut.compose'],
  [['/'], 'shortcut.search'],
  [['⌘', 'K'], 'shortcut.palette'],
  [['⌘', 'J'], 'shortcut.assistant'],
  [['⌘', '↵'], 'shortcut.send'],
  [['Esc'], 'shortcut.close'],
];

interface Props {
  account: string;
  model: string;
  categories: Category[];
  onCategoriesChange: () => void;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function SettingsDialog({ account, model, categories, onCategoriesChange, onClose, onToast }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('general');
  const tabs: [Tab, MessageKey][] = [
    ['general', 'settings.account'],
    ['categories', 'settings.categories'],
    ['shortcuts', 'settings.shortcuts'],
  ];

  return (
    <Modal onClose={onClose} className="flex h-[min(620px,86vh)] w-full max-w-[760px] overflow-hidden">
      <nav className="w-48 shrink-0 border-r border-line bg-panel p-2">
        <div className="px-2 pb-2 pt-1.5 text-sm font-semibold">{t('settings.title')}</div>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex h-7 w-full items-center rounded-md px-2 text-sm',
              tab === id ? 'bg-selected text-fg' : 'text-muted hover:bg-hover hover:text-fg',
            )}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      <div className="relative min-w-0 flex-1 overflow-y-auto p-6">
        <IconButton label={t('shortcut.close')} shortcut="Esc" onClick={onClose} className="absolute right-3 top-3">
          <X className="size-4" />
        </IconButton>
        {tab === 'general' && <General account={account} model={model} onToast={onToast} />}
        {tab === 'categories' && <Categories categories={categories} onChange={onCategoriesChange} />}
        {tab === 'shortcuts' && (
          <div>
            <h3 className="mb-4 text-sm font-semibold">{t('settings.shortcuts')}</h3>
            <div className="divide-y divide-line">
              {SHORTCUTS.map(([keys, label]) => (
                <div key={label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted">{t(label)}</span>
                  <span className="flex gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line py-4 first:pt-0">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <p className="mt-0.5 max-w-sm text-xs text-faint">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-line p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={clsx('rounded px-2.5 py-0.5 text-xs', value === v ? 'bg-selected text-fg' : 'text-muted hover:text-fg')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function General({ account, model, onToast }: { account: string; model: string; onToast: (m: string) => void }) {
  const { t, lang, setLang } = useI18n();
  const [theme, setThemeState] = useState<Theme>('dark');
  const [imap, setImap] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    setThemeState(currentTheme());
    api<{ imap?: { ok: boolean; error?: string } }>('/api/status?check=1')
      .then((s) => setImap(s.imap ?? { ok: false }))
      .catch((e) => setImap({ ok: false, error: String(e) }));
  }, []);

  const rerun = async () => {
    await api('/api/triage', { method: 'POST' });
    onToast(t('settings.rerunStarted'));
  };

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold">{t('settings.account')}</h3>
      <Row label={account}>
        <span className="flex items-center gap-1.5 text-xs">
          {imap === null ? (
            <>
              <Spinner className="text-faint" /> <span className="text-muted">{t('settings.checking')}</span>
            </>
          ) : imap.ok ? (
            <>
              <span className="size-1.5 rounded-full bg-success" /> <span className="text-muted">{t('settings.connected')}</span>
            </>
          ) : (
            <span className="max-w-[260px] text-danger" title={imap.error}>
              {t('settings.notConnected')}
            </span>
          )}
        </span>
      </Row>
      <Row label={t('settings.model')}>
        <code className="font-mono text-xs text-muted">{model}</code>
      </Row>
      <Row label={t('settings.language')} hint={t('settings.languageHint')}>
        <Segmented value={lang} options={[['vi', 'Tiếng Việt'], ['en', 'English']]} onChange={setLang} />
      </Row>
      <Row label={t('settings.theme')}>
        <Segmented
          value={theme}
          options={[['dark', t('settings.theme.dark')], ['light', t('settings.theme.light')]]}
          onChange={(v) => {
            setTheme(v);
            setThemeState(v);
          }}
        />
      </Row>
      <Row label={t('settings.rerun')} hint={t('settings.rerunHint')}>
        <button onClick={rerun} className="btn-outline text-xs">
          {t('settings.rerun')}
        </button>
      </Row>
    </div>
  );
}

function Categories({ categories, onChange }: { categories: Category[]; onChange: () => void }) {
  const { t } = useI18n();

  const patch = async (id: number, body: Partial<Category>) => {
    await api(`/api/categories/${id}`, { method: 'PATCH', json: body });
    onChange();
  };
  const remove = async (id: number) => {
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    onChange();
  };
  const add = async () => {
    await api('/api/categories', {
      method: 'POST',
      json: { name: t('settings.name'), description: '', color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length], icon: 'tag' },
    });
    onChange();
  };

  return (
    <div>
      <h3 className="text-sm font-semibold">{t('settings.categories')}</h3>
      <p className="mb-4 mt-1 text-xs text-faint">{t('settings.categoriesHint')}</p>
      <div className="space-y-2">
        {categories.map((c) => (
          <CategoryEditor key={c.id} category={c} onSave={(body) => patch(c.id, body)} onDelete={() => remove(c.id)} />
        ))}
      </div>
      <button onClick={add} className="btn-ghost mt-3 text-xs">
        <Plus className="size-3.5" /> {t('settings.addCategory')}
      </button>
    </div>
  );
}

/** Saves on blur so typing never triggers a network round-trip per keystroke. */
function CategoryEditor({
  category,
  onSave,
  onDelete,
}: {
  category: Category;
  onSave: (body: Partial<Category>) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description);
  const [pickColor, setPickColor] = useState(false);

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setPickColor((v) => !v)}
            className="flex items-center justify-center rounded-lg hover:opacity-80"
            aria-label={t('settings.appearance')}
            aria-expanded={pickColor}
          >
            <CategoryBadge icon={category.icon} color={category.color} size={30} />
          </button>
          {pickColor && (
            <div className="absolute left-0 top-9 z-10 w-[232px] rounded-xl bg-elevated p-2 shadow-pop animate-pop-in">
              <div className="flex gap-1">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onSave({ color })}
                    aria-label={color}
                    className={clsx('flex size-8 items-center justify-center rounded-lg hover:bg-hover', color === category.color && 'bg-hover')}
                  >
                    <span className="size-3.5 rounded-[4px]" style={{ background: catColor(color) }} />
                  </button>
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-6 gap-1 border-t border-line pt-1.5">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => onSave({ icon })}
                    aria-label={icon}
                    className={clsx('flex size-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-fg', icon === category.icon && 'bg-hover text-fg')}
                  >
                    <CategoryGlyph icon={icon} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== category.name && onSave({ name: name.trim() })}
          className="h-7 flex-1 bg-transparent text-sm font-medium focus:outline-none"
          aria-label={t('settings.name')}
        />
        <IconButton label={t('settings.delete')} onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => description !== category.description && onSave({ description })}
        placeholder={t('settings.description')}
        rows={2}
        className="mt-1 w-full resize-none bg-transparent pl-8 text-xs leading-relaxed text-muted placeholder:text-faint focus:outline-none"
      />
    </div>
  );
}
