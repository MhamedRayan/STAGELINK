/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mint: '#DAF1DE',
        canvas: '#F8FFF9',
        forest: { 900: '#051F20', 800: '#0B2B26' },
        surface: { 700: '#163832', 600: '#235347' },
        sage: '#8EB69B',
        muted: '#4D7770',
        inverse: '#F5FFF7',
        danger: '#B3261E',
        warning: '#9A5B00',
        success: '#1B6B4F',
        info: '#235347',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      maxWidth: {
        content: '1140px',
      },
    },
  },
  plugins: [],
};
