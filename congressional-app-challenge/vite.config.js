import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_PORT = process.env.PORT || 8787

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The browser never talks to Checkr directly — /api goes to our server,
    // which is the only thing holding the Checkr secret key.
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
