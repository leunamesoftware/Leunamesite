// Link de aprovação: a única parte do Facturo que usa o servidor.
// Enviamos uma cópia do documento (só o que o cliente precisa ver) e recebemos um link
// impossível de adivinhar. O app guarda a chaveDono para consultar se o cliente aprovou.
import type { Aprovacao, Documento, LinkCompartilhado, Negocio } from '../dominio/tipos';
import { codigo, subtotal, total } from '../dominio/calculos';
import { gerarPixCopiaECola } from '../pix/brcode';
import { idiomaAtual, unidade } from '../i18n';
import { regiaoDe } from '../regioes/regioes';

export const SERVIDOR = (import.meta.env.VITE_SERVIDOR as string | undefined) || 'https://facturo.leunamesoftware.com.br';

export function copiaPublica(doc: Documento, neg: Negocio) {
  const pix =
    doc.tipo === 'fatura' && neg.pagamento.pixChave.trim()
      ? gerarPixCopiaECola({ chave: neg.pagamento.pixChave, nome: neg.nome, cidade: neg.pagamento.pixCidade, valorCentavos: total(doc), identificador: codigo(doc).replace('-', '') })
      : '';
  return {
    v: 1,
    idioma: idiomaAtual(),
    locale: regiaoDe(neg.pais).locale,
    tipo: doc.tipo,
    codigo: codigo(doc),
    moeda: doc.moeda,
    emitidoEm: doc.emitidoEm,
    validoAte: doc.validoAte,
    venceEm: doc.venceEm,
    negocio: { nome: neg.nome, documento: neg.documento, telefone: neg.telefone, email: neg.email, endereco: neg.endereco, logo: neg.logo, cor: neg.cor },
    cliente: { nome: doc.cliente.nome },
    linhas: doc.linhas.map((l) => ({ nome: l.nome, unidade: unidade(l.unidade), quantidade: l.quantidade, precoUnitario: l.precoUnitario })),
    subtotal: subtotal(doc.linhas),
    desconto: doc.desconto,
    total: total(doc),
    observacoes: doc.observacoes,
    pagamento: doc.tipo === 'fatura' ? { pix, link: neg.pagamento.link.trim(), banco: neg.pagamento.banco.trim() } : null,
    pedeAprovacao: doc.tipo === 'orcamento',
  };
}

export async function criarLink(doc: Documento, neg: Negocio): Promise<LinkCompartilhado> {
  const r = await fetch(`${SERVIDOR}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(copiaPublica(doc, neg)),
  });
  if (!r.ok) throw new Error('servidor ' + r.status);
  const j = (await r.json()) as { id: string; chaveDono: string; url: string };
  return { ...j, criadoEm: new Date().toISOString() };
}

/** Atualiza a cópia no servidor (ex.: orçamento virou fatura, mudou o valor). */
export async function atualizarLink(link: LinkCompartilhado, doc: Documento, neg: Negocio): Promise<void> {
  const r = await fetch(`${SERVIDOR}/api/links/${link.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${link.chaveDono}` },
    body: JSON.stringify(copiaPublica(doc, neg)),
  });
  if (!r.ok) throw new Error('servidor ' + r.status);
}

export async function consultarLink(link: LinkCompartilhado): Promise<{ aprovacao: Aprovacao | null; recusado: boolean }> {
  const r = await fetch(`${SERVIDOR}/api/links/${link.id}/status`, { headers: { Authorization: `Bearer ${link.chaveDono}` } });
  if (!r.ok) throw new Error('servidor ' + r.status);
  return (await r.json()) as { aprovacao: Aprovacao | null; recusado: boolean };
}
