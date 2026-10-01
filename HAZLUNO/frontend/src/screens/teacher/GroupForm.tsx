import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { ClassSummary } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { errorText, fieldTexts } from '../../ui/errors';
import { dateInput, viewerTimeZone } from '../../ui/format';
import { Banner } from '../../ui/kit';

interface Row { date: string; start: string; end: string }
const MAX_SEATS = 25;

function tomorrowRow(): Row {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return { date: dateInput(d.toISOString()), start: '09:00', end: '10:30' };
}

/** Times are typed in the teacher's own time zone and sent as UTC. */
const toIso = (date: string, hhmm: string) => new Date(`${date}T${hhmm}`).toISOString();

export function GroupForm({ courseId, onCreated }: { courseId: string; onCreated(k: ClassSummary): void }) {
  const { t, fill } = useI18n();
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState(20);
  const [price, setPrice] = useState('20');
  const [rows, setRows] = useState<Row[]>([tomorrowRow()]);
  const [repeat, setRepeat] = useState(1);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyRepeat = (n: number) => {
    setRepeat(n);
    const first = rows[0]!;
    setRows(Array.from({ length: Math.max(1, Math.min(n, 60)) }, (_, i) => {
      const d = new Date(`${first.date}T12:00`);
      d.setDate(d.getDate() + i);
      return { ...first, date: dateInput(d.toISOString()) };
    }));
  };
  const setRow = (i: number, patch: Partial<Row>) => setRows((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFields({}); setError(null); setBusy(true);
    try {
      const cents = Math.round(Number(price.replace(',', '.')) * 100);
      const k = await api.teacher.createClass(courseId, {
        label: label.trim() || null, timezone: viewerTimeZone(), capacity, priceCents: Number.isFinite(cents) ? cents : -1,
        meetings: rows.map((r) => ({ start: toIso(r.date, r.start), end: toIso(r.date, r.end) })),
      });
      onCreated(k);
    } catch (err) {
      setError(errorText(t, err)); setFields(fieldTexts(t, err));
    } finally { setBusy(false); }
  }

  return (
    <form className="panel form-light group-form" onSubmit={submit} noValidate>
      <h2>{t.teach.newGroup}</h2>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="row-2">
        <label className="lfield"><span>{t.teach.groupLabel}</span><input id="g-label" value={label} placeholder={t.teach.groupLabelHint} onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="lfield"><span>{fill(t.teach.capacity, { max: String(MAX_SEATS) })}</span>
          <input id="g-capacity" type="number" min={1} max={MAX_SEATS} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          {fields.capacity && <em>{fields.capacity}</em>}</label>
      </div>
      <label className="lfield"><span>{t.teach.price}</span>
        <input id="g-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <small className="muted">{t.teach.priceHint}</small>{fields.priceCents && <em>{fields.priceCents}</em>}</label>

      <h3 className="sub">{t.teach.meetingsTitle} <small className="muted">· {t.teach.timezone}: {viewerTimeZone()}</small></h3>
      <ul className="meeting-rows">
        {rows.map((r, i) => (
          <li key={i}>
            <label className="lfield"><span>{t.teach.date}</span><input type="date" value={r.date} onChange={(e) => setRow(i, { date: e.target.value })} /></label>
            <label className="lfield"><span>{t.teach.start}</span><input type="time" value={r.start} onChange={(e) => setRow(i, { start: e.target.value })} /></label>
            <label className="lfield"><span>{t.teach.end}</span><input type="time" value={r.end} onChange={(e) => setRow(i, { end: e.target.value })} /></label>
            {rows.length > 1 && <button type="button" className="icon-btn" aria-label={t.teach.removeMeeting} onClick={() => setRows((l) => l.filter((_, j) => j !== i))}><Trash2 size={18} /></button>}
            {(fields[`meetings.${i}.start`] || fields[`meetings.${i}.end`]) && <em className="row-error">{fields[`meetings.${i}.start`] ?? fields[`meetings.${i}.end`]}</em>}
          </li>
        ))}
      </ul>
      {fields.meetings && <em className="row-error">{fields.meetings}</em>}
      <div className="row-2 align-end-row">
        <button type="button" className="btn-small btn-blue-soft" onClick={() => setRows((l) => [...l, { ...l.at(-1)! }])}><Plus size={18} aria-hidden />{t.teach.addMeeting}</button>
        <label className="lfield"><span>{t.teach.repeatDays}</span><input type="number" min={1} max={60} value={repeat} onChange={(e) => applyRepeat(Number(e.target.value))} /></label>
      </div>
      <p className="muted">{t.teach.deadlineNote}</p>
      <button className="btn-small btn-orange-solid align-start" disabled={busy}>{busy ? t.common.loading : t.teach.createGroup}</button>
    </form>
  );
}
