import { Link } from 'react-router-dom';
import { SimboloRadar } from '../../componentes/marca/SimboloRadar';
import { rotas } from '../../rotas';
import './TelaPendente.css';

// Marca o lugar de uma tela cuja referência visual ainda não foi entregue.
// Não é uma tela da V1: é substituída assim que a interface real for construída.
export function TelaPendente({ titulo }: { titulo: string }) {
  return (
    <main className="tela-pendente">
      <SimboloRadar className="tela-pendente__simbolo" rotulo="" />
      <p className="tela-pendente__rotulo">Próxima tela</p>
      <h1 className="tela-pendente__titulo">{titulo}</h1>
      <p className="tela-pendente__texto">
        Esta tela ainda não foi construída. Ela será feita a partir da referência visual dela.
      </p>
      <Link className="tela-pendente__voltar" to={rotas.abertura}>
        Voltar para o início
      </Link>
    </main>
  );
}
