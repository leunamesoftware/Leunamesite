import {
  Briefcase, Camera, ChefHat, Dumbbell, Hammer, Heart, Languages, Laptop, LayoutGrid, Music, Palette, Scissors, Sparkles, Wrench, type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Category, LanguageCode } from '../../../shared/contracts';
import { api } from '../api';

const ICONS: Record<string, LucideIcon> = {
  'chef-hat': ChefHat, sparkles: Sparkles, music: Music, languages: Languages, laptop: Laptop, camera: Camera, scissors: Scissors,
  wrench: Wrench, hammer: Hammer, dumbbell: Dumbbell, briefcase: Briefcase, grid: LayoutGrid, palette: Palette, heart: Heart,
};
export const categoryIcon = (name: string) => ICONS[name] ?? LayoutGrid;

const cache = new Map<LanguageCode, Promise<Category[]>>();

export function useCategories(lang: LanguageCode) {
  const [list, setList] = useState<Category[]>([]);
  useEffect(() => {
    if (!cache.has(lang)) cache.set(lang, api.categories(lang).catch((e) => { cache.delete(lang); throw e; }));
    cache.get(lang)!.then(setList, () => setList([]));
  }, [lang]);
  return list;
}

/** Horizontal category chips, alternating orange and blue like the references. */
export function CategoryChips({ categories, selected, onPick, allLabel }: {
  categories: Category[]; selected: string | null; onPick(id: string | null): void; allLabel?: string;
}) {
  return (
    <div className="chips" role="list">
      {allLabel && (
        <button type="button" role="listitem" className={`chip${selected === null ? ' chip-on' : ''}`} onClick={() => onPick(null)}>
          <LayoutGrid size={20} aria-hidden />{allLabel}
        </button>
      )}
      {categories.map((c, i) => {
        const Icon = categoryIcon(c.icon);
        return (
          <button key={c.id} type="button" role="listitem" aria-pressed={selected === c.id}
            className={`chip ${i % 2 ? 'chip-blue' : 'chip-orange'}${selected === c.id ? ' chip-on' : ''}`} onClick={() => onPick(c.id)}>
            <Icon size={20} aria-hidden />{c.name}
          </button>
        );
      })}
    </div>
  );
}
