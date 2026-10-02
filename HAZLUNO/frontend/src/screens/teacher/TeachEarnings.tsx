import { ArrowRightLeft, BadgeCheck, Banknote, CreditCard, Hourglass, Info, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Earnings, PayoutStatus } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { errorText } from '../../ui/errors';
import { dayShort, money } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { TeachLayout } from './TeachLayout';

/** Tela 28 — earnings (owner reference, adjusted): real sales only, processor fee shown openly, bank details only on the provider's page. */
export function TeachEarnings() {
  const { t, lang, fill } = useI18n();
  const [e, setE] = useState<Earnings | null>(null);
  const [p, setP] = useState<PayoutStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.teacher.earnings().then(setE, (err) => setError(errorText(t, err)));
    api.teacher.payouts().then(setP, () => undefined);
  }, [t]);
  const eur = (c: number) => money(c, e?.currency ?? 'EUR', lang);
  const connect = async () => {
    setBusy(true);
    try { window.location.assign((await api.teacher.connectPayouts()).url); } catch (err) { setError(errorText(t, err)); setBusy(false); }
  };
  const kind = { sale: t.earn.kind_sale, withdrawal: t.earn.kind_withdrawal, refund: t.earn.kind_refund, opening_fee: t.earn.kind_opening_fee };
  const state = { held: t.earn.state_held, transferred: t.earn.state_transferred, refunded: t.earn.state_refunded, paid: t.earn.state_paid };

  return (
    <TeachLayout title={t.earn.title}>
      <p className="page-lead muted">{t.earn.sub}</p>
      {error && <Banner tone="error">{error}</Banner>}
      {e && <>
        <div className="adm-stats">
          {([
            [ArrowRightLeft, 'adm-green', t.earn.transferred, e.transferredCents, null],
            [Hourglass, 'adm-orange', t.earn.held, e.heldCents, t.earn.heldHint],
            [Receipt, 'adm-blue', t.earn.gross, e.grossCents, fill(t.earn.salesN, { n: String(e.salesCount) })],
            [CreditCard, 'adm-purple', t.earn.fees, e.feesCents, `${t.earn.opening}: ${eur(e.openingFeesCents)}`],
          ] as const).map(([Icon, tone, label, value, sub]) => (
            <section key={label} className="panel adm-stat">
              <span className={`adm-icon ${tone}`}><Icon size={28} aria-hidden /></span>
              <div><span className="muted">{label}</span><strong>{eur(value)}</strong>{sub && <small>{sub}</small>}</div>
            </section>
          ))}
        </div>

        <div className="adm-grid adm-grid-2">
          <section className="panel">
            <h2>{t.earn.movements}</h2>
            {!e.lines.length ? <p className="muted">{t.earn.noMovements}</p> : (
              <div className="earn-table" role="table">
                <div className="earn-row earn-head" role="row">
                  <span>{t.earn.colDate}</span><span>{t.earn.colDesc}</span><span>{t.earn.colGross}</span><span>{t.earn.colFee}</span><span>{t.earn.colNet}</span><span>{t.earn.colState}</span>
                </div>
                {e.lines.map((l, i) => (
                  <div key={`${l.at}-${i}`} className="earn-row" role="row">
                    <span>{dayShort(l.at, lang)}</span>
                    <span><b>{kind[l.kind]}</b><small>{l.courseTitle}{l.classLabel ? ` · ${l.classLabel}` : ''}{l.student ? ` · ${l.student}` : ''}</small></span>
                    <span>{eur(l.grossCents)}</span>
                    <span>{l.feeCents ? `−${eur(l.feeCents)}` : '—'}</span>
                    <span className={l.netCents < 0 ? 'neg' : ''}><b>{eur(l.netCents)}</b></span>
                    <span><b className={`earn-state earn-${l.state}`}>{state[l.state]}</b></span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="why">
            <section className="panel">
              <h2><Banknote size={20} aria-hidden /> {t.earn.payoutTitle}</h2>
              {!p?.paymentsAvailable ? <p className="muted">{t.earn.payoutOff}</p> : p.payoutsEnabled ? (
                <p className="earn-ok"><BadgeCheck size={20} aria-hidden /> {t.earn.payoutOk}</p>
              ) : (
                <button type="button" className="btn-small btn-orange-solid align-start" disabled={busy} onClick={connect}>{p.connected ? t.earn.payoutContinue : t.earn.payoutConnect}</button>
              )}
              <p className="muted small">{t.earn.payoutHint}</p>
            </section>
            <section className="panel tips">
              <h2><Info size={20} aria-hidden /> {t.site.howTitle}</h2>
              <p className="muted">{fill(t.earn.rules, { fee: eur(p?.openingFeeCents ?? 500) })}</p>
            </section>
          </div>
        </div>
      </>}
    </TeachLayout>
  );
}
