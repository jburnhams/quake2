/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'q2-bg': '#1a1a1a',
        'q2-panel': '#262626',
        'q2-green': '#00ff00',
        'q2-green-dim': '#00aa00',
        'q2-text': '#cccccc',
        'q2-header': '#ffffff',
        'q2-border': '#444444',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
      keyframes: {
        blink: {
          '50%': { opacity: '0' },
        }
      },
      animation: {
        blink: 'blink 1s step-end infinite',
      }
    },
  },
  plugins: [],
}
