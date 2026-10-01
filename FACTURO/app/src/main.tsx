import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos/app.css';

// Erros ficam registrados no log do aparelho (ajuda a corrigir bugs relatados).
window.addEventListener('error', (e) => console.error('ERRO', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('PROMESSA', String(e.reason?.stack ?? e.reason)));

createRoot(document.getElementById('raiz')!).render(<App />);
