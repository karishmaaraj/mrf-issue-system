import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/worker/',
  plugins: [react()],
  server: {
    port: 5176,
    strictPort: true,
  },
});
