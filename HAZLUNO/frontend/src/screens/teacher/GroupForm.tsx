import { CalendarDays, CheckCircle2, Clock, Lightbulb, Tag, Users, Video, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { InstructorCourse } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { errorText, fieldTexts } from '../../ui/errors';
import { dateInput, dayShort, duration, LOCALE, money, viewerTimeZone } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { TeachLayout } from './TeachLayout';

const MAX_SEATS = 25;
const MAX_MEETINGS = 60;
const DESC_MAX = 300;
/** Monday first, as people read a week in Europe. Values are JS getDay(). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Times are typed in the teacher's own time zone and sent as UTC. */
const toIso = (date: string, hhmm: string) => new Date(`${date}T${hhmm}`).toISOString();
const plusDays = (date: string, n: number) => { const d = new Date(`${date}T12:00`); d.setDate(d.getDate() + n); return dateInput(d.toISOString()); };
const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); };

/** Every date between start and end that falls on a chosen weekday. */
function generate(start: string, end: string, days: number[]): string[] {
  if (!start || !end || end < start || !days.length) return [];
  const out: string[] = [];
  for (let d = start; d <= end && out.length <= MAX_MEETINGS; d = plusDays(d, 1)) {
    if (days.includes(new Date(`${d}T12:00`).getDay())) out.push(d);
  }
  return out;
}

/** "Crear grupo y definir horarios" (owner reference): weekdays + time + dates create the live meetings. Live only, max 25. */
export function GroupForm() {
  const { id } = useParams();
  const { t, lang, fill } = useI18n();
  const { me } = useSession();
  const navigate = useNavigate();
  const [course, setCourse] = useState<InstructorCourse | null>(null);
  const firstDay = plusDays(dateInput(new Date().toISOString()), 7);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState<number[]>([new Date(`${firstDay}T12:00`).getDay()]);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('20:00');
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(plusDays(firstDay, 21));
  const [skipped, setSkipped] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(20);
  const [price, setPrice] = useState('20');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (id) api.teacher.course(id).then(setCourse, () => navigate('/teach', { replace: true })); }, [id, navigate]);

  const all = useMemo(() => generate(from, to, days), [from, to, days]);
  const dates = all.filter((d) => !skipped.includes(d));
  const perClass = Math.max(0, minutesOf(end) - minutesOf(start));
  const weekdayName = (d: number, style: 'long' | 'short') =>
    new Intl.DateTimeFormat(LOCALE[lang], { weekday: style }).format(new Date(2024, 0, d === 0 ? 7 : d)); // 2024-01-01 is a Monday
  const daysList = new Intl.ListFormat(LOCALE[lang], { type: 'conjunction' }).format(WEEK.filter((d) => days.includes(d)).map((d) => weekdayName(d, 'long')));
  const daysText = daysList.charAt(0).toUpperCase() + daysList.slice(1);
  const cents = Math.round(Number(price.replace(',', '.')) * 100);
  const tooMany = all.length > MAX_MEETINGS;

  const toggleDay = (d: number) => setDays((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));
  async function submit() {
    setFields({}); setError(null);
    const stop = (text: string) => { setError(text); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    if (!dates.length) { stop(t.teach.gNoMeetings); return; }
    if (tooMany) { stop(t.teach.gTooMany); return; }
    setBusy(true);
    try {
      await api.teacher.createClass(id!, {
        label: label.trim() || null, description: description.trim() || null, timezone: viewerTimeZone(), capacity,
        priceCents: Number.isFinite(cents) ? cents : -1,
        meetings: dates.map((d) => ({ start: toIso(d, start), end: toIso(d, end) })),
      });
      navigate(`/teach/courses/${id}?step=3`, { replace: true });
    } catch (err) {
      stop(errorText(t, err)); setFields(fieldTexts(t, err));
    } finally { setBusy(false); }
  }
  const meetingError = (i: number) => fields[`meetings.${i}.start`] ?? fields[`meetings.${i}.end`];
  const firstMeetingError = Object.keys(fields).find((k) => k.startsWith('meetings.'));

  return (
    <TeachLayout title={t.teach.gTitle} back={`/teach/courses/${id}?step=3`}>
      <p className="page-lead muted">{t.teach.gSubtitle}</p>
      <div className="wizard-wrap">
        <div className="wizard">
          {error && <Banner tone="error">{error}</Banner>}
          <section className="panel form-light">
            <div className="step-title"><span className="step-icon step-icon-orange"><Users size={24} /></span><div><h2>{t.teach.gData}</h2><p className="muted">{t.teach.gDataHint}</p></div></div>
            <div className="row-2 row-2-wide">
              <label className="lfield"><span>{t.teach.groupLabel}</span><input id="g-label" maxLength={40} value={label} placeholder={t.teach.groupLabelHint} onChange={(e) => setLabel(e.target.value)} /></label>
              <label className="lfield"><span>{t.teach.courseLabel}</span><input value={course?.title ?? ''} disabled /></label>
            </div>
            <label className="lfield"><span>{t.teach.groupDesc}</span>
              <textarea id="g-description" maxLength={DESC_MAX} value={description} onChange={(e) => setDescription(e.target.value)} />
              <small className="muted counter">{description.length}/{DESC_MAX}</small>{fields.description && <em>{fields.description}</em>}</label>
          </section>

          <section className="panel form-light">
            <div className="step-title"><span className="step-icon"><CalendarDays size={24} /></span><div><h2>{t.teach.gDays}</h2><p className="muted">{t.teach.gDaysHint}</p></div></div>
            <div className="weekdays" role="group" aria-label={t.teach.gDays}>
              {WEEK.map((d) => (
                <label key={d} className={`weekday${days.includes(d) ? ' weekday-on' : ''}`}>
                  <input type="checkbox" checked={days.includes(d)} onChange={() => { toggleDay(d); setSkipped([]); }} />
                  <span className="wd-long">{weekdayName(d, 'long')}</span><span className="wd-short">{weekdayName(d, 'short')}</span>
                </label>
              ))}
            </div>
            <div className="row-3">
              <label className="lfield"><span>{t.teach.startTime}</span><input id="g-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
              <label className="lfield"><span>{t.teach.endTime}</span><input id="g-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
              <label className="lfield"><span>{t.teach.perClass}</span><input value={perClass ? duration(perClass, lang) : '—'} disabled /></label>
            </div>
            <div className="row-2">
              <label className="lfield"><span>{t.teach.startDate}</span><input id="g-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setSkipped([]); }} /></label>
              <label className="lfield"><span>{t.teach.endDate}</span><input id="g-to" type="date" min={from} value={to} onChange={(e) => { setTo(e.target.value); setSkipped([]); }} /></label>
            </div>
            <p className="muted small">{t.teach.timezone}: {viewerTimeZone()}</p>

            <h3 className="sub">{fill(t.teach.gMeetingsList, { n: String(dates.length) })}</h3>
            {tooMany ? <p className="row-error">{t.teach.gTooMany}</p> : !all.length ? <p className="muted">{t.teach.gNoMeetings}</p> : <>
              <p className="muted small">{t.teach.gMeetingsHint}</p>
              <ul className="gen-meetings">
                {all.map((d) => {
                  const off = skipped.includes(d);
                  const i = dates.indexOf(d);
                  return (
                    <li key={d} className={off ? 'gen-off' : i >= 0 && meetingError(i) ? 'gen-bad' : ''}>
                      <span>{dayShort(`${d}T12:00`, lang)}</span>
                      <button type="button" className="icon-btn" aria-label={off ? t.teach.addItem : t.teach.removeItem} aria-pressed={!off}
                        onClick={() => setSkipped((l) => (off ? l.filter((x) => x !== d) : [...l, d]))}>{off ? '+' : <X size={16} />}</button>
                    </li>
                  );
                })}
              </ul>
              {firstMeetingError && <em className="row-error">{fields[firstMeetingError]}</em>}
            </>}
          </section>

          <section className="panel form-light">
            <div className="step-title"><span className="step-icon step-icon-green"><Video size={24} /></span><div><h2>{t.teach.gLive}</h2><p className="muted">{t.teach.gLiveText}</p></div></div>
            <h3 className="sub">{t.teach.gSeatsPrice}</h3>
            <div className="row-2">
              <label className="lfield"><span>{fill(t.teach.capacity, { max: String(MAX_SEATS) })}</span>
                <select id="g-capacity" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
                  {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select>
                {fields.capacity && <em>{fields.capacity}</em>}</label>
              <label className="lfield"><span>{t.teach.price}</span>
                <input id="g-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
                <small className="muted">{t.teach.priceHint}</small>{fields.priceCents && <em>{fields.priceCents}</em>}</label>
            </div>
            <p className="muted small">{t.teach.deadlineNote} {t.teach.groupDraftNote}</p>
            <div className="wizard-nav">
              <button type="button" className="btn-small btn-blue-soft" onClick={() => navigate(`/teach/courses/${id}?step=3`)}>{t.teach.previous}</button>
              <button type="button" className="btn-small btn-orange-solid" disabled={busy} onClick={submit}>{busy ? t.common.loading : t.teach.createGroup}</button>
            </div>
          </section>
        </div>

        <aside className="why">
          <section className="panel preview">
            <h2>{t.teach.gPreview}</h2>
            <p className="muted small">{t.teach.gPreviewHint}</p>
            <div className="gpreview">
              {course?.coverUrl ? <img src={course.coverUrl} alt="" /> : <div className="preview-cover" aria-hidden />}
              <strong>{label.trim() || t.teach.newGroup}</strong>
              <span className="muted">{course?.title}</span>
              {me && <span className="cpreview-teacher"><Avatar url={me.avatarUrl} name={me.displayName} size={36} />{me.displayName}</span>}
              {description.trim() && <p className="gpreview-desc">{description.trim()}</p>}
              <ul className="gpreview-facts">
                <li><CalendarDays size={18} aria-hidden /><span>{daysText || '—'}<br />{start}–{end}</span></li>
                <li><Clock size={18} aria-hidden /><span>{perClass ? duration(perClass, lang) : '—'}<br />{t.teach.gLive}</span></li>
                <li><Users size={18} aria-hidden /><span>{fill(t.teach.maxStudents, { n: String(capacity) })}<br />{fill(t.card.meetings, { n: String(dates.length) })}</span></li>
                <li><CalendarDays size={18} aria-hidden /><span>{dates[0] ? fill(t.teach.startsOnDate, { date: dayShort(`${dates[0]}T12:00`, lang) }) : '—'}<br />
                  {perClass && dates.length ? fill(t.teach.hoursTotal, { h: duration(perClass * dates.length, lang) }) : ''}</span></li>
                <li className="gpreview-price"><Tag size={18} aria-hidden /><span className="cpreview-price">{Number.isFinite(cents) && cents >= 0 ? (cents === 0 ? t.card.free : money(cents, 'EUR', lang)) : '—'}</span></li>
              </ul>
            </div>
          </section>
          <section className="panel tips">
            <h2><Lightbulb size={20} aria-hidden /> {t.teach.gTipsTitle}</h2>
            <ul>{[t.teach.gtip1, t.teach.gtip2, t.teach.gtip3, t.teach.gtip4].map((x) => <li key={x}><CheckCircle2 size={18} aria-hidden />{x}</li>)}</ul>
          </section>
        </aside>
      </div>
    </TeachLayout>
  );
}
