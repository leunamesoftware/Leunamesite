import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O app roda 100% no aparelho (funciona sem internet). Só o link de aprovação usa o servidor.
export default defineConfig({
  plugins: [react()],
  define: { __VERSAO_APP__: JSON.stringify(process.env.VERSAO_APP || '0.1.0') },
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
