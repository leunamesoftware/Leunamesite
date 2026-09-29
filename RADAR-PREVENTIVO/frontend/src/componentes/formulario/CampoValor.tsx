import { centavosParaTexto, textoParaCentavos } from '../../utilitarios/dinheiro';
import './CampoValor.css';

/**
 * Campo de dinheiro no jeito dos apps de banco: a pessoa digita só os números
 * e a vírgula anda sozinha (1 → 0,01; 1234 → 12,34).
 */
export function CampoValor({
  id,
  valor,
  aoMudar,
  className = '',
  invalido = false,
}: {
  id: string;
  valor: number | null;
  aoMudar: (centavos: number | null) => void;
  className?: string;
  invalido?: boolean;
}) {
  return (
    <span className={`campo-valor ${className}`}>
      <span className="campo-valor__moeda" aria-hidden="true">
        R$
      </span>
      <input
        id={id}
        className="campo-valor__entrada"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0,00"
        value={centavosParaTexto(valor)}
        onChange={(e) => aoMudar(textoParaCentavos(e.target.value))}
        aria-invalid={invalido ? true : undefined}
      />
    </span>
  );
}
