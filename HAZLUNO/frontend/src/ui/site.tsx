import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useI18n } from '../i18n';
import { LanguagePicker, Wordmark } from './kit';

/** True on computers (same breakpoint as the CSS desktop mode). */
export function useWide(min = 1000) {
  const query = `(min-width: ${min}px)`;
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return wide;
}

/** Website header for visitors (not signed in). */
export function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="site-head">
      <div className="site-head-in">
        <Link to="/" className="site-brand" aria-label="Hazluno"><Wordmark size="sm" /></Link>
        <nav className="site-nav" aria-label={t.site.navExplore}>
          <NavLink to="/explore">{t.site.navExplore}</NavLink>
          <a href="/#como">{t.site.navHow}</a>
          <a href="/#ensenar">{t.site.navTeach}</a>
        </nav>
        <div className="site-actions">
          <LanguagePicker />
          <Link to="/login" className="site-login">{t.site.login}</Link>
          <Link to="/signup" className="btn-small btn-orange-solid site-signup">{t.site.signup}</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t, fill } = useI18n();
  return (
    <footer className="site-foot">
      <div className="site-foot-in">
        <div className="site-foot-brand"><Wordmark size="sm" /><p>{t.site.footerText}</p></div>
        <nav aria-label={t.site.navExplore}>
          <strong>Hazluno</strong>
          <Link to="/explore">{t.site.navExplore}</Link>
          <a href="/#como">{t.site.navHow}</a>
          <a href="/#ensenar">{t.site.navTeach}</a>
        </nav>
        <nav aria-label={t.site.footerLegal}>
          <strong>{t.site.footerLegal}</strong>
          <Link to="/terms">{t.legal.terms}</Link>
          <Link to="/privacy">{t.legal.privacy}</Link>
        </nav>
        <div><LanguagePicker /></div>
      </div>
      <p className="site-rights">{fill(t.site.rights, { year: String(new Date().getFullYear()) })}</p>
    </footer>
  );
}
