import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AgendaItem } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { PeriodIcon } from '../../ui/classes';
import { dayLong, time } from '../../ui/format';
import { TeachLayout } from './TeachLayout';

/** Tela 18 — agenda: every live session of the next 60 days, grouped by day. */
export function TeachAgenda() {
  const { t, lang, fill } = useI18n();
  const [items, setItems] = useState<AgendaItem[] | null>(null);
  useEffect(() => { api.teacher.agenda().then(setItems, () => setItems([])); }, []);
  const days = new Map<string, AgendaItem[]>();
  for (const i of items ?? []) {
    const key = new Date(i.start).toDateString();
    days.set(key, [...(days.get(key) ?? []), i]);
  }
  return (
    <TeachLayout title={t.teach.agenda}>
      {items && !items.length && <div className="empty empty-light"><p>{t.teach.agendaEmpty}</p></div>}
      {[...days.values()].map((list) => (
        <section key={list[0]!.start} className="panel">
          <h2 className="cap">{dayLong(list[0]!.start, lang)}</h2>
          <ul className="agenda">
            {list.map((i) => (
              <li key={i.meetingId}>
                <PeriodIcon iso={i.start} size={20} />
                <div>
                  <strong>{time(i.start, lang)} – {time(i.end, lang)}</strong>
                  <Link to={`/teach/courses/${i.courseId}`}>{i.courseTitle}{i.label ? ` · ${i.label}` : ''}</Link>
                </div>
                <span className={`badge badge-${i.classStatus}`}>{t.teach.classStatus[i.classStatus]}</span>
                <span className="muted">{fill(t.teach.seatsTaken, { n: String(i.seatsTaken), cap: String(i.capacity) })}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </TeachLayout>
  );
}
