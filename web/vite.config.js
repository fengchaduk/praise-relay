import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 화면(5173)에서 /api로 보낸 요청을 Spring 서버(8080)로 넘겨요.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
