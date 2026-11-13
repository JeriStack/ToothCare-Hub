/** @type {import('tailwindcss').Config} */
export default {
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
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
