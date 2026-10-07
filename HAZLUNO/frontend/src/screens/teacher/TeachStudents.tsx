import { BookOpen, CalendarCheck, CalendarDays, Flag, Globe2, NotebookPen, Search, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { MyStudent, ReportReason, StudentState } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { Avatar } from '../../ui/avatar';
import { errorText } from '../../ui/errors';
import { dayShort } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { TeachLayout } from './TeachLayout';

type Tab = 'all' | StudentState;
const TABS: Tab[] = ['all', 'active', 'pending', 'completed', 'inactive'];
const REASONS: ReportReason[] = ['harassment', 'inappropriate', 'fraud', 'safety', 'spam', 'other'];

/** Progress = live meetings attended out of the group's meetings (never "video watched"). */
const progress = (s: MyStudent) => (s.meetingsTotal ? Math.round((s.meetingsAttended / s.meetingsTotal) * 100) : 0);

/** "Mis alumnos" (owner reference, adjusted): no adding by hand, no e-mails, no removing a paying student. */
export function TeachStudents() {
  const { t, lang, fill } = useI18n();
  const [list, setList] = useState<MyStudent[] | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.teacher.students().then(setList, (e) => setError(errorText(t, e))); }, [t]);

  const courses = useMemo(() => [...new Map((list ?? []).map((s) => [s.courseId, s.courseTitle])).entries()], [list]);
  const base = (list ?? []).filter((s) => (!course || s.courseId === course) && s.name.toLowerCase().includes(query.trim().toLowerCase()));
  const shown = base.filter((s) => tab === 'all' || s.state === tab);
  const count = (x: Tab) => base.filter((s) => x === 'all' || s.state === x).length;
  const tabLabel: Record<Tab, string> = { all: t.teach.stAll, active: t.teach.stActive, pending: t.teach.stPending, completed: t.teach.stCompleted, inactive: t.teach.stInactive };
  const open = list?.find((s) => s.enrollmentId === openId) ?? null;
  const update = (studentId: string, patch: Partial<MyStudent>) => setList((l) => l && l.map((s) => (s.studentId === studentId ? { ...s, ...patch } : s)));

  return (
    <TeachLayout title={t.teach.stTitle}>
      <p className="page-lead muted">{t.teach.stSubtitle}</p>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="stu-tools">
        <div className="stu-tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} className={`stu-tab stu-tab-${x}${tab === x ? ' stu-tab-on' : ''}`} onClick={() => setTab(x)}>
              {x !== 'all' && <i aria-hidden />}{tabLabel[x]} ({count(x)})
            </button>
          ))}
        </div>
        <label className="stu-search"><Search size={20} aria-hidden />
          <input id="stu-q" type="search" value={query} placeholder={t.teach.stSearch} aria-label={t.teach.stSearch} onChange={(e) => setQuery(e.target.value)} /></label>
        {courses.length > 1 && (
          <select id="stu-course" className="stu-course" value={course} aria-label={t.teach.courseLabel} onChange={(e) => setCourse(e.target.value)}>
            <option value="">{t.teach.stAllCourses}</option>{courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        )}
      </div>

      <div className="stu-wrap">
        <section className="panel stu-list">
          {list && !list.length && <p className="muted">{t.teach.stEmpty}</p>}
          {list && !!list.length && !shown.length && <p className="muted">{t.teach.stNoMatch}</p>}
          {!!shown.length && (
            <>
              <div className="stu-row stu-head" aria-hidden><span>{t.teach.colStudent}</span><span>{t.teach.colCourse}</span><span>{t.teach.colState}</span><span>{t.teach.colProgress}</span></div>
              <ul>
                {shown.map((s) => (
                  <li key={s.enrollmentId}>
                    <button type="button" className={`stu-row${openId === s.enrollmentId ? ' stu-row-on' : ''}`} onClick={() => setOpenId(s.enrollmentId)}>
                      <span className="stu-who"><Avatar url={s.avatarUrl} name={s.name} size={44} /><strong>{s.name}</strong></span>
                      <span className="stu-course-cell">{s.courseTitle}<small>{s.classLabel ?? dayShort(s.classStartsAt, lang)}</small></span>
                      <span><span className={`stu-state stu-state-${s.state}`}><i aria-hidden />{t.teach[`state_${s.state}` as const]}</span></span>
                      <span className="stu-progress"><b>{progress(s)}%</b><span className="bar"><span style={{ width: `${progress(s)}%` }} /></span></span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="muted small">{fill(t.teach.stCount, { n: String(shown.length) })}</p>
            </>
          )}
        </section>

        {open ? <StudentCard key={open.enrollmentId} s={open} onClose={() => setOpenId(null)} onNote={(note) => update(open.studentId, { note })} />
          : list && !!list.length && <aside className="panel stu-detail stu-detail-empty"><UsersRound size={36} aria-hidden /><p className="muted">{t.teach.stPick}</p></aside>}
      </div>
    </TeachLayout>
  );
}

function StudentCard({ s, onClose, onNote }: { s: MyStudent; onClose(): void; onNote(note: string | null): void }) {
  const { t, lang, fill } = useI18n();
  const [note, setNote] = useState(s.note ?? '');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const saveNote = async () => {
    try { const r = await api.teacher.saveStudentNote(s.studentId, note); onNote(r.note); setMsg({ tone: 'info', text: t.teach.stNoteSaved }); }
    catch (e) { setMsg({ tone: 'error', text: errorText(t, e) }); }
  };
  const report = async () => {
    try { await api.teacher.reportStudent(s.studentId, reason, details); setReporting(false); setDetails(''); setMsg({ tone: 'info', text: t.teach.stReported }); }
    catch (e) { setMsg({ tone: 'error', text: errorText(t, e) }); }
  };
  const facts: [typeof BookOpen, string, string][] = [
    [BookOpen, t.teach.courseLabel, s.courseTitle],
    [UsersRound, t.teach.stGroup, s.classLabel ?? dayShort(s.classStartsAt, lang)],
    [CalendarDays, t.teach.stEnrolled, dayShort(s.enrolledAt, lang)],
    [CalendarCheck, t.teach.stLastClass, s.lastMeetingAt ? dayShort(s.lastMeetingAt, lang) : '—'],
    [CalendarCheck, t.teach.stAttended, fill(t.teach.stAttendedValue, { a: String(s.meetingsAttended), n: String(s.meetingsTotal) })],
    [Globe2, t.teach.stLanguage, NATIVE_NAMES[s.languageCode]],
  ];

  return (
    <aside className="panel stu-detail" aria-label={s.name}>
      <button type="button" className="icon-btn stu-close" onClick={onClose} aria-label={t.teach.stCancel}><X size={20} /></button>
      <div className="stu-id">
        <Avatar url={s.avatarUrl} name={s.name} size={84} />
        <div><h2>{s.name}</h2><span className={`stu-state stu-state-${s.state}`}><i aria-hidden />{t.teach[`state_${s.state}` as const]}</span></div>
      </div>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <h3 className="sub">{t.teach.stInfo}</h3>
      <dl className="stu-facts">
        {facts.map(([Icon, k, v]) => <div key={k}><dt><Icon size={18} aria-hidden />{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <label className="lfield"><span><NotebookPen size={16} aria-hidden /> {t.teach.stNote}</span>
        <textarea id="stu-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        <small className="muted">{t.teach.stNoteHint}</small></label>
      <button type="button" className="btn-small btn-blue-soft" disabled={note === (s.note ?? '')} onClick={saveNote}>{t.teach.stSaveNote}</button>
      <p className="muted small">{t.teach.stLater}</p>
      {!reporting ? (
        <button type="button" className="btn-plain danger stu-report-btn" onClick={() => setReporting(true)}><Flag size={16} aria-hidden /> {t.teach.stReport}</button>
      ) : (
        <div className="stu-report">
          <p className="muted small">{t.teach.stReportHint}</p>
          <label className="lfield"><span>{t.teach.stReason}</span>
            <select id="stu-reason" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
              {REASONS.map((r) => <option key={r} value={r}>{t.teach[`reason_${r}` as const]}</option>)}</select></label>
          <label className="lfield"><span>{t.teach.stDetails}</span><textarea id="stu-details" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
          <div className="wizard-nav">
            <button type="button" className="btn-small btn-blue-soft" onClick={() => setReporting(false)}>{t.teach.stCancel}</button>
            <button type="button" className="btn-small btn-danger" onClick={report}><Flag size={16} aria-hidden />{t.teach.stSend}</button>
          </div>
        </div>
      )}
    </aside>
  );
}
