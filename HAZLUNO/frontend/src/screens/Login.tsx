import { ChevronRight, LockKeyhole, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useI18n } from '../i18n';
import { usePublicConfig } from '../state/config';
import { useSession } from '../state/session';
import { errorText, fieldTexts } from '../ui/errors';
import { nextPath } from '../ui/next';
import { AuthBar, Banner, PillField, Wordmark } from '../ui/kit';
import { SocialButtons } from '../ui/social';

/** Tela 2 — login. */
export function Login() {
  const { t } = useI18n();
  const { start } = useSession();
  const { config } = usePublicConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [forgotInfo, setForgotInfo] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setFields({});
    try {
      start(await api.login(email, password));
      navigate(nextPath(searchParams), { replace: true });
    } catch (err) {
      setError(errorText(t, err)); setFields(fieldTexts(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <AuthBar back={() => navigate('/')} />
      <div className="auth-body">
        <Wordmark size="md" />
        <h1 className="auth-title">{t.login.title}</h1>
        <p className="auth-sub">{t.login.subtitle}</p>
        <form onSubmit={submit} noValidate className="auth-form">
          {error && <Banner tone="error">{error}</Banner>}
          <PillField id="login-email" label={t.login.email} icon={Mail} type="email" autoComplete="email" inputMode="email"
            value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
          <PillField id="login-password" label={t.login.password} icon={LockKeyhole} revealable autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
          <button type="button" className="auth-link align-end" onClick={() => setForgotInfo(true)}>{t.login.forgot}</button>
          {forgotInfo && !config?.passwordRecovery && <Banner tone="info">{t.login.forgotUnavailable}</Banner>}
          <button className="btn btn-orange btn-split" disabled={busy}>
            <span /><span>{busy ? t.common.loading : t.login.submit}</span><ChevronRight size={22} aria-hidden />
          </button>
        </form>
        <SocialButtons config={config} onPick={() => undefined} />
        <p className="auth-switch">{t.login.noAccount} <Link to="/signup">{t.login.createAccount}</Link></p>
      </div>
    </main>
  );
}
