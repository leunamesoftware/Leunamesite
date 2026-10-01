import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CourseCard as Card } from '../../../../shared/contracts';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { toggleFavorite } from '../../state/favorites';
import { useSession } from '../../state/session';
import { Avatar } from '../../ui/avatar';
import { CategoryChips, useCategories } from '../../ui/categories';
import { CourseCard } from '../../ui/CourseCard';
import { Banner, Wordmark } from '../../ui/kit';
import { Shell } from '../../ui/shell';

/** Tela 4 — início do aluno. */
export function Home() {
  const { t, lang, fill } = useI18n();
  const { me } = useSession();
  const navigate = useNavigate();
  const categories = useCategories(lang);
  const [live, setLive] = useState<Card[] | null>(null);
  const [upcoming, setUpcoming] = useState<Card[] | null>(null);

  useEffect(() => {
    api.explore({ liveNow: true, limit: 6 }).then((r) => setLive(r.items), () => setLive([]));
    api.explore({ sort: 'soonest', limit: 8 }).then((r) => setUpcoming(r.items.filter((c) => c.nextClass)), () => setUpcoming([]));
  }, []);
  if (!me) return null;
  const firstName = me.displayName.split(' ')[0] ?? me.displayName;
  const fav = (card: Card, on: boolean) => {
    void toggleFavorite(card, on, (fn) => setLive((l) => l && fn(l)));
    void toggleFavorite(card, on, (fn) => setUpcoming((l) => l && fn(l)));
  };

  return (
    <Shell>
      <main className="home">
        <img className="home-art" src="/signup-learn.webp" alt="" width={409} height={532} />
        <header className="home-head">
          <div className="home-bar">
            <Wordmark size="sm" />
            <button type="button" className="avatar-btn" onClick={() => navigate('/profile')} aria-label={t.nav.profile}>
              <Avatar url={me.avatarUrl} name={me.displayName} size={44} />
            </button>
          </div>
          <p className="home-hello">{fill(t.home.hello, { name: firstName })}</p>
          <h1 className="home-question">{t.home.questionPre}<em>{t.home.questionWord}</em>{t.home.questionPost}</h1>
          <button type="button" className="searchbar" onClick={() => navigate('/explore?focus=1')}>
            <Search size={22} aria-hidden /><span>{t.homeP2.searchPlaceholder}</span>
          </button>
        </header>
        <div className="home-body">
          {me.instructor?.verificationStatus && me.instructor.verificationStatus !== 'approved' && <Banner tone="info">{t.home.instructorPending}</Banner>}
          <CategoryChips categories={categories} selected={null} onPick={(id) => navigate(id ? `/explore?category=${id}` : '/explore')} />
          {!!live?.length && (
            <section className="row-section">
              <h2 className="section-title">{t.homeP2.liveNow}</h2>
              <div className="cards-row">{live.map((c) => <CourseCard key={c.id} card={c} onFavorite={(on) => fav(c, on)} />)}</div>
            </section>
          )}
          <section className="row-section">
            <div className="section-head">
              <h2 className="section-title">{t.homeP2.upcoming}</h2>
              {!!upcoming?.length && <button type="button" className="see-all" onClick={() => navigate('/explore?sort=soonest')}>{t.homeP2.seeAll}</button>}
            </div>
            {upcoming && !upcoming.length && (
              <div className="empty"><h2>{t.home.emptyTitle}</h2><p>{t.home.emptyText}</p></div>
            )}
            <div className="cards-row">{(upcoming ?? []).map((c) => <CourseCard key={c.id} card={c} onFavorite={(on) => fav(c, on)} />)}</div>
          </section>
        </div>
      </main>
    </Shell>
  );
}
