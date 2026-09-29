import './Contador.css';

/** Bolinha vermelha com um número (ex.: alertas não lidos). Some quando é zero. */
export function Contador({ valor, rotulo }: { valor: number; rotulo: string }) {
  if (valor <= 0) return null;
  return (
    <span className="contador" aria-label={`${valor} ${rotulo}`}>
      {valor > 99 ? '99+' : valor}
    </span>
  );
}
