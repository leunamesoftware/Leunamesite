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
