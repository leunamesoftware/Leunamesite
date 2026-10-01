// Regras de negócio do fluxo: orçamento → aprovação → fatura → pagamento → recibo.
import { agora, clientes, documentos, itens, negocio, novoId, proximoNumero } from '../dados/banco';
import { PROFISSOES, nomeNoIdioma, precoModelo } from '../modelos/profissoes';
import { regiaoDe } from '../regioes/regioes';
import { dataLocal, somarDias } from './calculos';
import type { Cliente, Documento, Negocio, TipoDocumento } from './tipos';

export async function criarNegocioInicial(nome: string, pais: string, profissaoId: string, idioma: string): Promise<Negocio> {
  const reg = regiaoDe(pais);
  const n: Negocio = {
    id: 'principal', criadoEm: agora(), atualizadoEm: agora(),
    nome: nome.trim(), documento: '', telefone: '', email: '', endereco: '', logo: null,
    cor: '#0E9F6E', pais: reg.pais, moeda: reg.moeda, idioma, profissao: profissaoId,
    pagamento: { pixChave: '', pixCidade: '', link: '', banco: '' },
    validadePadraoDias: 15, observacaoPadrao: '',
  };
  await negocio.salvar(n);
  const prof = PROFISSOES.find((p) => p.id === profissaoId) ?? PROFISSOES[PROFISSOES.length - 1]!;
  for (const m of prof.itens) {
    await itens.salvar({ id: novoId(), criadoEm: agora(), atualizadoEm: agora(), nome: nomeNoIdioma(m.nome, idioma), unidade: m.unidade, preco: precoModelo(m.precoUsd, reg.moeda) });
  }
  return n;
}

export function documentoVazio(tipo: TipoDocumento, neg: Negocio): Documento {
  return {
    id: novoId(), criadoEm: agora(), atualizadoEm: agora(),
    tipo, numero: 0, clienteId: null,
    cliente: { nome: '', telefone: '', email: '', documento: '', endereco: '' },
    linhas: [], desconto: 0, observacoes: neg.observacaoPadrao,
    emitidoEm: dataLocal(),
    validoAte: tipo === 'orcamento' ? somarDias(neg.validadePadraoDias || 15) : null,
    venceEm: tipo === 'fatura' ? somarDias(7) : null,
    status: 'rascunho', moeda: neg.moeda, origemId: null, link: null, aprovacao: null, pagoEm: null,
  };
}

/** Salva o documento; na primeira vez ganha o número sequencial. */
export async function salvarDocumento(doc: Documento): Promise<Documento> {
  const d = { ...doc };
  if (!d.numero) d.numero = await proximoNumero(d.tipo);
  return documentos.salvar(d);
}

/** Garante que o cliente digitado exista na lista de clientes. */
export async function garantirCliente(doc: Documento): Promise<Documento> {
  if (doc.clienteId || !doc.cliente.nome.trim()) return doc;
  const c: Cliente = { id: novoId(), criadoEm: agora(), atualizadoEm: agora(), ...doc.cliente, nome: doc.cliente.nome.trim() };
  await clientes.salvar(c);
  return { ...doc, clienteId: c.id };
}

export async function marcarAprovado(doc: Documento, nome: string, assinatura: string | null = null): Promise<Documento> {
  return documentos.salvar({ ...doc, status: 'aprovado', aprovacao: { nome, assinatura, em: agora() } });
}

/** Orçamento aprovado (ou não) vira fatura com 1 toque. */
export async function virarFatura(orc: Documento): Promise<Documento> {
  const fat: Documento = {
    ...orc,
    id: novoId(), criadoEm: agora(), atualizadoEm: agora(),
    tipo: 'fatura', numero: await proximoNumero('fatura'),
    emitidoEm: dataLocal(), validoAte: null, venceEm: somarDias(7),
    status: 'rascunho', origemId: orc.id, link: null, pagoEm: null,
  };
  await documentos.salvar(fat);
  return fat;
}

/** Marca a fatura como paga e gera o recibo. */
export async function registrarPagamento(fat: Documento, pagoEm = dataLocal()): Promise<{ fatura: Documento; recibo: Documento }> {
  const fatura = await documentos.salvar({ ...fat, status: 'pago', pagoEm });
  const recibo: Documento = {
    ...fat,
    id: novoId(), criadoEm: agora(), atualizadoEm: agora(),
    tipo: 'recibo', numero: await proximoNumero('recibo'),
    emitidoEm: pagoEm, validoAte: null, venceEm: null,
    status: 'pago', origemId: fat.id, link: null, pagoEm, aprovacao: null,
  };
  await documentos.salvar(recibo);
  return { fatura, recibo };
}
