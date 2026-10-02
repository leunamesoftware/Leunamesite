import { BookOpen, CalendarRange, ChevronLeft, GraduationCap, House, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Wordmark } from '../../ui/kit';

/** Admin frame: dark side menu on desktop, tabs on phones. Sections appear here only once they really work. */
export function AdminLayout({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const nav: [string, string, typeof House, boolean][] = [
    ['/admin', t.admin.navHome, House, true], ['/admin/users', t.admin.navUsers, Users, false], ['/admin/courses', t.admin.navCourses, BookOpen, false], ['/admin/classes', t.admin.navClasses, CalendarRange, false], ['/admin/instructors', t.admin.navTeachers, GraduationCap, false],
  ];
  return (
    <main className="mine admin">
      <nav className="admin-side" aria-label={t.admin.panelTitle}>
        <Wordmark size="sm" />
        <strong className="admin-side-title">{t.admin.panelTitle}</strong>
        {nav.map(([to, label, Icon, end]) => (
          <NavLink key={to} end={end} to={to} className={({ isActive }) => `aside-link${isActive ? ' aside-on' : ''}`}><Icon size={22} aria-hidden />{label}</NavLink>
        ))}
      </nav>
      <header className="page-head">
        <div className="teach-bar">
          <button type="button" className="icon-btn icon-btn-light" onClick={() => navigate('/profile')} aria-label={t.common.back}><ChevronLeft size={24} /></button>
          <span className="teach-kicker">{t.admin.panelTitle}</span>
        </div>
        <div className="admin-title-row"><h1>{title}</h1>{actions}</div>
        <nav className="seg admin-seg">
          {nav.map(([to, label, , end]) => <NavLink key={to} end={end} to={to} className={({ isActive }) => `seg-btn${isActive ? ' seg-on' : ''}`}>{label}</NavLink>)}
        </nav>
      </header>
      <div className="page-body">{children}</div>
    </main>
  );
}
