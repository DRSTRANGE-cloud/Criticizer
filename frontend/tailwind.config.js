/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "criticizer-red": "#E50914",
        "criticizer-dark": "#141414",
        "criticizer-gray": "#2D2D2D",
      },
    },
  },
  plugins: [],
};
