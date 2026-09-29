import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Armazenamento } from './tipos.js';

/** Guarda os anexos numa pasta do servidor (desenvolvimento / servidor próprio). */
export function criarArmazenamentoDiscoLocal(pastaRaiz: string): Armazenamento {
  const raiz = resolve(pastaRaiz);
  const caminhoSeguro = (chave: string) => {
    const caminho = resolve(join(raiz, chave));
    if (!caminho.startsWith(raiz + sep)) throw new Error('Chave de arquivo inválida');
    return caminho;
  };
  return {
    async gravar(chave, conteudo) {
      const caminho = caminhoSeguro(chave);
      await mkdir(dirname(caminho), { recursive: true });
      await writeFile(caminho, conteudo);
    },
    async ler(chave) {
      try {
        return new Uint8Array(await readFile(caminhoSeguro(chave)));
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw erro;
      }
    },
    async apagar(chave) {
      await rm(caminhoSeguro(chave), { force: true });
    },
  };
}
