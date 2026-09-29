import type { Armazenamento } from './tipos.js';

/** O mínimo da API do Cloudflare R2 que o Radar usa. */
export interface R2Bucket {
  put(chave: string, conteudo: Uint8Array, opcoes?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(chave: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(chave: string): Promise<void>;
}

/** Anexos guardados num bucket R2 privado (sem acesso público: só a API lê e entrega). */
export function criarArmazenamentoR2(bucket: R2Bucket): Armazenamento {
  return {
    async gravar(chave, conteudo, formato) {
      await bucket.put(chave, conteudo, { httpMetadata: { contentType: formato } });
    },
    async ler(chave) {
      const objeto = await bucket.get(chave);
      return objeto ? new Uint8Array(await objeto.arrayBuffer()) : null;
    },
    async apagar(chave) {
      await bucket.delete(chave);
    },
  };
}
