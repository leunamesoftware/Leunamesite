import type { CourseCard } from '../../../shared/contracts';
import { api } from '../api';

/** Optimistic favorite toggle shared by every list of cards. */
export async function toggleFavorite(card: CourseCard, on: boolean, update: (fn: (cards: CourseCard[]) => CourseCard[]) => void) {
  const set = (value: boolean) => update((cards) => cards.map((c) => (c.id === card.id ? { ...c, favorite: value } : c)));
  set(on);
  try { await api.setFavorite(card.id, on); } catch { set(!on); }
}
