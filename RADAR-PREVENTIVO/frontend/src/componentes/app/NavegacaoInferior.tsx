import { NavLink } from 'react-router-dom';
import { IconeDocumento, IconePessoa, IconeRadar, IconeSino } from '../icones/Icones';
import { Contador } from './Contador';
import { MarcaHorizontal } from '../marca/MarcaHorizontal';
import { rotas } from '../../rotas';
import './NavegacaoInferior.css';

const ITENS = [
  { para: rotas.radar, nome: 'Radar', Icone: IconeRadar },
  { para: rotas.documentos, nome: 'Documentos', Icone: IconeDocumento },
  { para: rotas.alertas, nome: 'Alertas', Icone: IconeSino },
  { para: rotas.conta, nome: 'Conta', Icone: IconePessoa },
] as const;

export function NavegacaoInferior({ alertasNaoLidos }: { alertasNaoLidos: number }) {
  return (
    <nav className="navegacao" aria-label="Navegação principal">
      <ul className="navegacao__lista">
        {/* Só no computador (menu lateral): a marca no topo do menu. */}
        <li className="navegacao__marca" aria-hidden="true"><MarcaHorizontal /></li>
        {ITENS.map(({ para, nome, Icone }) => (
          <li key={para}>
            <NavLink to={para} className={({ isActive }) => `navegacao__item ${isActive ? 'navegacao__item--ativo' : ''}`}>
              <span className="navegacao__icone">
                <Icone />
                {para === rotas.alertas && <Contador valor={alertasNaoLidos} rotulo="alertas não lidos" />}
              </span>
              <span className="navegacao__nome">{nome}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
