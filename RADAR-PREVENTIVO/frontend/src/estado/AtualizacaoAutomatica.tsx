import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Atualização automática: quando sai uma versão nova do Radar, o app se recarrega sozinho,
// sem precisar baixar nada de novo. Confere ao voltar para o app e a cada 10 minutos.
// Nunca recarrega no meio de um formulário: espera a pessoa sair da tela.
// Antes de recarregar, apaga a cópia da página guardada no celular (sw.js), para a
// próxima abertura já vir com a versão nova.

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

async function recarregarComVersaoNova() {
  // Trava: no máximo uma recarga por minuto (evita repetir se a internet entregar algo fora de ordem).
  try {
    const ultima = Number(sessionStorage.getItem('radar-preventivo.recarregou') ?? 0);
    if (Date.now() - ultima < 60_000) return;
    sessionStorage.setItem('radar-preventivo.recarregou', String(Date.now()));
  } catch {
    // sem sessionStorage: segue
  }
  try {
    const cache = await caches.open('radar-app-v1');
    await cache.delete('/index.html');
  } catch {
    // sem cache (navegador antigo ou modo privado): só recarrega
  }
  window.location.reload();
}

export function AtualizacaoAutomatica() {
  const { pathname } = useLocation();
  const caminho = useRef(pathname);
  const pendente = useRef(false);

  // Versão nova encontrada numa tela com formulário: recarrega assim que a pessoa mudar de tela.
  useEffect(() => {
    caminho.current = pathname;
    if (pendente.current) void recarregarComVersaoNova();
  }, [pathname]);

  useEffect(() => {
    async function conferir() {
      if (document.visibilityState !== 'visible' || pendente.current) return;
      if (!(await haVersaoNova())) return;
      if (TELAS_COM_FORMULARIO.some((t) => t.test(caminho.current))) pendente.current = true;
      else await recarregarComVersaoNova();
    }
    // Confere logo ao abrir: com o app guardado no celular, ele pode ter aberto a versão anterior.
    void conferir();
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
