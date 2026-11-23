import type { Config } from 'tailwindcss';

// Single source of truth for design tokens (values sampled from Figma file STAGLINK,
// design-system frame 4:610 and frame 25:524). Never hard-code hex values in components.
export default {
  content: [
    './index.html',
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        mint: '#DAF1DE', // muted surface: cards, bands, secondary button
        canvas: '#F8FFF9', // page canvas
        'forest-900': '#051F20', // sidebar, titles, table body text
        'forest-800': '#0B2B26',
        'surface-700': '#163832',
        'surface-600': '#235347', // primary button, active nav row, secondary border
        sage: '#8EB69B', // accent, role label on dark
        muted: '#4D7770', // secondary text, table headers
        ink: '#103B35', // body text
        inverse: '#F5FFF7', // text on dark
        'nav-text': '#B7D9C9', // inactive sidebar item
        line: '#B8DDC8', // 1px borders and dividers
        pill: {
          'neutral-bg': '#E3ECE8',
          'neutral-fg': '#4D7770',
          'info-bg': '#DCE9F7',
          'info-fg': '#2D5F9A',
          'success-bg': '#CDEED9',
          'success-fg': '#2A6B47',
          'warning-bg': '#F6E7A8',
          'warning-fg': '#8A6A10',
          'danger-bg': '#F6D3D3',
          'danger-fg': '#A8322D',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['28px', { lineHeight: 'normal', fontWeight: '700' }],
        'section-title': ['18px', { lineHeight: 'normal', fontWeight: '600' }],
        body: ['13px', { lineHeight: 'normal' }],
        'table-body': ['14px', { lineHeight: 'normal' }],
        'table-head': ['11px', { lineHeight: 'normal', letterSpacing: '0.04em' }],
        pill: ['12px', { lineHeight: 'normal', fontWeight: '500' }],
      },
      borderRadius: { card: '12px', panel: '16px', btn: '8px', pill: '13px' },
      width: { sidebar: '260px' },
      spacing: { sidebar: '260px' },
      maxWidth: { content: '1100px' },
    },
  },
  plugins: [],
} satisfies Config;
