import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconeChevron } from '../icones/Icones';
import type { Tom } from '../../utilitarios/situacao';
import './Radar.css';

/** Cartão pequeno com o número de itens de uma situação (topo do painel). */
export function CartaoContador({
  valor,
  nome,
  tom,
  icone,
  para,
}: {
  valor: number;
  nome: string;
  tom: Tom;
  icone: ReactNode;
  para: string;
}) {
  return (
    <Link to={para} className={`cartao-contador tom-${tom}`} aria-label={`${valor} ${nome}`}>
      <span className="cartao-contador__topo">
        <span className="cartao-contador__valor">{valor}</span>
        <span className="cartao-contador__icone" aria-hidden="true">
          {icone}
        </span>
      </span>
      <span className="cartao-contador__rodape">
        <span className="cartao-contador__nome">{nome}</span>
        <IconeChevron className="cartao-contador__seta" />
      </span>
    </Link>
  );
}

/** Seção do painel com título, "Ver todos" e a lista. */
export function SecaoRadar({
  titulo,
  tom,
  verTodos,
  children,
}: {
  titulo: string;
  tom: Tom;
  verTodos?: string;
  children: ReactNode;
}) {
  return (
    <section className={`secao-radar tom-${tom}`}>
      <header className="secao-radar__topo">
        <h2 className="secao-radar__titulo">{titulo}</h2>
        {verTodos && (
          <Link to={verTodos} className="secao-radar__ver-todos">
            Ver todos
            <IconeChevron />
          </Link>
        )}
      </header>
      <div className="secao-radar__lista">{children}</div>
    </section>
  );
}
