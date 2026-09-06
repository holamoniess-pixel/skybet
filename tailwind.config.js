/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="skybet-dark"],[data-theme="skybet-violet"]'],
  safelist: [
    {
      pattern: /data-theme/,
      variants: ['lg', 'md', 'sm', 'xs'],
    },
    'bg-skybet-primary',
    'text-skybet-primary',
  ],
  theme: {
    extend: {
      screens: {
        xs: '375px',
        '3xl': '1700px',
      },
      colors: {
        primary: 'var(--primary)',
        'primary-dark': 'var(--primary-dark)',
        'bg-page': 'var(--bg-page)',
        card: 'var(--card-bg)',
        'card-alt': 'var(--card-alt)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        'border-light': 'var(--border-light)',
        'nav-bg': 'var(--nav-bg)',
        'skybet-logo-primary': 'var(--skybet-logo-primary, var(--primary))',
        'skybet-logo-secondary': 'var(--skybet-logo-secondary, #ffffff)',
        // Blue/white/black palette
        'blue-core': '#1d4ed8',
        'blue-bright': '#3b82f6',
        'blue-light': '#60a5fa',
        'blue-pale': '#bfdbfe',
        'ink': '#0a0f1e',
        'ink-soft': '#131929',
        'white-pure': '#ffffff',
        'white-muted': '#e8edf8',
        // Legacy accent names (now remapped)
        'neon-green': '#3b82f6',   /* repurposed → blue-bright */
        'gold': '#60a5fa',         /* repurposed → blue-light */
        'blue-accent': '#1d4ed8',
      },
      fontFamily: {
        display: ['Barlow Condensed', 'sans-serif'],
        heading: ['Barlow Condensed', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};