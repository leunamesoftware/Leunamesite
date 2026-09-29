import { z } from 'zod';
import type { SessaoCriada } from '../../../../compartilhado/contratos.js';
import type { Dependencias } from '../../comum/ambiente.js';
import { ErroApp } from '../../comum/erros.js';
import { conferirSenha, gerarHashSenha, gerarToken, novoId, sha256 } from '../../comum/seguranca.js';
import { validar } from '../../comum/validacao.js';
import { paraUsuario, repositorioAuth, type LinhaUsuario } from './repositorio.js';

const LIMITE_FALHAS = 10;
const JANELA_MIN = 15;

export const esquemaSenha = z.string({ required_error: 'Informe a senha.' }).min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(200, 'Senha longa demais.');
const esquemaEmail = z.string({ required_error: 'Informe o e-mail.' }).trim().toLowerCase().email('E-mail inválido.').max(200);

const esquemaCadastro = z.object({
  nome: z.string({ required_error: 'Informe o nome.' }).trim().min(2, 'Informe o nome.').max(120, 'Máximo de 120 caracteres.'),
  email: esquemaEmail,
  senha: esquemaSenha,
  tipoConta: z.enum(['pessoa', 'empresa'], { errorMap: () => ({ message: 'Escolha: pessoa ou empresa.' }) }),
});
const esquemaEntrar = z.object({ email: esquemaEmail, senha: z.string({ required_error: 'Informe a senha.' }).min(1, 'Informe a senha.') });

async function bloqueado(deps: Dependencias, identificadores: string[]) {
  const desde = new Date(deps.relogio.agora().getTime() - JANELA_MIN * 60_000).toISOString();
  for (const id of identificadores) {
    if ((await repositorioAuth.contarFalhas(deps.banco, id, desde)) >= LIMITE_FALHAS) {
      throw new ErroApp('muitas_tentativas', 429, `Muitas tentativas. Aguarde ${JANELA_MIN} minutos e tente de novo.`);
    }
  }
}

async function registrar(deps: Dependencias, identificadores: string[], sucesso: boolean) {
  const criadoEm = deps.relogio.agora().toISOString();
  for (const identificador of identificadores) {
    await repositorioAuth.registrarTentativa(deps.banco, { id: novoId(), identificador, sucesso, criadoEm });
  }
}

async function abrirSessao(deps: Dependencias, u: LinhaUsuario): Promise<SessaoCriada> {
  const token = gerarToken();
  const agora = deps.relogio.agora();
  const expiraEm = new Date(agora.getTime() + deps.config.diasSessao * 86_400_000).toISOString();
  await repositorioAuth.criarSessao(deps.banco, { id: novoId(), usuarioId: u.id, tokenHash: await sha256(token), criadoEm: agora.toISOString(), expiraEm });
  return { token, expiraEm, usuario: paraUsuario(u) };
}

export async function cadastrar(deps: Dependencias, entrada: unknown, ip: string): Promise<SessaoCriada> {
  const idIp = `cadastro:${ip}`;
  await bloqueado(deps, [idIp]);
  const d = validar(esquemaCadastro, entrada);
  if (await repositorioAuth.usuarioPorEmail(deps.banco, d.email)) {
    await registrar(deps, [idIp], false);
    throw new ErroApp('email_ja_cadastrado', 409, 'Já existe uma conta com este e-mail.', { email: 'Já existe uma conta com este e-mail.' });
  }
  const agora = deps.relogio.agora().toISOString();
  const usuario = { id: novoId(), nome: d.nome, email: d.email, senha_hash: await gerarHashSenha(d.senha, deps.config.pimentaSenha), tipo_conta: d.tipoConta, criado_em: agora, atualizado_em: agora };
  await repositorioAuth.criarUsuario(deps.banco, usuario);
  return abrirSessao(deps, { ...usuario, papel: 'usuario' });
}

export async function entrar(deps: Dependencias, entrada: unknown, ip: string): Promise<SessaoCriada> {
  const d = validar(esquemaEntrar, entrada);
  const ids = [`login:${d.email}`, `login-ip:${ip}`];
  await bloqueado(deps, ids);
  const u = await repositorioAuth.usuarioPorEmail(deps.banco, d.email);
  // Espaço sobrando no começo/fim (comum com teclado de celular) não impede o login.
  const valida = !!u && ((await conferirSenha(d.senha, u.senha_hash, deps.config.pimentaSenha))
    || (d.senha !== d.senha.trim() && (await conferirSenha(d.senha.trim(), u.senha_hash, deps.config.pimentaSenha))));
  await registrar(deps, ids, valida);
  if (!u || !valida) throw new ErroApp('credenciais_invalidas', 401, 'E-mail ou senha incorretos.');
  return abrirSessao(deps, u);
}

export async function sair(deps: Dependencias, token: string) {
  await repositorioAuth.encerrarSessao(deps.banco, await sha256(token), deps.relogio.agora().toISOString());
}
