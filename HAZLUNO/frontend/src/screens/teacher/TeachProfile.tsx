import { Send } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LANGUAGES, type InstructorProfile, type LanguageCode } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { usePublicConfig } from '../../state/config';
import { errorText, fieldTexts } from '../../ui/errors';
import { Banner } from '../../ui/kit';
import { VerificationCard } from './TeachHome';
import { TeachLayout } from './TeachLayout';

type Form = Omit<InstructorProfile, 'verificationStatus' | 'rejectionReason'>;

/** Verification form: public profile + legal details (needed to issue real certificates and get paid). */
export function TeachProfile() {
  const { t, lang, countryName } = useI18n();
  const { config } = usePublicConfig();
  const [p, setP] = useState<InstructorProfile | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [specialties, setSpecialties] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const load = (x: InstructorProfile) => {
    setP(x);
    const { verificationStatus: _v, rejectionReason: _r, ...rest } = x;
    setForm(rest);
    setSpecialties(x.specialties.join(', '));
  };
  useEffect(() => { api.teacher.profile().then(load, () => undefined); }, []);
  const countries = useMemo(() => (config?.countries ?? []).map((c) => ({ code: c.code, name: countryName(c.code) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang)), [config, countryName, lang]);
  if (!p || !form) return <TeachLayout title={t.teach.profileTitle}><span /></TeachLayout>;

  const locked = ['under_review', 'approved', 'suspended'].includes(p.verificationStatus);
  const body = (): Form => ({ ...form, specialties: specialties.split(',').map((s) => s.trim()).filter(Boolean) });
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setFields({}); setMsg(null);
    try { load(await api.teacher.saveProfile(body())); setMsg({ tone: 'info', text: t.teach.saved }); return true; }
    catch (err) { setFields(fieldTexts(t, err)); setMsg({ tone: 'error', text: errorText(t, err) }); return false; }
  };
  const submit = async () => {
    if (!(await save())) return;
    try { load(await api.teacher.submit()); setMsg(null); }
    catch (err) { setFields(fieldTexts(t, err)); setMsg({ tone: 'error', text: errorText(t, err) }); }
  };
  const text = (k: keyof Form, label: string, opts: { area?: boolean; hint?: string; disabled?: boolean } = {}) => (
    <label className="lfield"><span>{label}</span>
      {opts.area
        ? <textarea id={`tp-${k}`} value={(form[k] as string | null) ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} disabled={opts.disabled} />
        : <input id={`tp-${k}`} value={(form[k] as string | null) ?? ''} placeholder={opts.hint} onChange={(e) => setForm({ ...form, [k]: e.target.value })} disabled={opts.disabled} />}
      {fields[k] && <em>{fields[k]}</em>}
    </label>
  );

  return (
    <TeachLayout title={t.teach.profileTitle}>
      <VerificationCard profile={p} />
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <form className="panel form-light" onSubmit={save} noValidate>
        <h2>{t.teach.publicPart}</h2>
        {text('headline', t.teach.headline, { hint: t.teach.headlineHint })}
        {text('bio', t.teach.bio, { area: true })}
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

        <h2>{t.teach.legalPart}</h2>
        {locked && <p className="muted">{t.teach.lockedLegal}</p>}
        <label className="lfield"><span>{t.teach.entityType}</span>
          <select id="tp-entity" value={form.legalEntityType ?? ''} disabled={locked} onChange={(e) => setForm({ ...form, legalEntityType: (e.target.value || null) as Form['legalEntityType'] })}>
            <option value="">—</option><option value="individual">{t.teach.individual}</option><option value="company">{t.teach.company}</option>
          </select>{fields.legalEntityType && <em>{fields.legalEntityType}</em>}</label>
        {text('legalName', t.teach.legalName, { disabled: locked })}
        <div className="row-2">
          {text('taxId', t.teach.taxId, { disabled: locked })}
          <label className="lfield"><span>{t.teach.taxCountry}</span>
            <select id="tp-taxcountry" value={form.taxCountry ?? ''} disabled={locked} onChange={(e) => setForm({ ...form, taxCountry: e.target.value || null })}>
              <option value="">—</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>{fields.taxCountry && <em>{fields.taxCountry}</em>}</label>
        </div>
        {text('businessAddress', t.teach.address, { disabled: locked })}
        <div className="form-actions">
          <button className="btn-small btn-blue-soft">{t.teach.saveDraft}</button>
          {(p.verificationStatus === 'pending' || p.verificationStatus === 'rejected') && (
            <button type="button" className="btn-small btn-orange-solid" onClick={submit}><Send size={18} aria-hidden />{t.teach.submit}</button>
          )}
        </div>
      </form>
    </TeachLayout>
  );
}
