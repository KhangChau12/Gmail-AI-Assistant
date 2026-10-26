'use client';

import { useI18n, type MessageKey } from '@/lib/i18n';
import { Logo } from './shell/NavRail';

export function Setup({ missing }: { missing: string[] }) {
  const { t, lang, setLang } = useI18n();
  const steps: MessageKey[] = ['setup.step1', 'setup.step2', 'setup.step3', 'setup.step4'];

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="btn-ghost text-xs">
            {lang === 'vi' ? 'English' : 'Tiếng Việt'}
          </button>
        </div>
        <h1 className="font-display text-3xl font-bold">{t('setup.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('setup.body')}</p>

        <div className="mt-5 rounded-lg border border-line bg-panel p-3">
          <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-faint">{t('setup.missing')}</div>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((key) => (
              <code key={key} className="rounded bg-danger/10 px-1.5 py-0.5 font-mono text-xs text-danger">
                {key}
              </code>
            ))}
          </div>
        </div>

        <ol className="mt-5 space-y-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-2xs text-muted">
                {i + 1}
              </span>
              <span className="pt-px text-fg/90">
                {t(step)}
                {step === 'setup.step2' && (
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-accent-ink hover:underline"
                  >
                    myaccount.google.com/apppasswords ↗
                  </a>
                )}
                {step === 'setup.step3' && (
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="ml-1 text-accent-ink hover:underline">
                    platform.openai.com ↗
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>

        <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-panel p-3 font-mono text-xs leading-relaxed text-muted">
{`GMAIL_ADDRESS=you@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
OPENAI_API_KEY=sk-...`}
        </pre>
        <p className="mt-4 text-xs text-faint">{t('setup.guide')}</p>
      </div>
    </main>
  );
}
