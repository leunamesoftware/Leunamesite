import { useEffect, useState } from 'react';
import { clientes as repoClientes, itens as repoItens, negocio as repoNegocio } from '../dados/banco';
import type { Cliente, Item, Negocio } from '../dominio/tipos';
import { useEstado } from '../estado';
import { dinheiro, t, unidade, useIdioma } from '../i18n';
import { regiaoDe } from '../regioes/regioes';
import { iniciais } from '../dominio/marca';
import { Campo, CampoTexto, Topo } from '../componentes/base';
import { EditorCliente, EditorItem } from './Editor';

export function Clientes() {
  useIdioma();
  const [lista, setLista] = useState<Cliente[]>([]);
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null);
  const [busca, setBusca] = useState('');
  const carregar = async () => setLista(await repoClientes.listar());
  useEffect(() => { void carregar(); }, []);
  const q = busca.trim().toLowerCase();
  const filtrados = lista.filter((c) => !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q));

  return (
    <>
      <Topo titulo={t('clientes.titulo')} />
      <main className="conteudo">
        <input id="busca-clientes" className="entrada" placeholder={t('comum.buscar')} value={busca} onChange={(e) => setBusca(e.target.value)} />
        <section className="cartao">
          {filtrados.length ? (
            <div className="lista">
              {filtrados.map((c) => (
                <button key={c.id} className="item-lista" onClick={() => setEditando(c)}>
                  <div className="principal">
                    <div className="titulo">{c.nome}</div>
                    <div className="sub">{[c.telefone, c.email].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span aria-hidden>›</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="vazio">{t('clientes.vazio')}</div>
          )}
        </section>
      </main>
      <button className="fab" onClick={() => setEditando('novo')}>＋ {t('clientes.novo')}</button>
      {editando && (
        <EditorCliente
          inicial={editando === 'novo' ? undefined : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (c) => { await repoClientes.salvar(c); setEditando(null); await carregar(); }}
        />
      )}
    </>
  );
}

export function Itens() {
  useIdioma();
  const { negocio } = useEstado();
  const [lista, setLista] = useState<Item[]>([]);
  const [editando, setEditando] = useState<Item | 'novo' | null>(null);
  const carregar = async () => setLista(await repoItens.listar());
  useEffect(() => { void carregar(); }, []);
  const moeda = negocio?.moeda ?? 'USD';

  return (
    <>
      <Topo titulo={t('itens.titulo')} voltar />
      <main className="conteudo">
        <section className="cartao">
          {lista.length ? (
            <div className="lista">
              {lista.map((i) => (
                <button key={i.id} className="item-lista" onClick={() => setEditando(i)}>
                  <div className="principal">
                    <div className="titulo">{i.nome}</div>
                    <div className="sub">{unidade(i.unidade)}</div>
                  </div>
                  <div className="valor">{dinheiro(i.preco, moeda)}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="vazio">{t('itens.vazio')}</div>
          )}
        </section>
      </main>
      <button className="fab" onClick={() => setEditando('novo')}>＋ {t('itens.novo')}</button>
      {editando && (
        <EditorItem
          inicial={editando === 'novo' ? undefined : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (i) => { await repoItens.salvar(i); setEditando(null); await carregar(); }}
          aoExcluir={editando === 'novo' ? undefined : async () => { await repoItens.excluir(editando.id); setEditando(null); await carregar(); }}
        />
      )}
    </>
  );
}

/** Reduz a logo para no máximo 320px (PDF e link leves). */
function reduzirImagem(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 320;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(arquivo);
  });
}

const CORES = ['#0E9F6E', '#0B4F6C', '#1D4ED8', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#111827'];

export function MeuNegocio() {
  useIdioma();
  const { negocio, recarregarNegocio, voltar, aviso } = useEstado();
  const [n, setN] = useState<Negocio | null>(negocio ?? null);
  if (!n) return null;
  const reg = regiaoDe(n.pais);
  const m = (k: keyof Negocio) => (e: { target: { value: string } }) => setN({ ...n, [k]: e.target.value });
  const mp = (k: keyof Negocio['pagamento']) => (e: { target: { value: string } }) => setN({ ...n, pagamento: { ...n.pagamento, [k]: e.target.value } });

  async function salvar() {
    await repoNegocio.salvar(n!);
    await recarregarNegocio();
    aviso(t('comum.salvo'));
    voltar();
  }

  return (
    <>
      <Topo titulo={t('negocio.titulo')} voltar />
      <main className="conteudo">
        <section className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="campo">
            <label>{t('negocio.logo')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {n.logo ? <img className="logo-previa" src={n.logo} alt="" /> : <div className="logo-previa monograma" style={{ color: n.cor }} title={t('negocio.logoAuto')}>{iniciais(n.nome)}</div>}
              <label className="botao secundario" style={{ width: 'auto' }}>
                {t('negocio.trocarLogo')}
                <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setN({ ...n, logo: await reduzirImagem(f) }); }} />
              </label>
              {n.logo && <button className="botao perigo" style={{ width: 'auto' }} onClick={() => setN({ ...n, logo: null })}>{t('negocio.removerLogo')}</button>}
            </div>
            {!n.logo && <small>{t('negocio.logoAuto')}</small>}
          </div>
          <Campo id="ng-nome" rotulo={t('negocio.nome')} value={n.nome} onChange={m('nome')} />
          <Campo id="ng-doc" rotulo={`${reg.rotuloDocumento} (${t('comum.opcional')})`} value={n.documento} onChange={m('documento')} />
          <Campo id="ng-tel" rotulo={t('negocio.telefone')} type="tel" value={n.telefone} onChange={m('telefone')} />
          <Campo id="ng-email" rotulo={t('negocio.email')} type="email" value={n.email} onChange={m('email')} />
          <Campo id="ng-end" rotulo={t('negocio.endereco')} value={n.endereco} onChange={m('endereco')} />
          <div className="campo">
            <label>{t('negocio.cor')}</label>
            <div className="chips">
              {CORES.map((c) => (
                <button key={c} aria-label={c} onClick={() => setN({ ...n, cor: c })} style={{ width: 40, height: 40, borderRadius: 12, border: n.cor === c ? '3px solid var(--texto)' : '0', background: c }} />
              ))}
            </div>
          </div>
        </section>

        <section className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>{t('negocio.pagamento')}</h2>
          {reg.pagamentos.includes('pix') && (
            <div className="linha2">
              <Campo id="ng-pix" rotulo={t('negocio.pixChave')} value={n.pagamento.pixChave} onChange={mp('pixChave')} />
              <Campo id="ng-pixcid" rotulo={t('negocio.pixCidade')} value={n.pagamento.pixCidade} onChange={mp('pixCidade')} />
            </div>
          )}
          <Campo id="ng-link" rotulo={t('negocio.link')} ajuda={t('negocio.linkAjuda')} type="url" inputMode="url" value={n.pagamento.link} onChange={mp('link')} />
          <CampoTexto id="ng-banco" rotulo={t('negocio.banco')} ajuda={t('negocio.bancoAjuda')} value={n.pagamento.banco} onChange={mp('banco')} />
        </section>

        <section className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Campo id="ng-val" rotulo={t('negocio.validade')} type="number" inputMode="numeric" value={String(n.validadePadraoDias)} onChange={(e) => setN({ ...n, validadePadraoDias: Math.max(1, Number(e.target.value) || 15) })} />
          <CampoTexto id="ng-obs" rotulo={t('negocio.observacaoPadrao')} placeholder={t('doc.observacoesDica')} value={n.observacaoPadrao} onChange={m('observacaoPadrao')} />
        </section>

        <button className="botao" onClick={salvar}>{t('comum.salvar')}</button>
      </main>
    </>
  );
}
