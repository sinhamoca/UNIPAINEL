/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background
        'bg-primary': '#0a0a0f',
        'bg-secondary': '#12121a',
        'bg-tertiary': '#1a1a25',
        'bg-card': '#16161f',
        'bg-hover': '#1e1e2a',
        
        // Borders
        'border-color': '#2a2a3a',
        'border-light': '#3a3a4a',
        
        // Text
        'text-primary': '#f0f0f5',
        'text-secondary': '#a0a0b0',
        'text-muted': '#606070',
        
        // IBO Revenda (Green)
        'ibo': {
          primary: '#10b981',
          secondary: '#059669',
          glow: 'rgba(16, 185, 129, 0.2)',
        },
        
        // Koffice (Purple)
        'koffice': {
          primary: '#8b5cf6',
          secondary: '#7c3aed',
          glow: 'rgba(139, 92, 246, 0.2)',
        },
        
        // Playlist Manager (Orange)
        'playlist': {
          primary: '#f59e0b',
          secondary: '#d97706',
          glow: 'rgba(245, 158, 11, 0.2)',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
