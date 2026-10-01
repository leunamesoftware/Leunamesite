import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LANGUAGES, type CourseCard as Card, type ExploreQuery, type LanguageCode, type Level } from '../../../../shared/contracts';
import { api } from '../../api';
import { NATIVE_NAMES, useI18n } from '../../i18n';
import { usePublicConfig } from '../../state/config';
import { toggleFavorite } from '../../state/favorites';
import { useSession } from '../../state/session';
import { CategoryChips, useCategories } from '../../ui/categories';
import { CourseCard } from '../../ui/CourseCard';
import { Shell } from '../../ui/shell';

const PAGE = 12;
type When = '' | 'today' | 'week' | 'month';

function range(when: When): Pick<ExploreQuery, 'from' | 'to'> {
  if (!when) return {};
  const now = new Date();
  const end = new Date(now);
  if (when === 'today') end.setHours(24, 0, 0, 0);
  else end.setDate(end.getDate() + (when === 'week' ? 7 : 30));
  return { from: now.toISOString(), to: end.toISOString() };
}

/** Tela 5 — buscar (layout da referência: busca, categorias, filtros, ordenação, contagem, cartões). */
export function Explore() {
  const { t, lang, fill, countryName } = useI18n();
  const { me } = useSession();
  const { config } = usePublicConfig();
  const categories = useCategories(lang);
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [items, setItems] = useState<Card[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const query = useMemo<ExploreQuery & { when: When }>(() => ({
    q: params.get('q') ?? undefined,
    category: params.get('category') ?? undefined,
    level: (params.get('level') as Level) || undefined,
    language: (params.get('language') as LanguageCode) || undefined,
    country: params.get('country') ?? undefined,
    price: (params.get('price') as 'free' | 'paid') || undefined,
    liveNow: params.get('liveNow') === '1' || undefined,
    sort: (params.get('sort') as ExploreQuery['sort']) || 'relevance',
    when: (params.get('when') as When) || '',
  }), [params]);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('focus');
    setParams(next, { replace: true });
  };

  useEffect(() => { if (params.get('focus')) searchRef.current?.focus(); }, [params]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const { when, ...q } = query;
    api.explore({ ...q, ...range(when), limit: PAGE, offset: 0 })
      .then((r) => { if (alive) { setItems(r.items); setTotal(r.total); } }, () => { if (alive) { setItems([]); setTotal(0); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [query]);

  const more = async () => {
    const { when, ...q } = query;
    const r = await api.explore({ ...q, ...range(when), limit: PAGE, offset: items.length });
    setItems((l) => [...l, ...r.items]);
  };

  const radio = (key: string, options: [string, string][], current: string) => (
    <div className="radios">
      {options.map(([value, label]) => (
        <label key={value || 'all'} className="radio">
          <input type="radio" name={key} checked={current === value} onChange={() => set(key, value || null)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
  const activeFilters = ['level', 'language', 'country', 'price', 'liveNow', 'when'].filter((k) => params.get(k)).length;

  return (
    <Shell tone="soft">
      <main className="explore">
        <header className="explore-head">
          <form className="searchbar searchbar-input" role="search" onSubmit={(e) => { e.preventDefault(); set('q', text.trim() || null); }}>
            <Search size={22} aria-hidden />
            <input ref={searchRef} id="explore-q" type="search" value={text} onChange={(e) => setText(e.target.value)}
              placeholder={t.homeP2.searchPlaceholder} aria-label={t.explore.title} enterKeyHint="search" />
            {text && <button type="button" className="clear-x" aria-label={t.explore.clear} onClick={() => { setText(''); set('q', null); }}><X size={18} /></button>}
          </form>
          <CategoryChips categories={categories} selected={query.category ?? null} onPick={(id) => set('category', id)} allLabel={t.explore.all} />
        </header>

        <div className="explore-body">
          <aside className={`filters${filtersOpen ? ' filters-open' : ''}`} aria-label={t.explore.filters}>
            <div className="filters-head">
              <h2>{t.explore.filters}</h2>
              <button type="button" className="icon-btn filters-close" onClick={() => setFiltersOpen(false)} aria-label={t.explore.apply}><X size={20} /></button>
            </div>
            <fieldset><legend>{t.explore.type}</legend>
              <label className="check-line"><input type="checkbox" checked={!!query.liveNow} onChange={(e) => set('liveNow', e.target.checked ? '1' : null)} />{t.explore.liveOnly}</label>
            </fieldset>
            <fieldset><legend>{t.explore.when}</legend>
              {radio('when', [['', t.explore.whenAny], ['today', t.explore.whenToday], ['week', t.explore.whenWeek], ['month', t.explore.whenMonth]], query.when)}
            </fieldset>
            <fieldset><legend>{t.explore.price}</legend>
              {radio('price', [['', t.explore.priceAll], ['free', t.explore.priceFree], ['paid', t.explore.pricePaid]], query.price ?? '')}
            </fieldset>
            <fieldset><legend>{t.explore.level}</legend>
              {radio('level', [['', t.explore.levelAll], ['beginner', t.levels.beginner], ['intermediate', t.levels.intermediate], ['advanced', t.levels.advanced]], query.level ?? '')}
            </fieldset>
            <fieldset><legend>{t.explore.language}</legend>
              <select id="f-language" value={query.language ?? ''} onChange={(e) => set('language', e.target.value || null)}>
                <option value="">{t.explore.anyLanguage}</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{NATIVE_NAMES[l]}</option>)}
              </select>
            </fieldset>
            <fieldset><legend>{t.explore.country}</legend>
              <select id="f-country" value={query.country ?? ''} onChange={(e) => set('country', e.target.value || null)}>
                <option value="">{t.explore.anyCountry}</option>
                {(config?.countries ?? []).map((c) => ({ code: c.code, name: countryName(c.code) }))
                  .sort((a, b) => a.name.localeCompare(b.name, lang)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </fieldset>
            <div className="filters-foot">
              <button type="button" className="btn-plain" onClick={() => { setParams(new URLSearchParams(query.q ? { q: query.q } : {}), { replace: true }); }}>{t.explore.clear}</button>
              <button type="button" className="btn-small btn-orange-solid" onClick={() => setFiltersOpen(false)}>{t.explore.apply}</button>
            </div>
          </aside>

          <section className="results" aria-busy={loading}>
            <div className="results-head">
              <h1>{t.explore.results} {total !== null && <span>{total === 1 ? t.explore.resultsCountOne : fill(t.explore.resultsCount, { n: String(total) })}</span>}</h1>
              <div className="results-tools">
                <button type="button" className="tool-btn filters-toggle" onClick={() => setFiltersOpen(true)}>
                  <SlidersHorizontal size={18} aria-hidden />{t.explore.filters}{activeFilters ? ` (${activeFilters})` : ''}
                </button>
                <label className="tool-btn sort">
                  <ArrowUpDown size={18} aria-hidden />
                  <select id="explore-sort" aria-label={t.explore.sortBy} value={query.sort} onChange={(e) => set('sort', e.target.value === 'relevance' ? null : e.target.value)}>
                    <option value="relevance">{t.explore.sortRelevance}</option>
                    <option value="soonest">{t.explore.sortSoonest}</option>
                    <option value="price_asc">{t.explore.sortPriceAsc}</option>
                    <option value="price_desc">{t.explore.sortPriceDesc}</option>
                    <option value="rating">{t.explore.sortRating}</option>
                    <option value="newest">{t.explore.sortNewest}</option>
                  </select>
                </label>
              </div>
            </div>
            {total === 0 && !loading && <div className="empty empty-light"><h2>{t.explore.empty}</h2><p>{t.explore.emptyText}</p></div>}
            <div className="cards-grid">
              {items.map((c) => <CourseCard key={c.id} card={c} onFavorite={me ? (on) => toggleFavorite(c, on, (fn) => setItems(fn)) : undefined} />)}
            </div>
            {total !== null && items.length < total && <button type="button" className="btn-more" onClick={more}>{t.explore.loadMore}</button>}
          </section>
        </div>
      </main>
    </Shell>
  );
}
