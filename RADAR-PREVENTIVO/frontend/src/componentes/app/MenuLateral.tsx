import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useSessao } from '../../estado/SessaoContexto';
import { IconeDocumento, IconeFechar, IconePessoa, IconeRadar, IconeSair, IconeSino } from '../icones/Icones';
import { rotas } from '../../rotas';
import './MenuLateral.css';

// Menu aberto pelo botão ☰ do topo: as mesmas áreas da barra inferior e o "Sair".

export function MenuLateral({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { sessao, sair } = useSessao();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    painel.current?.querySelector<HTMLElement>('a, button')?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      anterior?.focus();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  const links = [
    { para: rotas.radar, nome: 'Radar', Icone: IconeRadar },
    { para: rotas.documentos, nome: 'Documentos e prazos', Icone: IconeDocumento },
    { para: rotas.alertas, nome: 'Alertas', Icone: IconeSino },
    { para: rotas.conta, nome: 'Conta', Icone: IconePessoa },
  ];

  return (
    <div className="menu-lateral" role="presentation" onClick={aoFechar}>
      <div
        ref={painel}
        id="menu-lateral"
        className="menu-lateral__painel"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-lateral__topo">
          <div>
            <p className="menu-lateral__nome">{sessao?.usuario.nome}</p>
            <p className="menu-lateral__email">{sessao?.usuario.email}</p>
          </div>
          <button type="button" className="menu-lateral__fechar" onClick={aoFechar} aria-label="Fechar menu">
            <IconeFechar />
          </button>
        </div>
        <nav aria-label="Menu">
          <ul className="menu-lateral__lista">
            {links.map(({ para, nome, Icone }) => (
              <li key={para}>
                <NavLink to={para} className="menu-lateral__link" onClick={aoFechar}>
                  <Icone />
                  {nome}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="menu-lateral__link menu-lateral__sair" onClick={() => void sair()}>
          <IconeSair />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
