import { BadgeCheck, CalendarCheck, Check, ChevronRight, LockKeyhole, MessagesSquare, PlayCircle, ScanFace, Search, ShieldCheck, Ticket, Video } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CourseCard as Card } from '../../../shared/contracts';
import { api } from '../api';
import { useI18n } from '../i18n';
import { categoryIcon, useCategories } from '../ui/categories';
import { CourseCard } from '../ui/CourseCard';
import { SiteFooter, SiteHeader } from '../ui/site';

/** Public website on computers: what Hazluno is, real open groups, how it works, teaching, safety, FAQ. */
export function Landing() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const categories = useCategories(lang);
  const [q, setQ] = useState('');
  const [upcoming, setUpcoming] = useState<Card[] | null>(null);
  useEffect(() => {
    api.explore({ sort: 'soonest', limit: 6 }).then((r) => setUpcoming(r.items.filter((c) => c.nextClass)), () => setUpcoming([]));
  }, []);
  const search = (e: FormEvent) => { e.preventDefault(); navigate(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore'); };

  const trust: [typeof BadgeCheck, string][] = [[BadgeCheck, t.site.trust1], [ScanFace, t.site.trust2], [PlayCircle, t.site.trust3], [Ticket, t.site.trust4]];
  const how: [typeof Search, string, string][] = [
    [Search, t.site.how1t, t.site.how1], [CalendarCheck, t.site.how2t, t.site.how2], [Video, t.site.how3t, t.site.how3], [PlayCircle, t.site.how4t, t.site.how4],
  ];
  const safe: [typeof ShieldCheck, string, string][] = [
    [ShieldCheck, t.site.safe1t, t.site.safe1], [LockKeyhole, t.site.safe2t, t.site.safe2], [MessagesSquare, t.site.safe3t, t.site.safe3],
  ];
  const faq: [string, string][] = [[t.site.q1, t.site.a1], [t.site.q2, t.site.a2], [t.site.q3, t.site.a3], [t.site.q4, t.site.a4]];

  return (
    <div className="site">
      <SiteHeader />
      <main>
        <section className="lp-hero">
          <div className="lp-in lp-hero-in">
            <div className="lp-hero-copy">
              <span className="lp-kicker">{t.site.heroKicker}</span>
              <h1>{t.site.heroTitle}</h1>
              <p>{t.site.heroText}</p>
              <form className="lp-search" onSubmit={search} role="search">
                <Search size={22} aria-hidden />
                <input id="lp-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.site.searchPh} aria-label={t.site.searchPh} />
                <button className="btn-small btn-orange-solid">{t.site.searchBtn}</button>
              </form>
              <div className="lp-ctas">
                <Link to="/signup?intent=learn" className="lp-btn lp-btn-orange">{t.site.ctaLearn}<ChevronRight size={20} aria-hidden /></Link>
                <Link to="/signup?intent=teach" className="lp-btn lp-btn-ghost">{t.site.ctaTeach}</Link>
              </div>
              <ul className="lp-trust">{trust.map(([Icon, label]) => <li key={label}><Icon size={20} aria-hidden />{label}</li>)}</ul>
            </div>
            <img className="lp-hero-img" src="/hero.webp" alt="" width={900} height={797} fetchPriority="high" />
          </div>
        </section>

        {!!categories.length && (
          <section className="lp-section">
            <div className="lp-in">
              <div className="lp-head"><div><h2>{t.site.catsTitle}</h2><p>{t.site.catsSub}</p></div>
                <Link to="/explore" className="lp-more">{t.site.seeAll}<ChevronRight size={18} aria-hidden /></Link></div>
              <div className="lp-cats">
                {categories.map((c, i) => {
                  const Icon = categoryIcon(c.icon);
                  return <Link key={c.id} to={`/explore?category=${c.id}`} className={`lp-cat lp-cat-${i % 2 ? 'blue' : 'orange'}`}><Icon size={26} aria-hidden /><span>{c.name}</span></Link>;
                })}
              </div>
            </div>
          </section>
        )}

        <section className="lp-section lp-soft">
          <div className="lp-in">
            <div className="lp-head"><div><h2>{t.site.upcomingTitle}</h2><p>{t.site.upcomingSub}</p></div>
              <Link to="/explore?sort=soonest" className="lp-more">{t.site.seeAll}<ChevronRight size={18} aria-hidden /></Link></div>
            {upcoming && !upcoming.length && <p className="lp-empty">{t.site.upcomingEmpty}</p>}
            <div className="lp-cards">{(upcoming ?? []).map((c) => <CourseCard key={c.id} card={c} />)}</div>
          </div>
        </section>

        <section className="lp-section" id="como">
          <div className="lp-in">
            <h2 className="lp-center">{t.site.howTitle}</h2>
            <ol className="lp-how">
              {how.map(([Icon, title, text], i) => (
                <li key={title}><span className="lp-how-n">{i + 1}</span><Icon size={30} aria-hidden /><strong>{title}</strong><p>{text}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-teach" id="ensenar">
          <div className="lp-in lp-teach-in">
            <img src="/signup-teach.webp" alt="" width={520} height={604} loading="lazy" />
            <div>
              <h2>{t.site.teachTitle}</h2>
              <p>{t.site.teachText}</p>
              <ul>{[t.site.teach1, t.site.teach2, t.site.teach3, t.site.teach4].map((x) => <li key={x}><Check size={20} aria-hidden />{x}</li>)}</ul>
              <Link to="/signup?intent=teach" className="lp-btn lp-btn-orange">{t.site.teachCta}<ChevronRight size={20} aria-hidden /></Link>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-in">
            <h2 className="lp-center">{t.site.safeTitle}</h2>
            <div className="lp-safe">
              {safe.map(([Icon, title, text]) => <article key={title}><Icon size={30} aria-hidden /><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="lp-section lp-soft">
          <div className="lp-in lp-faq">
            <h2 className="lp-center">{t.site.faqTitle}</h2>
            {faq.map(([qq, a], i) => <details key={qq} open={i === 0}><summary>{qq}</summary><p>{a}</p></details>)}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
