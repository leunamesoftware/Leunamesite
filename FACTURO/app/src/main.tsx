import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos/app.css';

// Erros ficam registrados no log do aparelho (ajuda a corrigir bugs relatados).
window.addEventListener('error', (e) => console.error('ERRO', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('PROMESSA', String(e.reason?.stack ?? e.reason)));

// Enquanto digita, esconde a barra de baixo e o botão flutuante (não ficam por cima do teclado).
const ehCampo = (el: EventTarget | null) => el instanceof HTMLElement && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select');
document.addEventListener('focusin', (e) => { if (ehCampo(e.target)) document.body.classList.add('digitando'); });
document.addEventListener('focusout', () => setTimeout(() => { if (!ehCampo(document.activeElement)) document.body.classList.remove('digitando'); }, 60));

createRoot(document.getElementById('raiz')!).render(<App />);
