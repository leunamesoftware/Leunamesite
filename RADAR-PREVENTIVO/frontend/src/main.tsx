import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lexend-zetta/latin-700.css';
import '@fontsource/lexend-zetta/latin-800.css';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-600.css';
import './estilos/tokens.css';
import './estilos/global.css';
import { App } from './App';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado.');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
