import type { Analise, EstadoItem, ItemResumo, Natureza, OrigemDados, Pendencia, Situacao } from '../../../../compartilhado/contratos.js';
import type { Banco, Parametro } from '../../infra/banco/tipos.js';

export interface LinhaItem {
  id: string; usuario_id: string; natureza: Natureza; titulo: string; tipo: string; descricao: string | null;
  data_emissao: string | null; data_vencimento: string | null; antecedencia_dias: number | null;
  estado: EstadoItem; resolvido_em: string | null; origem_dados: OrigemDados; criado_em: string; atualizado_em: string;
  // da análise (LEFT JOIN)
  a_situacao: Situacao | null; a_dias: number | null; a_pendencias: string | null; a_em: string | null; a_versao: string | null;
  qtd_anexos: number;
}

export const SELECT_ITEM = `SELECT i.*, a.situacao AS a_situacao, a.dias_restantes AS a_dias, a.pendencias AS a_pendencias,
  a.analisado_em AS a_em, a.versao_regras AS a_versao,
  (SELECT COUNT(*) FROM anexos x WHERE x.item_id = i.id) AS qtd_anexos
  FROM itens i LEFT JOIN analises a ON a.item_id = i.id`;

export function analiseDaLinha(l: LinhaItem): Analise | null {
  if (!l.a_situacao || !l.a_em || !l.a_versao) return null;
  return {
    situacao: l.a_situacao, diasRestantes: l.a_dias, pendencias: JSON.parse(l.a_pendencias ?? '[]') as Pendencia[],
    analisadoEm: l.a_em, versaoRegras: l.a_versao,
  };
}

export function paraResumo(l: LinhaItem): ItemResumo {
  return {
    id: l.id, natureza: l.natureza, titulo: l.titulo, tipo: l.tipo, dataVencimento: l.data_vencimento,
    estado: l.estado, resolvidoEm: l.resolvido_em, analise: analiseDaLinha(l), quantidadeAnexos: Number(l.qtd_anexos),
    atualizadoEm: l.atualizado_em,
  };
}

export const repositorioItens = {
  async buscar(banco: Banco, usuarioId: string, id: string) {
    return banco.um<LinhaItem>(`${SELECT_ITEM} WHERE i.usuario_id = ? AND i.id = ?`, [usuarioId, id]);
  },
  async listar(banco: Banco, usuarioId: string, f: { estado: EstadoItem; situacao?: Situacao; busca?: string }) {
    const cond = ['i.usuario_id = ?', 'i.estado = ?'];
    const params: Parametro[] = [usuarioId, f.estado];
    if (f.situacao) { cond.push('a.situacao = ?'); params.push(f.situacao); }
    if (f.busca) {
      cond.push('(i.titulo LIKE ? OR i.tipo LIKE ? OR i.descricao LIKE ?)');
      const termo = `%${f.busca}%`;
      params.push(termo, termo, termo);
    }
    // Sem data vão para o fim; o resto em ordem de vencimento.
    const ordem = f.estado === 'resolvido' ? 'i.resolvido_em DESC' : 'i.data_vencimento IS NULL, i.data_vencimento ASC, i.titulo';
    return banco.todos<LinhaItem>(`${SELECT_ITEM} WHERE ${cond.join(' AND ')} ORDER BY ${ordem}`, params);
  },
  async listarAtivosDeTodos(banco: Banco) {
    return banco.todos<LinhaItem>(`${SELECT_ITEM} WHERE i.estado = 'ativo'`);
  },
  async tiposUsados(banco: Banco, usuarioId: string) {
    const linhas = await banco.todos<{ tipo: string }>(
      'SELECT tipo FROM itens WHERE usuario_id = ? GROUP BY tipo ORDER BY COUNT(*) DESC, tipo LIMIT 50', [usuarioId]);
    return linhas.map((l) => l.tipo);
  },
  async inserir(banco: Banco, d: { id: string; usuarioId: string; natureza: Natureza; titulo: string; tipo: string; descricao: string | null; dataEmissao: string | null; dataVencimento: string | null; antecedenciaDias: number | null; agora: string }) {
    await banco.executar(
      `INSERT INTO itens (id, usuario_id, natureza, titulo, tipo, descricao, data_emissao, data_vencimento, antecedencia_dias, estado, origem_dados, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', 'manual', ?, ?)`,
      [d.id, d.usuarioId, d.natureza, d.titulo, d.tipo, d.descricao, d.dataEmissao, d.dataVencimento, d.antecedenciaDias, d.agora, d.agora],
    );
  },
  async atualizar(banco: Banco, id: string, d: { natureza: Natureza; titulo: string; tipo: string; descricao: string | null; dataEmissao: string | null; dataVencimento: string | null; antecedenciaDias: number | null; agora: string }) {
    await banco.executar(
      `UPDATE itens SET natureza = ?, titulo = ?, tipo = ?, descricao = ?, data_emissao = ?, data_vencimento = ?, antecedencia_dias = ?, atualizado_em = ? WHERE id = ?`,
      [d.natureza, d.titulo, d.tipo, d.descricao, d.dataEmissao, d.dataVencimento, d.antecedenciaDias, d.agora, id],
    );
  },
  async marcarResolvido(banco: Banco, id: string, agora: string) {
    await banco.executar(`UPDATE itens SET estado = 'resolvido', resolvido_em = ?, atualizado_em = ? WHERE id = ?`, [agora, agora, id]);
  },
  async excluir(banco: Banco, id: string) {
    await banco.executar('DELETE FROM itens WHERE id = ?', [id]);
  },
};
