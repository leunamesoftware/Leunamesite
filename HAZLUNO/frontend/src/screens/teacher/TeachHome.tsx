import { AlertTriangle, BadgeCheck, ChevronRight, Clock, Plus, ShieldQuestion } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { InstructorCourse, InstructorProfile } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { TeachLayout } from './TeachLayout';

export function VerificationCard({ profile, showAction = true }: { profile: InstructorProfile; showAction?: boolean }) {
  const { t, fill } = useI18n();
  const s = profile.verificationStatus;
  const map = {
    pending: { icon: ShieldQuestion, title: t.teach.statusPending, text: t.teach.statusPendingText, tone: 'warn' },
    under_review: { icon: Clock, title: t.teach.statusReview, text: t.teach.statusReviewText, tone: 'info' },
    approved: { icon: BadgeCheck, title: t.teach.statusApproved, text: t.teach.statusApprovedText, tone: 'ok' },
    rejected: { icon: AlertTriangle, title: t.teach.statusRejected, text: fill(t.teach.statusRejectedText, { reason: profile.rejectionReason ?? '—' }), tone: 'warn' },
    suspended: { icon: AlertTriangle, title: t.teach.statusSuspended, text: '', tone: 'warn' },
  }[s];
  const Icon = map.icon;
  return (
    <section className={`status-card status-${map.tone}`}>
      <Icon size={30} aria-hidden />
      <div>
        <h2>{map.title}</h2>
        {map.text && <p>{map.text}</p>}
        {showAction && (s === 'pending' || s === 'rejected') && <Link className="btn-small btn-orange-solid" to="/teach/profile">{t.teach.completeProfile}</Link>}
      </div>
    </section>
  );
}

/** Tela 17 — área do professor: verificação + meus cursos. */
export function TeachHome() {
  const { t, fill } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [courses, setCourses] = useState<InstructorCourse[] | null>(null);
  useEffect(() => {
    api.teacher.profile().then(setProfile, () => setProfile(null));
    api.teacher.courses().then(setCourses, () => setCourses([]));
  }, []);
  const statusLabel = { draft: t.teach.statusDraft, published: t.teach.statusPublished, archived: t.teach.statusArchived, pending_review: t.teach.statusDraft, rejected: t.teach.statusDraft };
  return (
    <TeachLayout title={t.teach.myCourses}>
      {profile && <VerificationCard profile={profile} />}
      <button type="button" className="btn-small btn-orange-solid align-start" onClick={() => navigate('/teach/courses/new')}><Plus size={18} aria-hidden />{t.teach.newCourse}</button>
      {courses && !courses.length && <div className="empty empty-light"><p>{t.teach.noCourses}</p></div>}
      <ul className="tcourses">
        {(courses ?? []).map((c) => {
          const open = c.classes.filter((k) => !['canceled', 'completed', 'draft'].includes(k.status));
          const seats = open.reduce((n, k) => n + (k.capacity - k.seatsLeft), 0);
          return (
            <li key={c.id}>
              <Link to={`/teach/courses/${c.id}`} className="tcourse">
                {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <span className="tcourse-img" aria-hidden />}
                <div>
                  <span className={`badge badge-${c.status}`}>{statusLabel[c.status]}</span>
                  <strong>{c.title}</strong>
                  <span className="muted">{t.teach.groups}: {c.classes.filter((k) => k.status !== 'canceled').length} · {fill(t.teach.seatsTaken, { n: String(seats), cap: String(open.reduce((n, k) => n + k.capacity, 0)) })}</span>
                </div>
                <ChevronRight size={20} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </TeachLayout>
  );
}
