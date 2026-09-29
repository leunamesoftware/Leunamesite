import type { ReactNode } from 'react';
import { IconeAlerta } from '../icones/Icones';
import './EstadoTela.css';

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="estado-tela" role="status">
      <span className="estado-tela__pulso" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function FalhaAoCarregar({ mensagem, aoTentarDeNovo }: { mensagem: string; aoTentarDeNovo: () => void }) {
  return (
    <div className="estado-tela estado-tela--erro" role="alert">
      <IconeAlerta className="estado-tela__icone" />
      <span>{mensagem}</span>
      <button type="button" className="estado-tela__acao" onClick={aoTentarDeNovo}>
        Tentar de novo
      </button>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="estado-tela estado-tela--vazio">{children}</p>;
}
