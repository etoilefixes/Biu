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
          accent: '#FF3D71',
          dark: '#070B14',
          'dark-alt': '#0D1321',
          surface: '#111827',
          'surface-light': '#1E293B',
          'surface-hover': '#263348',
        },
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.02em',
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 212, 170, 0.15)',
        'glow-accent': '0 0 20px rgba(255, 61, 113, 0.15)',
        'glow-strong': '0 0 40px rgba(0, 212, 170, 0.25)',
      },
    },
  },
  plugins: [],
};
