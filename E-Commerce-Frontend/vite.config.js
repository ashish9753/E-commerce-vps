import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    // Dev-only proxy used by `npm run dev` when the app makes a relative
    // /api/... fetch (not the normal flow — every src/api/* module hits the
    // absolute baseURL from src/api/client.js).
    proxy: {
      '/api': {
        target: 'https://tradengine.com.np',
        changeOrigin: true,
      },
    },
  },
})
