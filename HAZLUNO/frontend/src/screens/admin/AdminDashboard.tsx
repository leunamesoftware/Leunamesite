import { Activity, BookOpen, CalendarCheck, CreditCard, Flag, GraduationCap, Mail, MonitorSmartphone, ScrollText, Search, UserPlus, Users, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminDashboard as Data } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { errorText } from '../../ui/errors';
import { LOCALE } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { AdminLayout } from './AdminLayout';

const ACT_ICON: Record<string, typeof Users> = {
  'auth.signup': UserPlus, 'instructor.submitted': ScrollText, 'admin.instructor_approved': GraduationCap, 'admin.instructor_rejected': GraduationCap,
  'course.published': BookOpen, 'class.published': CalendarCheck, 'class.canceled': CalendarCheck, 'student.reported': Flag,
};

/** Rounds the top of the chart up to a readable number (5, 10, 50, 100…). */
function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

function UsersChart({ data, students, teachers, lang }: { data: Data['usersSeries']; students: string; teachers: string; lang: string }) {
  const W = 640, H = 230, L = 44, R = 16, T = 14, B = 28;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.students, d.teachers))));
  const x = (i: number) => L + (data.length === 1 ? 0 : (i / (data.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (k: 'students' | 'teachers') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const step = Math.max(1, Math.ceil(data.length / 6));
  const fmt = new Intl.DateTimeFormat(LOCALE[lang as keyof typeof LOCALE], { day: '2-digit', month: '2-digit' });
  const last = data.at(-1);
  return (
    <figure className="achart">
      <figcaption className="achart-legend"><span className="lg-blue">{students}</span><span className="lg-orange">{teachers}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${students}: ${last?.students ?? 0} · ${teachers}: ${last?.teachers ?? 0}`}>
        {ticks.map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 8} y={y(v) + 4} textAnchor="end">{v}</text></g>
        ))}
        {data.map((d, i) => (i % step === 0 || i === data.length - 1) && (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>{fmt.format(new Date(`${d.date}T12:00`))}</text>
        ))}
        <path d={`${line('students')}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} className="area-blue" />
        <path d={line('students')} className="ln-blue" />
        <path d={line('teachers')} className="ln-orange" />
        {last && <><circle cx={x(data.length - 1)} cy={y(last.students)} r="5" className="dot-blue" /><circle cx={x(data.length - 1)} cy={y(last.teachers)} r="5" className="dot-orange" /></>}
      </svg>
    </figure>
  );
}

/** Tela 29 (owner reference, adjusted): only real numbers; money, video and certificates show as "next phase". */
export function AdminDashboard() {
  const { t, lang, fill } = useI18n();
  const { me } = useSession();
  const [days, setDays] = useState(30);
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.admin.dashboard(days).then(setD, (e) => setError(errorText(t, e))); }, [days, t]);

  const nf = new Intl.NumberFormat(LOCALE[lang]);
  const rel = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' });
  const ago = (iso: string) => {
    const min = Math.round((Date.parse(iso) - Date.now()) / 60_000);
    if (Math.abs(min) < 60) return rel.format(min, 'minute');
    if (Math.abs(min) < 1440) return rel.format(Math.round(min / 60), 'hour');
    return rel.format(Math.round(min / 1440), 'day');
  };
  const growth = (g: { now: number; before: number }) => {
    if (!g.before) return g.now ? fill(t.admin.newInPeriod, { n: nf.format(g.now) }) : '—';
    const pct = Math.round(((g.now - g.before) / g.before) * 100);
    return fill(t.admin.vsBefore, { p: `${pct >= 0 ? '+' : ''}${pct}%` });
  };
  const actLabel: Record<string, string> = {
    'auth.signup': t.admin.act_signup, 'instructor.submitted': t.admin.act_submitted, 'admin.instructor_approved': t.admin.act_approved,
    'admin.instructor_rejected': t.admin.act_rejected, 'course.published': t.admin.act_course, 'class.published': t.admin.act_class,
    'class.canceled': t.admin.act_canceled, 'student.reported': t.admin.act_report,
  };
  const period = (
    <select id="adm-days" className="adm-period" value={days} aria-label={t.admin.period} onChange={(e) => setDays(Number(e.target.value))}>
      <option value={7}>{t.admin.last7}</option><option value={30}>{t.admin.last30}</option><option value={90}>{t.admin.last90}</option>
    </select>
  );

  return (
    <AdminLayout title={fill(t.admin.welcome, { name: me?.displayName.split(' ')[0] ?? '' })} actions={period}>
      <p className="page-lead muted">{t.admin.welcomeSub}</p>
      {error && <Banner tone="error">{error}</Banner>}
      {d && <>
        <div className="adm-stats">
          {([
            [Users, 'adm-blue', t.admin.students, d.totals.students, growth(d.growth.students)],
            [GraduationCap, 'adm-green', t.admin.teachers, d.totals.teachers, `${fill(t.admin.verifiedOf, { n: nf.format(d.totals.verifiedTeachers) })} · ${growth(d.growth.teachers)}`],
            [BookOpen, 'adm-purple', t.admin.courses, d.totals.courses, growth(d.growth.courses)],
            [Video, 'adm-orange', t.admin.meetings, d.totals.meetingsDone, growth(d.growth.meetingsDone)],
          ] as const).map(([Icon, tone, label, value, sub]) => (
            <section key={label} className="panel adm-stat">
              <span className={`adm-icon ${tone}`}><Icon size={28} aria-hidden /></span>
              <div><span className="muted">{label}</span><strong>{nf.format(value)}</strong><small>{sub}</small></div>
            </section>
          ))}
        </div>

        <div className="adm-grid adm-grid-2">
          <section className="panel"><h2>{t.admin.usersChart}</h2><UsersChart data={d.usersSeries} students={t.admin.students} teachers={t.admin.teachers} lang={lang} /></section>
          <section className="panel adm-later"><h2>{t.admin.salesTitle}</h2><CreditCard size={40} aria-hidden /><p className="muted">{t.admin.salesLater}</p></section>
        </div>

        <div className="adm-grid adm-grid-3">
          <section className="panel">
            <h2>{t.admin.popular}</h2>
            {!d.popularCourses.length ? <p className="muted">{t.admin.popularEmpty}</p> : (
              <ol className="adm-rank">
                {d.popularCourses.map((c, i) => {
                  const top = d.popularCourses[0]!.students || 1;
                  return (
                    <li key={c.id}>
                      <span className="adm-n">{i + 1}</span>
                      {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <span className="adm-thumb" aria-hidden />}
                      <Link to={`/course/${c.id}`}>{c.title}</Link>
                      <span className="adm-bar" aria-hidden><span style={{ width: `${(c.students / top) * 100}%` }} /></span>
                      <small>{fill(t.admin.studentsN, { n: nf.format(c.students) })}</small>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section className="panel">
            <h2>{t.admin.topTeachers}</h2>
            {!d.topTeachers.length ? <p className="muted">{t.admin.topEmpty}</p> : (
              <ul className="adm-people">
                {d.topTeachers.map((p) => (
                  <li key={p.id}>
                    <Avatar url={p.avatarUrl} name={p.name} size={40} />
                    <Link to={`/teacher/${p.id}`}>{p.name}</Link>
                    <small>{fill(t.admin.coursesN, { n: nf.format(p.courses) })} · {fill(t.admin.studentsN, { n: nf.format(p.students) })}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel">
            <h2>{t.admin.activity}</h2>
            {!d.activity.length ? <p className="muted">{t.admin.activityEmpty}</p> : (
              <ul className="adm-activity">
                {d.activity.map((a, i) => {
                  const Icon = ACT_ICON[a.action] ?? Activity;
                  return (
                    <li key={`${a.at}-${i}`}>
                      <span className={`adm-act adm-act-${a.action.replace(/\W/g, '-')}`}><Icon size={18} aria-hidden /></span>
                      <div><strong>{actLabel[a.action] ?? a.action}</strong><small>{a.target ?? a.actor ?? ''}</small></div>
                      <time dateTime={a.at}>{ago(a.at)}</time>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="adm-grid adm-grid-2">
          <section className="panel">
            <h2>{t.admin.platform}</h2>
            <ul className="adm-status">
              {([
                [MonitorSmartphone, t.admin.pSite, d.platform.site],
                [Mail, t.admin.pEmail, d.platform.email],
                [CreditCard, t.admin.pPayments, d.platform.payments],
                [Video, t.admin.pVideo, d.platform.video],
                [ScrollText, t.admin.pCertificates, d.platform.certificates],
              ] as const).map(([Icon, label, state]) => (
                <li key={label}><Icon size={20} aria-hidden /><span>{label}</span>
                  <b className={`adm-pill adm-pill-${state}`}>{state === 'online' ? t.admin.online : state === 'not_configured' ? t.admin.notConfigured : t.admin.later}</b></li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>{t.admin.quick}</h2>
            <div className="adm-quick">
              <Link to="/admin/instructors" className="adm-q adm-q-blue"><GraduationCap size={28} aria-hidden />{t.admin.approveTeachers}
                <small>{fill(t.admin.pendingN, { n: nf.format(d.totals.pendingTeachers) })}</small></Link>
              <Link to="/explore" className="adm-q adm-q-green"><Search size={28} aria-hidden />{t.admin.viewCatalog}</Link>
            </div>
            {d.totals.openReports > 0 && <p className="muted small"><Flag size={14} aria-hidden /> {fill(t.admin.openReports, { n: nf.format(d.totals.openReports) })}</p>}
          </section>
        </div>
      </>}
    </AdminLayout>
  );
}
