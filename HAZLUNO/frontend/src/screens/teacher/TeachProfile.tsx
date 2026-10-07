import { BadgeCheck, Briefcase, CalendarClock, Camera, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Eye, FileCheck2, Globe2, Lightbulb, Link2, Pencil, PlayCircle, Send, Star, Tag, UserRound, Video } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, type Experience, type InstructorProfile, type LanguageCode, type ProfileLink } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { usePublicConfig } from '../../state/config';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { errorText, fieldTexts } from '../../ui/errors';
import { Banner } from '../../ui/kit';
import { VerificationCard } from './TeachHome';
import { TeachLayout } from './TeachLayout';

type Form = Omit<InstructorProfile, 'verificationStatus' | 'rejectionReason' | 'agreementAcceptedAt'>;
const STEP_FIELDS: (keyof Form | 'teachingLanguages')[][] = [
  ['phone', 'city'],
  ['headline', 'bio', 'specialties', 'teachingLanguages', 'experience', 'links'],
  ['legalEntityType', 'legalName', 'taxId', 'taxCountry', 'businessAddress'],
  [],
  [],
];
const LAST = 4;
const LINK_KINDS: ProfileLink['kind'][] = ['instagram', 'youtube', 'website'];

/** Teacher sign-up in 4 steps (owner reference): personal → professional → documents → review & send. */
export function TeachProfile() {
  const { t, lang, fill, countryName } = useI18n();
  const { me, refresh } = useSession();
  const { config } = usePublicConfig();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [p, setP] = useState<InstructorProfile | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [specialties, setSpecialties] = useState('');
  const [step, setStep] = useState(0);
  const [agree, setAgree] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const load = (x: InstructorProfile) => {
    setP(x);
    const { verificationStatus: _v, rejectionReason: _r, agreementAcceptedAt: _a, ...rest } = x;
    setAgree(!!x.agreementAcceptedAt);
    setForm(rest);
    setSpecialties(x.specialties.join(', '));
  };
  useEffect(() => { api.teacher.profile().then(load, () => undefined); }, []);
  const countries = useMemo(() => (config?.countries ?? []).map((c) => ({ code: c.code, name: countryName(c.code) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang)), [config, countryName, lang]);
  if (!p || !form || !me) return <TeachLayout title={t.teach.profileTitle}><span /></TeachLayout>;

  const locked = ['under_review', 'approved', 'suspended'].includes(p.verificationStatus);
  const canSubmit = p.verificationStatus === 'pending' || p.verificationStatus === 'rejected';
  const steps = [t.teach.stepPersonal, t.teach.stepProfessional, t.teach.stepDocuments, t.teach.stepPayments, t.teach.stepReview];
  const linkOf = (kind: ProfileLink['kind']) => form.links.find((l) => l.kind === kind)?.url ?? '';
  const setLink = (kind: ProfileLink['kind'], url: string) =>
    setForm({ ...form, links: [...form.links.filter((l) => l.kind !== kind), ...(url.trim() ? [{ kind, url: url.trim() }] : [])] });
  const linkError = (kind: ProfileLink['kind']) => { const i = form.links.findIndex((l) => l.kind === kind); return i >= 0 ? fields[`links.${i}.url`] : undefined; };
  const expLabel = (e: Experience) => t.teach[`exp_${e}` as const];

  /** Saves what was typed; jumps to the first step that still has a problem. */
  const save = async (): Promise<boolean> => {
    setFields({}); setMsg(null);
    try {
      load(await api.teacher.saveProfile({ ...form, specialties: specialties.split(',').map((s) => s.trim()).filter(Boolean) }));
      return true;
    } catch (err) {
      const f = fieldTexts(t, err);
      setFields(f); setMsg({ tone: 'error', text: errorText(t, err) });
      const bad = STEP_FIELDS.findIndex((list) => list.some((k) => f[k] || Object.keys(f).some((x) => x.startsWith(`${k}.`))));
      if (bad >= 0) setStep(bad);
      return false;
    }
  };
  const next = async () => { if (await save()) setStep((s) => Math.min(LAST, s + 1)); };
  const submit = async () => {
    if (!(await save())) return;
    try { load(await api.teacher.submit(agree)); setMsg({ tone: 'info', text: t.teach.statusReview }); }
    catch (err) {
      const f = fieldTexts(t, err);
      setFields(f); setMsg({ tone: 'error', text: errorText(t, err) });
      const bad = STEP_FIELDS.findIndex((list) => list.some((k) => f[k]));
      if (bad >= 0) setStep(bad);
    }
  };
  const cover = async (file?: File) => { if (file) try { load(await api.teacher.uploadProfileCover(file)); } catch (err) { setMsg({ tone: 'error', text: errorText(t, err) }); } };
  const photo = async (file?: File) => { if (file) try { refresh(await api.uploadAvatar(file)); } catch (err) { setMsg({ tone: 'error', text: errorText(t, err) }); } };

  const input = (k: keyof Form, label: string, o: { area?: boolean; hint?: string; disabled?: boolean; type?: string; auto?: string } = {}) => (
    <label className="lfield"><span>{label}</span>
      {o.area
        ? <textarea id={`tp-${k}`} value={(form[k] as string | null) ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} disabled={o.disabled} />
        : <input id={`tp-${k}`} type={o.type ?? 'text'} autoComplete={o.auto} value={(form[k] as string | null) ?? ''} placeholder={o.hint}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })} disabled={o.disabled} />}
      {fields[k] && <em>{fields[k]}</em>}
    </label>
  );
  const select = (k: 'legalEntityType' | 'taxCountry', label: string, options: [string, string][]) => (
    <label className="lfield"><span>{label}</span>
      <select id={`tp-${k}`} value={(form[k] as string | null) ?? ''} disabled={locked} onChange={(e) => setForm({ ...form, [k]: e.target.value || null })}>
        <option value="">—</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>{fields[k] && <em>{fields[k]}</em>}
    </label>
  );
  const review: [number, string, string][] = [
    [0, t.teach.phone, form.phone ?? '—'], [0, t.teach.city, form.city ?? '—'],
    [1, t.teach.headline, form.headline ?? '—'], [1, t.teach.teachingLanguages, form.teachingLanguages.map((l) => NATIVE_NAMES[l]).join(', ') || '—'],
    [1, t.teach.specialties, specialties || '—'], [1, t.teach.experience, form.experience ? expLabel(form.experience) : '—'],
    [1, t.teach.links, form.links.map((l) => l.url).join(' · ') || '—'],
    [2, t.teach.legalName, form.legalName ?? '—'], [2, t.teach.taxId, `${form.taxId ?? '—'}${form.taxCountry ? ` (${countryName(form.taxCountry)})` : ''}`],
    [2, t.teach.address, form.businessAddress ?? '—'],
  ];
  const why: [typeof Globe2, string, string][] = [
    [Globe2, t.teach.why1t, t.teach.why1], [Video, t.teach.why2t, t.teach.why2], [CalendarClock, t.teach.why3t, t.teach.why3],
    [Tag, t.teach.why4t, t.teach.why4], [BadgeCheck, t.teach.why5t, t.teach.why5],
  ];

  return (
    <TeachLayout title={t.teach.profileTitle}>
      <div className="wizard-wrap">
        <div className="wizard">
          <VerificationCard profile={p} showAction={false} />
          <ol className="steps">
            {steps.map((label, i) => (
              <li key={label} className={`${i === step ? 'step-on' : ''}${i < step ? ' step-done' : ''}`}>
                <button type="button" onClick={() => setStep(i)}><span>{i + 1}</span>{label}</button>
              </li>
            ))}
          </ol>
          {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}

          <section className="panel form-light">
            {step === 0 && <>
              <div className="step-title"><span className="step-icon"><UserRound size={26} /></span><div><h2>{t.teach.stepPersonal}</h2><p className="muted">{t.teach.personalHint}</p></div></div>
              <div className="row-2">
                <label className="lfield"><span>{t.signup.name}</span><input value={me.displayName} disabled /></label>
                <label className="lfield"><span>{t.profile.email}</span><input value={me.email} disabled /></label>
              </div>
              <div className="row-2">
                {input('phone', t.teach.phone, { hint: '+34 612 345 678', type: 'tel', auto: 'tel' })}
                {input('city', t.teach.city, { auto: 'address-level2' })}
              </div>
              <div className="photo-row">
                <button type="button" className="avatar-edit avatar-edit-dark" onClick={() => fileRef.current?.click()} aria-label={t.teach.uploadPhoto}>
                  <Avatar url={me.avatarUrl} name={me.displayName} size={104} /><span className="avatar-edit-badge"><Camera size={18} aria-hidden /></span>
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => photo(e.target.files?.[0])} />
                <div><strong>{t.teach.photo}</strong><p className="muted">{t.teach.photoHint}</p>
                  <button type="button" className="btn-small btn-blue-soft" onClick={() => fileRef.current?.click()}><Camera size={18} aria-hidden />{t.teach.uploadPhoto}</button>
                  <p className="muted small">{t.teach.photoFormats}</p></div>
              </div>
            </>}

            {step === 1 && <>
              <div className="step-title"><span className="step-icon"><Pencil size={24} /></span><div><h2>{t.teach.stepProfessional}</h2><p className="muted">{t.teach.professionalHint}</p></div></div>
              <div className="cover-edit">
                {p.coverUrl ? <img src={p.coverUrl} alt="" /> : <div className="preview-cover" aria-hidden />}
                <button type="button" className="btn-small cover-btn" onClick={() => coverRef.current?.click()}><Camera size={18} aria-hidden />{p.coverUrl ? t.teach.changeProfileCover : t.teach.coverTitle}</button>
                <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => cover(e.target.files?.[0])} />
              </div>
              <p className="muted small">{t.teach.coverHint}</p>
              <div className="row-2 row-2-wide">
                {input('headline', t.teach.headline, { hint: t.teach.headlineHint })}
                <label className="lfield"><span>{t.teach.experience}</span>
                  <select id="tp-experience" value={form.experience ?? ''} onChange={(e) => setForm({ ...form, experience: (e.target.value || null) as Experience | null })}>
                    <option value="">—</option>{(['lt1', '1_3', '3_5', '5_10', 'gt10'] as const).map((x) => <option key={x} value={x}>{expLabel(x)}</option>)}
                  </select></label>
              </div>
              {input('bio', t.teach.bio, { area: true })}
              <label className="lfield"><span>{t.teach.specialties}</span><input id="tp-specialties" value={specialties} onChange={(e) => setSpecialties(e.target.value)} /></label>
              <fieldset className="lfield checks"><span>{t.teach.teachingLanguages}</span>
                <div className="check-grid">
                  {LANGUAGES.map((l) => (
                    <label key={l} className="check-line"><input type="checkbox" checked={form.teachingLanguages.includes(l)}
                      onChange={(e) => setForm({ ...form, teachingLanguages: e.target.checked ? [...form.teachingLanguages, l] : form.teachingLanguages.filter((x) => x !== l) as LanguageCode[] })} />{NATIVE_NAMES[l]}</label>
                  ))}
                </div>
                {fields.teachingLanguages && <em>{fields.teachingLanguages}</em>}
              </fieldset>
              <fieldset className="lfield checks"><span>{t.teach.links}</span>
                <small className="muted">{t.teach.linksHint}</small>
                {LINK_KINDS.map((kind) => {
                  const Icon = kind === 'instagram' ? Camera : kind === 'youtube' ? PlayCircle : Link2;
                  return (
                    <div key={kind} className="link-input">
                      <Icon size={20} aria-hidden />
                      <input id={`tp-link-${kind}`} type="url" inputMode="url" placeholder={kind === 'website' ? `${t.teach.linkWebsite} — https://…` : `https://${kind}.com/…`}
                        aria-label={kind === 'website' ? t.teach.linkWebsite : kind} value={linkOf(kind)} onChange={(e) => setLink(kind, e.target.value)} />
                      {linkError(kind) && <em>{linkError(kind)}</em>}
                    </div>
                  );
                })}
              </fieldset>
            </>}

            {step === 2 && <>
              <div className="step-title"><span className="step-icon"><FileCheck2 size={24} /></span><div><h2>{t.teach.stepDocuments}</h2><p className="muted">{t.teach.documentsHint}</p></div></div>
              {locked && <p className="muted">{t.teach.lockedLegal}</p>}
              {select('legalEntityType', t.teach.entityType, [['individual', t.teach.individual], ['company', t.teach.company]])}
              {input('legalName', t.teach.legalName, { disabled: locked })}
              <div className="row-2">
                {input('taxId', t.teach.taxId, { disabled: locked })}
                {select('taxCountry', t.teach.taxCountry, countries.map((c) => [c.code, c.name]))}
              </div>
              {input('businessAddress', t.teach.address, { disabled: locked })}
              <div className="identity-later"><strong>{t.teach.identityTitle}</strong><p>{t.teach.identityLater}</p></div>
            </>}

            {step === 3 && <>
              <div className="step-title"><span className="step-icon"><CreditCard size={24} /></span><div><h2>{t.teach.stepPayments}</h2><p className="muted">{t.teach.paymentsHint}</p></div></div>
              <div className="identity-later"><p>{t.teach.paymentsLater}</p></div>
            </>}

            {step === 4 && <>
              <div className="step-title"><span className="step-icon"><Send size={24} /></span><div><h2>{t.teach.stepReview}</h2><p className="muted">{t.teach.reviewHint}</p></div></div>
              <dl className="kv review-kv">
                {review.map(([s, k, v]) => <div key={k} className="kv-row"><dt>{k}</dt><dd>{v}</dd><button type="button" className="btn-plain" onClick={() => setStep(s)}>{t.teach.edit}</button></div>)}
              </dl>
              <div className="pay-rule agreement">
                <strong>{t.legal.teacherAgreement}</strong>
                <a href="/teacher-agreement" target="_blank" rel="noopener">{t.legal.readAgreement}</a>
                <label className="check-line"><input id="tp-agree" type="checkbox" checked={agree} disabled={!canSubmit} onChange={(e) => setAgree(e.target.checked)} />{t.legal.acceptAgreement}</label>
                {fields.acceptAgreement && <em className="row-error">{fields.acceptAgreement}</em>}
              </div>
            </>}

            <div className="wizard-nav">
              {step > 0 ? <button type="button" className="btn-small btn-blue-soft" onClick={() => setStep(step - 1)}><ChevronLeft size={18} aria-hidden />{t.teach.previous}</button> : <span />}
              {step < LAST && <button type="button" className="btn-small btn-orange-solid" onClick={next}>{t.teach.next}<ChevronRight size={18} aria-hidden /></button>}
              {step === LAST && (canSubmit
                ? <button type="button" className="btn-small btn-orange-solid" disabled={!agree} onClick={submit}><Send size={18} aria-hidden />{t.teach.submit}</button>
                : <button type="button" className="btn-small btn-blue-soft" onClick={() => void save().then((ok) => ok && setMsg({ tone: 'info', text: t.teach.saved }))}>{t.teach.saveDraft}</button>)}
            </div>
          </section>
        </div>

        <aside className="why">
          {step === 0 ? (
            <>
              <div className="why-hero">
                <img src="/signup-teach.webp" alt="" />
                <div><h2>{t.teach.heroTitle}</h2><p>{t.teach.heroText}</p></div>
              </div>
              <section className="panel">
                <h2>{t.teach.whyTitle}</h2>
                <ul className="why-list">
                  {why.map(([Icon, title, text], i) => <li key={title}><span className={`why-icon why-${i}`}><Icon size={22} aria-hidden /></span><div><strong>{title}</strong><span>{text}</span></div></li>)}
                </ul>
              </section>
            </>
          ) : (
            <>
              <section className="panel preview">
                <h2><Eye size={20} aria-hidden /> {t.teach.preview}</h2>
                <div className="preview-card">
                  {p.coverUrl ? <img className="preview-cover preview-cover-img" src={p.coverUrl} alt="" /> : <div className="preview-cover" aria-hidden />}
                  <Avatar url={me.avatarUrl} name={me.displayName} size={88} />
                  <strong>{me.displayName} {p.verificationStatus === 'approved' && <BadgeCheck className="verified" size={20} aria-label={t.teach.verified} />}</strong>
                  <span className="preview-rating"><Star size={16} fill="currentColor" aria-hidden />{t.card.newTeacher}</span>
                  <ul>
                    {form.headline && <li><UserRound size={16} aria-hidden />{form.headline}</li>}
                    {form.experience && <li><Briefcase size={16} aria-hidden />{expLabel(form.experience)}</li>}
                    {!!form.teachingLanguages.length && <li><Globe2 size={16} aria-hidden />{fill(t.teach.teachesIn, { langs: form.teachingLanguages.map((l) => NATIVE_NAMES[l]).join(', ') })}</li>}
                  </ul>
                  <div className="role-chips">{specialties.split(',').map((x) => x.trim()).filter(Boolean).map((x) => <span key={x} className="role-chip role-chip-blue">{x}</span>)}</div>
                </div>
              </section>
              <section className="panel tips">
                <h2><Lightbulb size={20} aria-hidden /> {t.teach.tipsTitle}</h2>
                <ul>{[t.teach.tip1, t.teach.tip2, t.teach.tip3, t.teach.tip4].map((x) => <li key={x}><CheckCircle2 size={18} aria-hidden />{x}</li>)}</ul>
              </section>
            </>
          )}
        </aside>
      </div>
    </TeachLayout>
  );
}
