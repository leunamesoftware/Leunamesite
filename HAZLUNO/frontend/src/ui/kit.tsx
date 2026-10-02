import { ArrowLeft, ChevronLeft, Eye, EyeOff, Globe, type LucideIcon } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LANGUAGES, type LanguageCode } from '../../../shared/contracts';
import { BRAND } from '../brand';
import { NATIVE_NAMES, useI18n } from '../i18n';

export function Wordmark({ size = 'lg' }: { size?: 'lg' | 'md' | 'sm' }) {
  return (
    <span className={`wordmark wordmark-${size}`} aria-label={BRAND.name}>
      <span className="wordmark-head" aria-hidden>{BRAND.head}</span><span className="wordmark-tail" aria-hidden>{BRAND.tail}</span>
    </span>
  );
}

/** Language switcher: a native select dressed as a chip (keyboard and screen-reader friendly). */
export function LanguagePicker({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { lang, setLang, t } = useI18n();
  const id = useId();
  return (
    <label className={`lang-chip lang-chip-${tone}`} htmlFor={id}>
      <Globe size={16} aria-hidden />
      <span>{lang.toUpperCase()}</span>
      <select id={id} aria-label={t.common.language} value={lang} onChange={(e) => setLang(e.target.value as LanguageCode)}>
        {LANGUAGES.map((l) => <option key={l} value={l}>{NATIVE_NAMES[l]}</option>)}
      </select>
    </label>
  );
}

export function TopBar({ back }: { back?: string }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <header className="topbar">
      {back ? (
        <button type="button" className="icon-btn" onClick={() => navigate(back)} aria-label={t.common.back}><ArrowLeft size={22} /></button>
      ) : <span />}
      <Wordmark size="sm" />
      <LanguagePicker tone="dark" />
    </header>
  );
}

export function Banner({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return <div className={`banner banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

type PillProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; icon: LucideIcon; error?: string; revealable?: boolean };

/** White rounded field with an icon (auth screens). The label stays for screen readers; sighted users see the placeholder. */
export function PillField({ id, label, icon: Icon, error, revealable, type, ...input }: PillProps) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  return (
    <div className={`pfield${error ? ' pfield-error' : ''}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="pill-box">
        <Icon className="pill-icon" size={22} aria-hidden />
        <input id={id} placeholder={label} aria-invalid={!!error} aria-describedby={error ? `${id}-msg` : undefined}
          type={revealable ? (visible ? 'text' : 'password') : type} {...input} />
        {revealable && (
          <button type="button" className="pill-reveal" onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t.common.hidePassword : t.common.showPassword}>
            {visible ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>
        )}
      </div>
      {error && <p id={`${id}-msg`} className="pill-msg">{error}</p>}
    </div>
  );
}

/** Blue top bar of the auth screens: back, language. */
export function AuthBar({ back }: { back: () => void }) {
  const { t } = useI18n();
  return (
    <div className="auth-bar">
      <button type="button" className="icon-btn icon-btn-light" onClick={back} aria-label={t.common.back}><ChevronLeft size={24} /></button>
      <LanguagePicker />
    </div>
  );
}
