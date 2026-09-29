import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lexend-zetta/latin-700.css';
import '@fontsource/lexend-zetta/latin-800.css';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-600.css';
import '@fontsource/nunito-sans/latin-700.css';
import '@fontsource/nunito-sans/latin-800.css';
import './estilos/tokens.css';
import './estilos/global.css';
import { App } from './App';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado.');

// Guarda o app no celular para abrir na hora (só na versão publicada).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
