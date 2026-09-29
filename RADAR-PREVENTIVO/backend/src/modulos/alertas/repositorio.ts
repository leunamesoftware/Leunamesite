import type { Alerta, MotivoAlerta, Natureza, Situacao } from '../../../../compartilhado/contratos.js';
import type { Banco } from '../../infra/banco/tipos.js';

interface LinhaAlerta {
  id: string; item_id: string; item_titulo: string; item_natureza: Natureza; item_data_vencimento: string | null;
  motivo: MotivoAlerta; situacao: Situacao;
  mensagem: string; criado_em: string; lido_em: string | null; resolvido_em: string | null;
}

const paraAlerta = (l: LinhaAlerta): Alerta => ({
  id: l.id, itemId: l.item_id, itemTitulo: l.item_titulo, itemNatureza: l.item_natureza, itemDataVencimento: l.item_data_vencimento, motivo: l.motivo, situacao: l.situacao,
  mensagem: l.mensagem, criadoEm: l.criado_em, lidoEm: l.lido_em, resolvidoEm: l.resolvido_em,
});

const SELECT = `SELECT a.id, a.item_id, i.titulo AS item_titulo, i.natureza AS item_natureza, i.data_vencimento AS item_data_vencimento, a.motivo, a.situacao, a.mensagem,
  a.criado_em, a.lido_em, a.resolvido_em FROM alertas a JOIN itens i ON i.id = a.item_id`;

export const repositorioAlertas = {
  /** Cria o alerta; se a chave única já existe, não cria de novo e devolve null. */
  async criar(banco: Banco, a: { id: string; usuarioId: string; itemId: string; motivo: MotivoAlerta; situacao: Situacao; mensagem: string; chaveUnica: string; criadoEm: string }) {
    const r = await banco.executar(
      `INSERT INTO alertas (id, usuario_id, item_id, motivo, situacao, mensagem, chave_unica, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(chave_unica) DO NOTHING`,
      [a.id, a.usuarioId, a.itemId, a.motivo, a.situacao, a.mensagem, a.chaveUnica, a.criadoEm],
    );
    if (!r.alteradas) return null;
    return this.buscar(banco, a.usuarioId, a.id);
  },
  async criadoEmPorChave(banco: Banco, chaveUnica: string) {
    const r = await banco.um<{ criado_em: string }>('SELECT criado_em FROM alertas WHERE chave_unica = ?', [chaveUnica]);
    return r?.criado_em ?? null;
  },
  async registrarEntrega(banco: Banco, e: { id: string; alertaId: string; canal: string; status: string; criadoEm: string }) {
    await banco.executar('INSERT INTO entregas_alerta (id, alerta_id, canal, status, criado_em) VALUES (?, ?, ?, ?, ?)',
      [e.id, e.alertaId, e.canal, e.status, e.criadoEm]);
  },
  async buscar(banco: Banco, usuarioId: string, id: string) {
    const l = await banco.um<LinhaAlerta>(`${SELECT} WHERE a.usuario_id = ? AND a.id = ?`, [usuarioId, id]);
    return l ? paraAlerta(l) : null;
  },
  async listar(banco: Banco, usuarioId: string, filtro: { naoLidos?: boolean; limite?: number } = {}) {
    const linhas = await banco.todos<LinhaAlerta>(
      `${SELECT} WHERE a.usuario_id = ? ${filtro.naoLidos ? 'AND a.lido_em IS NULL' : ''} ORDER BY a.criado_em DESC LIMIT ?`,
      [usuarioId, filtro.limite ?? 200],
    );
    return linhas.map(paraAlerta);
  },
  async listarDoItem(banco: Banco, usuarioId: string, itemId: string) {
    const linhas = await banco.todos<LinhaAlerta>(`${SELECT} WHERE a.usuario_id = ? AND a.item_id = ? ORDER BY a.criado_em DESC`, [usuarioId, itemId]);
    return linhas.map(paraAlerta);
  },
  async contarNaoLidos(banco: Banco, usuarioId: string) {
    const r = await banco.um<{ n: number }>('SELECT COUNT(*) AS n FROM alertas WHERE usuario_id = ? AND lido_em IS NULL', [usuarioId]);
    return Number(r?.n ?? 0);
  },
  async marcarLido(banco: Banco, usuarioId: string, id: string, quando: string) {
    const r = await banco.executar('UPDATE alertas SET lido_em = COALESCE(lido_em, ?) WHERE usuario_id = ? AND id = ?', [quando, usuarioId, id]);
    return r.alteradas > 0;
  },
  async marcarTodosLidos(banco: Banco, usuarioId: string, quando: string) {
    const r = await banco.executar('UPDATE alertas SET lido_em = ? WHERE usuario_id = ? AND lido_em IS NULL', [quando, usuarioId]);
    return r.alteradas;
  },
  /** Fecha os alertas em aberto do item (resolvido ou situação melhorou). Nada é apagado. */
  async resolverDoItem(banco: Banco, itemId: string, quando: string) {
    await banco.executar('UPDATE alertas SET resolvido_em = ? WHERE item_id = ? AND resolvido_em IS NULL', [quando, itemId]);
  },
};
