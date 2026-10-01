import { classAccess } from '../../../../shared/class-access.js';
import type {
  ClassSessionStatus, ClassSummary, CourseCard, InstructorMini, LanguageCode, Level, Meeting,
} from '../../../../shared/contracts.js';
import type { Db } from '../../infra/db/types.js';
import { placeholders } from '../../common/sql.js';
import { publicUrl } from '../files/images.js';

export interface ClassRow {
  id: string; course_id: string; instructor_id: string; label: string | null; description: string | null; timezone: string; starts_at: string; ends_at: string;
  capacity: number; seats_taken: number; price_cents: number; currency: string; language_code: LanguageCode;
  enrollment_deadline: string; status: ClassSessionStatus; enrolled: number | null;
}

interface MeetingRow { id: string; class_session_id: string; sequence: number; scheduled_start: string; scheduled_end: string; status: Meeting['status'] }

/** Classes of the given courses, each with its meetings and what THIS viewer may do with it. */
export async function loadClasses(db: Db, opts: { courseIds?: string[]; classIds?: string[]; viewerId: string | null; now: Date; includeDrafts?: boolean }): Promise<ClassSummary[]> {
  const ids = opts.courseIds ?? opts.classIds ?? [];
  if (!ids.length) return [];
  const column = opts.courseIds ? 'cs.course_id' : 'cs.id';
  const rows = await db.all<ClassRow>(
    `SELECT cs.*, (SELECT 1 FROM enrollments e WHERE e.class_session_id = cs.id AND e.student_id = ?
                   AND e.status IN ('confirmed', 'completed')) AS enrolled
     FROM class_sessions cs WHERE ${column} IN (${placeholders(ids.length)}) ${opts.includeDrafts ? '' : `AND cs.status != 'draft'`}
     ORDER BY cs.starts_at`, [opts.viewerId, ...ids]);
  if (!rows.length) return [];
  const meetings = await db.all<MeetingRow>(
    `SELECT id, class_session_id, sequence, scheduled_start, scheduled_end, status FROM live_sessions
     WHERE class_session_id IN (${placeholders(rows.length)}) ORDER BY sequence`, rows.map((r) => r.id));
  return rows.map((r) => toClassSummary(r, meetings.filter((m) => m.class_session_id === r.id), opts.now));
}

export function toClassSummary(r: ClassRow, meetings: MeetingRow[], now: Date): ClassSummary {
  return {
    id: r.id, courseId: r.course_id, label: r.label, description: r.description ?? null, timezone: r.timezone, startsAt: r.starts_at, endsAt: r.ends_at,
    enrollmentDeadline: r.enrollment_deadline, capacity: r.capacity, seatsLeft: Math.max(0, r.capacity - r.seats_taken),
    priceCents: r.price_cents, currency: r.currency, languageCode: r.language_code, status: r.status,
    meetings: meetings.map((m) => ({ id: m.id, sequence: m.sequence, start: m.scheduled_start, end: m.scheduled_end, status: m.status })),
    access: classAccess({
      status: r.status, startsAt: r.starts_at, endsAt: r.ends_at, enrollmentDeadline: r.enrollment_deadline,
      capacity: r.capacity, seatsTaken: r.seats_taken, viewerEnrolled: !!r.enrolled, now,
    }),
  };
}

interface CourseRow {
  id: string; title: string; summary: string | null; cover_key: string | null; category_id: string; language_code: LanguageCode;
  level: Level; instructor_id: string; instructor_name: string; instructor_avatar: string | null; instructor_country: string;
}

/** Ratings come only from real, published reviews. */
async function ratings(db: Db, column: 'course_id' | 'instructor_id', ids: string[]) {
  if (!ids.length) return new Map<string, { rating: number; count: number }>();
  const rows = await db.all<{ id: string; avg: number; n: number }>(
    `SELECT ${column} AS id, AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE status = 'published'
     AND ${column} IN (${placeholders(ids.length)}) GROUP BY ${column}`, ids);
  return new Map(rows.map((r) => [r.id, { rating: Math.round(r.avg * 10) / 10, count: Number(r.n) }]));
}

export async function instructorMinis(db: Db, rows: { id: string; name: string; avatar: string | null; country: string }[]): Promise<Map<string, InstructorMini>> {
  const r = await ratings(db, 'instructor_id', [...new Set(rows.map((x) => x.id))]);
  return new Map(rows.map((x) => [x.id, {
    id: x.id, name: x.name, avatarUrl: publicUrl(x.avatar), countryCode: x.country,
    rating: r.get(x.id)?.rating ?? null, reviewsCount: r.get(x.id)?.count ?? 0,
  }]));
}

/** Course cards in the given order, with next buyable class, "live now", ratings and the viewer's favorites. */
export async function loadCourseCards(db: Db, courseIds: string[], viewerId: string | null, now: Date): Promise<CourseCard[]> {
  if (!courseIds.length) return [];
  const rows = await db.all<CourseRow>(
    `SELECT c.id, c.title, c.summary, c.cover_key, c.category_id, c.language_code, c.level, c.instructor_id,
            u.display_name AS instructor_name, u.avatar_key AS instructor_avatar, u.country_code AS instructor_country
     FROM courses c JOIN users u ON u.id = c.instructor_id WHERE c.id IN (${placeholders(courseIds.length)})`, courseIds);
  const classes = await loadClasses(db, { courseIds, viewerId, now });
  const courseRatings = await ratings(db, 'course_id', courseIds);
  const minis = await instructorMinis(db, rows.map((r) => ({ id: r.instructor_id, name: r.instructor_name, avatar: r.instructor_avatar, country: r.instructor_country })));
  const favs = viewerId
    ? new Set((await db.all<{ course_id: string }>(`SELECT course_id FROM favorites WHERE user_id = ? AND course_id IN (${placeholders(courseIds.length)})`,
        [viewerId, ...courseIds])).map((f) => f.course_id))
    : new Set<string>();
  const byId = new Map(rows.map((r) => {
    const own = classes.filter((c) => c.courseId === r.id);
    const next = own.find((c) => c.access.action === 'buy') ?? null;
    const upcoming = own.filter((c) => !['finished', 'canceled'].includes(c.access.badge));
    const card: CourseCard = {
      id: r.id, title: r.title, summary: r.summary, coverUrl: publicUrl(r.cover_key), categoryId: r.category_id,
      languageCode: r.language_code, level: r.level, instructor: minis.get(r.instructor_id)!,
      rating: courseRatings.get(r.id)?.rating ?? null, reviewsCount: courseRatings.get(r.id)?.count ?? 0,
      liveNow: own.some((c) => c.access.badge === 'live'),
      nextClass: next && { id: next.id, startsAt: next.startsAt, seatsLeft: next.seatsLeft, priceCents: next.priceCents, currency: next.currency, meetings: next.meetings },
      minPriceCents: upcoming.length ? Math.min(...upcoming.map((c) => c.priceCents)) : null,
      favorite: favs.has(r.id),
    };
    return [r.id, card] as const;
  }));
  return courseIds.map((id) => byId.get(id)).filter((c): c is CourseCard => !!c);
}

/** SQL fragment: course is visible in the public catalog. */
export const PUBLIC_COURSE = `c.status = 'published' AND u.status = 'active' AND ip.verification_status = 'approved'`;
