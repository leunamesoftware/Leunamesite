import { BadgeCheck, ChevronLeft, Languages, Star, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { InstructorPublic } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { useSession } from '../../state/session';
import { toggleFavorite } from '../../state/favorites';
import { Avatar } from '../../ui/avatar';
import { CourseCard } from '../../ui/CourseCard';

/** Tela 6 — perfil público do professor. */
export function TeacherPublic() {
  const { id = '' } = useParams();
  const { t, lang, fill, countryName } = useI18n();
  const { me } = useSession();
  const navigate = useNavigate();
  const [p, setP] = useState<InstructorPublic | null>(null);
  useEffect(() => { api.instructor(id).then(setP, () => navigate('/explore', { replace: true })); }, [id, navigate]);
  if (!p) return <main className="teacherpub" aria-busy="true" />;
  return (
    <main className="teacherpub">
      <header className="teacherpub-head">
        {p.coverUrl && <img className="teacherpub-cover" src={p.coverUrl} alt="" />}
        <button type="button" className="icon-btn icon-btn-light" onClick={() => navigate(-1)} aria-label={t.common.back}><ChevronLeft size={24} /></button>
        <Avatar url={p.avatarUrl} name={p.name} size={112} />
        <h1>{p.name} <BadgeCheck className="verified verified-light" size={24} aria-label={t.teach.verified} /></h1>
        <p>{countryName(p.countryCode)}</p>
        <div className="teacherpub-stats">
          {p.rating != null ? <span><Star size={18} fill="currentColor" aria-hidden />{p.rating.toLocaleString(lang, { minimumFractionDigits: 1 })} ({p.reviewsCount})</span>
            : <span className="tag-new">{t.card.newTeacher}</span>}
          {p.studentsCount > 0 && <span><UsersRound size={18} aria-hidden />{fill(t.course.teacherStudents, { n: String(p.studentsCount) })}</span>}
          {!!p.teachingLanguages.length && <span><Languages size={18} aria-hidden />{p.teachingLanguages.map((l) => NATIVE_NAMES[l]).join(', ')}</span>}
        </div>
      </header>
      <div className="page-body">
        {(p.headline || p.bio) && (
          <section className="panel">
            {p.headline && <h2>{p.headline}</h2>}
            {p.bio && <p className="prose">{p.bio}</p>}
            {!!p.specialties.length && <div className="role-chips">{p.specialties.map((s) => <span key={s} className="role-chip role-chip-blue">{s}</span>)}</div>}
          </section>
        )}
        <h2 className="section-title section-title-dark">{t.course.nextGroups}</h2>
        {!p.courses.length && <div className="empty empty-light"><p>{t.course.noGroups}</p></div>}
        <div className="cards-grid">
          {p.courses.map((c) => <CourseCard key={c.id} card={c} onFavorite={me ? (on) => toggleFavorite(c, on, (fn) => setP((x) => x && { ...x, courses: fn(x.courses) })) : undefined} />)}
        </div>
      </div>
    </main>
  );
}
