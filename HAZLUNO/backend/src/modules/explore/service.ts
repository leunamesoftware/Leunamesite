import { z } from 'zod';
import { LANGUAGES, type CourseDetail, type ExploreResult, type InstructorPublic } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { errors } from '../../common/errors.js';
import { likeParam, parseJsonList } from '../../common/sql.js';
import { parse } from '../../common/validation.js';
import type { Param } from '../../infra/db/types.js';
import { loadClasses, loadCourseCards, PUBLIC_COURSE } from './queries.js';

const bool = z.preprocess((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : v), z.boolean());
const exploreSchema = z.object({
  q: z.string().trim().max(80, 'too_long').optional(),
  category: z.string().trim().max(40).optional(),
  language: z.enum(LANGUAGES, { errorMap: () => ({ message: 'invalid_option' }) }).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all_levels'], { errorMap: () => ({ message: 'invalid_option' }) }).optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'invalid_option').optional(),
  price: z.enum(['free', 'paid'], { errorMap: () => ({ message: 'invalid_option' }) }).optional(),
  liveNow: bool.optional(),
  from: z.string().datetime({ message: 'invalid_option' }).optional(),
  to: z.string().datetime({ message: 'invalid_option' }).optional(),
  sort: z.enum(['relevance', 'soonest', 'price_asc', 'price_desc', 'rating', 'newest'], { errorMap: () => ({ message: 'invalid_option' }) }).default('relevance'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** Explore (Tela 5): published courses of approved instructors with at least one class still to happen or happening now. */
export async function explore(deps: Deps, query: Record<string, string>, viewerId: string | null): Promise<ExploreResult> {
  const f = parse(exploreSchema, Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '')));
  const now = deps.clock.now().toISOString();
  const where: string[] = [PUBLIC_COURSE];
  const params: Param[] = [];

  // Classes that still matter for this search (not draft/canceled/finished), optionally narrowed by date and price.
  const classConds = [`cs.course_id = c.id`, `cs.status NOT IN ('draft', 'canceled', 'completed')`, `cs.ends_at > ?`];
  const classParams: Param[] = [now];
  if (f.from) { classConds.push('cs.starts_at >= ?'); classParams.push(f.from); }
  if (f.to) { classConds.push('cs.starts_at < ?'); classParams.push(f.to); }
  if (f.price === 'free') classConds.push('cs.price_cents = 0');
  if (f.price === 'paid') classConds.push('cs.price_cents > 0');
  if (f.liveNow) classConds.push(`cs.status = 'live'`);
  where.push(`EXISTS (SELECT 1 FROM class_sessions cs WHERE ${classConds.join(' AND ')})`);
  params.push(...classParams);

  if (f.category) { where.push('c.category_id = ?'); params.push(f.category); }
  if (f.language) { where.push('c.language_code = ?'); params.push(f.language); }
  if (f.level) { where.push('c.level = ?'); params.push(f.level); }
  if (f.country) { where.push('u.country_code = ?'); params.push(f.country); }
  if (f.q) {
    const like = likeParam(f.q);
    where.push(`(c.title LIKE ? ESCAPE '\\' OR c.summary LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\'
      OR c.category_id IN (SELECT category_id FROM category_translations WHERE name LIKE ? ESCAPE '\\'))`);
    params.push(like, like, like, like);
  }

  const from = `FROM courses c JOIN users u ON u.id = c.instructor_id JOIN instructor_profiles ip ON ip.user_id = u.id WHERE ${where.join(' AND ')}`;
  const total = Number((await deps.db.one<{ n: number }>(`SELECT COUNT(*) AS n ${from}`, params))?.n ?? 0);

  const nextStart = `(SELECT MIN(cs.starts_at) FROM class_sessions cs WHERE cs.course_id = c.id AND cs.status = 'enrollment_open'
      AND cs.seats_taken < cs.capacity AND cs.enrollment_deadline > ? AND cs.starts_at > ?)`;
  const minPrice = `(SELECT MIN(cs.price_cents) FROM class_sessions cs WHERE cs.course_id = c.id AND cs.status NOT IN ('draft', 'canceled', 'completed') AND cs.ends_at > ?)`;
  const live = `EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.course_id = c.id AND cs.status = 'live')`;
  const rating = `(SELECT AVG(r.rating) FROM reviews r WHERE r.course_id = c.id AND r.status = 'published')`;
  const order: Record<typeof f.sort, string> = {
    relevance: 'live DESC, (next_start IS NULL), next_start, c.published_at DESC',
    soonest: '(next_start IS NULL), next_start',
    price_asc: '(min_price IS NULL), min_price, next_start',
    price_desc: '(min_price IS NULL), min_price DESC, next_start',
    rating: '(rating IS NULL), rating DESC, next_start',
    newest: 'c.published_at DESC',
  };
  const ids = (await deps.db.all<{ id: string }>(
    `SELECT c.id, ${nextStart} AS next_start, ${minPrice} AS min_price, ${live} AS live, ${rating} AS rating ${from}
     ORDER BY ${order[f.sort]}, c.id LIMIT ? OFFSET ?`,
    [now, now, now, ...params, f.limit, f.offset])).map((r) => r.id);

  return { total, items: await loadCourseCards(deps.db, ids, viewerId, deps.clock.now()) };
}

/** Course detail (Telas 7/8). Classes come with the viewer's access already decided. */
export async function courseDetail(deps: Deps, courseId: string, viewerId: string | null): Promise<CourseDetail> {
  const c = await deps.db.one<{
    id: string; description: string | null; learning_outcomes: string; required_materials: string; recommended_materials: string;
    is_hazardous: number; safety_notice: string | null; certificate_enabled: number; instructor_id: string; bio: string | null; headline: string | null;
  }>(`SELECT c.*, ip.bio, ip.headline FROM courses c JOIN users u ON u.id = c.instructor_id JOIN instructor_profiles ip ON ip.user_id = u.id
      WHERE c.id = ? AND ${PUBLIC_COURSE}`, [courseId]);
  if (!c) throw errors.notFound('Course');
  const now = deps.clock.now();
  const [card] = await loadCourseCards(deps.db, [courseId], viewerId, now);
  const classes = (await loadClasses(deps.db, { courseIds: [courseId], viewerId, now }))
    .filter((k) => k.access.visible && (k.access.badge !== 'finished' || k.access.action === 'recording'));
  const count = async (sql: string, p: Param[]) => Number((await deps.db.one<{ n: number }>(sql, p))?.n ?? 0);
  return {
    ...card!,
    description: c.description,
    learningOutcomes: parseJsonList(c.learning_outcomes),
    requiredMaterials: parseJsonList(c.required_materials),
    recommendedMaterials: parseJsonList(c.recommended_materials),
    isHazardous: !!c.is_hazardous,
    safetyNotice: c.safety_notice,
    certificateEnabled: !!c.certificate_enabled,
    studentsCount: await count(`SELECT COUNT(DISTINCT e.student_id) AS n FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id
      WHERE cs.course_id = ? AND e.status IN ('confirmed', 'completed')`, [courseId]),
    classes,
    instructorBio: c.bio,
    instructorHeadline: c.headline,
    instructorStudentsCount: await count(`SELECT COUNT(DISTINCT e.student_id) AS n FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id
      WHERE cs.instructor_id = ? AND e.status IN ('confirmed', 'completed')`, [c.instructor_id]),
  };
}

/** Public instructor profile (Tela 6). Only approved instructors are public. */
export async function instructorPublic(deps: Deps, instructorId: string, viewerId: string | null): Promise<InstructorPublic> {
  const p = await deps.db.one<{
    id: string; display_name: string; avatar_key: string | null; country_code: string; headline: string | null; bio: string | null;
    specialties: string; teaching_languages: string;
  }>(`SELECT u.id, u.display_name, u.avatar_key, u.country_code, ip.headline, ip.bio, ip.specialties, ip.teaching_languages
      FROM users u JOIN instructor_profiles ip ON ip.user_id = u.id WHERE u.id = ? AND u.status = 'active' AND ip.verification_status = 'approved'`,
    [instructorId]);
  if (!p) throw errors.notFound('Instructor');
  const now = deps.clock.now().toISOString();
  const courseIds = (await deps.db.all<{ id: string }>(
    `SELECT c.id FROM courses c WHERE c.instructor_id = ? AND c.status = 'published'
     AND EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.course_id = c.id AND cs.status NOT IN ('draft', 'canceled', 'completed') AND cs.ends_at > ?)
     ORDER BY c.published_at DESC`, [instructorId, now])).map((r) => r.id);
  const courses = await loadCourseCards(deps.db, courseIds, viewerId, deps.clock.now());
  const rating = await deps.db.one<{ avg: number | null; n: number }>(
    `SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE instructor_id = ? AND status = 'published'`, [instructorId]);
  const students = await deps.db.one<{ n: number }>(
    `SELECT COUNT(DISTINCT e.student_id) AS n FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id
     WHERE cs.instructor_id = ? AND e.status IN ('confirmed', 'completed')`, [instructorId]);
  return {
    id: p.id, name: p.display_name, avatarUrl: p.avatar_key ? `/api/files/${p.avatar_key}` : null, countryCode: p.country_code,
    headline: p.headline, bio: p.bio, specialties: parseJsonList(p.specialties), teachingLanguages: parseJsonList(p.teaching_languages),
    rating: rating?.avg != null ? Math.round(rating.avg * 10) / 10 : null, reviewsCount: Number(rating?.n ?? 0),
    studentsCount: Number(students?.n ?? 0), courses,
  };
}
