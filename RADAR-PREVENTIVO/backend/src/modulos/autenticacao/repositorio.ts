import type { Papel, TipoConta, Usuario } from '../../../../compartilhado/contratos.js';
import type { Banco } from '../../infra/banco/tipos.js';

export interface LinhaUsuario {
  id: string; nome: string; email: string; senha_hash: string; tipo_conta: TipoConta; papel: Papel; criado_em: string; atualizado_em: string;
}

export const paraUsuario = (l: LinhaUsuario): Usuario => ({
  id: l.id, nome: l.nome, email: l.email, tipoConta: l.tipo_conta, papel: l.papel, criadoEm: l.criado_em,
});

export const repositorioAuth = {
  async usuarioPorEmail(banco: Banco, email: string) {
    return banco.um<LinhaUsuario>('SELECT * FROM usuarios WHERE email = ?', [email]);
  },
  async usuarioPorId(banco: Banco, id: string) {
    return banco.um<LinhaUsuario>('SELECT * FROM usuarios WHERE id = ?', [id]);
  },
  async criarUsuario(banco: Banco, u: Omit<LinhaUsuario, 'papel'>) {
    await banco.executar(
      `INSERT INTO usuarios (id, nome, email, senha_hash, tipo_conta, papel, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'usuario', ?, ?)`,
      [u.id, u.nome, u.email, u.senha_hash, u.tipo_conta, u.criado_em, u.atualizado_em],
    );
  },
  async criarSessao(banco: Banco, s: { id: string; usuarioId: string; tokenHash: string; criadoEm: string; expiraEm: string }) {
    await banco.executar('INSERT INTO sessoes (id, usuario_id, token_hash, criado_em, expira_em) VALUES (?, ?, ?, ?, ?)',
      [s.id, s.usuarioId, s.tokenHash, s.criadoEm, s.expiraEm]);
  },
  async usuarioDaSessao(banco: Banco, tokenHash: string, agora: string) {
    return banco.um<LinhaUsuario>(
      `SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.encerrada_em IS NULL AND s.expira_em > ?`, [tokenHash, agora]);
  },
  async encerrarSessao(banco: Banco, tokenHash: string, agora: string) {
    await banco.executar('UPDATE sessoes SET encerrada_em = ? WHERE token_hash = ? AND encerrada_em IS NULL', [agora, tokenHash]);
  },
  async encerrarOutrasSessoes(banco: Banco, usuarioId: string, tokenHashAtual: string, agora: string) {
    await banco.executar('UPDATE sessoes SET encerrada_em = ? WHERE usuario_id = ? AND token_hash != ? AND encerrada_em IS NULL',
      [agora, usuarioId, tokenHashAtual]);
  },
  async registrarTentativa(banco: Banco, t: { id: string; identificador: string; sucesso: boolean; criadoEm: string }) {
    await banco.executar('INSERT INTO tentativas_login (id, identificador, sucesso, criado_em) VALUES (?, ?, ?, ?)',
      [t.id, t.identificador, t.sucesso ? 1 : 0, t.criadoEm]);
  },
  async contarFalhas(banco: Banco, identificador: string, desde: string) {
    const r = await banco.um<{ n: number }>('SELECT COUNT(*) AS n FROM tentativas_login WHERE identificador = ? AND sucesso = 0 AND criado_em > ?',
      [identificador, desde]);
    return Number(r?.n ?? 0);
  },
};
