/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Namespaced under `brand` so these don't clobber Tailwind's built-in
      // blue/sky/cyan scales — use e.g. `bg-brand-navy`, `text-brand-ink`.
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
    },
  },
  plugins: [],
}

