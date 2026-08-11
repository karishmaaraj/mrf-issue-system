import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/superadmin/',
  plugins: [react()],
  server: {
    port: 5177,
    strictPort: true,
  }
})
