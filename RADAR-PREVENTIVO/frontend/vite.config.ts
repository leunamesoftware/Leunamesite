import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const pastaCompartilhada = fileURLToPath(new URL('../compartilhado', import.meta.url));

// Cada build ganha uma versão. O app compara a dele com /versao.json para se atualizar sozinho.
const versao = new Date().toISOString();

function arquivoDeVersao(): Plugin {
  return {
    name: 'arquivo-de-versao',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ versao }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), arquivoDeVersao()],
  define: { __VERSAO__: JSON.stringify(versao) },
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
