import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Atualização automática: quando sai uma versão nova do Radar, o app se recarrega sozinho,
// sem precisar baixar nada de novo. Confere ao voltar para o app e a cada 10 minutos.
// Nunca recarrega no meio de um formulário: espera a pessoa sair da tela.

const INTERVALO = 10 * 60 * 1000;
const TELAS_COM_FORMULARIO = [/^\/entrar/, /^\/criar-conta/, /^\/itens\/novo/, /\/editar$/, /^\/conta/];

async function haVersaoNova(): Promise<boolean> {
  try {
    const r = await fetch('/versao.json', { cache: 'no-store' });
    if (!r.ok) return false;
    const { versao } = (await r.json()) as { versao?: string };
    return typeof versao === 'string' && versao !== __VERSAO__;
  } catch {
    return false; // sem internet ou em desenvolvimento: tenta de novo depois
  }
}

export function AtualizacaoAutomatica() {
  const { pathname } = useLocation();
  const caminho = useRef(pathname);
  const pendente = useRef(false);

  // Versão nova encontrada numa tela com formulário: recarrega assim que a pessoa mudar de tela.
  useEffect(() => {
    caminho.current = pathname;
    if (pendente.current) window.location.reload();
  }, [pathname]);

  useEffect(() => {
    async function conferir() {
      if (document.visibilityState !== 'visible' || pendente.current) return;
      if (!(await haVersaoNova())) return;
      if (TELAS_COM_FORMULARIO.some((t) => t.test(caminho.current))) pendente.current = true;
      else window.location.reload();
    }
    document.addEventListener('visibilitychange', conferir);
    window.addEventListener('focus', conferir);
    const timer = window.setInterval(conferir, INTERVALO);
    return () => {
      document.removeEventListener('visibilitychange', conferir);
      window.removeEventListener('focus', conferir);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
