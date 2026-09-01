/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef6fb',
          100: '#d6eaf4',
          200: '#aed0e8',
          300: '#7fb4d8',
          400: '#4d92c2',
          500: '#2B6F9E',
          600: '#225a82',
          700: '#1b4768',
          800: '#14354e',
          900: '#0c2235',
        },
        secondary: {
          50: '#fdf5ec',
          100: '#fbe6d1',
          200: '#f6cb9f',
          300: '#f2a65a',
          400: '#ee8c33',
          500: '#e2721c',
          600: '#bd5a14',
          700: '#974610',
          800: '#71340c',
          900: '#4d2308',
        },
        accent: {
          50: '#eafaf1',
          100: '#cdf3da',
          200: '#97e6b5',
          300: '#5fd38c',
          400: '#34bd6b',
          500: '#1fa055',
          600: '#168044',
          700: '#136637',
          800: '#0f4d2b',
          900: '#0a3520',
        },
        success: {
          50: '#eafaf1',
          500: '#1fa055',
          600: '#168044',
          700: '#136637',
        },
        warning: {
          50: '#fff8e6',
          500: '#e2b33c',
          600: '#c79820',
          700: '#a87d12',
        },
        error: {
          50: '#fdecec',
          500: '#d9534f',
          600: '#b9403c',
          700: '#93332f',
        },
        // Token allineati alla palette ufficiale ScuolaRadar:
        //  · sky.700  = Primary Blu Radar #2B6F9E (hover sky.800 = #1E5276)
        //  · slate.50 = sfondo Modal/Card #F4F7F9
        sky: {
          700: '#2B6F9E',
          800: '#1E5276',
        },
        slate: {
          50: '#F4F7F9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"Source Serif 4"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(20,53,78,0.06), 0 8px 24px rgba(20,53,78,0.06)',
        soft: '0 2px 8px rgba(20,53,78,0.08)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-lenta': 'fade-in 0.5s ease-in-out both',
        'pop': 'pop 0.25s ease-out both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
