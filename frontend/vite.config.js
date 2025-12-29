import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Aici activam Tailwind 4
  ],
  resolve: {
    alias: {
      // Atentie: acum calea e doar ./src pentru ca vite.config e deja in frontend
      '@': path.resolve(__dirname, './src'),
    },
  },
})