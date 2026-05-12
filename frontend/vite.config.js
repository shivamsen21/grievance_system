import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    host: true, // Listen on all local IPs
    allowedHosts: [
      'lustfully-talisman-corridor.ngrok-free.dev',
    ],
    proxy: {
      // Forward all /api requests to the backend — no hardcoded IPs needed
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  }
});
