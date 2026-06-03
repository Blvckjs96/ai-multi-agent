import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'argo-base': 'var(--bg-base)',
        'argo-surface': 'var(--bg-surface)',
        'argo-elevated': 'var(--bg-elevated)',
        'argo-overlay': 'var(--bg-overlay)',
        'argo-border': 'var(--border)',
        'argo-cyan': 'var(--accent-cyan)',
        'argo-green': 'var(--accent-green)',
        'argo-error': 'var(--status-error)',
        'argo-muted': 'var(--text-muted)',
        'argo-secondary': 'var(--text-secondary)',
        'argo-primary': 'var(--text-primary)',
      },
      fontFamily: {
        sans: ['var(--f-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--f-mono)', 'JetBrains Mono', 'monospace'],
        display: ['var(--f-display)', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
      },
    },
  },
  plugins: [typography],
}
