/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: {
          DEFAULT: '#DAF1DE',
          50: '#F5FCF7',
          100: '#EBF8EE',
          200: '#DAF1DE',
          300: '#C2E7CA',
        },
        forest: {
          DEFAULT: '#051F20',
          900: '#051F20',
          800: '#0B2B26',
        },
        surface: {
          700: '#163832',
          600: '#235347',
        },
        sage: {
          DEFAULT: '#8EB69B',
        },
        canvas: {
          DEFAULT: '#F8FFF9',
        },
        mutedText: {
          DEFAULT: '#4D7770',
        },
        inverseText: {
          DEFAULT: '#F5FFF7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      maxWidth: {
        content: '1140px',
      },
    },
  },
  plugins: [],
}
