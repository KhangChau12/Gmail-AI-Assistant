import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import { I18nProvider } from '@/lib/i18n';
import { themeScript } from '@/lib/theme';
import { getLanguage } from '@/server/repo';
import './globals.css';

const sans = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });
const display = Bricolage_Grotesque({ subsets: ['latin', 'vietnamese'], variable: '--font-display', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'vietnamese'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Inbox Assistant',
  description: 'Your Gmail, sorted by AI and answered from one place. Runs on your machine.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#12151f' },
    { media: '(prefers-color-scheme: light)', color: '#f3f4f8' },
  ],
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const language = getLanguage();
  return (
    <html lang={language} data-theme="dark" className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider initial={language}>{children}</I18nProvider>
      </body>
    </html>
  );
}
