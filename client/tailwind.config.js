/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        biu: {
          primary: '#6C5CE7',
          secondary: '#A29BFE',
          dark: '#0A0A1A',
          surface: '#1A1A2E',
          'surface-light': '#25253E',
        },
      },
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
};
