import { useEffect, useState } from 'react';
import { documentos } from '../dados/banco';
import { codigo, dataLocal, estaVencida, total } from '../dominio/calculos';
import type { Documento } from '../dominio/tipos';
import { useEstado } from '../estado';
import { dinheiro, t, useIdioma } from '../i18n';
import { Selo, Topo } from '../componentes/base';

export function ItemDocumento({ d }: { d: Documento }) {
  const { ir } = useEstado();
  return (
    <button className="item-lista" onClick={() => ir({ nome: 'documento', id: d.id })}>
      <div className="principal">
        <div className="titulo">{d.cliente.nome || '—'}</div>
        <div className="sub">
          {t('tipo.' + d.tipo)} · {codigo(d)} <Selo doc={d} />
        </div>
      </div>
      <div className="valor">{dinheiro(total(d), d.moeda)}</div>
    </button>
  );
}

export function Inicio() {
  useIdioma();
  const { negocio, ir, revisao } = useEstado();
  const [docs, setDocs] = useState<Documento[] | null>(null);
  useEffect(() => { void documentos.listar().then(setDocs); }, [revisao]);
  if (!negocio) return null;

  const lista = docs ?? [];
  const moeda = negocio.moeda;
  const faturasAbertas = lista.filter((d) => d.tipo === 'fatura' && d.status !== 'pago' && d.status !== 'cancelado');
  const aReceber = faturasAbertas.reduce((s, d) => s + total(d), 0);
  const vencidas = faturasAbertas.filter((d) => estaVencida(d));
  const mes = dataLocal().slice(0, 7);
  const recebidoMes = lista.filter((d) => d.tipo === 'fatura' && d.status === 'pago' && (d.pagoEm ?? '').startsWith(mes)).reduce((s, d) => s + total(d), 0);
  const aguardando = lista.filter((d) => d.tipo === 'orcamento' && d.status === 'enviado');
  const aprovados = lista.filter((d) => d.tipo === 'orcamento' && d.status === 'aprovado');

  return (
    <>
      <Topo titulo={negocio.nome} />
      <main className="conteudo">
        <section className="destaque">
          <div className="rotulo">{t('inicio.aReceber')}</div>
          <div className="valor">{dinheiro(aReceber, moeda)}</div>
          <div className="rotulo">{t('inicio.recebidoMes')}: <strong>{dinheiro(recebidoMes, moeda)}</strong></div>
        </section>

        <div className="grade2">
          <button className="mini" onClick={() => ir({ nome: 'documentos' })}>
            <div className="n">{aguardando.length}</div>
            <div className="r">{t('inicio.aguardando')}</div>
          </button>
          <button className="mini" onClick={() => ir({ nome: 'documentos' })}>
            <div className="n">{aprovados.length}</div>
            <div className="r">{t('inicio.aprovados')}</div>
          </button>
          <button className="mini" onClick={() => ir({ nome: 'documentos' })} style={vencidas.length ? { boxShadow: 'inset 0 0 0 2px var(--perigo)' } : undefined}>
            <div className="n">{vencidas.length}</div>
            <div className="r">{t('inicio.vencidas')}</div>
          </button>
          <button className="mini" onClick={() => ir({ nome: 'editor', tipo: 'fatura' })}>
            <div className="n">＋</div>
            <div className="r">{t('inicio.novaFatura')}</div>
          </button>
        </div>

        <section className="cartao">
          <h2>{t('inicio.recentes')}</h2>
          {docs && lista.length === 0 ? (
            <div className="vazio">
              <strong>{t('inicio.vazioTitulo')}</strong>
              {t('inicio.vazioTexto')}
            </div>
          ) : (
            <div className="lista">{lista.slice(0, 8).map((d) => <ItemDocumento key={d.id} d={d} />)}</div>
          )}
        </section>
      </main>
      <button className="fab" onClick={() => ir({ nome: 'editor', tipo: 'orcamento' })}>＋ {t('inicio.novoOrcamento')}</button>
    </>
  );
}
