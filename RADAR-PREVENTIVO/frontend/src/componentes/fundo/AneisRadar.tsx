import { useId } from 'react';

// Anéis de radar (mira, escala e brilhos) que ficam atrás do símbolo na abertura.
// Puramente decorativo: escondido de leitores de tela.

function arco(raio: number, de: number, ate: number): string {
  const p = (g: number) => {
    const r = (g * Math.PI) / 180;
    return `${(raio * Math.cos(r)).toFixed(2)} ${(raio * Math.sin(r)).toFixed(2)}`;
  };
  const grande = ate - de > 180 ? 1 : 0;
  return `M${p(de)} A${raio} ${raio} 0 ${grande} 1 ${p(ate)}`;
}

const TRACOS = Array.from({ length: 180 }, (_, i) => i * 2);

export function AneisRadar({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (nome: string) => `${nome}-${id}`;

  return (
    <svg className={className} viewBox="-500 -500 1000 1000" aria-hidden="true">
      <defs>
        <linearGradient id={u('horizontal')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a8dff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#6cc8ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3a8dff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={u('vertical')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a8dff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#6cc8ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#3a8dff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={u('ponto')}>
          <stop offset="0" stopColor="#e6fbff" />
          <stop offset="0.25" stopColor="#6fd8ff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#1f7dff" stopOpacity="0" />
        </radialGradient>
        <filter id={u('brilho')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="d" />
          <feMerge>
            <feMergeNode in="d" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Círculos concêntricos */}
      <circle r="470" fill="none" stroke="#2b6fe0" strokeOpacity="0.35" strokeWidth="2" />
      <circle r="390" fill="none" stroke="#2b6fe0" strokeOpacity="0.28" strokeWidth="1.5" />
      <circle r="300" fill="none" stroke="#2b6fe0" strokeOpacity="0.2" strokeWidth="1.2" />
      <circle r="215" fill="none" stroke="#2b6fe0" strokeOpacity="0.14" strokeWidth="1" />

      {/* Escala girando devagar */}
      <g className="aneis-radar__escala">
        {TRACOS.map((g) => {
          const r = (g * Math.PI) / 180;
          const longo = g % 30 === 0;
          const a = longo ? 404 : 410;
          return (
            <line
              key={g}
              x1={(a * Math.cos(r)).toFixed(1)}
              y1={(a * Math.sin(r)).toFixed(1)}
              x2={(424 * Math.cos(r)).toFixed(1)}
              y2={(424 * Math.sin(r)).toFixed(1)}
              stroke="#4d9dff"
              strokeOpacity={longo ? 0.5 : 0.22}
              strokeWidth={longo ? 2 : 1.2}
            />
          );
        })}
      </g>

      {/* Mira */}
      <rect x="-500" y="-1" width="1000" height="2" fill={`url(#${u('horizontal')})`} />
      <rect x="-1" y="-500" width="2" height="1000" fill={`url(#${u('vertical')})`} />

      {/* Arcos em destaque no anel externo */}
      <path
        d={arco(470, 196, 268)}
        fill="none"
        stroke="#3fb8ff"
        strokeWidth="5"
        strokeLinecap="round"
        filter={`url(#${u('brilho')})`}
      />
      <path d={arco(470, 108, 150)} fill="none" stroke="#2f8cff" strokeOpacity="0.8" strokeWidth="3" />
      <path d={arco(470, 20, 52)} fill="none" stroke="#2f8cff" strokeOpacity="0.45" strokeWidth="2.5" />

      {/* Pontos de luz onde a mira cruza os anéis */}
      {[
        [0, -470, 26],
        [-390, 0, 20],
        [390, 0, 20],
        [0, -300, 14],
        [-300, 0, 12],
        [300, 0, 12],
      ].map(([x, y, r]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={r} fill={`url(#${u('ponto')})`} />
      ))}
    </svg>
  );
}
