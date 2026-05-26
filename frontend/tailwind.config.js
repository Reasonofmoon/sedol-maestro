/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      opacity: {
        '3': '0.03',
        '8': '0.08',
        '15': '0.15',
        '35': '0.35',
        '45': '0.45',
      }
    },
  },
  plugins: [],
};
