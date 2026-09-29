import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './BotaoPrincipal.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Mostra a seta "→" depois do texto. */
  comSeta?: boolean;
};

export function BotaoPrincipal({ children, comSeta = false, className = '', type = 'button', ...resto }: Props) {
  return (
    <button type={type} className={`botao-principal ${className}`.trim()} {...resto}>
      <span>{children}</span>
      {comSeta && (
        <svg className="botao-principal__seta" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 12h15M13 5.5 19.5 12 13 18.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
