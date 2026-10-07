import { CalendarDays, ChevronLeft, CreditCard, Lock, ShieldAlert, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CourseDetail } from '../../../../shared/contracts';
import { api, ApiError } from '../../api';
import { useI18n } from '../../i18n';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { useClassWhen, useMeetingTime } from '../../ui/classes';
import { errorText } from '../../ui/errors';
import { dayShort, money } from '../../ui/format';
import { Banner } from '../../ui/kit';

const HOLD_MINUTES = 30;

/** Tela 9 — "Finalizar inscripción": summary, every meeting, cancellation rule to accept, then the provider's secure page. */
export function Checkout() {
  const { id = '', classId = '' } = useParams();
  const { t, lang, fill } = useI18n();
  const { me } = useSession();
  const navigate = useNavigate();
  const when = useClassWhen();
  const meetingTime = useMeetingTime();
  const [c, setC] = useState<CourseDetail | null>(null);
  const [acceptW, setAcceptW] = useState(false);
  const [acceptS, setAcceptS] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.course(id).then(setC, () => navigate('/explore', { replace: true })); }, [id, navigate]);
  useEffect(() => { if (!me) navigate(`/login?next=${encodeURIComponent(`/course/${id}/checkout/${classId}`)}`, { replace: true }); }, [me, id, classId, navigate]);
  const k = c?.classes.find((x) => x.id === classId);
  if (!c || !me) return <main className="mine pay" aria-busy="true" />;
  if (!k || k.access.action !== 'buy') {
    return (
      <main className="mine pay"><div className="page-body"><Banner tone="error">{t.errors.enrollment_closed}</Banner>
        <Link className="btn-small btn-blue-soft align-start" to={`/course/${c.id}/choose`}>{t.common.back}</Link></div></main>
    );
  }
  const paid = k.priceCents > 0;
  const price = paid ? money(k.priceCents, k.currency, lang) : t.card.free;
  const refund = money(k.priceCents - Math.round(k.priceCents / 2), k.currency, lang);
  const ready = (!paid || acceptW) && (!c.isHazardous || acceptS);

  async function go() {
    setBusy(true); setError(null);
    try {
      const r = await api.enroll({ classId, acceptWithdrawal: paid ? acceptW : undefined, acceptSafety: c!.isHazardous ? acceptS : undefined });
      if (r.checkoutUrl) window.location.assign(r.checkoutUrl);
      else navigate(`/enrollment/${r.enrollmentId}`, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'payments_unavailable' ? t.pay.paymentsOff : errorText(t, e));
      setBusy(false);
    }
  }

  return (
    <main className="mine pay">
      <header className="page-head">
        <div className="teach-bar">
          <button type="button" className="icon-btn icon-btn-light" onClick={() => navigate(`/course/${c.id}/choose?class=${k.id}`)} aria-label={t.common.back}><ChevronLeft size={24} /></button>
        </div>
        <h1>{t.pay.checkoutTitle}</h1>
        <p>{t.pay.checkoutSub}</p>
      </header>
      <div className="page-body pay-grid">
        <section className="panel pay-summary">
          <div className="pay-course">
            {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <span className="adm-thumb" aria-hidden />}
            <div><strong>{c.title}</strong><span className="cpreview-teacher"><Avatar url={c.instructor.avatarUrl} name={c.instructor.name} size={26} />{c.instructor.name}</span></div>
          </div>
          <h2 className="sub">{t.pay.yourGroup}</h2>
          <p className="pay-group"><Users size={18} aria-hidden /><b>{k.label ?? when(k)}</b>{k.label ? ` · ${when(k)}` : ''}</p>
          <h3 className="sub">{fill(t.pay.meetingsList, { n: String(k.meetings.length) })}</h3>
          <ol className="pay-meetings">
            {k.meetings.map((m) => <li key={m.id}><CalendarDays size={16} aria-hidden /><span>{dayShort(m.start, lang)}</span><b>{meetingTime(m).range}</b></li>)}
          </ol>
          {c.isHazardous && c.safetyNotice && (
            <div className="pay-safety"><strong><ShieldAlert size={18} aria-hidden /> {t.pay.safetyTitle}</strong><p>{c.safetyNotice}</p>
              <label className="check-line"><input id="pay-safety" type="checkbox" checked={acceptS} onChange={(e) => setAcceptS(e.target.checked)} />{t.pay.acceptSafety}</label></div>
          )}
        </section>

        <aside className="panel pay-box">
          <div className="pay-total"><span>{t.pay.total}</span><strong>{price}</strong></div>
          <p className="muted small">{t.pay.perGroupNote}</p>
          {paid && (
            <div className="pay-rule">
              <strong>{t.pay.withdrawalTitle}</strong>
              <p>{fill(t.pay.withdrawalText, { refund })}</p>
              <label className="check-line"><input id="pay-withdrawal" type="checkbox" checked={acceptW} onChange={(e) => setAcceptW(e.target.checked)} />{t.pay.acceptWithdrawal}</label>
            </div>
          )}
          {error && <Banner tone="error">{error}</Banner>}
          <button type="button" className="btn btn-orange btn-split" disabled={!ready || busy} onClick={go}>
            {paid ? <CreditCard size={22} aria-hidden /> : <span />}<span>{busy ? t.common.loading : paid ? fill(t.pay.payBtn, { price }) : t.pay.freeBtn}</span><span />
          </button>
          {paid && <p className="muted small pay-secure"><Lock size={14} aria-hidden /> {t.pay.secureNote}</p>}
          {paid && <p className="muted small">{fill(t.pay.holdNote, { min: String(HOLD_MINUTES) })}</p>}
        </aside>
      </div>
    </main>
  );
}
