import './NomeRadar.css';

// Nome oficial em duas linhas: RADAR (branco) e PREVENTIVO (ciano).
// O tamanho vem do font-size de quem usa (a palavra RADAR ocupa 1em).

type Props = {
  className?: string;
  /** Use 'h1' quando o nome for o título da tela. */
  como?: 'h1' | 'p';
};

export function NomeRadar({ className = '', como: Tag = 'p' }: Props) {
  return (
    <Tag className={`nome-radar ${className}`.trim()} aria-label="Radar Preventivo">
      <span className="nome-radar__radar" aria-hidden="true">
        RADAR
      </span>
      <span className="nome-radar__preventivo" aria-hidden="true">
        PREVENTIVO
      </span>
    </Tag>
  );
}
