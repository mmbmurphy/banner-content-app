/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1a2b4a',
          accent: '#0082F3',
          coral: '#FF7469',
          green: '#12B76A',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
