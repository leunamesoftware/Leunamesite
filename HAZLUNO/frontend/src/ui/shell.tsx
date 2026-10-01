import { CalendarDays, Heart, Home, Search, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n';

/** Signed-in layout: page content + bottom navigation (Inicio, Buscar, Mis clases, Favoritos, Perfil). */
export function Shell({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'soft' }) {
  const { t } = useI18n();
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
