import { useEffect, useState } from 'react';
import './BannerInstalar.css';

// Quando o Radar é aberto pelo navegador (ou por um atalho antigo, sem o ícone
// oficial) e o celular permite instalar, mostra um aviso para instalar o app com
// o ícone e a abertura certos. Some sozinho quando já está instalado.

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const CHAVE_DISPENSADO = 'radar-preventivo.instalar-dispensado';

function dispensadoAntes(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) === '1';
  } catch {
    return false;
  }
}

export function BannerInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [instalado, setInstalado] = useState(false);

  useEffect(() => {
    const aoPoderInstalar = (e: Event) => {
      e.preventDefault();
      if (!dispensadoAntes()) setEvento(e as EventoInstalar);
    };
    const aoInstalar = () => {
      setInstalado(true);
      setEvento(null);
    };
    window.addEventListener('beforeinstallprompt', aoPoderInstalar);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  if (instalado) {
    return (
      <div className="banner-instalar" role="status">
        <p className="banner-instalar__texto">
          Pronto! O Radar foi instalado com o ícone novo. Se ainda houver um atalho antigo (de fundo branco) na tela inicial, pode apagá-lo.
        </p>
      </div>
    );
  }
  if (!evento) return null;

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice.catch(() => undefined);
    setEvento(null);
  }

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, '1');
    } catch {
      // sem armazenamento: só esconde agora
    }
    setEvento(null);
  }

  return (
    <div className="banner-instalar" role="region" aria-label="Instalar o aplicativo">
      <img className="banner-instalar__icone" src="/icone-192.png" alt="" width="44" height="44" />
      <p className="banner-instalar__texto">Instale o Radar no celular com o ícone oficial e abertura sem fundo branco.</p>
      <div className="banner-instalar__acoes">
        <button type="button" className="banner-instalar__botao" onClick={() => void instalar()}>
          Instalar
        </button>
        <button type="button" className="banner-instalar__agora-nao" onClick={dispensar}>
          Agora não
        </button>
      </div>
    </div>
  );
}
