import { SimboloRadar } from './SimboloRadar';
import { NomeRadar } from './NomeRadar';
import './MarcaHorizontal.css';

/** Símbolo e nome lado a lado, para o topo das telas internas. */
export function MarcaHorizontal({ className = '' }: { className?: string }) {
  return (
    <div className={`marca-horizontal ${className}`.trim()}>
      <SimboloRadar className="marca-horizontal__simbolo" rotulo="" />
      <NomeRadar className="marca-horizontal__nome" />
    </div>
  );
}
