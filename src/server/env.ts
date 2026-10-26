import 'server-only';

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

export const env = {
  gmailAddress: process.env.GMAIL_ADDRESS?.trim() ?? '',
  gmailAppPassword: (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, ''),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
  openaiModel: optional('OPENAI_MODEL', 'gpt-4o-mini'),
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
  syncInitialLimit: Number(optional('SYNC_INITIAL_LIMIT', '200')) || 200,
  databasePath: optional('DATABASE_PATH', 'data/inbox.db'),
  /** Used in the greeting on the Today page. */
  userName: process.env.YOUR_NAME?.trim() ?? '',
  /** Language before the user picks one in Settings; also used for the default category names. */
  defaultLanguage: (process.env.APP_LANGUAGE?.trim() === 'en' ? 'en' : 'vi') as 'vi' | 'en',
};

/** Lists missing required settings so the UI can show a setup screen instead of crashing. */
export function missingConfig(): string[] {
  const missing: string[] = [];
  if (!env.gmailAddress) missing.push('GMAIL_ADDRESS');
  if (!env.gmailAppPassword) missing.push('GMAIL_APP_PASSWORD');
  if (!env.openaiApiKey) missing.push('OPENAI_API_KEY');
  return missing;
}
