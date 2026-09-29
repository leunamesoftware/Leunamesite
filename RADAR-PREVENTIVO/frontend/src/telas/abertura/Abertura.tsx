import { useNavigate } from 'react-router-dom';
import { SimboloRadar } from '../../componentes/marca/SimboloRadar';
import { NomeRadar } from '../../componentes/marca/NomeRadar';
import { AneisRadar } from '../../componentes/fundo/AneisRadar';
import { GloboConectado } from '../../componentes/fundo/GloboConectado';
import { BotaoPrincipal } from '../../componentes/botoes/BotaoPrincipal';
import { rotas } from '../../rotas';
import './Abertura.css';

// Interface 1 — Abertura. Recriada a partir da referência visual oficial.
export function Abertura() {
  const navegar = useNavigate();

  return (
    <main className="abertura">
      <section className="abertura__marca">
        <div className="abertura__emblema">
          <AneisRadar className="abertura__aneis" />
          <SimboloRadar className="abertura__simbolo" rotulo="" />
        </div>

        <NomeRadar como="h1" className="abertura__nome" />

        <span className="abertura__divisor" aria-hidden="true" />

        <p className="abertura__slogan">
          Protege seu hoje.
          <br />
          Evita problemas amanhã.
        </p>
      </section>

      <div className="abertura__globo">
        <GloboConectado className="abertura__globo-tela" />
        <BotaoPrincipal seta="junto" className="abertura__comecar" onClick={() => navegar(rotas.entrar)}>
          Começar
        </BotaoPrincipal>
      </div>
    </main>
  );
}
