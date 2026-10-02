import { CalendarDays, Heart, Home, Search, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useSession } from '../state/session';
import { SiteHeader } from './site';
import { Wordmark } from './kit';

/** Signed-in layout: page content + navigation (bottom bar on phones, top bar on computers). */
export function Shell({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'soft' }) {
  const { t } = useI18n();
  const { me } = useSession();
  if (!me) return <div className={`shell shell-${tone} shell-guest`}><SiteHeader /><div className="shell-page">{children}</div></div>;
  const items = [
    { to: '/home', icon: Home, label: t.nav.home },
    { to: '/explore', icon: Search, label: t.nav.search },
    { to: '/my', icon: CalendarDays, label: t.nav.myClasses },
    { to: '/favorites', icon: Heart, label: t.nav.favorites },
    { to: '/profile', icon: UserRound, label: t.nav.profile },
  ];
  return (
    <div className={`shell shell-${tone}`}>
      <div className="shell-page">{children}</div>
      <nav className="tabbar" aria-label="Hazluno">
        <Link to="/home" className="tabbar-brand" aria-label={t.nav.home}><Wordmark size="sm" /></Link>
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `tab${isActive ? ' tab-on' : ''}`}>
            <Icon size={24} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
