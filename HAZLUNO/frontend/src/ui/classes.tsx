import { Moon, Sun, Sunrise } from 'lucide-react';
import type { ClassSummary } from '../../../shared/contracts';
import { useI18n } from '../i18n';
import { dayLong, dayShort, duration, minutesBetween, period, sameDay, time } from './format';

export function PeriodIcon({ iso, size = 26 }: { iso: string; size?: number }) {
  const p = period(iso);
  const Icon = p === 'morning' ? Sun : p === 'afternoon' ? Sunrise : Moon;
  return <span className={`period period-${p}`} aria-hidden><Icon size={size} /></span>;
}

export function usePeriodLabel() {
  const { t } = useI18n();
  return (iso: string) => ({ morning: t.choose.morning, afternoon: t.choose.afternoon, night: t.choose.night })[period(iso)];
}

/** "miércoles, 15 de octubre" or "15 oct – 21 oct · 7 encuentros" for multi-day classes. */
export function useClassWhen() {
  const { t, lang, fill } = useI18n();
  return (k: Pick<ClassSummary, 'startsAt' | 'endsAt' | 'meetings'>) => {
    const n = k.meetings.length;
    if (n <= 1 || sameDay(k.startsAt, k.endsAt)) return dayLong(k.startsAt, lang);
    return `${dayShort(k.startsAt, lang)} – ${dayShort(k.endsAt, lang)} · ${fill(t.card.meetings, { n: String(n) })}`;
  };
}

/** "09:00 – 10:30 (1 hora 30 minutos)" of the first meeting. */
export function useMeetingTime() {
  const { lang } = useI18n();
  return (m: { start: string; end: string }) => ({
    range: `${time(m.start, lang)} – ${time(m.end, lang)}`,
    length: duration(minutesBetween(m.start, m.end), lang),
  });
}

/** Badge text for a class as the viewer sees it. */
export function useAccessLabel() {
  const { t, lang, fill } = useI18n();
  return (k: ClassSummary) => ({
    starts_on: fill(t.card.startsOn, { date: `${dayShort(k.startsAt, lang)} · ${time(k.startsAt, lang)}` }),
    full: t.card.full, closed: t.card.closed, live: t.card.live, in_progress: t.card.inProgress, finished: t.card.finished, canceled: t.card.canceled,
  })[k.access.badge];
}
