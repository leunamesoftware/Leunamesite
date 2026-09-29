import type { Dependencias } from '../../comum/ambiente.js';
import { ErroApp, erros } from '../../comum/erros.js';
import { novoId } from '../../comum/seguranca.js';
import { repositorioItens } from '../itens/repositorio.js';
import { paraAnexo, repositorioAnexos } from './repositorio.js';

export const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/** Formatos aceitos e a "assinatura" dos primeiros bytes de cada um (não basta confiar na extensão). */
const FORMATOS: Record<string, (b: Uint8Array) => boolean> = {
  'application/pdf': (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
};

export async function enviarAnexo(deps: Dependencias, usuarioId: string, itemId: string, arquivo: unknown) {
  const item = await repositorioItens.buscar(deps.banco, usuarioId, itemId);
  if (!item) throw erros.naoEncontrado('Item');
  if (!(arquivo instanceof File)) throw erros.dadosInvalidos({ arquivo: 'Escolha um arquivo.' });
  if (arquivo.size === 0) throw erros.dadosInvalidos({ arquivo: 'O arquivo está vazio.' });
  if (arquivo.size > TAMANHO_MAXIMO) throw new ErroApp('arquivo_grande_demais', 413, 'O arquivo passa de 10 MB.');
  const conteudo = new Uint8Array(await arquivo.arrayBuffer());
  const formato = Object.keys(FORMATOS).find((f) => FORMATOS[f]!(conteudo));
  if (!formato) throw new ErroApp('arquivo_invalido', 400, 'Envie um PDF ou uma imagem (JPG, PNG ou WEBP).');

  const id = novoId();
  const chave = `usuarios/${usuarioId}/itens/${itemId}/${id}`;
  await deps.armazenamento.gravar(chave, conteudo, formato);
  const nome = (arquivo.name || 'arquivo').replace(/[\\/\r\n"]/g, '_').slice(0, 120);
  const linha = { id, item_id: itemId, usuario_id: usuarioId, chave_arquivo: chave, nome, formato, tamanho_bytes: conteudo.byteLength, criado_em: deps.relogio.agora().toISOString() };
  try {
    await repositorioAnexos.inserir(deps.banco, linha);
  } catch (erro) {
    await deps.armazenamento.apagar(chave);
    throw erro;
  }
  return paraAnexo({ ...linha, situacao_leitura: 'nao_processado' });
}

export async function lerAnexo(deps: Dependencias, usuarioId: string, id: string) {
  const a = await repositorioAnexos.buscar(deps.banco, usuarioId, id);
  if (!a) throw erros.naoEncontrado('Anexo');
  const conteudo = await deps.armazenamento.ler(a.chave_arquivo);
  if (!conteudo) throw erros.naoEncontrado('Arquivo');
  return { conteudo, formato: a.formato, nome: a.nome };
}

export async function excluirAnexo(deps: Dependencias, usuarioId: string, id: string) {
  const a = await repositorioAnexos.buscar(deps.banco, usuarioId, id);
  if (!a) throw erros.naoEncontrado('Anexo');
  await repositorioAnexos.excluir(deps.banco, id);
  await deps.armazenamento.apagar(a.chave_arquivo);
}
