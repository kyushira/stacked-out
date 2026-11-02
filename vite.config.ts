import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset URLs relative so the build works behind a tunnel or sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 4180,
    host: '127.0.0.1',
  },
  preview: {
    port: 4180,
    host: '127.0.0.1',
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
