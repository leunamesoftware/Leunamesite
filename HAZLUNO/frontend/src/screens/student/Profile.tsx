import {
  Award, Camera, ChevronRight, Globe, GraduationCap, Heart, KeyRound, Languages, LogOut, Mail, MapPin, MonitorSmartphone, PlayCircle,
  Presentation, Shield, ShieldCheck, UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LANGUAGES, type LanguageCode, type MyStats, type SessionInfo } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { usePublicConfig } from '../../state/config';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { categoryIcon, useCategories } from '../../ui/categories';
import { errorText, fieldTexts } from '../../ui/errors';
import { dayShort } from '../../ui/format';
import { Banner, Wordmark } from '../../ui/kit';
import { Shell } from '../../ui/shell';

type Tab = 'profile' | 'settings' | 'security';

/** Tela 16 — perfil (referência "Mi perfil"). Only items that really work are shown. */
export function Profile() {
  const { t, lang, setLang, fill, countryName } = useI18n();
  const { me, logout, refresh } = useSession();
  const { config } = usePublicConfig();
  const categories = useCategories(lang);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [stats, setStats] = useState<MyStats | null>(null);
  const [form, setForm] = useState({ displayName: me?.displayName ?? '', countryCode: me?.countryCode ?? '', languageCode: me?.languageCode ?? lang });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  useEffect(() => {
    api.stats().then(setStats, () => setStats(null));
    api.sessions().then(setSessions, () => setSessions([]));
  }, []);
  const countries = useMemo(() => (config?.countries ?? []).map((c) => ({ code: c.code, name: countryName(c.code) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang)), [config, countryName, lang]);
  if (!me) return null;

  const fail = (err: unknown) => { setFields(fieldTexts(t, err)); setMsg({ tone: 'error', text: errorText(t, err) }); };
  const go = (next: Tab) => { setTab(next); setMsg(null); setFields({}); };
  const saveData = async (e: FormEvent) => {
    e.preventDefault(); setFields({}); setMsg(null);
    try { const u = await api.updateMe(form); refresh(u); setLang(u.languageCode); setMsg({ tone: 'info', text: t.profile.saved }); } catch (err) { fail(err); }
  };
  const toggleInterest = async (id: string) => {
    const next = me.interests.includes(id) ? me.interests.filter((x) => x !== id) : [...me.interests, id];
    refresh({ ...me, interests: next });
    try { refresh(await api.updateMe({ interests: next })); } catch (err) { refresh(me); fail(err); }
  };
  const changePassword = async (e: FormEvent) => {
    e.preventDefault(); setFields({}); setMsg(null);
    try {
      await api.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '' });
      setSessions((l) => l.filter((s) => s.current));
      setMsg({ tone: 'info', text: t.profile.passwordChanged });
    } catch (err) {
      const f = fieldTexts(t, err);
      setFields({ ...f, ...(f.newPassword ? { newPassword: f.newPassword === t.fields.too_short ? t.fields.password_too_short : f.newPassword } : {}) });
      setMsg({ tone: 'error', text: errorText(t, err) });
    }
  };
  const photo = async (file: File | undefined) => { if (file) try { refresh(await api.uploadAvatar(file)); } catch (err) { fail(err); } };
  const teach = async () => { try { refresh(await api.becomeInstructor()); navigate('/teach'); } catch (err) { fail(err); } };
  const roleLabel = { student: t.profile.roleStudent, instructor: t.profile.roleInstructor, admin: t.profile.roleAdmin, moderator: t.profile.roleModerator };
  const tabs: [Tab, string, typeof UserRound][] = [['profile', t.profile.tabProfile, UserRound], ['settings', t.profile.tabSettings, Globe], ['security', t.profile.tabSecurity, Shield]];

  return (
    <Shell tone="soft">
      <main className="mine">
        <header className="page-head profile-head">
          <Wordmark size="sm" />
          <div className="profile-card">
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
            {stats && (
              <dl className="stats">
                <div><dt>{t.profile.statCompleted}</dt><dd>{stats.completedClasses}</dd></div>
                <div><dt>{t.profile.statCertificates}</dt><dd>{stats.certificates}</dd></div>
                <div><dt>{t.profile.statInProgress}</dt><dd>{stats.inProgress}</dd></div>
              </dl>
            )}
          </div>
          <div className="seg">
            {tabs.map(([key, label, Icon]) => (
              <button key={key} type="button" className={`seg-btn${tab === key ? ' seg-on' : ''}`} onClick={() => go(key)}><Icon size={20} aria-hidden />{label}</button>
            ))}
          </div>
        </header>

        <div className="page-body">
          {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}

          {tab === 'profile' && (
            <>
              <section className="panel list-panel">
                <h2>{t.profile.myData}</h2>
                <div className="info-row"><UserRound size={22} aria-hidden /><span>{t.profile.name}</span><strong>{me.displayName}</strong></div>
                <div className="info-row"><Mail size={22} aria-hidden /><span>{t.profile.email}</span><strong>{me.email}</strong></div>
                <div className="info-row"><MapPin size={22} aria-hidden /><span>{t.profile.country}</span><strong>{countryName(me.countryCode)}</strong></div>
                <div className="info-row"><Languages size={22} aria-hidden /><span>{t.profile.language}</span><strong>{NATIVE_NAMES[me.languageCode]}</strong></div>
                <button type="button" className="btn-plain align-start" onClick={() => go('settings')}>{t.profile.tabSettings} →</button>
              </section>

              <section className="panel list-panel">
                <h2>{t.profile.preferences}</h2>
                <Link to="/favorites" className="link-row"><Heart size={22} aria-hidden /><span><b>{t.nav.favorites}</b><small>{t.profile.favoritesHint}</small></span><ChevronRight size={20} aria-hidden /></Link>
                <Link to="/my" className="link-row"><PlayCircle size={22} aria-hidden /><span><b>{t.nav.myClasses}</b><small>{t.my.subtitle}</small></span><ChevronRight size={20} aria-hidden /></Link>
                {stats && stats.certificates > 0 && <Link to="/my" className="link-row"><Award size={22} aria-hidden /><span><b>{t.profile.statCertificates}</b></span><ChevronRight size={20} aria-hidden /></Link>}
              </section>

              <section className="panel list-panel">
                <h2>{t.profile.account}</h2>
                {me.roles.includes('instructor')
                  ? <Link to="/teach" className="link-row"><Presentation size={22} aria-hidden /><span><b>{t.profile.teacherArea}</b></span><ChevronRight size={20} aria-hidden /></Link>
                  : <button type="button" className="link-row" onClick={teach}><GraduationCap size={22} aria-hidden /><span><b>{t.profile.becomeTeacher}</b></span><ChevronRight size={20} aria-hidden /></button>}
                {me.roles.some((r) => r === 'admin' || r === 'moderator') && (
                  <Link to="/admin" className="link-row"><ShieldCheck size={22} aria-hidden /><span><b>{roleLabel.admin}</b></span><ChevronRight size={20} aria-hidden /></Link>
                )}
                <button type="button" className="link-row" onClick={() => go('security')}><KeyRound size={22} aria-hidden /><span><b>{t.profile.changePassword}</b></span><ChevronRight size={20} aria-hidden /></button>
                <Link to="/privacy" className="link-row"><Shield size={22} aria-hidden /><span><b>{t.profile.privacy}</b></span><ChevronRight size={20} aria-hidden /></Link>
                <button type="button" className="link-row link-danger" onClick={async () => { await logout(); navigate('/', { replace: true }); }}>
                  <LogOut size={22} aria-hidden /><span><b>{t.profile.logout}</b></span></button>
              </section>
            </>
          )}

          {tab === 'settings' && (
            <>
              <form className="panel form-light" onSubmit={saveData} noValidate>
                <h2>{t.profile.myData}</h2>
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
              <section className="panel">
                <h2>{t.profile.interests}</h2>
                <p className="muted">{t.profile.interestsHint}</p>
                <div className="interest-grid">
                  {categories.map((c) => {
                    const Icon = categoryIcon(c.icon);
                    const on = me.interests.includes(c.id);
                    return (
                      <button key={c.id} type="button" aria-pressed={on} className={`interest${on ? ' interest-on' : ''}`} onClick={() => toggleInterest(c.id)}>
                        <Icon size={20} aria-hidden />{c.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {tab === 'security' && (
            <>
              <form className="panel form-light" onSubmit={changePassword} noValidate>
                <h2>{t.profile.changePassword}</h2>
                <label className="lfield"><span>{t.profile.currentPassword}</span>
                  <input id="pw-current" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                  {fields.currentPassword && <em>{fields.currentPassword}</em>}</label>
                <label className="lfield"><span>{t.profile.newPassword}</span>
                  <input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                  {fields.newPassword && <em>{fields.newPassword}</em>}</label>
                <button className="btn-small btn-orange-solid align-start">{t.profile.changePassword}</button>
              </form>
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
            </>
          )}
          <nav className="legal-links"><Link to="/terms">{t.legal.terms}</Link><span aria-hidden>·</span><Link to="/privacy">{t.legal.privacy}</Link></nav>
        </div>
      </main>
    </Shell>
  );
}
