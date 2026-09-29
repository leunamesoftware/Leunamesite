import type { Anexo } from '../../../../compartilhado/contratos.js';
import type { Banco } from '../../infra/banco/tipos.js';

export interface LinhaAnexo {
  id: string; item_id: string; usuario_id: string; chave_arquivo: string; nome: string; formato: string;
  tamanho_bytes: number; situacao_leitura: 'nao_processado'; criado_em: string;
}

export const paraAnexo = (l: LinhaAnexo): Anexo => ({
  id: l.id, nome: l.nome, formato: l.formato, tamanhoBytes: Number(l.tamanho_bytes), situacaoLeitura: l.situacao_leitura, criadoEm: l.criado_em,
});

export const repositorioAnexos = {
  async inserir(banco: Banco, a: Omit<LinhaAnexo, 'situacao_leitura'>) {
    await banco.executar(
      `INSERT INTO anexos (id, item_id, usuario_id, chave_arquivo, nome, formato, tamanho_bytes, situacao_leitura, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'nao_processado', ?)`,
      [a.id, a.item_id, a.usuario_id, a.chave_arquivo, a.nome, a.formato, a.tamanho_bytes, a.criado_em],
    );
  },
  async buscar(banco: Banco, usuarioId: string, id: string) {
    return banco.um<LinhaAnexo>('SELECT * FROM anexos WHERE usuario_id = ? AND id = ?', [usuarioId, id]);
  },
  async listarDoItem(banco: Banco, usuarioId: string, itemId: string) {
    return banco.todos<LinhaAnexo>('SELECT * FROM anexos WHERE usuario_id = ? AND item_id = ? ORDER BY criado_em', [usuarioId, itemId]);
  },
  async excluir(banco: Banco, id: string) {
    await banco.executar('DELETE FROM anexos WHERE id = ?', [id]);
  },
};
