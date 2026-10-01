import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useEstado, type Tela } from '../estado';
import { t, useIdioma } from '../i18n';
import type { Documento } from '../dominio/tipos';
import { estaVencida } from '../dominio/calculos';

export function Topo({ titulo, voltar = false, direita }: { titulo: string; voltar?: boolean; direita?: ReactNode }) {
  const { voltar: fnVoltar } = useEstado();
  return (
    <header className="topo">
      {voltar && (
        <button className="icone-botao" aria-label={t('comum.voltar')} onClick={fnVoltar}>
          ←
        </button>
      )}
      <h1>{titulo}</h1>
      {direita}
    </header>
  );
}

export function BarraNav() {
  useIdioma();
  const { tela, ir } = useEstado();
  const itens: { tela: Tela; icone: string; rotulo: string }[] = [
    { tela: { nome: 'inicio' }, icone: '⌂', rotulo: t('nav.inicio') },
    { tela: { nome: 'documentos' }, icone: '☰', rotulo: t('nav.documentos') },
    { tela: { nome: 'clientes' }, icone: '☺', rotulo: t('nav.clientes') },
    { tela: { nome: 'mais' }, icone: '⋯', rotulo: t('nav.mais') },
  ];
  return (
    <div className="barra-nav">
      <nav>
        {itens.map((i) => (
          <button key={i.tela.nome} className={tela.nome === i.tela.nome ? 'ativo' : ''} onClick={() => ir(i.tela)}>
            <span className="i" aria-hidden>{i.icone}</span>
            {i.rotulo}
          </button>
        ))}
      </nav>
    </div>
  );
}

type PropsCampo = { rotulo: string; ajuda?: string; id: string } & InputHTMLAttributes<HTMLInputElement>;
export function Campo({ rotulo, ajuda, id, ...resto }: PropsCampo) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} className="entrada" {...resto} />
      {ajuda && <small>{ajuda}</small>}
    </div>
  );
}

type PropsTexto = { rotulo: string; ajuda?: string; id: string } & TextareaHTMLAttributes<HTMLTextAreaElement>;
export function CampoTexto({ rotulo, ajuda, id, ...resto }: PropsTexto) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <textarea id={id} className="entrada" {...resto} />
      {ajuda && <small>{ajuda}</small>}
    </div>
  );
}

export function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h2 style={{ flex: 1 }}>{titulo}</h2>
          <button className="icone-botao" aria-label={t('comum.fechar')} onClick={aoFechar}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Situação para mostrar ao usuário (inclui "vencido", que é calculado). */
export function situacao(doc: Documento): string {
  if (estaVencida(doc)) return 'vencido';
  if (doc.tipo === 'fatura' && (doc.status === 'enviado' || doc.status === 'rascunho')) return doc.status === 'enviado' ? 'aberto' : 'rascunho';
  return doc.status;
}

export function Selo({ doc }: { doc: Documento }) {
  const s = situacao(doc);
  return <span className={'selo ' + s}>{t('status.' + s)}</span>;
}

export function AvisoFlutuante() {
  const { avisoAtual } = useEstado();
  return avisoAtual ? <div className="aviso-flutuante" role="status">{avisoAtual}</div> : null;
}
