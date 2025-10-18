import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration keeps things lean while allowing TypeScript paths for components and styles.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@components': '/src/components',
      '@styles': '/src/styles',
      '@theme': '/src/theme',
    },
  },
});
