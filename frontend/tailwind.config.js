/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#05090f",
          card: "#09101b",
          border: "#132135",
          cyan: "#00f0ff",
          "cyan-dim": "#00a2cc",
          "cyan-dark": "#031d2b",
          purple: "#bf33ff",
          "purple-dark": "#240938",
          magenta: "#e040fb",
          green: "#00ff66",
          "green-dim": "#00b344",
          "green-dark": "#052613",
          red: "#ff3366",
          "red-dark": "#2b060f",
          amber: "#ffb700",
          "amber-dark": "#302200",
          blue: "#0066ff",
          gray: "#8597a8",
          dark: "#03060a"
        }
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', '"JetBrains Mono"', '"Courier New"', "monospace"],
        sans: ['"Outfit"', '"Inter"', "sans-serif"]
      },
      boxShadow: {
        "neon-cyan": "0 0 10px rgba(0, 240, 255, 0.3), 0 0 20px rgba(0, 240, 255, 0.1)",
        "neon-cyan-intense": "0 0 15px rgba(0, 240, 255, 0.6), 0 0 30px rgba(0, 240, 255, 0.3)",
        "neon-purple": "0 0 10px rgba(191, 51, 255, 0.3)",
        "neon-magenta": "0 0 10px rgba(224, 64, 251, 0.3)",
        "neon-amber": "0 0 10px rgba(255, 183, 0, 0.3)",
        "neon-red": "0 0 10px rgba(255, 51, 102, 0.3)",
        "neon-green": "0 0 10px rgba(0, 255, 102, 0.3)"
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1s step-end infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        blink: {
          '50%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        }
      }
    },
  },
  plugins: [],
}
