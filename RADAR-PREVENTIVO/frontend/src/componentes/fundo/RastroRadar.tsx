import { useId } from 'react';

// Anéis e feixe de varredura que saem do radar do símbolo em direção ao canto
// superior direito (telas de acesso). Unidade: 100 = largura do símbolo.
// Deve ser posicionado com o centro no centro do radar do símbolo.

// Mesmo ângulo da linha de varredura do símbolo, para o feixe sair dela sem quebra.
const ANGULO_FEIXE = -30.5;

function ponto(r: number, grau: number): [number, number] {
  const a = (grau * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function arco(r: number, de: number, ate: number): string {
  const [x1, y1] = ponto(r, de);
  const [x2, y2] = ponto(r, ate);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${ate - de > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const TRACOS = Array.from({ length: 70 }, (_, i) => -95 + i * 2.6);

export function RastroRadar({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (nome: string) => `${nome}-${id}`;
  // Começa na borda externa da faixa luminosa do símbolo (raio 346 de 816).
  const [fx1, fy1] = ponto(42, ANGULO_FEIXE);
  const [fx2, fy2] = ponto(104, ANGULO_FEIXE);
  const [cx, cy] = ponto(122, 8);

  return (
    <svg className={className} viewBox="-150 -150 300 300" aria-hidden="true">
      <defs>
        {/* Os anéis somem para a esquerda, onde fica o R. */}
        <linearGradient id={u('mascara-grad')} x1="-150" y1="0" x2="150" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.5" />
        </linearGradient>
        <mask id={u('mascara')} maskUnits="userSpaceOnUse" x="-150" y="-150" width="300" height="300">
          <rect x="-150" y="-150" width="300" height="300" fill={`url(#${u('mascara-grad')})`} />
        </mask>
        <linearGradient id={u('feixe')} x1={fx1} y1={fy1} x2={fx2} y2={fy2} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e8fdff" />
          <stop offset="0.7" stopColor="#6fdcff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#2aa8ff" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id={u('clarao')}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor="#8fe8ff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#1f7dff" stopOpacity="0" />
        </radialGradient>
        <filter id={u('brilho')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="d" />
          <feMerge>
            <feMergeNode in="d" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g mask={`url(#${u('mascara')})`} fill="none">
        <path d={arco(72, -100, 95)} stroke="#2f86ff" strokeOpacity="0.55" strokeWidth="0.5" />
        <path d={arco(90, -100, 95)} stroke="#2f86ff" strokeOpacity="0.5" strokeWidth="0.5" />
        <path d={arco(108, -100, 95)} stroke="#2f86ff" strokeOpacity="0.45" strokeWidth="0.5" />
        <path d={arco(122, -95, 80)} stroke="#39a6ff" strokeOpacity="0.7" strokeWidth="1.1" filter={`url(#${u('brilho')})`} />
        <path d={arco(136, -100, 95)} stroke="#2f86ff" strokeOpacity="0.35" strokeWidth="0.5" />
        {TRACOS.map((g) => {
          const [x1, y1] = ponto(126, g);
          const [x2, y2] = ponto(129, g);
          return <line key={g} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4d9dff" strokeOpacity="0.5" strokeWidth="0.35" />;
        })}
        <line x1="0" y1="0" x2="150" y2="0" stroke="#3a8dff" strokeOpacity="0.35" strokeWidth="0.3" />
      </g>

      <line
        x1={fx1}
        y1={fy1}
        x2={fx2}
        y2={fy2}
        stroke={`url(#${u('feixe')})`}
        strokeWidth="0.9"
        strokeLinecap="round"
        filter={`url(#${u('brilho')})`}
      />
      <circle cx={fx2} cy={fy2} r="5" fill={`url(#${u('clarao')})`} />
      <circle cx={cx} cy={cy} r="4" fill={`url(#${u('clarao')})`} opacity="0.8" />
    </svg>
  );
}
