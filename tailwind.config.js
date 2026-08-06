/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0F1E4D',  // Primary Dark     · Deep Navy Blue
          blue: '#1E84C4',  // Primary Blue     · Bright Blue
          sky: '#4DA9E6',   // Secondary Blue   · Sky Blue
          cyan: '#00B8D9',  // Accent           · Cyan
          white: '#FFFFFF', // Background       · White
          light: '#F5F7FA', // Light Background · Light Gray
          ink: '#2C2C2C',   // Text             · Dark Gray
        },
      },
      keyframes: {
        'st-side-in': {
          'from': { opacity: '0', transform: 'translateX(24px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        'st-drawline': {
          'to': { strokeDashoffset: '0' },
        },
        'st-marker-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'st-nodepop': {
          'from': { opacity: '0', transform: 'scale(0.6)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        'st-twinkle': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.1' },
        },
        'st-npulse': {
          '0%, 100%': { opacity: '1', r: '0.5' },
          '50%': { opacity: '0.65', r: '5.8' },
        },
        'st-hspin': {
          'to': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'st-side-in': 'st-side-in 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'st-drawline': 'st-drawline 0.6s var(--d, 0s) ease forwards',
        'st-marker-in': 'st-marker-in 0.4s var(--d, 0s) ease forwards',
        'st-nodepop': 'st-nodepop 0.35s var(--d, 0s) ease backwards',
        'st-twinkle': 'st-twinkle 7s ease-in-out infinite',
        'st-npulse': 'st-npulse 2.6s ease-in-out infinite',
        'st-hspin': 'st-hspin 170s linear infinite',
      },
    },
  },
  plugins: [],
}
