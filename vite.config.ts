import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Serve /public/games/* as static files instead of falling back to index.html.
    // Without this, Vite's SPA fallback intercepts /games/{slug}/index.html
    // and serves your React app inside the iframe — breaking GameRunner.
    fs: {
      strict: false,
    },
  },
});