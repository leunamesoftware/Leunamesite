/** Relógio injetável: nos testes dá para "viajar no tempo" sem mexer no sistema. */
export interface Relogio {
  agora(): Date;
}

export const relogioDoSistema: Relogio = { agora: () => new Date() };

/** Data de hoje (AAAA-MM-DD) no fuso informado. */
export function dataLocal(instante: Date, fuso: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante);
  const pegar = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`;
}

/** Hora (0–23) no fuso informado. */
export function horaLocal(instante: Date, fuso: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: fuso, hour: '2-digit', hourCycle: 'h23' }).format(instante));
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Confere se é uma data de calendário válida no formato AAAA-MM-DD. */
export function dataValida(data: string): boolean {
  if (!RE_DATA.test(data)) return false;
  const d = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

/** Diferença em dias de calendário: positivo se `ate` é depois de `de`. */
export function diferencaDias(de: string, ate: string): number {
  const a = Date.parse(`${de}T00:00:00Z`);
  const b = Date.parse(`${ate}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
