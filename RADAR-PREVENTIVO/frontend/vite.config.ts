import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const pastaCompartilhada = fileURLToPath(new URL('../compartilhado', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@compartilhado': pastaCompartilhada },
  },
  server: {
    port: 5173,
    // O backend roda separado (porta 8787); em desenvolvimento o Vite repassa /api para ele.
    proxy: { '/api': 'http://localhost:8787' },
    fs: { allow: ['.', pastaCompartilhada] },
  },
});
