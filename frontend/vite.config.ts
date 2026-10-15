import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const backend = 'http://localhost:5000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development the browser talks to Vite, which forwards API and socket traffic to the backend.
    proxy: {
      '/api': backend,
      '/socket.io': { target: backend, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['tests/**/*.test.tsx', 'tests/**/*.test.ts'],
    css: false,
  },
});
