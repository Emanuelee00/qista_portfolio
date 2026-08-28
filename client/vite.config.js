import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.CLIENT_PORT) || 8080,
    proxy: {
      '/api': {
        target: process.env.SERVER_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
