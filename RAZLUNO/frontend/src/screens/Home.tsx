import {
  Briefcase, Camera, ChefHat, Dumbbell, Hammer, Languages, Laptop, LayoutGrid, LogOut, Music, Scissors, Sparkles, Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Category } from '../../../shared/contracts';
import { api } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../state/session';
import { Banner, Wordmark } from '../ui/kit';

const ICONS: Record<string, LucideIcon> = {
  'chef-hat': ChefHat, sparkles: Sparkles, music: Music, languages: Languages, laptop: Laptop, camera: Camera,
  scissors: Scissors, wrench: Wrench, hammer: Hammer, dumbbell: Dumbbell, briefcase: Briefcase, grid: LayoutGrid,
};
const iconFor = (name: string) => ICONS[name] ?? LayoutGrid;

/** Tela 4 (início do aluno) — versão da Fase 1: saudação e categorias reais. Turmas entram na Fase 2. */
export function Home() {
  const { t, lang, fill } = useI18n();
  const { me, logout } = useSession();
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => { api.categories(lang).then(setCategories, () => setCategories([])); }, [lang]);
  if (!me) return null;
  const firstName = me.displayName.split(' ')[0] ?? me.displayName;

  return (
    <main className="home">
      <img className="home-art" src="/signup-learn.webp" alt="" width={409} height={532} />
      <header className="home-head">
        <div className="home-bar">
          <Wordmark size="sm" />
          <button type="button" className="icon-btn icon-btn-light" onClick={logout} aria-label={t.home.logout} title={t.home.logout}>
            <LogOut size={20} />
          </button>
        </div>
        <p className="home-hello">{fill(t.home.hello, { name: firstName })}</p>
        <h1 className="home-question">{t.home.questionPre}<em>{t.home.questionWord}</em>{t.home.questionPost}</h1>
      </header>
      <div className="home-body">
        {me.instructor?.verificationStatus === 'pending' && <Banner tone="info">{t.home.instructorPending}</Banner>}
        <h2 className="section-title">{t.home.categories}</h2>
        <ul className="categories">
          {(categories ?? []).map((c) => {
            const Icon = iconFor(c.icon);
            return <li key={c.id}><span className="category-icon"><Icon size={28} strokeWidth={2.2} aria-hidden /></span><span>{c.name}</span></li>;
          })}
        </ul>
        <section className="empty">
          <h2>{t.home.emptyTitle}</h2>
          <p>{t.home.emptyText}</p>
        </section>
      </div>
    </main>
  );
}
