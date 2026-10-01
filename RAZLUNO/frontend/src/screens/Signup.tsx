import { ChevronDown, ChevronLeft, ChevronRight, GraduationCap, LockKeyhole, Mail, MapPin, Presentation, UserRound } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LanguageCode, SignupIntent } from '../../../shared/contracts';
import { api } from '../api';
import { useI18n } from '../i18n';
import { usePublicConfig } from '../state/config';
import { useSession } from '../state/session';
import { errorText, fieldTexts } from '../ui/errors';
import { AuthBar, Banner, LanguagePicker, PillField, Wordmark } from '../ui/kit';
import { SocialButtons } from '../ui/social';

const COUNTRY_BY_LANGUAGE: Record<LanguageCode, string> = { pt: 'PT', es: 'ES', fr: 'FR', it: 'IT', de: 'DE', en: 'IE' };

/** Country guess: the region in the phone's language tag (pt-PT, de-AT...) when it is a supported country. */
function guessCountry(codes: string[], lang: LanguageCode): string {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const region = tag.split('-')[1]?.toUpperCase();
    if (region && codes.includes(region)) return region;
  }
  return COUNTRY_BY_LANGUAGE[lang];
}

/** Tela 3 — criar conta: primeiro "aprender ou ensinar", depois os dados. */
export function Signup() {
  const { t, lang, countryName } = useI18n();
  const { start } = useSession();
  const { config } = usePublicConfig();
  const navigate = useNavigate();
  const [intent, setIntent] = useState<SignupIntent | null>(null);
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '', countryCode: '', acceptTerms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const countries = useMemo(() => (config?.countries ?? [])
    .map((c) => ({ code: c.code, name: countryName(c.code) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang)), [config, countryName, lang]);
  const countryCode = form.countryCode || (countries.length ? guessCountry(countries.map((c) => c.code), lang) : '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!intent) return;
    setError(null); setFields({});
    if (form.confirm !== form.password) {
      setError(t.errors.check_fields); setFields({ confirm: t.fields.password_mismatch });
      return;
    }
    setBusy(true);
    try {
      const { confirm: _confirm, ...data } = form;
      start(await api.signup({
        ...data, countryCode, languageCode: lang, intent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }));
      navigate('/home', { replace: true });
    } catch (err) {
      setError(errorText(t, err)); setFields(fieldTexts(t, err));
    } finally {
      setBusy(false);
    }
  }

  if (!intent) {
    return (
      <main className="choose">
        <header className="choose-bar">
          <button type="button" className="icon-btn icon-btn-light" onClick={() => navigate('/')} aria-label={t.common.back}>
            <ChevronLeft size={24} />
          </button>
          <Wordmark size="md" />
          <LanguagePicker />
        </header>
        <div className="choose-body">
          <h1 className="choose-title">{t.signup.chooseTitle}</h1>
          <button type="button" className="choose-card choose-learn" onClick={() => setIntent('learn')}>
            <img src="/choose-learn.webp" alt="" width={510} height={536} />
            <span className="choose-copy">
              <GraduationCap className="choose-icon" size={44} strokeWidth={2} aria-hidden />
              <strong>{t.signup.learnTitle}</strong>
              <span>{t.signup.learnText}</span>
            </span>
            <span className="choose-go"><ChevronRight size={24} strokeWidth={2.6} aria-hidden /></span>
          </button>
          <button type="button" className="choose-card choose-teach" onClick={() => setIntent('teach')}>
            <img src="/choose-teach.webp" alt="" width={520} height={604} />
            <span className="choose-copy">
              <Presentation className="choose-icon" size={44} strokeWidth={2} aria-hidden />
              <strong>{t.signup.teachTitle}</strong>
              <span>{t.signup.teachText}</span>
            </span>
            <span className="choose-go"><ChevronRight size={24} strokeWidth={2.6} aria-hidden /></span>
          </button>
          <p className="choose-switch">{t.signup.haveAccount} <Link to="/login">{t.signup.login}</Link></p>
        </div>
      </main>
    );
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const learn = intent === 'learn';
  const [termsBefore = '', termsMiddle = '', termsAfter = ''] = t.signup.acceptTerms.split(/\{terms\}|\{privacy\}/);
  return (
    <main className={`auth auth-photo auth-${intent}`}>
      <img className="auth-art" src={learn ? '/signup-learn.webp' : '/signup-teach.webp'} alt="" width={learn ? 461 : 520} height={learn ? 600 : 604} />
      <AuthBar back={() => setIntent(null)} />
      <div className="auth-body">
        <Wordmark size="md" />
        <h1 className="auth-title auth-title-split">
          {t.signup.formTitle}
          <span>{learn ? t.signup.forLearnPre : t.signup.forTeachPre} <em>{learn ? t.signup.forLearnWord : t.signup.forTeachWord}</em></span>
        </h1>
        <p className="auth-sub auth-sub-narrow">{learn ? t.signup.formSubLearn : t.signup.formSubTeach}</p>
        <form onSubmit={submit} noValidate className="auth-form">
          {error && <Banner tone="error">{error}</Banner>}
          <PillField id="su-name" label={t.signup.name} icon={UserRound} autoComplete="name" value={form.displayName} onChange={set('displayName')} error={fields.displayName} />
          <PillField id="su-email" label={t.signup.email} icon={Mail} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} error={fields.email} />
          <PillField id="su-password" label={t.signup.password} icon={LockKeyhole} revealable autoComplete="new-password" value={form.password} onChange={set('password')} error={fields.password} />
          <PillField id="su-confirm" label={t.signup.confirmPassword} icon={LockKeyhole} revealable autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={fields.confirm} />
          <div className={`pill${fields.countryCode ? ' pill-error' : ''}`}>
            <label htmlFor="su-country" className="sr-only">{t.signup.country}</label>
            <div className="pill-box">
              <MapPin className="pill-icon" size={22} aria-hidden />
              <select id="su-country" value={countryCode} onChange={set('countryCode')} autoComplete="country">
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <ChevronDown className="pill-caret" size={20} aria-hidden />
            </div>
            {fields.countryCode && <p className="pill-msg">{fields.countryCode}</p>}
          </div>
          <label className={`auth-check${fields.acceptTerms ? ' auth-check-error' : ''}`} htmlFor="su-terms">
            <input id="su-terms" type="checkbox" checked={form.acceptTerms} onChange={(e) => setForm((f) => ({ ...f, acceptTerms: e.target.checked }))} />
            <span>{termsBefore}<Link to="/terms">{t.legal.terms}</Link>{termsMiddle}<Link to="/privacy">{t.legal.privacy}</Link>{termsAfter}</span>
          </label>
          {fields.acceptTerms && <p className="pill-msg">{fields.acceptTerms}</p>}
          <button className="btn btn-orange btn-split" disabled={busy || !config}>
            <span /><span>{busy ? t.common.loading : t.signup.formTitle}</span><ChevronRight size={22} aria-hidden />
          </button>
        </form>
        <SocialButtons config={config} onPick={() => undefined} />
        <p className="auth-switch">{t.signup.haveAccount} <Link to="/login">{t.signup.login}</Link></p>
      </div>
    </main>
  );
}
