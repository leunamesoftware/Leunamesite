/**
 * Porta do armazenamento de arquivos (anexos). Privado: só o servidor lê e grava;
 * o usuário recebe o arquivo pela API, depois de conferido que ele é o dono.
 */
export interface Armazenamento {
  gravar(chave: string, conteudo: Uint8Array, formato: string): Promise<void>;
  ler(chave: string): Promise<Uint8Array | null>;
  apagar(chave: string): Promise<void>;
}
