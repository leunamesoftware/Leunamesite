import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconeSeta } from '../icones/Icones';
import './BotaoPrincipal.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** 'cheio' = azul luminoso; 'contorno' = borda ciano sobre o fundo escuro. */
  variante?: 'cheio' | 'contorno';
  /** Seta "→" logo depois do texto ou encostada na borda direita; ou seta "←" antes do texto. */
  seta?: 'junto' | 'borda' | 'voltar' | false;
};

export function BotaoPrincipal({
  children,
  variante = 'cheio',
  seta = false,
  className = '',
  type = 'button',
  ...resto
}: Props) {
  const classes = ['botao-principal', `botao-principal--${variante}`, seta === 'borda' ? 'botao-principal--seta-borda' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...resto}>
      {seta === 'voltar' && <IconeSeta className="botao-principal__seta botao-principal__seta--voltar" />}
      <span className="botao-principal__texto">{children}</span>
      {(seta === 'junto' || seta === 'borda') && <IconeSeta className="botao-principal__seta" />}
    </button>
  );
}
