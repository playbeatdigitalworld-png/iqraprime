import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {cloudflare} from '@cloudflare/vite-plugin';
import {defineConfig} from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), cloudflare(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://playbeattv.buzz',
        changeOrigin: true,
      },
    },
  },
});
