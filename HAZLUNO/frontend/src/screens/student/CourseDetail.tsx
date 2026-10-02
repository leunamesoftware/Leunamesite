import {
  Award, CalendarDays, ChevronLeft, ChevronRight, Clock, Heart, Lock, MessageCircle, Radio, Share2, ShieldAlert, Signal, Star, UsersRound, Video,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClassSummary, CourseDetail as Detail } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { PeriodIcon, useAccessLabel, useClassWhen, useMeetingTime, usePeriodLabel } from '../../ui/classes';
import { money } from '../../ui/format';

type Tab = 'info' | 'reviews' | 'teacher' | 'groups';

/** The one action the bottom button offers, following the owner's class rule. */
function mainAction(classes: ClassSummary[]) {
  const live = classes.find((k) => k.access.action === 'enter');
  if (live) return { kind: 'enter' as const, k: live };
  const mine = classes.find((k) => k.access.action === 'open');
  if (mine) return { kind: 'open' as const, k: mine };
  const buyable = classes.filter((k) => k.access.action === 'buy').sort((a, b) => a.priceCents - b.priceCents);
  if (buyable.length) return { kind: 'buy' as const, k: buyable[0]! };
  if (classes.some((k) => ['live', 'in_progress'].includes(k.access.badge))) return { kind: 'closed' as const, k: null };
  return { kind: 'full' as const, k: null };
}

/** Telas 7/8 — detalhe do curso (layout da referência). */
export function CourseDetail() {
  const { id = '' } = useParams();
  const { t, lang, fill } = useI18n();
  const { me } = useSession();
  const navigate = useNavigate();
  const [c, setC] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>('info');
  const [copied, setCopied] = useState(false);
  const when = useClassWhen();
  const meetingTime = useMeetingTime();
  const periodLabel = usePeriodLabel();
  const badge = useAccessLabel();

  useEffect(() => { api.course(id).then(setC, () => setMissing(true)); }, [id]);

  if (missing) return <main className="detail"><div className="detail-missing"><p>{t.course.notFound}</p><Link to="/explore">{t.my.explore}</Link></div></main>;
  if (!c) return <main className="detail" aria-busy="true" />;

  const action = mainAction(c.classes);
  const ref = action.k ?? c.classes[0] ?? null;
  const firstMeeting = ref?.meetings[0];
  const photo = c.coverUrl ?? c.instructor.avatarUrl;
  const rating = c.rating ?? c.instructor.rating;
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: c.title, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* user closed the share sheet */ }
  };
  const fav = async () => {
    const on = !c.favorite;
    setC({ ...c, favorite: on });
    try { await api.setFavorite(c.id, on); } catch { setC({ ...c, favorite: !on }); }
  };
  const tabs: [Tab, string, typeof Star][] = [['info', t.course.info, Signal], ['reviews', t.course.reviews, MessageCircle], ['teacher', t.course.teacher, UsersRound], ['groups', t.course.groups, CalendarDays]];

  return (
    <main className="detail">
      <div className="detail-hero">
        {photo ? <img src={photo} alt="" /> : <div className="detail-hero-empty" aria-hidden />}
        <div className="detail-hero-bar">
          <button type="button" className="icon-btn icon-btn-glass" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/explore'))} aria-label={t.common.back}><ChevronLeft size={26} /></button>
          <div className="detail-hero-actions">
            {me && <button type="button" className={`icon-btn icon-btn-glass${c.favorite ? ' fav-on' : ''}`} onClick={fav} aria-pressed={c.favorite}
              aria-label={c.favorite ? t.course.unfavorite : t.course.favorite}><Heart size={22} fill={c.favorite ? 'currentColor' : 'none'} /></button>}
            <button type="button" className="icon-btn icon-btn-glass" onClick={share} aria-label={t.course.share}><Share2 size={22} /></button>
          </div>
        </div>
        {c.liveNow && <span className="pill pill-live detail-live"><Radio size={16} aria-hidden />{t.card.live}</span>}
        {copied && <span className="toast">{t.course.linkCopied}</span>}
      </div>

      <div className="detail-body">
        <section className="detail-head">
          <div>
            <h1>{c.title}</h1>
            <div className="detail-teacher">
              <Avatar url={c.instructor.avatarUrl} name={c.instructor.name} size={48} />
              <Link to={`/teacher/${c.instructor.id}`}>{c.instructor.name}</Link>
              {rating != null ? <span className="rating"><Star size={18} fill="currentColor" aria-hidden />{rating.toLocaleString(lang, { minimumFractionDigits: 1 })}</span>
                : <span className="tag-new">{t.card.newTeacher}</span>}
              {c.studentsCount > 0 && (
                <>
                  <span className="sep" aria-hidden />
                  <span className="muted-light"><UsersRound size={18} aria-hidden /> {fill(t.course.courseStudents, { n: String(c.studentsCount) })}</span>
                </>
              )}
            </div>
          </div>
          {ref && firstMeeting && (
            <ul className="facts">
              <li><CalendarDays size={22} aria-hidden /><span><strong>{when(ref)}</strong>{meetingTime(firstMeeting).range}</span></li>
              <li><Clock size={22} aria-hidden /><span>{meetingTime(firstMeeting).length}{ref.meetings.length > 1 ? ` · ${fill(t.card.meetings, { n: String(ref.meetings.length) })}` : ''}</span></li>
              <li><Signal size={22} aria-hidden /><span>{t.levels[c.level]}</span></li>
              <li><Video size={22} aria-hidden /><span>{t.course.liveInteractive}</span></li>
            </ul>
          )}
        </section>

        <div className="tabs" role="tablist">
          {tabs.map(([key, label, Icon]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tabbtn${tab === key ? ' tabbtn-on' : ''}`} onClick={() => setTab(key)}>
              <Icon size={20} aria-hidden />{label}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <>
            <section className="panel">
              <h2>{t.course.about}</h2>
              {c.description && <p className="prose">{c.description}</p>}
              <ul className="feature-row">
                <li><Video size={24} aria-hidden />{t.course.liveInteractive}</li>
                <li><MessageCircle size={24} aria-hidden />{t.course.askLive}</li>
                <li><Signal size={24} aria-hidden />{t.levels[c.level]}</li>
                {c.certificateEnabled && <li><Award size={24} aria-hidden />{t.course.certificate}</li>}
              </ul>
            </section>
            {!!c.learningOutcomes.length && <section className="panel"><h2>{t.course.learn}</h2><ul className="ticks">{c.learningOutcomes.map((x) => <li key={x}>{x}</li>)}</ul></section>}
            {(!!c.requiredMaterials.length || !!c.recommendedMaterials.length) && (
              <section className="panel two-cols">
                {!!c.requiredMaterials.length && <div><h2>{t.course.required}</h2><ul className="dots">{c.requiredMaterials.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                {!!c.recommendedMaterials.length && <div><h2>{t.course.recommended}</h2><ul className="dots">{c.recommendedMaterials.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              </section>
            )}
            {c.isHazardous && c.safetyNotice && (
              <section className="panel panel-warn"><h2><ShieldAlert size={22} aria-hidden /> {t.course.safety}</h2><p className="prose">{c.safetyNotice}</p></section>
            )}
          </>
        )}

        {tab === 'reviews' && <section className="panel"><h2>{t.course.reviews}</h2><p className="muted">{t.course.noReviews}</p></section>}

        {tab === 'teacher' && (
          <section className="panel teacher-panel">
            <Avatar url={c.instructor.avatarUrl} name={c.instructor.name} size={96} />
            <div>
              <h2>{c.instructor.name}</h2>
              {(rating != null || c.instructorStudentsCount > 0) && (
                <p className="muted">{[rating != null ? `★ ${rating.toLocaleString(lang, { minimumFractionDigits: 1 })}` : '',
                  c.instructorStudentsCount > 0 ? fill(t.course.teacherStudents, { n: String(c.instructorStudentsCount) }) : ''].filter(Boolean).join(' · ')}</p>
              )}
              {c.instructorHeadline && <p><strong>{c.instructorHeadline}</strong></p>}
              {c.instructorBio && <p className="prose">{c.instructorBio}</p>}
              <Link className="link-arrow" to={`/teacher/${c.instructor.id}`}>{t.course.viewTeacher}<ChevronRight size={18} aria-hidden /></Link>
            </div>
          </section>
        )}

        {tab === 'groups' && (
          <section className="panel">
            <h2>{t.course.nextGroups}</h2>
            {!c.classes.length && <p className="muted">{t.course.noGroups}</p>}
            <ul className="group-list">
              {c.classes.map((k) => (
                <li key={k.id} className={`group${k.access.action === 'buy' ? '' : ' group-off'}`}>
                  <PeriodIcon iso={k.startsAt} />
                  <div>
                    <strong>{periodLabel(k.startsAt)} · {when(k)}</strong>
                    <span className="muted">{meetingTime(k.meetings[0] ?? { start: k.startsAt, end: k.endsAt }).range}</span>
                  </div>
                  <span className="group-price">{k.priceCents === 0 ? t.card.free : money(k.priceCents, k.currency, lang)}</span>
                  {k.access.action === 'buy'
                    ? <button type="button" className="btn-small btn-orange-solid" onClick={() => navigate(`/course/${c.id}/choose?class=${k.id}`)}>{t.choose.pick}</button>
                    : <span className="pill pill-muted">{badge(k)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="detail-spacer" />
      </div>

      <div className="cta-bar">
        {action.kind === 'buy' && (
          <button type="button" className="btn btn-orange btn-split" onClick={() => navigate(`/course/${c.id}/choose?class=${action.k.id}`)}>
            <Video size={22} aria-hidden /><span>{fill(t.course.bookCta, { price: action.k.priceCents === 0 ? t.card.free : money(action.k.priceCents, action.k.currency, lang) })}</span><ChevronRight size={22} aria-hidden />
          </button>
        )}
        {action.kind === 'enter' && <button type="button" className="btn btn-orange" onClick={() => navigate('/my')}><Video size={22} aria-hidden />{t.course.enterCta}</button>}
        {action.kind === 'open' && <button type="button" className="btn btn-ghost-light" onClick={() => navigate('/my')}>{t.course.openCta}</button>}
        {action.kind === 'closed' && <button type="button" className="btn btn-disabled" disabled><Lock size={20} aria-hidden />{t.course.closedCta}</button>}
        {action.kind === 'full' && <button type="button" className="btn btn-disabled" disabled><Lock size={20} aria-hidden />{t.course.fullCta}</button>}
      </div>
    </main>
  );
}
