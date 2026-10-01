import { Award, CalendarDays, CheckCircle2, Clock, Heart, PlayCircle, Radio, Search, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MyClass } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Avatar } from '../../ui/avatar';
import { useClassWhen, useMeetingTime } from '../../ui/classes';
import { dayLong, dayShort, time } from '../../ui/format';
import { Wordmark } from '../../ui/kit';
import { Shell } from '../../ui/shell';

type Tab = 'upcoming' | 'inProgress' | 'completed';

/**
 * Tela 10 — minhas aulas. Hazluno is live: a class starts on its date, so progress means
 * sessions already held (not "videos watched"). Enrolments arrive with payments (Phase 3).
 */
export function MyClasses() {
  const { t, lang, fill } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [q, setQ] = useState('');
  const [list, setList] = useState<MyClass[] | null>(null);
  const when = useClassWhen();
  const meetingTime = useMeetingTime();
  useEffect(() => { api.myClasses().then(setList, () => setList([])); }, []);

  const stateOf = (k: MyClass): Tab | 'canceled' =>
    k.access.badge === 'canceled' ? 'canceled' : k.access.badge === 'finished' ? 'completed'
      : k.access.badge === 'live' || k.access.badge === 'in_progress' ? 'inProgress' : 'upcoming';
  const shown = (list ?? []).filter((k) => stateOf(k) === tab && (!q || k.courseTitle.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (tab === 'completed' ? b.endsAt.localeCompare(a.endsAt) : a.startsAt.localeCompare(b.startsAt)));
  const empty = { upcoming: t.my.emptyUpcoming, inProgress: t.my.emptyInProgress, completed: t.my.emptyCompleted }[tab];
  const tabs: [Tab, string, typeof Clock][] = [['upcoming', t.my.upcoming, CalendarDays], ['inProgress', t.my.inProgress, PlayCircle], ['completed', t.my.completed, CheckCircle2]];

  return (
    <Shell tone="soft">
      <main className="mine">
        <header className="page-head">
          <Wordmark size="sm" />
          <h1>{t.my.title}</h1>
          <p>{t.my.subtitle}</p>
          <div className="seg">
            {tabs.map(([key, label, Icon]) => (
              <button key={key} type="button" className={`seg-btn${tab === key ? ' seg-on' : ''}`} onClick={() => setTab(key)}><Icon size={20} aria-hidden />{label}</button>
            ))}
            <button type="button" className="seg-btn" onClick={() => navigate('/favorites')}><Heart size={20} aria-hidden />{t.nav.favorites}</button>
          </div>
        </header>
        <div className="page-body">
          {!!list?.length && (
            <label className="searchbar searchbar-input searchbar-light">
              <Search size={20} aria-hidden />
              <input id="my-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.my.search} aria-label={t.my.search} />
            </label>
          )}
          {list && !shown.length && (
            <div className="empty empty-light">
              <h2>{empty}</h2>
              {tab === 'upcoming' && <button type="button" className="btn-small btn-orange-solid" onClick={() => navigate('/explore')}><Search size={18} aria-hidden />{t.my.explore}</button>}
            </div>
          )}
          <ul className="mine-list">
            {shown.map((k) => {
              const done = k.meetings.filter((m) => m.status === 'ended' || Date.parse(m.end) <= Date.now()).length;
              const n = k.meetings.length;
              const next = k.meetings.find((m) => Date.parse(m.end) > Date.now());
              const state = stateOf(k);
              return (
                <li key={k.id} className="mine-card">
                  <div className="mine-photo">
                    {(k.coverUrl ?? k.instructor.avatarUrl) ? <img src={k.coverUrl ?? k.instructor.avatarUrl!} alt="" /> : <div className="ccard-img-empty" />}
                    {k.access.badge === 'live'
                      ? <span className="pill pill-live"><Radio size={14} aria-hidden />{t.card.live}</span>
                      : state === 'upcoming' && <span className="pill pill-ok"><CheckCircle2 size={14} aria-hidden />{t.card.confirmed}</span>}
                  </div>
                  <div className="mine-main">
                    <h2>{k.courseTitle}</h2>
                    <div className="mine-teacher"><Avatar url={k.instructor.avatarUrl} name={k.instructor.name} size={30} />{k.instructor.name}</div>
                    <div className="mine-facts">
                      {state === 'completed'
                        ? <span><CheckCircle2 size={18} aria-hidden />{fill(t.my.finishedOn, { date: dayLong(k.endsAt, lang) })}</span>
                        : <>
                            <span><CalendarDays size={18} aria-hidden />{next && n > 1 ? `${dayShort(next.start, lang)}` : when(k)}</span>
                            {next && <span><Clock size={18} aria-hidden />{meetingTime(next).range}</span>}
                          </>}
                    </div>
                    {n > 0 && (
                      <div className="progress" aria-label={fill(t.my.progress, { done: String(done), n: String(n) })}>
                        <div className="progress-bar"><span style={{ width: `${Math.round((done / n) * 100)}%` }} className={state === 'completed' ? 'done' : ''} /></div>
                        <small>{fill(t.my.progress, { done: String(done), n: String(n) })}{next && state !== 'completed' && n > 1 ? ` · ${fill(t.my.nextMeeting, { i: String(k.meetings.indexOf(next) + 1), n: String(n), when: `${dayShort(next.start, lang)} ${time(next.start, lang)}` })}` : ''}</small>
                      </div>
                    )}
                  </div>
                  <div className="mine-actions">
                    {k.access.action === 'enter' && <button type="button" className="btn-small btn-orange-solid"><Video size={18} aria-hidden />{t.card.enter}</button>}
                    {k.access.action === 'recording' && <button type="button" className="btn-small btn-blue-solid"><PlayCircle size={18} aria-hidden />{t.card.recording}</button>}
                    {state === 'completed' && <button type="button" className="btn-small btn-blue-soft" disabled title="Fase 5"><Award size={18} aria-hidden />{t.my.certificate}</button>}
                    <button type="button" className="btn-small btn-blue-soft" onClick={() => navigate(`/course/${k.courseId}`)}>{t.card.details}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </Shell>
  );
}
