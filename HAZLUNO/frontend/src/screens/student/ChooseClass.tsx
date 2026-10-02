import { ChevronLeft, ChevronRight, Clock, Globe, Info, Star, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CourseDetail } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Avatar } from '../../ui/avatar';
import { PeriodIcon, useAccessLabel, useClassWhen, useMeetingTime, usePeriodLabel } from '../../ui/classes';
import { money, viewerTimeZone } from '../../ui/format';
import { Wordmark } from '../../ui/kit';

/** "Elige tu grupo" — the course's groups in the viewer's local time; only buyable ones can be chosen. */
export function ChooseClass() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { t, lang, fill } = useI18n();
  const navigate = useNavigate();
  const [c, setC] = useState<CourseDetail | null>(null);
  const [picked, setPicked] = useState<string | null>(params.get('class'));
  const when = useClassWhen();
  const meetingTime = useMeetingTime();
  const periodLabel = usePeriodLabel();
  const badge = useAccessLabel();

  useEffect(() => { api.course(id).then(setC, () => navigate('/explore', { replace: true })); }, [id, navigate]);
  if (!c) return <main className="choosecls" aria-busy="true" />;

  const groups = c.classes.filter((k) => k.access.badge !== 'finished');
  const selected = groups.find((k) => k.id === picked && k.access.action === 'buy') ?? null;
  const rating = c.rating ?? c.instructor.rating;
  const price = (cents: number, cur: string) => (cents === 0 ? t.card.free : money(cents, cur, lang));

  return (
    <main className="choosecls">
      {(c.coverUrl ?? c.instructor.avatarUrl) && <img className="choosecls-art" src={c.instructor.avatarUrl ?? c.coverUrl!} alt="" />}
      <header className="choosecls-head">
        <div className="choosecls-bar">
          <button type="button" className="icon-btn icon-btn-light" onClick={() => navigate(`/course/${c.id}`)} aria-label={t.common.back}><ChevronLeft size={24} /></button>
          <Wordmark size="md" />
        </div>
        <h1>{t.choose.title}</h1>
        <p>{t.choose.subtitle}</p>
        <div className="mini-course">
          <Avatar url={c.coverUrl ?? c.instructor.avatarUrl} name={c.title} size={64} />
          <div>
            <strong>{c.title}</strong>
            <span>{c.instructor.name} {rating != null ? <><Star size={14} fill="currentColor" aria-hidden /> {rating.toLocaleString(lang, { minimumFractionDigits: 1 })}</> : `· ${t.card.newTeacher}`}</span>
          </div>
        </div>
      </header>

      <section className="choosecls-body">
        <div className="section-head">
          <h2 className="section-title">{t.choose.available}</h2>
          <span className="local-time" title={viewerTimeZone()}><Globe size={18} aria-hidden />{t.choose.localTime}</span>
        </div>
        <ul className="slots">
          {groups.map((k) => {
            const m = meetingTime(k.meetings[0] ?? { start: k.startsAt, end: k.endsAt });
            const buy = k.access.action === 'buy';
            return (
              <li key={k.id} className={`slot${picked === k.id && buy ? ' slot-on' : ''}${buy ? '' : ' slot-off'}`}>
                <PeriodIcon iso={k.startsAt} />
                <div className="slot-main">
                  <strong>{k.label || periodLabel(k.startsAt)}</strong>
                  <span>{when(k)}</span>
                  {k.description && <p className="slot-desc">{k.description}</p>}
                  <div className="slot-facts">
                    <span><Clock size={18} aria-hidden /><b>{m.range}</b> ({m.length})</span>
                    <span><UsersRound size={18} aria-hidden />{buy ? fill(t.choose.seats, { n: String(k.seatsLeft) }) : badge(k)}</span>
                  </div>
                </div>
                <div className="slot-side">
                  <span className="slot-price">{price(k.priceCents, k.currency)}<small>{t.card.perGroup}</small></span>
                  {buy
                    ? <button type="button" className="btn-small btn-orange-solid" aria-pressed={picked === k.id} onClick={() => setPicked(k.id)}>
                        {picked === k.id ? t.choose.picked : t.choose.pick}</button>
                    : <span className="pill pill-muted">{badge(k)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="note"><Info size={18} aria-hidden />{t.choose.closesAtStart}</p>
      </section>

      {selected && (
        <div className="choosecls-foot">
          <div className="picked">
            <span className="picked-label">{t.choose.selected}</span>
            <div className="picked-row">
              <PeriodIcon iso={selected.startsAt} size={22} />
              <div><strong>{selected.label || periodLabel(selected.startsAt)}</strong><span>{when(selected)} · {meetingTime(selected.meetings[0]!).range}</span></div>
              <span className="slot-price">{price(selected.priceCents, selected.currency)}</span>
            </div>
          </div>
          <button type="button" className="btn btn-orange btn-split" onClick={() => navigate(`/course/${c.id}/checkout/${selected.id}`)}>
            <span /><span>{t.choose.goOn}</span><ChevronRight size={22} aria-hidden />
          </button>
        </div>
      )}
    </main>
  );
}
