import { useEffect, useState } from 'react';
import type { CourseCard as Card } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { toggleFavorite } from '../../state/favorites';
import { CourseCard } from '../../ui/CourseCard';
import { Wordmark } from '../../ui/kit';
import { Shell } from '../../ui/shell';

export function Favorites() {
  const { t } = useI18n();
  const [list, setList] = useState<Card[] | null>(null);
  useEffect(() => { api.favorites().then(setList, () => setList([])); }, []);
  return (
    <Shell tone="soft">
      <main className="mine">
        <header className="page-head"><Wordmark size="sm" /><h1>{t.fav.title}</h1></header>
        <div className="page-body">
          {list && !list.length && <div className="empty empty-light"><h2>{t.fav.empty}</h2></div>}
          <div className="cards-grid">
            {(list ?? []).map((c) => (
              <CourseCard key={c.id} card={c} onFavorite={(on) => toggleFavorite(c, on, (fn) => setList((l) => l && fn(l).filter((x) => x.favorite)))} />
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
