import { useEffect, useMemo, useState } from 'react';
import { agora, clientes as repoClientes, documentos, itens as repoItens, novoId } from '../dados/banco';
import { documentoVazio, garantirCliente, salvarDocumento } from '../dominio/acoes';
import { paraCentavos, subtotal, total } from '../dominio/calculos';
import type { Cliente, Documento, Item, LinhaDocumento } from '../dominio/tipos';
import { useEstado } from '../estado';
import { dinheiro, t, useIdioma } from '../i18n';
import { Campo, CampoTexto, Modal, Topo } from '../componentes/base';

function centavosParaTexto(c: number): string {
  return c ? (c / 100).toFixed(2).replace('.', ',') : '';
}

export function Editor({ id, tipo = 'orcamento' }: { id?: string; tipo?: 'orcamento' | 'fatura' }) {
  useIdioma();
  const { negocio, ir, voltar, aviso } = useEstado();
  const [doc, setDoc] = useState<Documento | null>(null);
  const [catalogo, setCatalogo] = useState<Item[]>([]);
  const [lista, setLista] = useState<Cliente[]>([]);
  const [escolhendoCliente, setEscolhendoCliente] = useState(false);
  const [novoItem, setNovoItem] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!negocio) return;
    void (async () => {
      setCatalogo(await repoItens.listar());
      setLista(await repoClientes.listar());
      setDoc(id ? (await documentos.obter(id)) ?? null : documentoVazio(tipo, negocio));
    })();
  }, [id, tipo, negocio]);

  const moeda = doc?.moeda ?? negocio?.moeda ?? 'USD';
  const noDoc = useMemo(() => new Set(doc?.linhas.map((l) => l.itemId)), [doc]);
  if (!doc || !negocio) return null;

  const atualizar = (parcial: Partial<Documento>) => setDoc({ ...doc, ...parcial });
  const mudarLinha = (i: number, parcial: Partial<LinhaDocumento>) =>
    atualizar({ linhas: doc.linhas.map((l, k) => (k === i ? { ...l, ...parcial } : l)) });

  function alternarItem(item: Item) {
    if (noDoc.has(item.id)) {
      atualizar({ linhas: doc!.linhas.filter((l) => l.itemId !== item.id) });
    } else {
      atualizar({ linhas: [...doc!.linhas, { itemId: item.id, nome: item.nome, unidade: item.unidade, quantidade: 1, precoUnitario: item.preco }] });
    }
  }

  function escolherCliente(c: Cliente | null, nome?: string) {
    if (c) atualizar({ clienteId: c.id, cliente: { nome: c.nome, telefone: c.telefone, email: c.email, documento: c.documento, endereco: c.endereco } });
    else atualizar({ clienteId: null, cliente: { nome: nome ?? '', telefone: '', email: '', documento: '', endereco: '' } });
    setEscolhendoCliente(false);
  }

  async function salvar(enviar: boolean) {
    if (!doc!.cliente.nome.trim()) return aviso(t('doc.semCliente'));
    if (!doc!.linhas.length) return aviso(t('doc.semItens'));
    setSalvando(true);
    try {
      const comCliente = await garantirCliente(doc!);
      const salvo = await salvarDocumento(comCliente);
      voltar();
      ir({ nome: 'documento', id: salvo.id, enviar });
    } finally {
      setSalvando(false);
    }
  }

  const tituloTipo = t('tipo.' + doc.tipo).toLowerCase();
  return (
    <>
      <Topo titulo={id ? t('comum.editar') : t('doc.novo', { tipo: tituloTipo })} voltar />
      <main className="conteudo">
        <section className="cartao">
          <h2>{t('doc.cliente')}</h2>
          <button className="botao secundario" onClick={() => setEscolhendoCliente(true)} style={{ justifyContent: 'flex-start' }}>
            {doc.cliente.nome ? `👤 ${doc.cliente.nome}` : `＋ ${t('doc.escolherCliente')}`}
          </button>
        </section>

        <section className="cartao">
          <h2>{t('doc.itens')}</h2>
          <div className="chips" aria-label={t('doc.toqueParaAdicionar')}>
            {catalogo.map((it) => (
              <button key={it.id} className={'chip' + (noDoc.has(it.id) ? ' ativo' : '')} onClick={() => alternarItem(it)}>
                {noDoc.has(it.id) ? '✓ ' : ''}{it.nome}
                <span className="preco">{dinheiro(it.preco, moeda)}</span>
              </button>
            ))}
            <button className="chip" onClick={() => setNovoItem(true)}>＋ {t('doc.outroItem')}</button>
          </div>

          {doc.linhas.map((l, i) => (
            <div className="linha-doc" key={l.itemId ?? `${l.nome}-${i}`}>
              <div className="nome">{l.nome}</div>
              <div style={{ fontWeight: 800 }}>{dinheiro(Math.round(l.quantidade * l.precoUnitario), moeda)}</div>
              <div className="controles">
                <div className="qtd">
                  <button aria-label="-" onClick={() => mudarLinha(i, { quantidade: Math.max(0.5, l.quantidade - 1) })}>−</button>
                  <input
                    id={`qtd-${i}`}
                    inputMode="decimal"
                    aria-label={t('doc.quantidade')}
                    value={String(l.quantidade).replace('.', ',')}
                    onChange={(e) => mudarLinha(i, { quantidade: Number(e.target.value.replace(',', '.')) || 0 })}
                  />
                  <button aria-label="+" onClick={() => mudarLinha(i, { quantidade: l.quantidade + 1 })}>＋</button>
                </div>
                <input
                  id={`preco-${i}`}
                  className="entrada preco-linha"
                  inputMode="decimal"
                  aria-label={t('doc.preco')}
                  defaultValue={centavosParaTexto(l.precoUnitario)}
                  onBlur={(e) => mudarLinha(i, { precoUnitario: paraCentavos(e.target.value) })}
                />
                <button className="icone-botao" aria-label={t('comum.excluir')} onClick={() => atualizar({ linhas: doc.linhas.filter((_, k) => k !== i) })}>✕</button>
              </div>
            </div>
          ))}

          <div className="linha2" style={{ marginTop: 12 }}>
            <Campo id="desconto" rotulo={t('doc.desconto')} inputMode="decimal" defaultValue={centavosParaTexto(doc.desconto)} onBlur={(e) => atualizar({ desconto: paraCentavos(e.target.value) })} />
            {doc.tipo === 'orcamento' ? (
              <Campo id="validade" type="date" rotulo={t('doc.validoAte')} value={doc.validoAte ?? ''} onChange={(e) => atualizar({ validoAte: e.target.value || null })} />
            ) : (
              <Campo id="vencimento" type="date" rotulo={t('doc.venceEm')} value={doc.venceEm ?? ''} onChange={(e) => atualizar({ venceEm: e.target.value || null })} />
            )}
          </div>

          <div className="totais" style={{ marginTop: 12 }}>
            {doc.desconto > 0 && <div>{t('doc.subtotal')}: {dinheiro(subtotal(doc.linhas), moeda)}</div>}
            <div className="grande">{t('doc.total')}: {dinheiro(total(doc), moeda)}</div>
          </div>
        </section>

        <section className="cartao">
          <CampoTexto id="obs" rotulo={t('doc.observacoes')} placeholder={t('doc.observacoesDica')} value={doc.observacoes} onChange={(e) => atualizar({ observacoes: e.target.value })} />
        </section>

        <div className="acoes">
          <button className="botao" disabled={salvando} onClick={() => salvar(true)}>{t('doc.salvarEnviar')}</button>
          <button className="botao secundario" disabled={salvando} onClick={() => salvar(false)}>{t('doc.salvarRascunho')}</button>
        </div>
      </main>

      {escolhendoCliente && (
        <SeletorCliente lista={lista} aoEscolher={escolherCliente} aoFechar={() => setEscolhendoCliente(false)} aoCriar={async (c) => { await repoClientes.salvar(c); setLista(await repoClientes.listar()); escolherCliente(c); }} />
      )}
      {novoItem && (
        <EditorItem
          aoFechar={() => setNovoItem(false)}
          aoSalvar={async (it) => {
            await repoItens.salvar(it);
            setCatalogo(await repoItens.listar());
            atualizar({ linhas: [...doc.linhas, { itemId: it.id, nome: it.nome, unidade: it.unidade, quantidade: 1, precoUnitario: it.preco }] });
            setNovoItem(false);
          }}
        />
      )}
    </>
  );
}

export function SeletorCliente({ lista, aoEscolher, aoFechar, aoCriar }: {
  lista: Cliente[];
  aoEscolher: (c: Cliente | null, nome?: string) => void;
  aoFechar: () => void;
  aoCriar: (c: Cliente) => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const q = busca.trim().toLowerCase();
  const filtrados = lista.filter((c) => !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q));

  if (criando) return <EditorCliente inicial={{ nome: busca }} aoFechar={aoFechar} aoSalvar={aoCriar} />;
  return (
    <Modal titulo={t('doc.escolherCliente')} aoFechar={aoFechar}>
      <input id="busca-cliente" className="entrada" autoFocus placeholder={t('comum.buscar')} value={busca} onChange={(e) => setBusca(e.target.value)} />
      <button className="botao" onClick={() => setCriando(true)}>＋ {t('doc.novoCliente')}</button>
      <div className="cartao">
        <div className="lista">
          {filtrados.map((c) => (
            <button key={c.id} className="item-lista" onClick={() => aoEscolher(c)}>
              <div className="principal">
                <div className="titulo">{c.nome}</div>
                <div className="sub">{c.telefone}</div>
              </div>
            </button>
          ))}
          {!filtrados.length && <div className="vazio">{t('clientes.vazio')}</div>}
        </div>
      </div>
    </Modal>
  );
}

export function EditorCliente({ inicial, aoFechar, aoSalvar }: { inicial?: Partial<Cliente>; aoFechar: () => void; aoSalvar: (c: Cliente) => Promise<void> }) {
  const [c, setC] = useState<Cliente>({
    id: novoId(), criadoEm: agora(), atualizadoEm: agora(), nome: '', telefone: '', email: '', documento: '', endereco: '', ...inicial,
  });
  const m = (k: keyof Cliente) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value });
  return (
    <Modal titulo={inicial?.id ? t('comum.editar') : t('clientes.novo')} aoFechar={aoFechar}>
      <Campo id="cli-nome" rotulo={t('clientes.nome')} value={c.nome} onChange={m('nome')} autoFocus />
      <Campo id="cli-tel" rotulo={t('clientes.telefone')} type="tel" inputMode="tel" value={c.telefone} onChange={m('telefone')} />
      <Campo id="cli-email" rotulo={`${t('clientes.email')} (${t('comum.opcional')})`} type="email" value={c.email} onChange={m('email')} />
      <Campo id="cli-doc" rotulo={`${t('clientes.documento')} (${t('comum.opcional')})`} value={c.documento} onChange={m('documento')} />
      <Campo id="cli-end" rotulo={`${t('clientes.endereco')} (${t('comum.opcional')})`} value={c.endereco} onChange={m('endereco')} />
      <button className="botao" disabled={!c.nome.trim()} onClick={() => aoSalvar({ ...c, nome: c.nome.trim() })}>{t('comum.salvar')}</button>
    </Modal>
  );
}

export const UNIDADES = ['un', 'h', 'dia', 'm2', 'm', 'servico', 'visita', 'kg'] as const;

export function EditorItem({ inicial, aoFechar, aoSalvar, aoExcluir }: { inicial?: Item; aoFechar: () => void; aoSalvar: (i: Item) => Promise<void>; aoExcluir?: () => Promise<void> }) {
  const [it, setIt] = useState<Item>(inicial ?? { id: novoId(), criadoEm: agora(), atualizadoEm: agora(), nome: '', unidade: 'servico', preco: 0 });
  const [preco, setPreco] = useState(centavosParaTexto(it.preco));
  return (
    <Modal titulo={inicial ? t('comum.editar') : t('itens.novo')} aoFechar={aoFechar}>
      <Campo id="it-nome" rotulo={t('itens.nome')} value={it.nome} onChange={(e) => setIt({ ...it, nome: e.target.value })} autoFocus />
      <div className="linha2">
        <Campo id="it-preco" rotulo={t('itens.preco')} inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
        <div className="campo">
          <label htmlFor="it-un">{t('itens.unidade')}</label>
          <select id="it-un" className="entrada" value={it.unidade} onChange={(e) => setIt({ ...it, unidade: e.target.value })}>
            {UNIDADES.map((u) => <option key={u} value={u}>{t('unidades.' + u)}</option>)}
          </select>
        </div>
      </div>
      <button className="botao" disabled={!it.nome.trim()} onClick={() => aoSalvar({ ...it, nome: it.nome.trim(), preco: paraCentavos(preco) })}>{t('comum.salvar')}</button>
      {aoExcluir && <button className="botao perigo" onClick={aoExcluir}>{t('comum.excluir')}</button>}
    </Modal>
  );
}
