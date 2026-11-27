import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => funciona na raiz e em subpath do GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
});
