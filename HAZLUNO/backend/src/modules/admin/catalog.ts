import type { AdminClassRow, AdminCourseRow, AdminPage, Me } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { newId } from '../../common/security.js';
import type { Param } from '../../infra/db/types.js';
import { auditStatement } from '../audit/audit.js';
import type { RequestMeta } from '../auth/service.js';
import { publicUrl } from '../files/images.js';
import { refundWholeClass } from '../payments/service.js';

const PAGE = 25;
const pageOf = (p?: string) => Math.max(1, Number(p) || 1);

/** Tela 31: every course, by status, searched by title or teacher. */
export async function listCourses(deps: Deps, q: { status?: string; q?: string; page?: string }): Promise<AdminPage<AdminCourseRow>> {
  const where: string[] = ['1 = 1'];
  const params: Param[] = [];
  if (q.status && ['draft', 'published', 'archived'].includes(q.status)) { where.push('c.status = ?'); params.push(q.status); }
  const text = (q.q ?? '').trim().toLowerCase();
  if (text) { where.push('(lower(c.title) LIKE ? OR lower(u.display_name) LIKE ?)'); params.push(`%${text}%`, `%${text}%`); }
  const from = `FROM courses c JOIN users u ON u.id = c.instructor_id WHERE ${where.join(' AND ')}`;
  const total = (await deps.db.one<{ n: number }>(`SELECT COUNT(*) AS n ${from}`, params))!.n;
  const rows = await deps.db.all<{ id: string; title: string; cover_key: string | null; instructor_id: string; name: string; category_id: string;
    status: AdminCourseRow['status']; created_at: string; groups: number; open_groups: number; students: number }>(
    `SELECT c.id, c.title, c.cover_key, c.instructor_id, u.display_name AS name, c.category_id, c.status, c.created_at,
            (SELECT COUNT(*) FROM class_sessions cs WHERE cs.course_id = c.id) AS groups,
            (SELECT COUNT(*) FROM class_sessions cs WHERE cs.course_id = c.id AND cs.status = 'enrollment_open') AS open_groups,
            (SELECT COUNT(*) FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id WHERE cs.course_id = c.id AND e.status IN ('confirmed', 'completed')) AS students
     ${from} ORDER BY c.created_at DESC LIMIT ${PAGE} OFFSET ${(pageOf(q.page) - 1) * PAGE}`, params);
  const counts = Object.fromEntries((await deps.db.all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM courses GROUP BY status')).map((r) => [r.status, r.n]));
  return {
    items: rows.map((r) => ({ id: r.id, title: r.title, coverUrl: publicUrl(r.cover_key), teacherId: r.instructor_id, teacherName: r.name, categoryId: r.category_id,
      status: r.status, groups: r.groups, openGroups: r.open_groups, students: r.students, createdAt: r.created_at })),
    total, counts: { all: Object.values(counts).reduce((a, b) => a + b, 0), ...counts },
  };
}

/** Hide a course from the catalog (students already in a group keep their classes) or show it again. */
export async function setCourseVisible(deps: Deps, me: Me, courseId: string, visible: boolean, reason: string | null, meta: RequestMeta) {
  const c = await deps.db.one<{ status: string }>('SELECT status FROM courses WHERE id = ?', [courseId]);
  if (!c) throw errors.notFound('Course');
  if (visible ? c.status !== 'archived' : c.status !== 'published') throw new AppError('invalid_state', 409, 'This course is not in a state that allows this.');
  if (!visible && (!reason || reason.trim().length < 3)) throw errors.invalid({ reason: 'required' });
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    { sql: 'UPDATE courses SET status = ?, updated_at = ? WHERE id = ?', params: [visible ? 'published' : 'archived', now, courseId] },
    { sql: `INSERT INTO moderation_actions (id, moderator_id, target_type, target_id, action, reason, created_at) VALUES (?, ?, 'course', ?, ?, ?, ?)`,
      params: [newId(), me.id, courseId, visible ? 'approve_course' : 'hide', reason?.trim() || null, now] },
    auditStatement(deps, { actorId: me.id, action: visible ? 'admin.course_shown' : 'admin.course_hidden', targetType: 'course', targetId: courseId, ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
}

/** Tela 32: every group with dates, seats, price and opening fee. */
export async function listClasses(deps: Deps, q: { status?: string; q?: string; page?: string }): Promise<AdminPage<AdminClassRow>> {
  const now = deps.clock.now().toISOString();
  const where: string[] = ['1 = 1'];
  const params: Param[] = [];
  if (q.status === 'upcoming') { where.push(`cs.status IN ('enrollment_open', 'full', 'enrollment_closed', 'scheduled') AND cs.starts_at > ?`); params.push(now); }
  else if (q.status === 'running') { where.push(`cs.status != 'canceled' AND cs.starts_at <= ? AND cs.ends_at > ?`); params.push(now, now); }
  else if (q.status === 'finished') { where.push(`cs.status != 'canceled' AND cs.ends_at <= ?`); params.push(now); }
  else if (q.status === 'draft' || q.status === 'canceled') { where.push('cs.status = ?'); params.push(q.status); }
  const text = (q.q ?? '').trim().toLowerCase();
  if (text) { where.push('(lower(c.title) LIKE ? OR lower(u.display_name) LIKE ?)'); params.push(`%${text}%`, `%${text}%`); }
  const from = `FROM class_sessions cs JOIN courses c ON c.id = cs.course_id JOIN users u ON u.id = cs.instructor_id WHERE ${where.join(' AND ')}`;
  const total = (await deps.db.one<{ n: number }>(`SELECT COUNT(*) AS n ${from}`, params))!.n;
  const rows = await deps.db.all<{ id: string; course_id: string; title: string; name: string; label: string | null; starts_at: string; ends_at: string;
    status: AdminClassRow['status']; capacity: number; seats_taken: number; price_cents: number; currency: string; meetings: number; fee_paid: number }>(
    `SELECT cs.id, cs.course_id, c.title, u.display_name AS name, cs.label, cs.starts_at, cs.ends_at, cs.status, cs.capacity, cs.seats_taken,
            cs.price_cents, cs.currency,
            (SELECT COUNT(*) FROM live_sessions ls WHERE ls.class_session_id = cs.id AND ls.status != 'canceled') AS meetings,
            EXISTS (SELECT 1 FROM payments p WHERE p.id = cs.opening_fee_payment_id AND p.status = 'succeeded') AS fee_paid
     ${from} ORDER BY cs.starts_at DESC LIMIT ${PAGE} OFFSET ${(pageOf(q.page) - 1) * PAGE}`, params);
  const n = async (sql: string, p: Param[] = []) => (await deps.db.one<{ n: number }>(sql, p))!.n;
  return {
    items: rows.map((r) => ({ id: r.id, courseId: r.course_id, courseTitle: r.title, teacherName: r.name, label: r.label, startsAt: r.starts_at, endsAt: r.ends_at,
      meetings: r.meetings, status: r.status, capacity: r.capacity, seatsTaken: r.seats_taken, priceCents: r.price_cents, currency: r.currency, openingFeePaid: !!r.fee_paid })),
    total,
    counts: {
      all: await n('SELECT COUNT(*) AS n FROM class_sessions'),
      upcoming: await n(`SELECT COUNT(*) AS n FROM class_sessions WHERE status IN ('enrollment_open', 'full', 'enrollment_closed', 'scheduled') AND starts_at > ?`, [now]),
      running: await n(`SELECT COUNT(*) AS n FROM class_sessions WHERE status != 'canceled' AND starts_at <= ? AND ends_at > ?`, [now, now]),
      finished: await n(`SELECT COUNT(*) AS n FROM class_sessions WHERE status != 'canceled' AND ends_at <= ?`, [now]),
      canceled: await n(`SELECT COUNT(*) AS n FROM class_sessions WHERE status = 'canceled'`),
    },
  };
}

/** The platform cancels a group that has not started: every student gets the full price back. */
export async function cancelClassAsAdmin(deps: Deps, me: Me, classId: string, reason: string | null, meta: RequestMeta) {
  const k = await deps.db.one<{ status: string; starts_at: string }>('SELECT status, starts_at FROM class_sessions WHERE id = ?', [classId]);
  if (!k) throw errors.notFound('Class');
  const now = deps.clock.now().toISOString();
  if (['canceled', 'completed', 'live'].includes(k.status) || k.starts_at <= now) throw new AppError('invalid_state', 409, 'Only groups that have not started can be canceled.');
  if (!reason || reason.trim().length < 3) throw errors.invalid({ reason: 'required' });
  await refundWholeClass(deps, classId, 'platform_cancel', me.id);
  await deps.db.batch([
    { sql: `UPDATE class_sessions SET status = 'canceled', canceled_reason = ?, canceled_at = ?, updated_at = ? WHERE id = ?`, params: [reason.trim(), now, now, classId] },
    { sql: `UPDATE live_sessions SET status = 'canceled' WHERE class_session_id = ?`, params: [classId] },
    { sql: `INSERT INTO moderation_actions (id, moderator_id, target_type, target_id, action, reason, created_at) VALUES (?, ?, 'class_session', ?, 'remove', ?, ?)`,
      params: [newId(), me.id, classId, reason.trim(), now] },
    auditStatement(deps, { actorId: me.id, action: 'admin.class_canceled', targetType: 'class_session', targetId: classId, ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
}
