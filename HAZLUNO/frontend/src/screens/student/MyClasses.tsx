import { Bookmark, CalendarDays, CheckCircle2, Clock, History, PlayCircle, Radio, Search, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MyClass } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Avatar } from '../../ui/avatar';
import { useClassWhen, useMeetingTime } from '../../ui/classes';
import { dayShort, time } from '../../ui/format';
import { Wordmark } from '../../ui/kit';
import { Shell } from '../../ui/shell';

/** Tela 10 — minhas aulas (referência "Mis clases"). Enrolments arrive with payments (Phase 3). */
export function MyClasses() {
  const { t, lang, fill } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [list, setList] = useState<MyClass[] | null>(null);
  const when = useClassWhen();
  const meetingTime = useMeetingTime();
  useEffect(() => { api.myClasses().then(setList, () => setList([])); }, []);

  const past = (k: MyClass) => k.access.badge === 'finished' || k.access.badge === 'canceled';
  const shown = (list ?? []).filter((k) => (tab === 'past' ? past(k) : !past(k)));

  return (
    <Shell tone="soft">
      <main className="mine">
        <header className="page-head">
          <Wordmark size="sm" />
          <h1>{t.my.title}</h1>
          <p>{t.my.subtitle}</p>
          <div className="seg">
            <button type="button" className={`seg-btn${tab === 'upcoming' ? ' seg-on' : ''}`} onClick={() => setTab('upcoming')}><CalendarDays size={20} aria-hidden />{t.my.upcoming}</button>
            <button type="button" className={`seg-btn${tab === 'past' ? ' seg-on' : ''}`} onClick={() => setTab('past')}><History size={20} aria-hidden />{t.my.past}</button>
            <button type="button" className="seg-btn" onClick={() => navigate('/favorites')}><Bookmark size={20} aria-hidden />{t.nav.favorites}</button>
          </div>
        </header>
        <div className="page-body">
          {list && !shown.length && (
            <div className="empty empty-light">
              <h2>{tab === 'past' ? t.my.emptyPast : t.my.emptyUpcoming}</h2>
              {tab === 'upcoming' && <button type="button" className="btn-small btn-orange-solid" onClick={() => navigate('/explore')}><Search size={18} aria-hidden />{t.my.explore}</button>}
            </div>
          )}
          <ul className="mine-list">
            {shown.map((k) => {
              const next = k.meetings.find((m) => m.status !== 'ended' && Date.parse(m.end) > Date.now()) ?? k.meetings[0];
              const index = next ? k.meetings.indexOf(next) + 1 : 1;
              return (
                <li key={k.id} className="mine-card">
                  <div className="mine-photo">
                    {(k.coverUrl ?? k.instructor.avatarUrl) ? <img src={k.coverUrl ?? k.instructor.avatarUrl!} alt="" /> : <div className="ccard-img-empty" />}
                    {k.access.badge === 'live'
                      ? <span className="pill pill-live"><Radio size={14} aria-hidden />{t.card.live}</span>
                      : !past(k) && <span className="pill pill-ok"><CheckCircle2 size={14} aria-hidden />{t.card.confirmed}</span>}
                  </div>
                  <div className="mine-main">
                    <h2>{k.courseTitle}</h2>
                    <div className="mine-teacher"><Avatar url={k.instructor.avatarUrl} name={k.instructor.name} size={30} />{k.instructor.name}</div>
                    <div className="mine-facts">
                      <span><CalendarDays size={18} aria-hidden />{when(k)}</span>
                      {next && <span><Clock size={18} aria-hidden />{meetingTime(next).range}</span>}
                    </div>
                    {next && k.meetings.length > 1 && !past(k) && (
                      <p className="muted">{fill(t.my.nextMeeting, { i: String(index), n: String(k.meetings.length), when: `${dayShort(next.start, lang)} ${time(next.start, lang)}` })}</p>
                    )}
                  </div>
                  <div className="mine-actions">
                    {k.access.action === 'enter' && <button type="button" className="btn-small btn-orange-solid"><Video size={18} aria-hidden />{t.card.enter}</button>}
                    {k.access.action === 'recording' && <button type="button" className="btn-small btn-blue-soft"><PlayCircle size={18} aria-hidden />{t.card.recording}</button>}
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
