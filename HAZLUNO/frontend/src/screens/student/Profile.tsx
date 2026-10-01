import { Camera, ChevronRight, GraduationCap, LogOut, MonitorSmartphone, Presentation, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LANGUAGES, type LanguageCode, type SessionInfo } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { usePublicConfig } from '../../state/config';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { errorText, fieldTexts } from '../../ui/errors';
import { dayShort } from '../../ui/format';
import { Banner, Wordmark } from '../../ui/kit';
import { Shell } from '../../ui/shell';

/** Tela 16 — perfil. */
export function Profile() {
  const { t, lang, setLang, fill, countryName } = useI18n();
  const { me, logout, refresh } = useSession();
  const { config } = usePublicConfig();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ displayName: me?.displayName ?? '', countryCode: me?.countryCode ?? '', languageCode: me?.languageCode ?? lang });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  useEffect(() => { api.sessions().then(setSessions, () => setSessions([])); }, []);
  const countries = useMemo(() => (config?.countries ?? []).map((c) => ({ code: c.code, name: countryName(c.code) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang)), [config, countryName, lang]);
  if (!me) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setFields({}); setMsg(null);
    try {
      const updated = await api.updateMe(form);
      refresh(updated);
      setLang(updated.languageCode);
      setMsg({ tone: 'info', text: t.profile.saved });
    } catch (err) { setFields(fieldTexts(t, err)); setMsg({ tone: 'error', text: errorText(t, err) }); }
  };
  const photo = async (file: File | undefined) => {
    if (!file) return;
    try { refresh(await api.uploadAvatar(file)); } catch (err) { setMsg({ tone: 'error', text: errorText(t, err) }); }
  };
  const teach = async () => { try { refresh(await api.becomeInstructor()); navigate('/teach'); } catch (err) { setMsg({ tone: 'error', text: errorText(t, err) }); } };
  const roleLabel = { student: t.profile.roleStudent, instructor: t.profile.roleInstructor, admin: t.profile.roleAdmin, moderator: t.profile.roleModerator };

  return (
    <Shell tone="soft">
      <main className="mine">
        <header className="page-head profile-head">
          <Wordmark size="sm" />
          <div className="profile-id">
            <button type="button" className="avatar-edit" onClick={() => fileRef.current?.click()} aria-label={t.profile.changePhoto}>
              <Avatar url={me.avatarUrl} name={me.displayName} size={88} />
              <span className="avatar-edit-badge"><Camera size={18} aria-hidden /></span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => photo(e.target.files?.[0])} />
            <div>
              <h1>{me.displayName}</h1>
              <p>{me.email}</p>
              <div className="role-chips">{me.roles.map((r) => <span key={r} className="role-chip">{roleLabel[r]}</span>)}</div>
            </div>
          </div>
        </header>
        <div className="page-body">
          {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
          <form className="panel form-light" onSubmit={save} noValidate>
            <h2>{t.profile.roles}</h2>
            <label className="lfield"><span>{t.profile.name}</span>
              <input id="pf-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              {fields.displayName && <em>{fields.displayName}</em>}</label>
            <div className="row-2">
              <label className="lfield"><span>{t.profile.country}</span>
                <select id="pf-country" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select></label>
              <label className="lfield"><span>{t.profile.language}</span>
                <select id="pf-lang" value={form.languageCode} onChange={(e) => setForm({ ...form, languageCode: e.target.value as LanguageCode })}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{NATIVE_NAMES[l]}</option>)}
                </select></label>
            </div>
            <button className="btn-small btn-orange-solid align-start">{t.profile.save}</button>
          </form>

          <section className="panel links">
            {me.roles.includes('instructor')
              ? <Link to="/teach" className="link-row"><Presentation size={22} aria-hidden /><span>{t.profile.teacherArea}</span><ChevronRight size={20} aria-hidden /></Link>
              : <button type="button" className="link-row" onClick={teach}><GraduationCap size={22} aria-hidden /><span>{t.profile.becomeTeacher}</span><ChevronRight size={20} aria-hidden /></button>}
            {me.roles.some((r) => r === 'admin' || r === 'moderator') && (
              <Link to="/admin" className="link-row"><ShieldCheck size={22} aria-hidden /><span>{roleLabel.admin}</span><ChevronRight size={20} aria-hidden /></Link>
            )}
          </section>

          <section className="panel">
            <h2><MonitorSmartphone size={20} aria-hidden /> {t.profile.devices}</h2>
            <ul className="devices">
              {sessions.map((s) => (
                <li key={s.id}>
                  <div><strong>{s.current ? t.profile.thisDevice : (s.userAgent ?? '—').slice(0, 60)}</strong>
                    <span className="muted">{fill(t.profile.since, { date: dayShort(s.createdAt, lang) })}</span></div>
                  {!s.current && <button type="button" className="btn-plain" onClick={async () => { await api.revokeSession(s.id); setSessions((l) => l.filter((x) => x.id !== s.id)); }}>{t.profile.disconnect}</button>}
                </li>
              ))}
            </ul>
          </section>

          <button type="button" className="btn-logout" onClick={async () => { await logout(); navigate('/', { replace: true }); }}><LogOut size={20} aria-hidden />{t.profile.logout}</button>
          <nav className="legal-links"><Link to="/terms">{t.legal.terms}</Link><span aria-hidden>·</span><Link to="/privacy">{t.legal.privacy}</Link></nav>
        </div>
      </main>
    </Shell>
  );
}
