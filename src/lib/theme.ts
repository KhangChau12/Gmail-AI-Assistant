export type Theme = 'dark' | 'light';

const KEY = 'theme';

/** Inline script for <head>: applies the saved theme before first paint to avoid a flash. */
export const themeScript = `try{var t=localStorage.getItem('${KEY}');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){document.documentElement.dataset.theme='dark'}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage unavailable (private mode) — theme still applies for this session
  }
}
