import { CalendarDays, ChevronLeft, LayoutDashboard, UserRound, UsersRound, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';

/** Teacher area frame: blue header with back to profile and the three sections. */
export function TeachLayout({ title, children, back = '/profile' }: { title: string; children: ReactNode; back?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const nav: [string, string, typeof UserRound, boolean][] = [
    ['/teach', t.teach.navPanel, LayoutDashboard, true], ['/teach/profile', t.profile.tabProfile, UserRound, false], ['/teach/students', t.teach.stTitle, UsersRound, false], ['/teach/agenda', t.teach.agenda, CalendarDays, false], ['/teach/earnings', t.earn.nav, Wallet, false],
  ];
  return (
    <main className="mine teach">
      <nav className="teach-side" aria-label={t.teach.title}>
        {nav.map(([to, label, Icon, end]) => (
          <NavLink key={to} end={end} to={to} className={({ isActive }) => `side-link${isActive ? ' side-on' : ''}`}><Icon size={22} aria-hidden />{label}</NavLink>
        ))}
      </nav>
      <header className="page-head">
        <div className="teach-bar">
          <button type="button" className="icon-btn icon-btn-light" onClick={() => navigate(back)} aria-label={t.common.back}><ChevronLeft size={24} /></button>
          <span className="teach-kicker">{t.teach.title}</span>
        </div>
        <h1>{title}</h1>
        <nav className="seg">
          <NavLink end to="/teach" className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{t.teach.myCourses}</NavLink>
          <NavLink to="/teach/students" className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{t.teach.stTitle}</NavLink>
          <NavLink to="/teach/earnings" className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{t.earn.nav}</NavLink>
          <NavLink to="/teach/agenda" className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{t.teach.agenda}</NavLink>
          <NavLink to="/teach/profile" className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{t.teach.profileTitle}</NavLink>
        </nav>
      </header>
      <div className="page-body">{children}</div>
    </main>
  );
}
