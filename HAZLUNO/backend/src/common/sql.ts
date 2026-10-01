import type { Param } from '../infra/db/types.js';

/** "?, ?, ?" for an IN (...) list. Callers never pass an empty list. */
export const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Text search with LIKE, escaping the user's % and _. */
export const likeParam = (q: string): Param => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export const parseJsonList = <T = string>(v: string | null): T[] => {
  try { const x = JSON.parse(v ?? '[]'); return Array.isArray(x) ? (x as T[]) : []; } catch { return []; }
};
