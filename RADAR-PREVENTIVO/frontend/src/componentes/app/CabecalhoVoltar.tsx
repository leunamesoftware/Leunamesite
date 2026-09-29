import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarcaHorizontal } from '../marca/MarcaHorizontal';
import { IconeVoltar } from '../icones/Icones';
import './CabecalhoVoltar.css';

/** Topo das telas de detalhe/cadastro: voltar à esquerda, marca no centro, ação opcional à direita. */
export function CabecalhoVoltar({ texto, direita, voltarPara }: { texto?: string; direita?: ReactNode; voltarPara?: string }) {
  const navegar = useNavigate();
  const voltar = () => {
    if (voltarPara) navegar(voltarPara);
    else if (window.history.length > 1) navegar(-1);
    else navegar('/radar');
  };
  return (
    <header className="cabecalho-voltar">
      <button type="button" className="cabecalho-voltar__botao" onClick={voltar} aria-label="Voltar">
        <IconeVoltar />
        {texto && <span>{texto}</span>}
      </button>
      <MarcaHorizontal className="cabecalho-voltar__marca" />
      <div className="cabecalho-voltar__direita">{direita}</div>
    </header>
  );
}
