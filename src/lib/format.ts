import { format, formatDistanceToNowStrict, isSameYear, isToday, isYesterday } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import type { Language } from './types';

const locales = { en: enUS, vi };

/** Compact timestamp for list rows: 14:32 · Yesterday · 3 Mar · 03/03/24 */
export function shortDate(iso: string, lang: Language, yesterday: string): string {
  const date = new Date(iso);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return yesterday;
  if (isSameYear(date, new Date())) return format(date, lang === 'vi' ? 'd MMM' : 'MMM d', { locale: locales[lang] });
  return format(date, 'dd/MM/yy');
}

export function fullDate(iso: string, lang: Language): string {
  return format(new Date(iso), lang === 'vi' ? "EEEE, d MMMM yyyy 'lúc' HH:mm" : "EEEE, MMMM d, yyyy 'at' HH:mm", {
    locale: locales[lang],
  });
}

export function timeAgo(iso: string, lang: Language): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: locales[lang] });
}

export function displayName(name: string, address: string): string {
  return name.trim() || address.split('@')[0];
}

export function initials(name: string, address: string): string {
  const source = displayName(name, address);
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/** Stable hue per sender so avatars are recognisable without being loud. */
export function senderHue(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = (hash * 31 + address.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Local calendar day in YYYY-MM-DD, matching the AI's `dueDate` format. */
function localIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Days from today to a YYYY-MM-DD date (negative = past). */
export function daysUntil(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date(localIso(new Date()).replace(/-/g, '/')).getTime();
  return Math.round((target - today) / 86_400_000);
}

/** "Today", "Tomorrow", "Thu", "30 Oct" — the date part of a deadline badge. */
export function dueDay(day: string, lang: Language, labels: { today: string; tomorrow: string }): string {
  const diff = daysUntil(day);
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (diff === 0) return labels.today;
  if (diff === 1) return labels.tomorrow;
  if (diff > 1 && diff < 7) return format(date, lang === 'vi' ? 'EEEEEE' : 'EEE', { locale: locales[lang] });
  return format(date, lang === 'vi' ? 'd/M' : 'MMM d', { locale: locales[lang] });
}

/** Section headings for the message list: Today · Yesterday · This week · Earlier. */
export function dayGroup(iso: string): 'today' | 'yesterday' | 'week' | 'earlier' {
  const date = new Date(iso);
  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  return Date.now() - date.getTime() < 7 * 86_400_000 ? 'week' : 'earlier';
}

export function weekdayShort(iso: string, lang: Language): string {
  return format(new Date(iso), lang === 'vi' ? 'EEEEEE' : 'EEE', { locale: locales[lang] });
}

export function longDate(date: Date, lang: Language): string {
  return format(date, lang === 'vi' ? "EEEE '·' d 'tháng' M" : "EEEE '·' MMMM d", { locale: locales[lang] });
}
