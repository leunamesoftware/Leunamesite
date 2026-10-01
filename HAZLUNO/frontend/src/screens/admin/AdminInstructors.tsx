import { Check, ChevronLeft, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminInstructorRow } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { errorText } from '../../ui/errors';
import { dayShort } from '../../ui/format';
import { Banner } from '../../ui/kit';

/** Minimal admin screen of Phase 2: approve or decline teachers. The full panel is Phase 6. */
export function AdminInstructors() {
  const { t, lang, fill, countryName } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminInstructorRow[] | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const load = () => api.admin.instructors().then(setRows, (e) => { setRows([]); setError(errorText(t, e)); });
  useEffect(() => { void load(); }, []);
  const decide = async (id: string, approve: boolean) => {
    setError(null);
    try { await (approve ? api.admin.approve(id) : api.admin.reject(id, reasons[id] ?? '')); await load(); } catch (e) { setError(errorText(t, e)); }
  };
  return (
    <main className="mine">
      <header className="page-head">
        <div className="teach-bar"><button type="button" className="icon-btn icon-btn-light" onClick={() => navigate('/profile')} aria-label={t.common.back}><ChevronLeft size={24} /></button></div>
        <h1>{t.admin.title}</h1>
      </header>
      <div className="page-body">
        {error && <Banner tone="error">{error}</Banner>}
        {rows && !rows.length && <div className="empty empty-light"><p>{t.admin.empty}</p></div>}
        {(rows ?? []).map((r) => (
          <section key={r.userId} className="panel">
            <h2>{r.name}</h2>
            <p className="muted">{r.email} · {countryName(r.countryCode)} · {fill(t.admin.submittedAt, { date: dayShort(r.submittedAt, lang) })}</p>
            <dl className="kv">
              <dt>{t.teach.headline}</dt><dd>{r.headline ?? '—'}</dd>
              <dt>{t.teach.entityType}</dt><dd>{r.legalEntityType === 'company' ? t.teach.company : t.teach.individual}</dd>
              <dt>{t.teach.legalName}</dt><dd>{r.legalName}</dd>
              <dt>{t.teach.taxId}</dt><dd>{r.taxId} ({r.taxCountry})</dd>
              <dt>{t.teach.address}</dt><dd>{r.businessAddress}</dd>
            </dl>
            <label className="lfield"><span>{t.admin.reason}</span><input value={reasons[r.userId] ?? ''} onChange={(e) => setReasons({ ...reasons, [r.userId]: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn-small btn-orange-solid" onClick={() => decide(r.userId, true)}><Check size={18} aria-hidden />{t.admin.approve}</button>
              <button type="button" className="btn-small btn-blue-soft" onClick={() => decide(r.userId, false)}><X size={18} aria-hidden />{t.admin.reject}</button>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
