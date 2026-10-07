import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminCourseRow, AdminPage } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { useCategories } from '../../ui/categories';
import { errorText } from '../../ui/errors';
import { dayShort } from '../../ui/format';
import { Banner } from '../../ui/kit';
import { AdminFilters, AdminPager } from './AdminList';
import { AdminLayout } from './AdminLayout';

type Tab = 'all' | 'published' | 'draft' | 'archived';

/** Tela 31 — every course; hide from the catalog (with reason) or publish again. */
export function AdminCourses() {
  const { t, lang, fill } = useI18n();
  const categories = useCategories(lang);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminPage<AdminCourseRow> | null>(null);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const load = () => api.admin.courses({ status: tab === 'all' ? undefined : tab, q, page }).then(setData, (e) => setMsg({ tone: 'error', text: errorText(t, e) }));
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [tab, q, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (c: AdminCourseRow) => {
    setMsg(null);
    try {
      if (c.status === 'published') {
        const reason = prompt(t.admin.hideReason);
        if (!reason || reason.trim().length < 3) return;
        await api.admin.hideCourse(c.id, reason.trim()); setMsg({ tone: 'info', text: t.admin.hiddenOk });
      } else { await api.admin.showCourse(c.id); setMsg({ tone: 'info', text: t.admin.shownOk }); }
      await load();
    } catch (e) { setMsg({ tone: 'error', text: errorText(t, e) }); }
  };
  const status = { draft: t.teach.statusDraft, published: t.teach.statusPublished, archived: t.teach.statusArchived, pending_review: t.teach.statusDraft, rejected: t.teach.statusDraft };
  const c = data?.counts ?? {};

  return (
    <AdminLayout title={t.admin.coursesTitle}>
      <p className="page-lead muted">{t.admin.coursesSub}</p>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <AdminFilters tabs={[['all', t.admin.tabAll, c.all], ['published', t.admin.tabPublished, c.published ?? 0], ['draft', t.admin.tabDraft, c.draft ?? 0], ['archived', t.admin.tabArchived, c.archived ?? 0]]}
        tab={tab} onTab={(x) => { setTab(x); setPage(1); }} q={q} onQ={(x) => { setQ(x); setPage(1); }} placeholder={t.admin.searchCourses} />
      <section className="panel stu-list">
        {data && !data.items.length && <p className="muted">{t.admin.noRows}</p>}
        {!!data?.items.length && <>
          <div className="usr-row stu-head" aria-hidden><span>{t.admin.colCourse}</span><span>{t.admin.colGroups}</span><span>{t.admin.colActivity}</span><span>{t.admin.colStatus}</span><span /></div>
          <ul>
            {data.items.map((x) => (
              <li key={x.id} className="usr-row">
                <span className="stu-who">{x.coverUrl ? <img className="adm-cover" src={x.coverUrl} alt="" /> : <span className="adm-thumb adm-cover" aria-hidden />}
                  <span className="usr-name"><Link to={`/course/${x.id}`}><strong>{x.title}</strong></Link><small>{x.teacherName}</small>
                    <small>{categories.find((k) => k.id === x.categoryId)?.name ?? x.categoryId}</small></span></span>
                <span className="usr-act"><small>{fill(t.admin.groupsN, { n: String(x.groups), open: String(x.openGroups) })}</small><small>{fill(t.admin.studentsN, { n: String(x.students) })}</small></span>
                <span className="usr-act"><small>{fill(t.admin.joined, { date: dayShort(x.createdAt, lang) })}</small></span>
                <span><b className={`stu-state ${x.status === 'published' ? 'stu-state-active' : x.status === 'archived' ? 'stu-state-inactive' : 'stu-state-pending'}`}><i aria-hidden />{status[x.status]}</b></span>
                <span className="usr-actions">
                  {x.status === 'published' && <button type="button" className="btn-plain danger" onClick={() => toggle(x)}><EyeOff size={16} aria-hidden /> {t.admin.hide}</button>}
                  {x.status === 'archived' && <button type="button" className="btn-plain" onClick={() => toggle(x)}><Eye size={16} aria-hidden /> {t.admin.show}</button>}
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
