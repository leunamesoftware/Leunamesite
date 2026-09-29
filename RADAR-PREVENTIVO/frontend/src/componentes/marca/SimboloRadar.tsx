import { useId } from 'react';

// Símbolo oficial: a letra R com o radar integrado, redesenhado em vetor a partir do
// ícone oficial do app (o mesmo da Play Store). Fica nítido em qualquer tamanho.

type Props = {
  className?: string;
  /** Texto para leitores de tela. Deixe vazio quando o nome já aparece ao lado. */
  rotulo?: string;
};

// Centro do radar dentro do desenho da letra.
const CX = 410;
const CY = 338;

function ponto(raio: number, grau: number): string {
  const rad = (grau * Math.PI) / 180;
  return `${(CX + raio * Math.cos(rad)).toFixed(1)} ${(CY + raio * Math.sin(rad)).toFixed(1)}`;
}

// Partes brancas da letra R. A curva interna do topo acompanha o anel do radar.
const R_TOPO = `M0 0 H477 L${ponto(296, -80.4)} A296 296 0 0 0 ${ponto(296, 197.9)} H0 Z`;
const R_BASE = 'M0 352 H247 L632 768 H432 L195 515 H157 V768 H0 Z';

// Faixa luminosa que fecha a "barriga" do R.
const FAIXA = `M${ponto(346, -70.2)} A346 346 0 0 1 ${ponto(346, 60.2)} L${ponto(298, 64.2)} A298 298 0 0 0 ${ponto(298, -74.7)} Z`;

const ANGULO_VARREDURA = (-30.5 * Math.PI) / 180;
const PONTA_VARREDURA = [CX + 346 * Math.cos(ANGULO_VARREDURA), CY + 346 * Math.sin(ANGULO_VARREDURA)];

export function SimboloRadar({ className, rotulo = 'Radar Preventivo' }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (nome: string) => `${nome}-${id}`;

  return (
    <svg
      className={className}
      viewBox="-30 -30 816 828"
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo || undefined}
      aria-hidden={rotulo ? undefined : true}
    >
      <defs>
        <linearGradient id={u('branco')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#f2f7fe" />
          <stop offset="1" stopColor="#dce8f8" />
        </linearGradient>
        <linearGradient id={u('faixa')} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#5fd8ff" />
          <stop offset="0.45" stopColor="#8fe4ff" />
          <stop offset="1" stopColor="#1aa6f5" />
        </linearGradient>
        <radialGradient id={u('bojo')} cx={CX} cy={CY} r="300" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0b4fb8" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#062a73" stopOpacity="0.6" />
          <stop offset="1" stopColor="#020c2a" stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id={u('nucleo')} cx={CX} cy={CY} r="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#8ff0ff" />
          <stop offset="1" stopColor="#1fa8ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u('linha')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#bff6ff" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <filter id={u('brilho')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" result="desfoque" />
          <feMerge>
            <feMergeNode in="desfoque" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={u('sombra')} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="0" stdDeviation="14" floodColor="#2a9bff" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Radar: bojo escuro, mira, anéis, varredura e núcleo */}
      <circle cx={CX} cy={CY} r="298" fill={`url(#${u('bojo')})`} />
      <g stroke="#4fb6ff" strokeOpacity="0.35" strokeWidth="2">
        <line x1={CX} y1={CY - 290} x2={CX} y2={CY + 290} />
        <line x1={CX - 290} y1={CY} x2={CX + 290} y2={CY} />
      </g>
      {[
        [58, 0.55, 2],
        [100, 0.5, 2],
        [145, 0.45, 2],
        [188, 0.4, 2],
      ].map(([r, op, w]) => (
        <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="#3fc4ff" strokeOpacity={op} strokeWidth={w} />
      ))}
      <circle
        cx={CX}
        cy={CY}
        r="228"
        fill="none"
        stroke="#23c3ff"
        strokeWidth="7"
        filter={`url(#${u('brilho')})`}
      />

      {/* Faixa externa */}
      <path d={FAIXA} fill={`url(#${u('faixa')})`} filter={`url(#${u('brilho')})`} />

      <line
        x1={CX}
        y1={CY}
        x2={PONTA_VARREDURA[0]}
        y2={PONTA_VARREDURA[1]}
        stroke={`url(#${u('linha')})`}
        strokeWidth="5"
        strokeLinecap="round"
        filter={`url(#${u('brilho')})`}
      />
      <circle cx={CX} cy={CY} r="46" fill={`url(#${u('nucleo')})`} />
      <circle cx={CX} cy={CY} r="15" fill="#e9fdff" filter={`url(#${u('brilho')})`} />

      {/* Letra R: relevo azulado por baixo e face branca por cima */}
      <g transform="translate(3 9)" fill="#3d6fd6" opacity="0.85">
        <path d={R_TOPO} />
        <path d={R_BASE} />
      </g>
      <g fill={`url(#${u('branco')})`} filter={`url(#${u('sombra')})`}>
        <path d={R_TOPO} />
        <path d={R_BASE} />
      </g>
    </svg>
  );
}
