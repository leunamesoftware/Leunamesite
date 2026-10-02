import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';

/** Shared top of the admin lists: tabs with counts + search box, and the pager at the bottom. */
export function AdminFilters<T extends string>({ tabs, tab, onTab, q, onQ, placeholder }: {
  tabs: [T, string, number | undefined][]; tab: T; onTab(t: T): void; q?: string; onQ?(q: string): void; placeholder?: string;
}) {
  return (
    <div className="stu-tools">
      <div className="stu-tabs" role="tablist">
        {tabs.map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`stu-tab${tab === k ? ' stu-tab-on' : ''}`} onClick={() => onTab(k)}>
            {label}{n !== undefined ? ` (${n})` : ''}</button>
        ))}
      </div>
      {onQ && <label className="stu-search"><Search size={20} aria-hidden />
        <input type="search" value={q} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onQ(e.target.value)} /></label>}
    </div>
  );
}

export function AdminPager({ page, total, size = 25, onPage, children }: { page: number; total: number; size?: number; onPage(p: number): void; children?: ReactNode }) {
  const { t, fill } = useI18n();
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(page * size, total);
  return (
    <div className="usr-pager">
      <small className="muted">{fill(t.admin.pageOf, { from: String(from), to: String(to), total: String(total) })}</small>
      {children}
      <button type="button" className="btn-small btn-blue-soft" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t.admin.prev}</button>
      <button type="button" className="btn-small btn-blue-soft" disabled={to >= total} onClick={() => onPage(page + 1)}>{t.admin.next}</button>
    </div>
  );
}
