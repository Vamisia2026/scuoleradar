import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // Porta fissa per ScuoleRadar: l'app gira SEMPRE e solo su http://localhost:5174,
  // senza saltare a porte successive né sovrapporsi ad altri progetti (es. PureFocus).
  server: {
    port: 5174,
    strictPort: true,
  },
});
