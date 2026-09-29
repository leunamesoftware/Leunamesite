import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './BotaoIcone.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Nome da ação, lido pelos leitores de tela. */
  rotulo: string;
  children: ReactNode;
  /** 'moldura' = quadrado com borda; 'simples' = só o ícone. */
  estilo?: 'moldura' | 'simples';
};

export function BotaoIcone({ rotulo, children, estilo = 'moldura', className = '', type = 'button', ...resto }: Props) {
  return (
    <button type={type} className={`botao-icone botao-icone--${estilo} ${className}`.trim()} aria-label={rotulo} title={rotulo} {...resto}>
      {children}
    </button>
  );
}
