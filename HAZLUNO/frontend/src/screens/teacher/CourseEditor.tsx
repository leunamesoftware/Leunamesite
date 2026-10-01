import { Camera, Eye, Send, Trash2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LANGUAGES, type CourseInput, type InstructorCourse, type Level } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { useCategories } from '../../ui/categories';
import { PeriodIcon, useClassWhen, useMeetingTime } from '../../ui/classes';
import { errorText, fieldTexts } from '../../ui/errors';
import { money } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { GroupForm } from './GroupForm';
import { TeachLayout } from './TeachLayout';

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);
const empty: CourseInput = { title: '', summary: '', description: '', categoryId: 'other', languageCode: 'es', level: 'beginner',
  learningOutcomes: [], requiredMaterials: [], recommendedMaterials: [], isHazardous: false, safetyNotice: '', certificateEnabled: true };

/** Create / edit a course, its cover and its groups (turmas). */
export function CourseEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { t, lang, fill } = useI18n();
  const navigate = useNavigate();
  const categories = useCategories(lang);
  const coverRef = useRef<HTMLInputElement>(null);
  const [course, setCourse] = useState<InstructorCourse | null>(null);
  const [f, setF] = useState<CourseInput>({ ...empty, languageCode: lang });
  const [text, setText] = useState({ outcomes: '', required: '', recommended: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [showGroup, setShowGroup] = useState(false);
  const when = useClassWhen();
  const meetingTime = useMeetingTime();

  const load = (c: InstructorCourse) => {
    setCourse(c);
    setF({ title: c.title, summary: c.summary ?? '', description: c.description ?? '', categoryId: c.categoryId, languageCode: c.languageCode,
      level: c.level, isHazardous: c.isHazardous, safetyNotice: c.safetyNotice ?? '', certificateEnabled: c.certificateEnabled });
    setText({ outcomes: c.learningOutcomes.join('\n'), required: c.requiredMaterials.join('\n'), recommended: c.recommendedMaterials.join('\n') });
  };
  useEffect(() => { if (id) api.teacher.course(id).then(load, () => navigate('/teach', { replace: true })); }, [id, navigate]);

  const fail = (err: unknown) => { setFields(fieldTexts(t, err)); setMsg({ tone: 'error', text: errorText(t, err) }); };
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setFields({}); setMsg(null);
    const body: CourseInput = { ...f, learningOutcomes: lines(text.outcomes), requiredMaterials: lines(text.required), recommendedMaterials: lines(text.recommended),
      safetyNotice: f.isHazardous ? f.safetyNotice : null };
    try {
      const c = isNew ? await api.teacher.createCourse(body) : await api.teacher.updateCourse(id!, body);
      load(c); setMsg({ tone: 'info', text: t.teach.courseSaved });
      if (isNew) navigate(`/teach/courses/${c.id}`, { replace: true });
      return c;
    } catch (err) { fail(err); return null; }
  };
  const publish = async () => { const c = await save(); if (c) try { load(await api.teacher.publishCourse(c.id)); } catch (err) { fail(err); } };
  const cover = async (file?: File) => { if (file && course) try { load(await api.teacher.uploadCover(course.id, file)); } catch (err) { fail(err); } };
  const refresh = async () => course && load(await api.teacher.course(course.id));
  const classAction = async (fn: () => Promise<unknown>) => { setMsg(null); try { await fn(); await refresh(); } catch (err) { fail(err); } };

  const input = (k: 'title' | 'summary', label: string) => (
    <label className="lfield"><span>{label}</span><input id={`ce-${k}`} value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />{fields[k] && <em>{fields[k]}</em>}</label>
  );
  const area = (k: keyof typeof text, label: string) => (
    <label className="lfield"><span>{label}</span><textarea id={`ce-${k}`} value={text[k]} onChange={(e) => setText({ ...text, [k]: e.target.value })} /></label>
  );
  const statusLabel = { draft: t.teach.statusDraft, published: t.teach.statusPublished, archived: t.teach.statusArchived, pending_review: t.teach.statusDraft, rejected: t.teach.statusDraft };

  return (
    <TeachLayout title={isNew ? t.teach.newCourse : course?.title ?? '…'} back="/teach">
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      {course && (
        <section className="panel cover-panel">
          {course.coverUrl ? <img src={course.coverUrl} alt="" /> : <div className="tcourse-img cover-empty" aria-hidden />}
          <div>
            <span className={`badge badge-${course.status}`}>{statusLabel[course.status]}</span>
            <button type="button" className="btn-small btn-blue-soft" onClick={() => coverRef.current?.click()}><Camera size={18} aria-hidden />{course.coverUrl ? t.teach.changeCover : t.teach.cover}</button>
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => cover(e.target.files?.[0])} />
            {course.status === 'published' && <Link className="link-arrow" to={`/course/${course.id}`}><Eye size={18} aria-hidden />{t.teach.viewPublic}</Link>}
          </div>
        </section>
      )}
      <form className="panel form-light" onSubmit={save} noValidate>
        {input('title', t.teach.courseTitle)}
        {input('summary', t.teach.summary)}
        <label className="lfield"><span>{t.teach.description}</span>
          <textarea id="ce-description" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />{fields.description && <em>{fields.description}</em>}</label>
        <div className="row-2">
          <label className="lfield"><span>{t.teach.category}</span>
            <select id="ce-category" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="lfield"><span>{t.teach.courseLanguage}</span>
            <select id="ce-lang" value={f.languageCode} onChange={(e) => setF({ ...f, languageCode: e.target.value as CourseInput['languageCode'] })}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{NATIVE_NAMES[l]}</option>)}</select></label>
        </div>
        <label className="lfield"><span>{t.teach.level}</span>
          <select id="ce-level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as Level })}>
            {(['beginner', 'intermediate', 'advanced', 'all_levels'] as const).map((l) => <option key={l} value={l}>{t.levels[l]}</option>)}</select></label>
        {area('outcomes', t.teach.outcomes)}
        <div className="row-2">{area('required', t.teach.requiredMat)}{area('recommended', t.teach.recommendedMat)}</div>
        <label className="check-line"><input type="checkbox" checked={!!f.isHazardous} onChange={(e) => setF({ ...f, isHazardous: e.target.checked })} />{t.teach.hazardous}</label>
        {f.isHazardous && <label className="lfield"><span>{t.teach.safetyNotice}</span>
          <textarea id="ce-safety" value={f.safetyNotice ?? ''} onChange={(e) => setF({ ...f, safetyNotice: e.target.value })} />{fields.safetyNotice && <em>{fields.safetyNotice}</em>}</label>}
        <label className="check-line"><input type="checkbox" checked={f.certificateEnabled !== false} onChange={(e) => setF({ ...f, certificateEnabled: e.target.checked })} />{t.teach.certificate}</label>
        <div className="form-actions">
          <button className="btn-small btn-blue-soft">{t.teach.saveCourse}</button>
          {course?.status === 'draft' && <button type="button" className="btn-small btn-orange-solid" onClick={publish}><Send size={18} aria-hidden />{t.teach.publishCourse}</button>}
        </div>
      </form>

      {course && (
        <section className="panel">
          <div className="section-head"><h2>{t.teach.groups}</h2>
            {!showGroup && <button type="button" className="btn-small btn-orange-solid" onClick={() => setShowGroup(true)}>{t.teach.newGroup}</button>}</div>
          {!course.classes.length && !showGroup && <p className="muted">{t.teach.noGroups}</p>}
          <ul className="group-list">
            {course.classes.map((k) => (
              <li key={k.id} className={`group tgroup${k.status === 'canceled' ? ' group-off' : ''}`}>
                <PeriodIcon iso={k.startsAt} />
                <div>
                  <strong>{k.label ? `${k.label} · ` : ''}{when(k)}</strong>
                  <span className="muted">{meetingTime(k.meetings[0]!).range} · {k.priceCents === 0 ? t.card.free : money(k.priceCents, k.currency, lang)} · {fill(t.teach.seatsTaken, { n: String(k.capacity - k.seatsLeft), cap: String(k.capacity) })}</span>
                  {k.status === 'draft' && <span className="muted">{t.teach.groupDraftNote}</span>}
                </div>
                <span className={`badge badge-${k.status}`}>{t.teach.classStatus[k.status]}</span>
                <div className="tgroup-actions">
                  {k.status === 'draft' && <>
                    <button type="button" className="btn-small btn-orange-solid" onClick={() => classAction(() => api.teacher.publishClass(k.id))}>{t.teach.publishGroup}</button>
                    <button type="button" className="btn-plain" onClick={() => classAction(() => api.teacher.deleteClass(k.id))}><Trash2 size={16} aria-hidden /> {t.teach.deleteGroup}</button>
                  </>}
                  {k.status === 'enrollment_open' && k.access.badge === 'starts_on' && (
                    <button type="button" className="btn-plain danger" onClick={() => { if (confirm(t.teach.confirmCancel)) void classAction(() => api.teacher.cancelClass(k.id, '')); }}>
                      <XCircle size={16} aria-hidden /> {t.teach.cancelGroup}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {showGroup && <GroupForm courseId={course.id} onCreated={() => { setShowGroup(false); void refresh(); }} />}
          <p className="muted small">{fill(t.teach.openingFeeNote, {})}</p>
        </section>
      )}
    </TeachLayout>
  );
}
