import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { SessaoCriada, Usuario } from '@compartilhado/contratos';
import { chamarApi, ErroApi } from '../servicos/api';
import { lerSessao, limparSessao, salvarSessao } from './sessao';
import { rotas } from '../rotas';

type ValorSessao = {
  sessao: SessaoCriada | null;
  /** Guarda a sessão recém-criada (login ou cadastro). */
  iniciar: (sessao: SessaoCriada) => void;
  /** Atualiza os dados da pessoa guardados na sessão (ex.: depois de editar o nome). */
  atualizarUsuario: (usuario: Usuario) => void;
  /** Sai da conta: encerra a sessão no servidor e apaga a cópia do aparelho. */
  sair: () => Promise<void>;
  /** Chamada à API já com a credencial; se a sessão expirou, volta para o login. */
  api: <T>(caminho: string, opcoes?: Omit<Parameters<typeof chamarApi>[1], 'token'>) => Promise<T>;
};

const Contexto = createContext<ValorSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<SessaoCriada | null>(() => lerSessao());
  // Sem sessão: tenta entrar com a conta da loja LeuApps (mesmo login de todos os apps) antes de mostrar o login.
  const [conferindoLoja, setConferindoLoja] = useState(() => !lerSessao());
  useEffect(() => {
    if (!conferindoLoja) return;
    let ativo = true;
    const limite = setTimeout(() => ativo && setConferindoLoja(false), 4000);
    chamarApi<SessaoCriada>('/auth/leuapps', { metodo: 'POST' })
      .then((nova) => { if (ativo) { salvarSessao(nova); setSessao(nova); } })
      .catch(() => undefined)
      .finally(() => { clearTimeout(limite); if (ativo) setConferindoLoja(false); });
    return () => { ativo = false; };
  }, [conferindoLoja]);

  const iniciar = useCallback((nova: SessaoCriada) => {
    salvarSessao(nova);
    setSessao(nova);
  }, []);

  const atualizarUsuario = useCallback((usuario: Usuario) => {
    setSessao((atual) => {
      if (!atual) return atual;
      const nova = { ...atual, usuario };
      salvarSessao(nova);
      return nova;
    });
  }, []);

  const expirar = useCallback(() => {
    limparSessao();
    setSessao(null);
  }, []);

  const sair = useCallback(async () => {
    const token = sessao?.token;
    expirar();
    if (token) await chamarApi('/auth/sair', { metodo: 'POST', token }).catch(() => undefined);
  }, [sessao, expirar]);

  const api = useCallback<ValorSessao['api']>(
    async (caminho, opcoes) => {
      try {
        return await chamarApi(caminho, { ...opcoes, token: sessao?.token });
      } catch (erro) {
        if (erro instanceof ErroApi && erro.codigo === 'nao_autenticado') expirar();
        throw erro;
      }
    },
    [sessao, expirar],
  );

  const valor = useMemo(() => ({ sessao, iniciar, atualizarUsuario, sair, api }), [sessao, iniciar, atualizarUsuario, sair, api]);
  if (conferindoLoja) return <div className="abertura-inicial"><img src="/simbolo.svg" alt="Radar Preventivo" /></div>;
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ValorSessao {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.');
  return valor;
}

/** Só mostra a tela para quem está logado; os demais vão para o login. */
export function RotaProtegida({ children }: { children: ReactNode }) {
  const { sessao } = useSessao();
  const local = useLocation();
  if (!sessao) return <Navigate to={rotas.entrar} replace state={{ de: local.pathname }} />;
  return <>{children}</>;
}

/** Telas de entrada (login e cadastro): quem já está logado vai direto para o Radar. */
export function RotaPublica({ children }: { children: ReactNode }) {
  const { sessao } = useSessao();
  if (sessao) return <Navigate to={rotas.radar} replace />;
  return <>{children}</>;
}
