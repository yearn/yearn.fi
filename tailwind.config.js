/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './apps/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        aeonik: [
          'Aeonik',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        'aeonik-fono': [
          'Aeonik Fono',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        'aeonik-mono': ['Aeonik Mono', 'Consolas', '"Courier New"', 'monospace'],
        'source-code-pro': ['Source Code Pro', 'Aeonik Mono', 'Consolas', '"Courier New"', 'monospace']
      }
    }
  },
  plugins: []
}
