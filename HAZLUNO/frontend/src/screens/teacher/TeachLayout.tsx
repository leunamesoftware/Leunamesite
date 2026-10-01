import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';

/** Teacher area frame: blue header with back to profile and the three sections. */
export function TeachLayout({ title, children, back = '/profile' }: { title: string; children: ReactNode; back?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <main className="mine teach">
      <header className="page-head">
        <div className="teach-bar">
          <button type="button" className="icon-btn icon-btn-light" onClick={() => navigate(back)} aria-label={t.common.back}><ChevronLeft size={24} /></button>
          <span className="teach-kicker">{t.teach.title}</span>
        </div>
        <h1>{title}</h1>
        <nav className="seg">
          <NavLink end to="/teach" className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{t.teach.myCourses}</NavLink>
          <NavLink to="/teach/agenda" className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{t.teach.agenda}</NavLink>
          <NavLink to="/teach/profile" className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{t.teach.profileTitle}</NavLink>
        </nav>
      </header>
      <div className="page-body">{children}</div>
    </main>
  );
}
