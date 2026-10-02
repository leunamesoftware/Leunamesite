import { BadgeCheck, CircleDashed, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminClassRow, AdminPage } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { errorText } from '../../ui/errors';
import { dayShort, money, time } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { AdminFilters, AdminPager } from './AdminList';
import { AdminLayout } from './AdminLayout';

type Tab = 'all' | 'upcoming' | 'running' | 'finished' | 'canceled';

/** Tela 32 — every group; the platform can cancel one that has not started (full refunds). */
export function AdminClasses() {
  const { t, lang, fill } = useI18n();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminPage<AdminClassRow> | null>(null);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const load = () => api.admin.classes({ status: tab === 'all' ? undefined : tab, q, page }).then(setData, (e) => setMsg({ tone: 'error', text: errorText(t, e) }));
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [tab, q, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async (k: AdminClassRow) => {
    const reason = prompt(t.admin.cancelReason);
    if (!reason || reason.trim().length < 3) return;
    setMsg(null);
    try { await api.admin.cancelClass(k.id, reason.trim()); setMsg({ tone: 'info', text: t.admin.canceledOk }); await load(); }
    catch (e) { setMsg({ tone: 'error', text: errorText(t, e) }); }
  };
  const c = data?.counts ?? {};
  const now = Date.now();

  return (
    <AdminLayout title={t.admin.classesTitle}>
      <p className="page-lead muted">{t.admin.classesSub}</p>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <AdminFilters tabs={[['upcoming', t.admin.tabUpcoming, c.upcoming], ['running', t.admin.tabRunning, c.running], ['finished', t.admin.tabFinished, c.finished],
        ['canceled', t.admin.tabCanceled, c.canceled], ['all', t.admin.tabAll, c.all]]}
        tab={tab} onTab={(x) => { setTab(x); setPage(1); }} q={q} onQ={(x) => { setQ(x); setPage(1); }} placeholder={t.admin.searchCourses} />
      <section className="panel stu-list">
        {data && !data.items.length && <p className="muted">{t.admin.noRows}</p>}
        {!!data?.items.length && <>
          <div className="usr-row stu-head" aria-hidden><span>{t.admin.colCourse}</span><span>{t.admin.colDates}</span><span>{t.admin.colSeats}</span><span>{t.admin.colStatus}</span><span /></div>
          <ul>
            {data.items.map((k) => (
              <li key={k.id} className="usr-row">
                <span className="usr-name"><Link to={`/course/${k.courseId}`}><strong>{k.courseTitle}{k.label ? ` · ${k.label}` : ''}</strong></Link><small>{k.teacherName}</small>
                  <small>{k.priceCents ? money(k.priceCents, k.currency, lang) : t.card.free}</small></span>
                <span className="usr-act"><small>{dayShort(k.startsAt, lang)} {time(k.startsAt, lang)}</small><small>→ {dayShort(k.endsAt, lang)}</small>
                  <small>{fill(t.admin.meetingsN, { n: String(k.meetings) })}</small></span>
                <span className="usr-act"><small><b>{k.seatsTaken}/{k.capacity}</b></small>
                  <small className={k.openingFeePaid ? 'fee-ok' : ''}>{k.openingFeePaid ? <BadgeCheck size={14} aria-hidden /> : <CircleDashed size={14} aria-hidden />} {k.openingFeePaid ? t.admin.feePaid : t.admin.feeNo}</small></span>
                <span><b className={`stu-state ${k.status === 'canceled' ? 'stu-state-inactive' : k.status === 'draft' ? 'stu-state-pending' : 'stu-state-active'}`}><i aria-hidden />{t.teach.classStatus[k.status]}</b></span>
                <span className="usr-actions">
                  {!['canceled', 'completed', 'live'].includes(k.status) && Date.parse(k.startsAt) > now && (
                    <button type="button" className="btn-plain danger" onClick={() => cancel(k)}><XCircle size={16} aria-hidden /> {t.admin.cancelGroup}</button>)}
                </span>
              </li>
            ))}
          </ul>
          <AdminPager page={page} total={data.total} onPage={setPage} />
        </>}
      </section>
    </AdminLayout>
  );
}
