/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        biu: {
          primary: '#00D4AA',
          'primary-dim': '#00A888',
          'primary-soft': '#00D4AA20',
          'primary-muted': '#00D4AA12',
          accent: '#FF3D71',
          'accent-soft': '#FF3D7118',
          dark: '#070B14',
          'dark-alt': '#0D1321',
          'dark-elevated': '#111827',
          surface: '#111827',
          'surface-light': '#1E293B',
          'surface-hover': '#263348',
          'surface-active': '#2D3B52',
        },
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        '3xl-display': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.03em' }],
        '4xl-display': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.04em' }],
        '5xl-display': ['3rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.02em',
        wide: '0.02em',
        wider: '0.04em',
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 212, 170, 0.15)',
        'glow-accent': '0 0 20px rgba(255, 61, 113, 0.15)',
        'glow-strong': '0 0 40px rgba(0, 212, 170, 0.25)',
        'glow-subtle': '0 0 12px rgba(0, 212, 170, 0.08)',
        'surface': '0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)',
        'surface-lg': '0 2px 8px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3)',
        'surface-xl': '0 4px 12px rgba(0, 0, 0, 0.5), 0 12px 36px rgba(0, 0, 0, 0.4)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'message-in': 'messageSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulse 1.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
