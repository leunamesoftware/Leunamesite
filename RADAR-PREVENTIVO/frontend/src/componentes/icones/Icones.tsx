// Ícones de traço usados nas telas. Herdam a cor do texto (currentColor).

type Props = { className?: string };

function Base({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconeEnvelope(p: Props) {
  return (
    <Base {...p}>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2.2" />
      <path d="m3.5 6.2 8.5 6.6 8.5-6.6" />
    </Base>
  );
}

export function IconeCadeado(p: Props) {
  return (
    <Base {...p}>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.6v2.4" />
      <circle cx="12" cy="14.3" r="0.6" fill="currentColor" />
    </Base>
  );
}

export function IconeOlho(p: Props) {
  return (
    <Base {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Base>
  );
}

export function IconeOlhoRiscado(p: Props) {
  return (
    <Base {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </Base>
  );
}

export function IconeSeta(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 12h15M13 5.5 19.5 12 13 18.5" strokeWidth="2.2" />
    </Base>
  );
}

export function IconeAlerta(p: Props) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.3" r="0.7" fill="currentColor" />
    </Base>
  );
}

export function IconePessoa(p: Props) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.8-3.8 3.9-6 7.5-6s6.7 2.2 7.5 6Z" />
    </Base>
  );
}

export function IconeMenu(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" strokeWidth="2" />
    </Base>
  );
}

export function IconeSino(p: Props) {
  return (
    <Base {...p}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </Base>
  );
}

export function IconeRadar(p: Props) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="m12 12 6.2-6.2" />
    </Base>
  );
}

export function IconeDocumento(p: Props) {
  return (
    <Base {...p}>
      <path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4.5h4.5M8.5 12.5h7M8.5 16h7" />
    </Base>
  );
}

export function IconeCalendario(p: Props) {
  return (
    <Base {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h2.5M13.5 13.5H16M8 17h2.5" />
    </Base>
  );
}

export function IconeMais(p: Props) {
  return (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" strokeWidth="2.2" />
    </Base>
  );
}

export function IconeChevron(p: Props) {
  return (
    <Base {...p}>
      <path d="m9 5.5 6.5 6.5L9 18.5" strokeWidth="2" />
    </Base>
  );
}

export function IconeLupa(p: Props) {
  return (
    <Base {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" strokeWidth="2" />
    </Base>
  );
}

export function IconeFiltros(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      <circle cx="15" cy="6.5" r="2" fill="var(--fundo, #020a1c)" />
      <circle cx="9" cy="12" r="2" fill="var(--fundo, #020a1c)" />
      <circle cx="14" cy="17.5" r="2" fill="var(--fundo, #020a1c)" />
    </Base>
  );
}

export function IconeExclamacao(p: Props) {
  return (
    <Base {...p}>
      <path d="M12 6.5v7" strokeWidth="2.6" />
      <circle cx="12" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconeRelogio(p: Props) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeWidth="2" />
    </Base>
  );
}

export function IconeTriangulo(p: Props) {
  return (
    <Base {...p}>
      <path d="M12 4 21 19.5H3Z" />
      <path d="M12 10v4.5" strokeWidth="2" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconeCheck(p: Props) {
  return (
    <Base {...p}>
      <path d="m5.5 12.5 4 4 9-9" strokeWidth="2.6" />
    </Base>
  );
}

export function IconePasta(p: Props) {
  return (
    <Base {...p}>
      <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8.3A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z" />
      <path d="M3.5 10.5h17" />
    </Base>
  );
}

export function IconeFechar(p: Props) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" />
    </Base>
  );
}

export function IconeSair(p: Props) {
  return (
    <Base {...p}>
      <path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" />
      <path d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" />
    </Base>
  );
}

export function IconeVoltar(p: Props) {
  return (
    <Base {...p}>
      <path d="M20 12H5M11 5.5 4.5 12l6.5 6.5" strokeWidth="2.2" />
    </Base>
  );
}

export function IconeNota(p: Props) {
  return (
    <Base {...p}>
      <path d="M5 4h14a1 1 0 0 1 1 1v9.5L14.5 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M14.5 20v-4.5a1 1 0 0 1 1-1H20M8 8.5h8M8 12h5" />
    </Base>
  );
}

export function IconeClipe(p: Props) {
  return (
    <Base {...p}>
      <path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l8.3-8.3a3.4 3.4 0 0 1 4.8 4.8l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6" />
    </Base>
  );
}

export function IconeNuvemEnvio(p: Props) {
  return (
    <Base {...p}>
      <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 10H16" />
      <path d="M12 21v-8.5M8.8 15.5 12 12.3l3.2 3.2" />
    </Base>
  );
}

export function IconeSalvarDocumento(p: Props) {
  return (
    <Base {...p}>
      <path d="M13 21H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8l4.5 4.5V12" />
      <path d="M14 3v4.5h4.5M8.5 12h6M8.5 15.5H12M18 15v6M15 18h6" />
    </Base>
  );
}

export function IconeLapis(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 20l1-4.5L15.8 4.7a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19Z" />
      <path d="M14 6.5l3.5 3.5" />
    </Base>
  );
}

export function IconeLixeira(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5l.9 13a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-13M10 10.5v6.5M14 10.5v6.5" />
    </Base>
  );
}

export function IconeTresPontos(p: Props) {
  return (
    <Base {...p}>
      <circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconeComentario(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 5.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4H5.5A1.5 1.5 0 0 1 4 14.5Z" />
    </Base>
  );
}
