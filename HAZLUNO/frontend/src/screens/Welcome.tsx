import { BadgeCheck, ChevronRight, LockKeyhole, PlayCircle, UserRound, Users, Video } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { usePublicConfig } from '../state/config';
import { LanguagePicker, Wordmark } from '../ui/kit';
import { SocialButtons } from '../ui/social';

/** Tela 1 — abertura: foto, marca, frase, 4 destaques, criar conta / entrar, login social (quando ativo), termos. */
export function Welcome() {
  const { t } = useI18n();
  const { config } = usePublicConfig();
  const navigate = useNavigate();
  const features = [
    { icon: Video, label: t.welcome.featureLive, tone: 'orange' },
    { icon: PlayCircle, label: t.welcome.featureRecorded, tone: 'blue' },
    { icon: Users, label: t.welcome.featureAreas, tone: 'orange' },
    { icon: BadgeCheck, label: t.welcome.featureVerified, tone: 'blue' },
  ] as const;
  return (
    <main className="welcome">
      <div className="welcome-lang"><LanguagePicker /></div>
      <div className="welcome-hero">
        <img src="/hero.webp" alt="" width={900} height={797} fetchPriority="high" />
      </div>
      <div className="welcome-body">
        <h1><Wordmark /></h1>
        <p className="welcome-tagline">
          {t.welcome.taglineMain} <span className="welcome-highlight">{t.welcome.taglineHighlight}</span>
        </p>
        <ul className="welcome-features">
          {features.map(({ icon: Icon, label, tone }) => (
            <li key={label}>
              <span className={`feature-dot feature-${tone}`}><Icon size={26} strokeWidth={2.2} aria-hidden /></span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <div className="welcome-actions">
          <Link className="btn btn-orange btn-split" to="/signup">
            <UserRound size={22} aria-hidden /><span>{t.welcome.start}</span><ChevronRight size={22} aria-hidden />
          </Link>
          <Link className="btn btn-ghost-light btn-split" to="/login">
            <LockKeyhole size={20} aria-hidden /><span>{t.welcome.haveAccount}</span><ChevronRight size={20} aria-hidden />
          </Link>
          <SocialButtons config={config} onPick={() => navigate('/login')} />
        </div>
        <nav className="welcome-legal" aria-label={`${t.legal.terms} / ${t.legal.privacy}`}>
          <Link to="/terms">{t.legal.terms}</Link>
          <span aria-hidden>|</span>
          <Link to="/privacy">{t.legal.privacy}</Link>
        </nav>
      </div>
    </main>
  );
}
