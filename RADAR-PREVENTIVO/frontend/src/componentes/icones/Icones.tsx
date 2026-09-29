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
