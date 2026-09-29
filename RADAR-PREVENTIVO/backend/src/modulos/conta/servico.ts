import { z } from 'zod';
import type { Dependencias } from '../../comum/ambiente.js';
import { ErroApp, erros } from '../../comum/erros.js';
import { conferirSenha, gerarHashSenha, sha256 } from '../../comum/seguranca.js';
import { validar } from '../../comum/validacao.js';
import { esquemaSenha } from '../autenticacao/servico.js';
import { paraUsuario, repositorioAuth } from '../autenticacao/repositorio.js';

const esquemaAtualizar = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(120, 'Máximo de 120 caracteres.').optional(),
  tipoConta: z.enum(['pessoa', 'empresa'], { errorMap: () => ({ message: 'Escolha: pessoa ou empresa.' }) }).optional(),
});
const esquemaSenhaNova = z.object({ senhaAtual: z.string().min(1, 'Informe a senha atual.'), novaSenha: esquemaSenha });

export async function atualizarConta(deps: Dependencias, usuarioId: string, entrada: unknown) {
  const d = validar(esquemaAtualizar, entrada);
  const u = await repositorioAuth.usuarioPorId(deps.banco, usuarioId);
  if (!u) throw erros.naoEncontrado('Usuário');
  await deps.banco.executar('UPDATE usuarios SET nome = ?, tipo_conta = ?, atualizado_em = ? WHERE id = ?',
    [d.nome ?? u.nome, d.tipoConta ?? u.tipo_conta, deps.relogio.agora().toISOString(), usuarioId]);
  return paraUsuario((await repositorioAuth.usuarioPorId(deps.banco, usuarioId))!);
}

/** Troca a senha e desconecta os outros aparelhos (o atual continua conectado). */
export async function trocarSenha(deps: Dependencias, usuarioId: string, tokenAtual: string, entrada: unknown) {
  const d = validar(esquemaSenhaNova, entrada);
  const u = await repositorioAuth.usuarioPorId(deps.banco, usuarioId);
  if (!u) throw erros.naoEncontrado('Usuário');
  if (!(await conferirSenha(d.senhaAtual, u.senha_hash, deps.config.pimentaSenha))) {
    throw new ErroApp('senha_atual_incorreta', 400, 'A senha atual está incorreta.', { senhaAtual: 'A senha atual está incorreta.' });
  }
  const agora = deps.relogio.agora().toISOString();
  await deps.banco.executar('UPDATE usuarios SET senha_hash = ?, atualizado_em = ? WHERE id = ?',
    [await gerarHashSenha(d.novaSenha, deps.config.pimentaSenha), agora, usuarioId]);
  await repositorioAuth.encerrarOutrasSessoes(deps.banco, usuarioId, await sha256(tokenAtual), agora);
}

const esquemaExcluir = z.object({ senha: z.string({ required_error: 'Informe sua senha.' }).min(1, 'Informe sua senha.') });

/**
 * Exclui a conta de vez: arquivos anexados, itens, alertas, sessões e o cadastro.
 * Pede a senha para confirmar. Não tem volta.
 */
export async function excluirConta(deps: Dependencias, usuarioId: string, entrada: unknown) {
  const d = validar(esquemaExcluir, entrada);
  const u = await repositorioAuth.usuarioPorId(deps.banco, usuarioId);
  if (!u) throw erros.naoEncontrado('Usuário');
  if (!(await conferirSenha(d.senha, u.senha_hash, deps.config.pimentaSenha))) {
    throw new ErroApp('senha_incorreta', 400, 'A senha está incorreta.', { senha: 'A senha está incorreta.' });
  }
  const arquivos = await deps.banco.todos<{ chave_arquivo: string }>('SELECT chave_arquivo FROM anexos WHERE usuario_id = ?', [usuarioId]);
  for (const a of arquivos) await deps.armazenamento.apagar(a.chave_arquivo);
  // Apaga em ordem (filhos antes do pai), sem depender de exclusão em cascata do banco.
  await deps.banco.executar('DELETE FROM entregas_alerta WHERE alerta_id IN (SELECT id FROM alertas WHERE usuario_id = ?)', [usuarioId]);
  await deps.banco.executar('DELETE FROM alertas WHERE usuario_id = ?', [usuarioId]);
  await deps.banco.executar('DELETE FROM analises WHERE item_id IN (SELECT id FROM itens WHERE usuario_id = ?)', [usuarioId]);
  await deps.banco.executar('DELETE FROM anexos WHERE usuario_id = ?', [usuarioId]);
  await deps.banco.executar('DELETE FROM itens WHERE usuario_id = ?', [usuarioId]);
  await deps.banco.executar('DELETE FROM sessoes WHERE usuario_id = ?', [usuarioId]);
  await deps.banco.executar('DELETE FROM tentativas_login WHERE identificador = ?', [u.email]);
  await deps.banco.executar('DELETE FROM usuarios WHERE id = ?', [usuarioId]);
}
