import { BarChart3, BookOpen, Camera, CheckCircle2, ChevronLeft, ChevronRight, Eye, Globe2, ImageIcon, Lightbulb, ListChecks, Pencil, Plus, Send, Trash2, Users, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LANGUAGES, type CourseInput, type InstructorCourse, type Level } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { useCategories } from '../../ui/categories';
import { PeriodIcon, useClassWhen, useMeetingTime } from '../../ui/classes';
import { errorText, fieldTexts } from '../../ui/errors';
import { money } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { TeachLayout } from './TeachLayout';

const empty: CourseInput = { title: '', summary: '', description: '', categoryId: 'other', languageCode: 'es', level: 'beginner',
  learningOutcomes: [], requiredMaterials: [], recommendedMaterials: [], isHazardous: false, safetyNotice: '', certificateEnabled: true };
type ListKey = 'learningOutcomes' | 'requiredMaterials' | 'recommendedMaterials';
const STEP_FIELDS: string[][] = [
  ['title', 'summary', 'description', 'categoryId', 'languageCode', 'level', 'learningOutcomes'],
  ['requiredMaterials', 'recommendedMaterials', 'safetyNotice'],
  [], [],
];
const LAST = 3;
const DESC_MAX = 5000;

/** Editable list of short lines (what students learn, materials). */
function ListEdit({ id, items, onChange, addLabel, removeLabel, max, error }: {
  id: string; items: string[]; onChange(v: string[]): void; addLabel: string; removeLabel: string; max: number; error?: string;
}) {
  return (
    <div className="list-edit">
      {items.map((v, i) => (
        <div key={i} className="list-edit-row">
          <CheckCircle2 size={20} aria-hidden />
          <input id={`${id}-${i}`} value={v} maxLength={160} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="icon-btn" aria-label={removeLabel} onClick={() => onChange(items.filter((_, j) => j !== i))}><X size={18} /></button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="btn-small btn-blue-soft list-edit-add" onClick={() => onChange([...items, ''])}><Plus size={18} aria-hidden />{addLabel}</button>
      )}
      {error && <em className="row-error">{error}</em>}
    </div>
  );
}

/** "Crear curso" in 4 steps (owner reference). Hours, meetings and price belong to each group, not to the course. */
export function CourseEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { t, lang, fill } = useI18n();
  const { me } = useSession();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const categories = useCategories(lang);
  const coverRef = useRef<HTMLInputElement>(null);
  const [course, setCourse] = useState<InstructorCourse | null>(null);
  const [approved, setApproved] = useState(false);
  const [f, setF] = useState<CourseInput>({ ...empty, languageCode: lang });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const when = useClassWhen();
  const meetingTime = useMeetingTime();
  const step = Math.min(LAST, Math.max(0, Number(search.get('step') ?? (isNew ? 0 : LAST)) || 0));
  const goStep = (s: number) => setSearch({ step: String(s) }, { replace: true });

  const load = (c: InstructorCourse) => {
    setCourse(c);
    setF({ title: c.title, summary: c.summary ?? '', description: c.description ?? '', categoryId: c.categoryId, languageCode: c.languageCode,
      level: c.level, isHazardous: c.isHazardous, safetyNotice: c.safetyNotice ?? '', certificateEnabled: c.certificateEnabled,
      learningOutcomes: c.learningOutcomes, requiredMaterials: c.requiredMaterials, recommendedMaterials: c.recommendedMaterials });
  };
  useEffect(() => { if (id) api.teacher.course(id).then(load, () => navigate('/teach', { replace: true })); }, [id, navigate]);
  useEffect(() => { api.teacher.profile().then((p) => setApproved(p.verificationStatus === 'approved'), () => undefined); }, []);

  const fail = (err: unknown) => {
    const fe = fieldTexts(t, err);
    setFields(fe); setMsg({ tone: 'error', text: errorText(t, err) });
    const bad = STEP_FIELDS.findIndex((list) => list.some((k) => Object.keys(fe).some((x) => x === k || x.startsWith(`${k}.`))));
    if (bad >= 0) goStep(bad);
  };
  const clean = (v?: string[]) => (v ?? []).map((s) => s.trim()).filter(Boolean);
  const save = async (): Promise<InstructorCourse | null> => {
    setFields({}); setMsg(null);
    const body: CourseInput = { ...f, learningOutcomes: clean(f.learningOutcomes), requiredMaterials: clean(f.requiredMaterials),
      recommendedMaterials: clean(f.recommendedMaterials), safetyNotice: f.isHazardous ? f.safetyNotice : null };
    try {
      const c = isNew ? await api.teacher.createCourse(body) : await api.teacher.updateCourse(id!, body);
      load(c);
      return c;
    } catch (err) { fail(err); return null; }
  };
  const next = async () => {
    const c = await save();
    if (!c) return;
    if (isNew) navigate(`/teach/courses/${c.id}?step=${step + 1}`, { replace: true });
    else goStep(step + 1);
  };
  const publish = async () => {
    const c = await save();
    if (c) try { load(await api.teacher.publishCourse(c.id)); setMsg({ tone: 'info', text: t.teach.coursePublished }); } catch (err) { fail(err); }
  };
  const cover = async (file?: File) => { if (file && course) try { load(await api.teacher.uploadCover(course.id, file)); } catch (err) { fail(err); } };
  const refresh = async () => course && load(await api.teacher.course(course.id));
  const classAction = async (fn: () => Promise<unknown>) => { setMsg(null); try { await fn(); await refresh(); } catch (err) { fail(err); } };

  const text = (k: 'title' | 'summary', label: string, max: number) => (
    <label className="lfield"><span>{label}</span>
      <input id={`ce-${k}`} maxLength={max} value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />{fields[k] && <em>{fields[k]}</em>}</label>
  );
  const listError = (k: ListKey) => fields[k] ?? Object.entries(fields).find(([x]) => x.startsWith(`${k}.`))?.[1];
  const list = (k: ListKey, max: number, addLabel: string) => (
    <ListEdit id={`ce-${k}`} items={f[k] ?? []} onChange={(v) => setF({ ...f, [k]: v })} addLabel={addLabel} removeLabel={t.teach.removeItem} max={max} error={listError(k)} />
  );
  const statusLabel = { draft: t.teach.statusDraft, published: t.teach.statusPublished, archived: t.teach.statusArchived, pending_review: t.teach.statusDraft, rejected: t.teach.statusDraft };
  const steps = [t.teach.cStepBasic, t.teach.cStepContent, t.teach.cStepImage, t.teach.cStepPublish];
  const categoryName = categories.find((c) => c.id === f.categoryId)?.name ?? '';
  const open = course?.classes.filter((k) => k.status !== 'canceled') ?? [];
  const minPrice = open.length ? Math.min(...open.map((k) => k.priceCents)) : null;
  const review: [number, string, string][] = [
    [0, t.teach.courseTitle, f.title || '—'], [0, t.teach.category, categoryName || '—'],
    [0, t.teach.level, t.levels[f.level]], [0, t.teach.courseLanguage, NATIVE_NAMES[f.languageCode]],
    [0, t.teach.summary, f.summary || '—'], [0, t.teach.outcomesTitle, clean(f.learningOutcomes).join(' · ') || '—'],
    [1, t.course.required, clean(f.requiredMaterials).join(' · ') || '—'], [1, t.teach.certificate, f.certificateEnabled !== false ? '✓' : '—'],
  ];

  return (
    <TeachLayout title={isNew ? t.teach.createCourse : course?.title ?? '…'} back="/teach">
      <div className="wizard-wrap">
        <div className="wizard">
          <ol className="steps steps-4">
            {steps.map((label, i) => (
              <li key={label} className={`${i === step ? 'step-on' : ''}${i < step ? ' step-done' : ''}`}>
                <button type="button" disabled={!course && i > 0} onClick={() => goStep(i)}><span>{i + 1}</span>{label}</button>
              </li>
            ))}
          </ol>
          {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}

          <section className="panel form-light">
            {step === 0 && <>
              <div className="step-title"><span className="step-icon"><Pencil size={24} /></span><div><h2>{t.teach.cStepBasic}</h2><p className="muted">{t.teach.cBasicHint}</p></div></div>
              <div className="row-2 row-2-wide">
                {text('title', t.teach.courseTitle, 120)}
                <label className="lfield"><span>{t.teach.category}</span>
                  <select id="ce-category" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              </div>
              <div className="row-2">
                <label className="lfield"><span>{t.teach.level}</span>
                  <select id="ce-level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as Level })}>
                    {(['beginner', 'intermediate', 'advanced', 'all_levels'] as const).map((l) => <option key={l} value={l}>{t.levels[l]}</option>)}</select></label>
                <label className="lfield"><span>{t.teach.courseLanguage}</span>
                  <select id="ce-lang" value={f.languageCode} onChange={(e) => setF({ ...f, languageCode: e.target.value as CourseInput['languageCode'] })}>
                    {LANGUAGES.map((l) => <option key={l} value={l}>{NATIVE_NAMES[l]}</option>)}</select></label>
              </div>
              {text('summary', t.teach.summary, 240)}
              <label className="lfield"><span>{t.teach.description}</span>
                <textarea id="ce-description" className="tall" maxLength={DESC_MAX} value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
                <small className="muted counter">{(f.description ?? '').length}/{DESC_MAX}</small>
                {fields.description && <em>{fields.description}</em>}</label>
              <div className="lfield"><span>{t.teach.outcomesTitle}</span><small className="muted">{t.teach.outcomesHint}</small>
                {list('learningOutcomes', 12, t.teach.addOutcome)}</div>
            </>}

            {step === 1 && <>
              <div className="step-title"><span className="step-icon"><ListChecks size={24} /></span><div><h2>{t.teach.cStepContent}</h2><p className="muted">{t.teach.cContentHint}</p></div></div>
              <div className="lfield"><span>{t.course.required}</span>{list('requiredMaterials', 20, t.teach.addItem)}</div>
              <div className="lfield"><span>{t.course.recommended}</span>{list('recommendedMaterials', 20, t.teach.addItem)}</div>
              <label className="check-line"><input type="checkbox" checked={!!f.isHazardous} onChange={(e) => setF({ ...f, isHazardous: e.target.checked })} />{t.teach.hazardous}</label>
              {f.isHazardous && <label className="lfield"><span>{t.teach.safetyNotice}</span>
                <textarea id="ce-safety" value={f.safetyNotice ?? ''} onChange={(e) => setF({ ...f, safetyNotice: e.target.value })} />{fields.safetyNotice && <em>{fields.safetyNotice}</em>}</label>}
              <label className="check-line"><input type="checkbox" checked={f.certificateEnabled !== false} onChange={(e) => setF({ ...f, certificateEnabled: e.target.checked })} />{t.teach.certificate}</label>
            </>}

            {step === 2 && course && <>
              <div className="step-title"><span className="step-icon"><ImageIcon size={24} /></span><div><h2>{t.teach.cStepImage}</h2><p className="muted">{t.teach.cImageHint}</p></div></div>
              <div className="cover-edit cover-edit-course">
                {course.coverUrl ? <img src={course.coverUrl} alt="" /> : <div className="preview-cover" aria-hidden />}
                <button type="button" className="btn-small cover-btn" onClick={() => coverRef.current?.click()}><Camera size={18} aria-hidden />{course.coverUrl ? t.teach.changeCover : t.teach.cover}</button>
                <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => cover(e.target.files?.[0])} />
              </div>
              <p className="muted small">{t.teach.coverSize}</p>
              <p className="muted small">{t.teach.videoLater}</p>
            </>}

            {step === 3 && course && <>
              <div className="step-title"><span className="step-icon"><Send size={24} /></span><div><h2>{t.teach.cStepPublish}</h2><p className="muted">{t.teach.cPublishHint}</p></div></div>
              <div className="publish-state">
                <span className={`badge badge-${course.status}`}>{statusLabel[course.status]}</span>
                {course.status === 'published' && <Link className="link-arrow" to={`/course/${course.id}`}><Eye size={18} aria-hidden />{t.teach.viewPublic}</Link>}
              </div>
              <dl className="kv review-kv">
                {review.map(([s, k, v]) => <div key={k} className="kv-row"><dt>{k}</dt><dd>{v}</dd><button type="button" className="btn-plain" onClick={() => goStep(s)}>{t.teach.edit}</button></div>)}
              </dl>

              <div className="section-head"><h3 className="sub">{t.teach.groups}</h3>
                <Link className="btn-small btn-orange-solid" to={`/teach/courses/${course.id}/groups/new`}><Plus size={18} aria-hidden />{t.teach.openGroup}</Link></div>
              {!course.classes.length && <p className="muted">{t.teach.noGroups}</p>}
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
                      {k.status === 'draft' && course.status === 'published' && (
                        <button type="button" className="btn-small btn-orange-solid" onClick={() => classAction(() => api.teacher.publishClass(k.id))}>{t.teach.publishGroup}</button>)}
                      {k.status === 'draft' && (
                        <button type="button" className="btn-plain" onClick={() => classAction(() => api.teacher.deleteClass(k.id))}><Trash2 size={16} aria-hidden /> {t.teach.deleteGroup}</button>)}
                      {k.status === 'enrollment_open' && k.access.badge === 'starts_on' && (
                        <button type="button" className="btn-plain danger" onClick={() => { if (confirm(t.teach.confirmCancel)) void classAction(() => api.teacher.cancelClass(k.id, '')); }}>
                          <XCircle size={16} aria-hidden /> {t.teach.cancelGroup}</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="muted small">{fill(t.teach.openingFeeNote, {})}</p>
              {course.status === 'draft' && !approved && <p className="muted small">{t.teach.publishNeedsApproval}</p>}
            </>}

            <div className="wizard-nav">
              {step > 0 ? <button type="button" className="btn-small btn-blue-soft" onClick={() => goStep(step - 1)}><ChevronLeft size={18} aria-hidden />{t.teach.previous}</button> : <span />}
              {step < LAST && <button type="button" className="btn-small btn-orange-solid" onClick={next}>{t.teach.next}<ChevronRight size={18} aria-hidden /></button>}
              {step === LAST && (course?.status === 'draft' && approved
                ? <button type="button" className="btn-small btn-orange-solid" onClick={publish}><Send size={18} aria-hidden />{t.teach.publishCourse}</button>
                : <button type="button" className="btn-small btn-blue-soft" onClick={() => void save().then((c) => c && setMsg({ tone: 'info', text: t.teach.courseSaved }))}>{t.teach.saveCourse}</button>)}
            </div>
          </section>
        </div>

        <aside className="why">
          <section className="panel preview">
            <h2><Eye size={20} aria-hidden /> {t.teach.coursePreview}</h2>
            <p className="muted small">{t.teach.coursePreviewHint}</p>
            <div className="cpreview">
              {course?.coverUrl ? <img src={course.coverUrl} alt="" /> : <div className="preview-cover" aria-hidden />}
              <div className="cpreview-body">
                <strong>{f.title || t.teach.courseTitle}</strong>
                {me && <span className="cpreview-teacher"><Avatar url={me.avatarUrl} name={me.displayName} size={28} />{me.displayName}</span>}
                <ul>
                  <li><BarChart3 size={16} aria-hidden />{t.levels[f.level]}</li>
                  <li><Globe2 size={16} aria-hidden />{NATIVE_NAMES[f.languageCode]}</li>
                  {categoryName && <li><BookOpen size={16} aria-hidden />{categoryName}</li>}
                  {!!open.length && <li><Users size={16} aria-hidden />{fill(t.card.meetings, { n: String(open[0]!.meetings.length) })}</li>}
                </ul>
                <span className="cpreview-price">{minPrice === null ? t.teach.priceByGroup
                  : minPrice === 0 ? t.card.free : `${t.card.fromPrice} ${money(minPrice, open[0]!.currency, lang)}`}</span>
              </div>
            </div>
          </section>
          <section className="panel tips">
            <h2><Lightbulb size={20} aria-hidden /> {t.teach.courseTipsTitle}</h2>
            <ul>{[t.teach.ctip1, t.teach.ctip2, t.teach.ctip3, t.teach.ctip4].map((x) => <li key={x}><CheckCircle2 size={18} aria-hidden />{x}</li>)}</ul>
          </section>
        </aside>
      </div>
    </TeachLayout>
  );
}
