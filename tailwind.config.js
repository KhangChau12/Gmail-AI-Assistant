/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        rail: token('rail'),
        panel: token('panel'),
        elevated: token('elevated'),
        line: token('line'),
        'line-strong': token('line-strong'),
        fg: token('fg'),
        muted: token('muted'),
        faint: token('faint'),
        accent: token('accent'),
        'accent-fg': token('accent-fg'),
        'accent-ink': token('accent-ink'),
        ai: token('ai'),
        danger: token('danger'),
        success: token('success'),
        warn: token('accent-ink'),
      },
      backgroundColor: {
        hover: 'var(--hover)',
        selected: 'var(--selected)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '17px'],
        sm: ['13px', '20px'],
        base: ['14px', '22px'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: '0 0 0 1px rgb(var(--line-strong)), 0 24px 60px -18px rgb(0 0 0 / 0.5)',
      },
      borderRadius: {
        card: '18px',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.985)' },
          to: { opacity: '1', transform: 'none' },
        },
        'rise-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'pop-in': 'pop-in 140ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'rise-in': 'rise-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
