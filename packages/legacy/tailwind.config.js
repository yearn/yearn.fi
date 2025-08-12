/** @type {import('tailwindcss').Config} \*/
const { join } = require('node:path')
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './apps/**/*.{js,ts,jsx,tsx}',
    join(__dirname, 'apps', 'lib', 'components', '**', '*.{js,ts,jsx,tsx}'),
    join(__dirname, 'apps', 'lib', 'contexts', '**', '*.{js,ts,jsx,tsx}'),
    join(__dirname, 'apps', 'lib', 'icons', '**', '*.{js,ts,jsx,tsx}'),
    join(__dirname, 'apps', 'lib', 'utils', '**', '*.{js,ts,jsx,tsx}')
  ],
  theme: {
    extend: {
      colors: {
        transparent: 'transparent',
        inherit: 'inherit',
        primary: '#0657F9',

        fallback: '#808080',
        red: '#D42600'
      },
      fontFamily: {
        aeonik: ['var(--font-aeonik)', 'Aeonik', ...defaultTheme.fontFamily.sans],
        aeonikFono: ['var(--font-aeonik-fono)', 'Aeonik Fono', ...defaultTheme.fontFamily.sans],
        mono: ['Aeonik Mono', ...defaultTheme.fontFamily.mono]
      },
      width: {
        22: '5.5rem',
        42: '10.5rem',
        50: '12.5rem',
        54: '13.5rem'
      },
      minWidth: {
        42: '10.5rem'
      },
      maxWidth: {
        50: '12.5rem',
        54: '13.5rem'
      },
      height: {
        inherit: 'inherit'
      },
      screens: {
        lg: '1200px'
      },
      gridTemplateColumns: {
        13: 'repeat(13, minmax(0, 1fr))',
        14: 'repeat(14, minmax(0, 1fr))',
        20: 'repeat(20, minmax(0, 1fr))',
        30: 'repeat(30, minmax(0, 1fr))',
        75: 'repeat(75, minmax(0, 1fr))'
      },
      gridColumn: {
        'span-75': 'span 75 / span 75',
        'span-50': 'span 50 / span 50',
        'span-46': 'span 46 / span 46',
        'span-29': 'span 29 / span 29',
        'span-25': 'span 25 / span 25'
      },
      fontSize: {
        xxs: ['10px', '16px'],
        '2xl': ['24px', '32px'],
        '3xl': ['32px', '40px'],
        '7xl': ['64px', '72px'],
        '8xl': ['88px', '104px']
      },
      animation: {
        'spin-slow': 'spin 4s linear infinite'
      },
      keyframes: {
        'spin-slow': {
          from: {
            transform: 'rotate(0deg)'
          },
          to: {
            transform: 'rotate(360deg)'
          }
        }
      }
    }
  },
  plugins: [require('tailwind-gradient-mask-image')]
}
