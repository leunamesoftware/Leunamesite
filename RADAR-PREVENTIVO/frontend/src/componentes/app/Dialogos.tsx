import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconeTresPontos } from '../icones/Icones';
import './Dialogos.css';

/** Janela de confirmação para ações que não têm volta (ex.: excluir). */
export function ConfirmarDialogo({
  aberto,
  titulo,
  texto,
  textoConfirmar,
  perigoso = false,
  ocupado = false,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean;
  titulo: string;
  texto: ReactNode;
  textoConfirmar: string;
  perigoso?: boolean;
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  const cancelar = useRef<HTMLButtonElement>(null);
  const aoCancelarAtual = useRef(aoCancelar);
  aoCancelarAtual.current = aoCancelar;

  // Foca "Cancelar" só ao abrir; não rouba o foco de campos dentro do diálogo a cada tecla.
  useEffect(() => {
    if (!aberto) return;
    cancelar.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoCancelarAtual.current();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  if (!aberto) return null;
  return (
    <div className="dialogo" role="presentation" onClick={aoCancelar}>
      <div
        className="dialogo__caixa"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        aria-describedby="dialogo-texto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialogo-titulo" className="dialogo__titulo">
          {titulo}
        </h2>
        <div id="dialogo-texto" className="dialogo__texto">
          {texto}
        </div>
        <div className="dialogo__acoes">
          <button ref={cancelar} type="button" className="dialogo__botao" onClick={aoCancelar} disabled={ocupado}>
            Cancelar
          </button>
          <button
            type="button"
            className={`dialogo__botao ${perigoso ? 'dialogo__botao--perigo' : 'dialogo__botao--principal'}`}
            onClick={aoConfirmar}
            disabled={ocupado}
          >
            {ocupado ? 'Aguarde…' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Botão ⋮ que abre uma lista curta de ações. */
export function MenuAcoes({
  rotulo,
  acoes,
  className = '',
}: {
  rotulo: string;
  acoes: { nome: string; aoEscolher: () => void; perigo?: boolean }[];
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  return (
    <div className={`menu-acoes ${className}`.trim()} ref={raiz}>
      <button
        type="button"
        className="menu-acoes__botao"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <IconeTresPontos />
      </button>
      {aberto && (
        <ul className="menu-acoes__lista" role="menu">
          {acoes.map((a) => (
            <li key={a.nome} role="none">
              <button
                type="button"
                role="menuitem"
                className={`menu-acoes__item ${a.perigo ? 'menu-acoes__item--perigo' : ''}`}
                onClick={() => {
                  setAberto(false);
                  a.aoEscolher();
                }}
              >
                {a.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
