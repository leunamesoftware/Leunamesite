import { Ban, Search, ShieldCheck, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdminUserList, AdminUserRow } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Avatar } from '../../ui/avatar';
import { errorText } from '../../ui/errors';
import { dayShort } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { AdminLayout } from './AdminLayout';

type Tab = 'all' | 'student' | 'instructor' | 'suspended';
const PAGE = 25;

/** Tela 30 — everyone on the platform; suspend / reinstate with a recorded reason. */
export function AdminUsers() {
  const { t, lang, fill, countryName } = useI18n();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserList | null>(null);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const load = () => api.admin.users({ role: tab === 'student' || tab === 'instructor' ? tab : undefined, status: tab === 'suspended' ? 'suspended' : undefined, q, page })
    .then(setData, (e) => setMsg({ tone: 'error', text: errorText(t, e) }));
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [tab, q, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (u: AdminUserRow) => {
    setMsg(null);
    try {
      if (u.status === 'active') {
        const reason = prompt(t.admin.suspendReason);
        if (!reason || reason.trim().length < 3) return;
        await api.admin.suspend(u.id, reason.trim());
        setMsg({ tone: 'info', text: t.admin.suspendedOk });
      } else {
        await api.admin.reinstate(u.id);
        setMsg({ tone: 'info', text: t.admin.reinstatedOk });
      }
      await load();
    } catch (e) { setMsg({ tone: 'error', text: errorText(t, e) }); }
  };
  const tabs: [Tab, string, number | undefined][] = [
    ['all', t.admin.tabAll, data?.counts.all], ['student', t.admin.tabStudents, data?.counts.students],
    ['instructor', t.admin.tabTeachers, data?.counts.teachers], ['suspended', t.admin.tabSuspended, data?.counts.suspended],
  ];
  const role = { student: t.admin.role_student, instructor: t.admin.role_instructor, admin: t.admin.role_admin, moderator: t.admin.role_moderator };
  const tv = { approved: t.admin.tv_approved, under_review: t.admin.tv_under_review, pending: t.admin.tv_pending, rejected: t.admin.tv_rejected, suspended: t.admin.tv_suspended };
  const from = data && data.total ? (page - 1) * PAGE + 1 : 0;
  const to = data ? Math.min(page * PAGE, data.total) : 0;

  return (
    <AdminLayout title={t.admin.usersTitle}>
      <p className="page-lead muted">{t.admin.usersSub}</p>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <div className="stu-tools">
        <div className="stu-tabs" role="tablist">
          {tabs.map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`stu-tab${tab === k ? ' stu-tab-on' : ''}`} onClick={() => { setTab(k); setPage(1); }}>
              {label}{n !== undefined ? ` (${n})` : ''}</button>
          ))}
        </div>
        <label className="stu-search"><Search size={20} aria-hidden />
          <input id="adm-users-q" type="search" value={q} placeholder={t.admin.searchUsers} aria-label={t.admin.searchUsers} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
      </div>
      <section className="panel stu-list">
        {data && !data.items.length && <p className="muted">{t.admin.noUsers}</p>}
        {!!data?.items.length && <>
          <div className="usr-row stu-head" aria-hidden><span>{t.admin.colUser}</span><span>{t.admin.colRoles}</span><span>{t.admin.colActivity}</span><span>{t.admin.colStatus}</span><span /></div>
          <ul>
            {data.items.map((u) => (
              <li key={u.id} className="usr-row">
                <span className="stu-who"><Avatar url={u.avatarUrl} name={u.name} size={44} /><span className="usr-name"><strong>{u.name}</strong><small>{u.email}</small><small>{countryName(u.countryCode)}</small></span></span>
                <span className="usr-roles">
                  {u.roles.map((r) => <b key={r} className={`role-chip role-chip-${r === 'admin' ? 'blue' : r === 'instructor' ? 'orange' : 'soft'}`}>{role[r]}</b>)}
                  {u.teacherStatus && <small className="muted">{u.teacherStatus === 'approved' && <ShieldCheck size={14} aria-hidden />} {tv[u.teacherStatus]}</small>}
                </span>
                <span className="usr-act"><small>{fill(t.admin.joined, { date: dayShort(u.createdAt, lang) })}</small>
                  {u.lastSeenAt && <small>{fill(t.admin.lastSeen, { date: dayShort(u.lastSeenAt, lang) })}</small>}
                  <small>{fill(t.admin.enrollmentsN, { n: String(u.enrollments) })}{u.courses ? ` · ${fill(t.admin.coursesN, { n: String(u.courses) })}` : ''}</small></span>
                <span><b className={`stu-state ${u.status === 'active' ? 'stu-state-active' : 'stu-state-inactive'}`}><i aria-hidden />{u.status === 'active' ? t.admin.statusActive : t.admin.statusSuspended}</b></span>
                <span className="usr-actions">
                  {!u.roles.includes('admin') && (u.status === 'active'
                    ? <button type="button" className="btn-plain danger" onClick={() => act(u)}><Ban size={16} aria-hidden /> {t.admin.suspend}</button>
                    : <button type="button" className="btn-plain" onClick={() => act(u)}><Undo2 size={16} aria-hidden /> {t.admin.reinstate}</button>)}
                </span>
              </li>
            ))}
          </ul>
          <div className="usr-pager">
            <small className="muted">{fill(t.admin.pageOf, { from: String(from), to: String(to), total: String(data.total) })}</small>
            <button type="button" className="btn-small btn-blue-soft" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t.admin.prev}</button>
            <button type="button" className="btn-small btn-blue-soft" disabled={to >= data.total} onClick={() => setPage(page + 1)}>{t.admin.next}</button>
          </div>
        </>}
      </section>
    </AdminLayout>
  );
}
