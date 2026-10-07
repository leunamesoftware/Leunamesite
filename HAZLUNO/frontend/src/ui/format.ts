import type { LanguageCode } from '../../../shared/contracts';

export const LOCALE: Record<LanguageCode, string> = { es: 'es-ES', pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', it: 'it-IT', de: 'de-DE' };

/** Everything is shown in the viewer's own time zone and language. */
export const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function money(cents: number, currency: string, lang: LanguageCode) {
  return new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

export const dayLong = (iso: string, lang: LanguageCode) =>
  new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));

export const dayShort = (iso: string, lang: LanguageCode) =>
  new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

export const time = (iso: string, lang: LanguageCode) =>
  new Intl.DateTimeFormat(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const dateInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function minutesBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 60_000);
}

export function duration(minutes: number, lang: LanguageCode) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const unit = (v: number, u: 'hour' | 'minute') =>
    new Intl.NumberFormat(LOCALE[lang], { style: 'unit', unit: u, unitDisplay: 'long' }).format(v);
  return [h ? unit(h, 'hour') : '', m ? unit(m, 'minute') : ''].filter(Boolean).join(' ');
}

/** Morning / afternoon / night by the local hour of the first meeting. */
export function period(iso: string): 'morning' | 'afternoon' | 'night' {
  const h = new Date(iso).getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'night';
}

export const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}
