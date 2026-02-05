/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'critisizer-red': '#E50914',
        'critisizer-dark': '#141414',
        'critisizer-gray': '#2D2D2D',
      },
    },
  },
  plugins: [],
}