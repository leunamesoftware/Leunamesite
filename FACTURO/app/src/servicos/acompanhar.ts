import { documentos } from '../dados/banco';
import { marcarAprovado } from '../dominio/acoes';
import type { Documento } from '../dominio/tipos';
import { consultarLink } from './links';

export type Evento = { tipo: 'aprovou' | 'recusou' | 'pagou'; doc: Documento };

/** Documento que ainda espera resposta do cliente pelo link. */
export const aguardaCliente = (d: Documento) =>
  !!d.link && ((d.tipo === 'orcamento' && d.status === 'enviado') || (d.tipo === 'fatura' && d.status !== 'pago' && d.status !== 'cancelado' && !d.pagamentoInformadoEm));

/** Confere um documento no servidor e grava o que o cliente fez (aprovou, recusou, informou pagamento). */
export async function acompanhar(d: Documento): Promise<{ doc: Documento; evento: Evento | null }> {
  if (!aguardaCliente(d)) return { doc: d, evento: null };
  const r = await consultarLink(d.link!);
  if (d.tipo === 'orcamento' && r.aprovacao) {
    const doc = await marcarAprovado(d, r.aprovacao.nome, r.aprovacao.assinatura);
    return { doc, evento: { tipo: 'aprovou', doc } };
  }
  if (d.tipo === 'orcamento' && r.recusado) {
    const doc = await documentos.salvar({ ...d, status: 'recusado' });
    return { doc, evento: { tipo: 'recusou', doc } };
  }
  if (d.tipo === 'fatura' && r.pagoInformadoEm) {
    const doc = await documentos.salvar({ ...d, pagamentoInformadoEm: r.pagoInformadoEm });
    return { doc, evento: { tipo: 'pagou', doc } };
  }
  return { doc: d, evento: null };
}

let rodando = false;
/** Confere todos os documentos pendentes (ao abrir o app e ao voltar para ele). Sem internet, não faz nada. */
export async function acompanharTodos(): Promise<Evento[]> {
  if (rodando || !navigator.onLine) return [];
  rodando = true;
  try {
    const pendentes = (await documentos.listar()).filter(aguardaCliente).slice(0, 30);
    const eventos: Evento[] = [];
    for (const d of pendentes) {
      try { const { evento } = await acompanhar(d); if (evento) eventos.push(evento); } catch { /* servidor fora: tenta depois */ }
    }
    return eventos;
  } finally {
    rodando = false;
  }
}
