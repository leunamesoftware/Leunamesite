import type { Armazenamento } from './tipos.js';

/** Versão em memória, para os testes automáticos. */
export function criarArmazenamentoMemoria(): Armazenamento & { total(): number } {
  const arquivos = new Map<string, Uint8Array>();
  return {
    async gravar(chave, conteudo) { arquivos.set(chave, conteudo); },
    async ler(chave) { return arquivos.get(chave) ?? null; },
    async apagar(chave) { arquivos.delete(chave); },
    total: () => arquivos.size,
  };
}
