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
          // 950 aggiunto in §26.87: `to-primary-950` (StepDossier, barra del documento) era orfano
          // e il gradiente sfumava nel trasparente, lasciando testo chiaro su fondo bianco.
          950: '#091825',
        },
        secondary: {
          50: '#fdf5ec',
          100: '#fbe6d1',
          200: '#f6cb9f',
          300: '#f2a65a',
          400: '#ee8c33',
          // 450 = ARANCIO ESATTO del brand (#E37820), chiesto dalla «Linea Rossa» (§26.110).
          // Sta fra 400 e 500 perché non sostituisce `secondary-500` (#e2721c), già in uso
          // in tutto il sito: qui serve il colore ufficiale, non l'ennesimo tono vicino.
          450: '#e37820',
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
        // Scala `warning` COMPLETA 50→900. La tinta è un oro attenuato (hue ≈ 43°) e i gradini
        // 50/500/600/700 sono quelli già in uso nel progetto: 100/200/300/400/800/900 sono
        // derivati dagli stessi ancoraggi, non presi da `amber` di Tailwind (che è più rosso).
        // Perché la scala deve restare completa: Tailwind scarta in silenzio le classi il cui
        // token non esiste, senza errori di build né di typecheck. Una scala parziale fa
        // sparire bordi e anelli dichiarati nel JSX (vedi §26.85-§26.86 di SYSTEM_HANDOVER).
        warning: {
          50: '#fff8e6',
          100: '#fef2d5',
          200: '#fbe3a7',
          300: '#f8d377',
          400: '#f4c54e',
          500: '#e2b33c',
          600: '#c79820',
          700: '#a87d12',
          800: '#785f21',
          900: '#6a4f0c',
        },
        // Scala `error` COMPLETA 50→900, stessa regola della scala `warning` (sopra): gradini
        // 50/500/600/700 invariati, i sei mancanti derivati dagli stessi ancoraggi (hue ≈ 2°,
        // saturazione 51%→81%, luminanza 95,9%→22,2%), non copiati da `red` di Tailwind.
        // Senza i gradini 100/200/800 sparivano in silenzio i `border-error-200` di toast,
        // form e health-check (15 occorrenze sanate in §26.87 di SYSTEM_HANDOVER).
        error: {
          50: '#fdecec',
          100: '#fbdcdb',
          200: '#f7bcb9',
          300: '#f1938f',
          400: '#e9716d',
          500: '#d9534f',
          600: '#b9403c',
          700: '#93332f',
          800: '#742724',
          900: '#571c1a',
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
