import { CalendarPlus, CheckCircle2, Clock3, Loader2, Video, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CourseDetail, EnrollmentInfo } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { useClassWhen, useMeetingTime } from '../../ui/classes';
import { errorText } from '../../ui/errors';
import { dayShort, money } from '../../ui/format';
import { downloadIcs } from '../../ui/ics';
import { Banner } from '../../ui/kit';

/** Tela 10 — the booking after the provider's page. It says "confirmed" only once the provider confirmed (webhook). */
export function Enrollment() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { t, lang, fill } = useI18n();
  const navigate = useNavigate();
  const when = useClassWhen();
  const meetingTime = useMeetingTime();
  const [e, setE] = useState<EnrollmentInfo | null>(null);
  const [c, setC] = useState<CourseDetail | null>(null);
  const [tries, setTries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.enrollment(id).then(setE, () => navigate('/my', { replace: true })); }, [id, navigate, tries]);
  useEffect(() => { if (e && !c) api.course(e.courseId).then(setC, () => undefined); }, [e, c]);
  // Back from the payment page: the provider's confirmation can take a few seconds to arrive.
  useEffect(() => {
    if (e?.status !== 'pending_payment' || tries >= 20) return;
    const timer = setTimeout(() => setTries((n) => n + 1), 2000);
    return () => clearTimeout(timer);
  }, [e, tries]);
  if (!e) return <main className="mine pay" aria-busy="true" />;
  const k = c?.classes.find((x) => x.id === e.classId);
  const refund = money(e.withdrawalRefundCents, e.currency, lang);

  async function withdraw() {
    if (!confirm(e!.priceCents > 0 && e!.status === 'confirmed' ? fill(t.pay.withdrawConfirm, { refund }) : t.pay.withdrawFree)) return;
    setBusy(true); setError(null);
    try { setE(await api.withdraw(e!.id)); } catch (err) { setError(errorText(t, err)); } finally { setBusy(false); }
  }

  const head = {
    pending_payment: [Loader2, t.pay.confirmingTitle, params.get('paid') && tries < 20 ? t.pay.confirmingText : t.pay.stillPending, 'pay-wait'],
    confirmed: [CheckCircle2, t.pay.confirmedTitle, t.pay.confirmedText, 'pay-ok'],
    completed: [CheckCircle2, t.pay.confirmedTitle, t.pay.confirmedText, 'pay-ok'],
    expired: [Clock3, t.pay.expiredTitle, t.pay.expiredText, 'pay-bad'],
    canceled: [XCircle, t.pay.canceledTitle, t.pay.canceledText, 'pay-bad'],
  } as const;
  const [Icon, title, text, tone] = head[e.status];

  return (
    <main className="mine pay">
      <div className="page-body pay-done">
        <section className={`panel pay-state ${tone}`}>
          <span className="pay-state-icon"><Icon size={44} className={e.status === 'pending_payment' ? 'spin' : ''} aria-hidden /></span>
          <h1>{title}</h1>
          <p>{text}</p>
        </section>
        {k && c && (
          <section className="panel">
            <h2 className="sub">{c.title}</h2>
            <p className="muted">{k.label ? `${k.label} · ` : ''}{when(k)}</p>
            <ol className="pay-meetings">{k.meetings.map((m) => <li key={m.id}><span>{dayShort(m.start, lang)}</span><b>{meetingTime(m).range}</b></li>)}</ol>
            {(e.status === 'confirmed' || e.status === 'completed') && <>
              <p className="pay-enter"><Video size={18} aria-hidden /> {t.pay.howToEnter}</p>
              <div className="form-actions">
                <button type="button" className="btn-small btn-blue-soft" onClick={() => downloadIcs(`hazluno-${c.id.slice(0, 8)}`, c.title, t.pay.howToEnter, k.meetings)}>
                  <CalendarPlus size={18} aria-hidden />{t.pay.addCalendar}</button>
                <Link className="btn-small btn-orange-solid" to="/my">{t.pay.viewMyClasses}</Link>
              </div>
            </>}
          </section>
        )}
        {error && <Banner tone="error">{error}</Banner>}
        {e.status === 'expired' && <Link className="btn-small btn-orange-solid align-start" to={`/course/${e.courseId}/choose`}>{t.pay.tryAgain}</Link>}
        {e.canWithdraw && e.status === 'confirmed' && (
          <section className="panel pay-rule">
            <p className="muted small">{e.priceCents > 0 ? fill(t.pay.withdrawalText, { refund }) : t.pay.withdrawFree}</p>
            <button type="button" className="btn-plain danger align-start" disabled={busy} onClick={withdraw}><XCircle size={16} aria-hidden /> {t.pay.withdrawBtn}</button>
          </section>
        )}
      </div>
    </main>
  );
}
