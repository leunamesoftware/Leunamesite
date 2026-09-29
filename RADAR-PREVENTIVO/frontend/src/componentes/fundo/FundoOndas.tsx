import { useId } from 'react';

// Ondas de luz azul nos cantos da tela (telas de acesso). Decorativo.
// Esticado para a tela toda; o traço não deforma (non-scaling-stroke).

export function FundoOndas({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (nome: string) => `${nome}-${id}`;

  const ondas: { d: string; preenchimento: string; borda: number }[] = [
    // canto superior esquerdo
    { d: 'M0 0 H300 C250 90 170 220 0 330 Z', preenchimento: u('forte'), borda: 0.55 },
    { d: 'M0 0 H150 C120 70 70 130 0 170 Z', preenchimento: u('suave'), borda: 0.3 },
    // lateral esquerda
    { d: 'M0 520 C90 610 120 760 60 930 C40 990 20 1020 0 1040 Z', preenchimento: u('suave'), borda: 0.18 },
    // canto inferior esquerdo
    { d: 'M0 1330 C140 1360 290 1440 380 1536 H0 Z', preenchimento: u('forte'), borda: 0.55 },
    // lateral direita
    { d: 'M1024 640 C930 700 880 820 900 940 C915 1030 970 1080 1024 1110 Z', preenchimento: u('suave'), borda: 0.22 },
    // canto inferior direito
    { d: 'M1024 1150 C960 1270 900 1400 850 1536 H1024 Z', preenchimento: u('forte'), borda: 0.6 },
  ];

  return (
    <svg className={className} viewBox="0 0 1024 1536" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={u('forte')} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0" stopColor="#1a5cff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0a2a8a" stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id={u('suave')} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0" stopColor="#1650e6" stopOpacity="0.22" />
          <stop offset="1" stopColor="#0a2a8a" stopOpacity="0.04" />
        </radialGradient>
        <filter id={u('brilho')} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="4" result="d" />
          <feMerge>
            <feMergeNode in="d" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {ondas.map((o, i) => (
        <path
          key={i}
          d={o.d}
          fill={`url(#${o.preenchimento})`}
          stroke={`rgba(70, 150, 255, ${o.borda})`}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          filter={`url(#${u('brilho')})`}
        />
      ))}
    </svg>
  );
}
