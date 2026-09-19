/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Party-Palette aus Runde-6-Prototyp als Startpunkt.
        // Kann jederzeit angepasst werden.
        'bg-start': '#1a1030',
        'bg-end': '#2a1a4a',
        'accent': '#e6c48c',
        'accent-soft': '#d1a56a',
        'text-main': '#f8f2e6',
        'muted': '#b8adc9',
        'team-a': '#f4a460',
        'team-b': '#87ceeb',
        'correct': '#a3d9a5',
        'wrong': '#ff9b8f',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
