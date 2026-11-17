/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#12304A',
          'navy-dark': '#0B1D2D',
          'navy-light': '#1B4568',
          teal: '#0D9488',
          'teal-dark': '#0F766E',
          'teal-light': '#14B8A6',
          'soft-teal': '#CCFBF1',
          'teal-50': '#F0FDFA',
          canvas: '#F5F8FA',
        },
        slate: {
          body: '#334155',
        },
        canvas: 'var(--bg-canvas)',
        surface: {
          DEFAULT: 'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
          muted: 'var(--bg-muted)',
          input: 'var(--bg-input)',
        },
        foreground: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        popover: {
          DEFAULT: 'var(--bg-popover)',
          foreground: 'var(--text-popover)',
        },
        sidebar: {
          DEFAULT: 'var(--bg-sidebar)',
          foreground: 'var(--text-sidebar)',
          border: 'var(--border-sidebar)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--color-accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--color-destructive)',
          foreground: 'var(--color-destructive-foreground)',
        },
        line: {
          DEFAULT: 'var(--border-default)',
          input: 'var(--border-input)',
        },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          grid: 'var(--chart-grid)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
