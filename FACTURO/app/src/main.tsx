import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos/app.css';

// Diagnóstico temporário (teste no Android): registra toques e erros no log.
document.addEventListener('pointerdown', (e) => console.log('TOQUE', Math.round(e.clientX), Math.round(e.clientY), (e.target as HTMLElement)?.className, innerWidth, innerHeight), true);
document.addEventListener('click', (e) => console.log('CLIQUE', (e.target as HTMLElement)?.className), true);
window.addEventListener('error', (e) => console.log('ERRO', e.message));
window.addEventListener('unhandledrejection', (e) => console.log('PROMESSA', String(e.reason?.stack ?? e.reason)));

createRoot(document.getElementById('raiz')!).render(<App />);
