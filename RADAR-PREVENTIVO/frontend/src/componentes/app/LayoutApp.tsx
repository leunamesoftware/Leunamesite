import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSessao } from '../../estado/SessaoContexto';
import { NavegacaoInferior } from './NavegacaoInferior';
import './LayoutApp.css';

// Estrutura das telas internas (depois do login): fundo, conteúdo e a barra de
// navegação inferior. Também mantém a contagem de alertas não lidos em dia.

const ContagemAlertas = createContext<{ naoLidos: number; atualizar: () => void }>({ naoLidos: 0, atualizar: () => {} });

export function useAlertasNaoLidos() {
  return useContext(ContagemAlertas);
}

export function LayoutApp({ children }: { children: ReactNode }) {
  const { api } = useSessao();
  const local = useLocation();
  const [naoLidos, setNaoLidos] = useState(0);

  const atualizar = useCallback(() => {
    api<{ naoLidos: number }>('/alertas/contagem')
      .then((r) => setNaoLidos(r.naoLidos))
      .catch(() => undefined);
  }, [api]);

  useEffect(atualizar, [atualizar, local.pathname]);

  return (
    <ContagemAlertas.Provider value={{ naoLidos, atualizar }}>
      <div className="app">
        <div className="app__conteudo">{children}</div>
        <NavegacaoInferior alertasNaoLidos={naoLidos} />
      </div>
    </ContagemAlertas.Provider>
  );
}
