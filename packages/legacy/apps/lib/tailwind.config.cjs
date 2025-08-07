module.exports = {
  presets: [require('./tailwind.plugin.cjs')],
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './contexts/**/*.{js,jsx,ts,tsx}',
    './icons/**/*.{js,jsx,ts,tsx}',
    './utils/**/*.{js,jsx,ts,tsx}'
  ],
  plugins: []
}
