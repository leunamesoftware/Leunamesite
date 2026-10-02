import { ArrowRightLeft, Banknote, CreditCard, Hourglass, Landmark, RotateCcw, Ticket, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdminFinance as Data, AdminMoneyLine } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { errorText } from '../../ui/errors';
import { dayShort, money } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { AdminFilters, AdminPager } from './AdminList';
import { AdminLayout } from './AdminLayout';

type Tab = 'payments' | 'refunds' | 'transfers';

/** Telas 33–34 — every euro that moved; transfers to teachers can be run by hand (they also run on a schedule). */
export function AdminFinance() {
  const { t, lang, fill } = useI18n();
  const [tab, setTab] = useState<Tab>('payments');
  const [page, setPage] = useState(1);
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const load = () => api.admin.finance(tab, page).then(setD, (e) => setMsg({ tone: 'error', text: errorText(t, e) }));
  useEffect(() => { void load(); }, [tab, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const eur = (c: number) => money(c, 'EUR', lang);
  const settle = async () => {
    setMsg(null);
    try { const r = await api.admin.settle(); setMsg({ tone: 'info', text: fill(t.admin.settled, { n: String(r.transferred), w: String(r.waiting) }) }); await load(); }
    catch (e) { setMsg({ tone: 'error', text: errorText(t, e) }); }
  };
  const kind = (l: AdminMoneyLine) => t.admin[`k_${l.kind}` as const];
  const status = (s: string) => (t.admin as Record<string, string>)[`st_${s}`] ?? s;
  const detail = (l: AdminMoneyLine) => {
    if (l.kind !== 'refund' || !l.detail) return l.kind === 'transfer' ? l.detail : l.detail ?? '';
    const [reason, p, tt] = l.detail.split(':');
    const label = (t.admin as Record<string, string>)[`r_${reason}`] ?? reason;
    return p !== undefined ? `${label} · ${fill(t.admin.keptSplit, { p: eur(Number(p)), t: eur(Number(tt)) })}` : label;
  };
  const s = d?.summary;

  return (
    <AdminLayout title={t.admin.moneyTitle} actions={s?.testMode ? <span className="test-badge">{t.admin.testBadge}</span> : undefined}>
      <p className="page-lead muted">{t.admin.moneySub}</p>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      {s && !s.paymentsAvailable && <Banner tone="info">{t.admin.paymentsOff}</Banner>}
      {s && <>
        <div className="adm-stats">
          {([
            [Ticket, 'adm-blue', t.admin.mSales, s.salesCents, null],
            [Landmark, 'adm-green', t.admin.mRevenue, s.platformRevenueCents, t.admin.mRevenueHint],
            [Hourglass, 'adm-orange', t.admin.mHeld, s.heldForTeachersCents, t.admin.mHeldHint],
            [ArrowRightLeft, 'adm-purple', t.admin.mTransferred, s.transferredCents, null],
            [CreditCard, 'adm-blue', t.admin.mFees, s.processorFeesCents, null],
            [Banknote, 'adm-green', t.admin.mOpening, s.openingFeesCents, null],
            [RotateCcw, 'adm-orange', t.admin.mRefunded, s.refundedCents, null],
          ] as const).map(([Icon, tone, label, value, hint]) => (
            <section key={label} className="panel adm-stat">
              <span className={`adm-icon ${tone}`}><Icon size={26} aria-hidden /></span>
              <div><span className="muted">{label}</span><strong>{eur(value)}</strong>{hint && <small>{hint}</small>}</div>
            </section>
          ))}
        </div>
        {s.failedRefunds > 0 && <Banner tone="error"><TriangleAlert size={16} aria-hidden /> {fill(t.admin.mFailed, { n: String(s.failedRefunds) })}</Banner>}
      </>}
      <AdminFilters tabs={[['payments', t.admin.tabPayments, undefined], ['refunds', t.admin.tabRefunds, undefined], ['transfers', t.admin.tabTransfers, undefined]]}
        tab={tab} onTab={(x) => { setTab(x); setPage(1); }} />
      <section className="panel">
        {d && !d.items.length && <p className="muted">{t.admin.noRows}</p>}
        {!!d?.items.length && <>
          <div className="earn-table">
            <div className="earn-row money-row earn-head"><span>{t.admin.colWhen}</span><span>{t.admin.colWho}</span><span>{t.admin.colAmount}</span><span>{t.admin.colFee}</span><span>{t.admin.colStatus}</span></div>
            {d.items.map((l) => (
              <div key={l.id} className="earn-row money-row">
                <span>{dayShort(l.at, lang)}</span>
                <span><b>{kind(l)}{l.test ? ' · test' : ''}</b><small>{l.who}{l.courseTitle ? ` · ${l.courseTitle}` : ''}</small>{detail(l) && <small>{detail(l)}</small>}</span>
                <span><b>{eur(l.amountCents)}</b></span>
                <span>{l.feeCents ? `−${eur(l.feeCents)}` : '—'}</span>
                <span><b className={`earn-state ${['succeeded', 'paid'].includes(l.status) ? 'earn-transferred' : ['failed', 'canceled', 'rejected'].includes(l.status) ? 'earn-refunded' : 'earn-held'}`}>{status(l.status)}</b></span>
              </div>
            ))}
          </div>
          <AdminPager page={page} total={d.total} onPage={setPage}>
            {tab === 'transfers' && s?.paymentsAvailable && <button type="button" className="btn-small btn-orange-solid" onClick={settle}>{t.admin.settleNow}</button>}
          </AdminPager>
        </>}
        {d && !d.items.length && tab === 'transfers' && s?.paymentsAvailable && <button type="button" className="btn-small btn-orange-solid align-start" onClick={settle}>{t.admin.settleNow}</button>}
      </section>
    </AdminLayout>
  );
}
