import type { AdminDashboard } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { publicUrl } from '../files/images.js';

/** What the admin sees in "Actividad reciente" (logins stay out: too noisy and personal). */
const ACTIVITY = ['auth.signup', 'instructor.submitted', 'admin.instructor_approved', 'admin.instructor_rejected', 'course.published',
  'class.published', 'class.canceled', 'student.reported'];

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Tela 29: every number comes from the database; nothing is estimated. */
export async function dashboard(deps: Deps, daysInput: number): Promise<AdminDashboard> {
  const days = [7, 30, 90].includes(daysInput) ? daysInput : 30;
  const now = deps.clock.now().getTime();
  const from = new Date(now - days * DAY).toISOString();
  const before = new Date(now - 2 * days * DAY).toISOString();
  const nowIso = new Date(now).toISOString();
  const db = deps.db;
  const count = async (sql: string, params: string[] = []) => (await db.one<{ n: number }>(sql, params))?.n ?? 0;

  const students = `SELECT COUNT(*) AS n FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student' WHERE u.status != 'deleted'`;
  const teachers = `SELECT COUNT(*) AS n FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'instructor' WHERE u.status != 'deleted'`;
  const courses = `SELECT COUNT(*) AS n FROM courses WHERE status = 'published'`;
  const meetings = `SELECT COUNT(*) AS n FROM live_sessions WHERE status = 'ended'`;
  const between = (base: string, col: string, a: string, b: string) => count(`${base} AND ${col} >= ? AND ${col} < ?`, [a, b]);
  const growthOf = async (base: string, col: string) => ({ now: await between(base, col, from, nowIso), before: await between(base, col, before, from) });

  const joined = await db.all<{ day: string; role: string; n: number }>(
    `SELECT substr(u.created_at, 1, 10) AS day, r.role, COUNT(*) AS n FROM users u JOIN user_roles r ON r.user_id = u.id
     WHERE r.role IN ('student', 'instructor') AND u.status != 'deleted' GROUP BY day, r.role`);
  const usersSeries: AdminDashboard['usersSeries'] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = isoDay(now - i * DAY);
    const upTo = (role: string) => joined.filter((j) => j.role === role && j.day <= date).reduce((a, j) => a + j.n, 0);
    usersSeries.push({ date, students: upTo('student'), teachers: upTo('instructor') });
  }

  const popular = await db.all<{ id: string; title: string; cover_key: string | null; students: number }>(
    `SELECT c.id, c.title, c.cover_key, COUNT(e.id) AS students FROM courses c
     JOIN class_sessions cs ON cs.course_id = c.id JOIN enrollments e ON e.class_session_id = cs.id AND e.status IN ('confirmed', 'completed')
     GROUP BY c.id ORDER BY students DESC, c.title LIMIT 5`);
  const top = await db.all<{ id: string; name: string; avatar_key: string | null; courses: number; students: number }>(
    `SELECT u.id, u.display_name AS name, u.avatar_key,
            (SELECT COUNT(*) FROM courses c WHERE c.instructor_id = u.id AND c.status = 'published') AS courses,
            (SELECT COUNT(*) FROM enrollments e JOIN class_sessions cs ON cs.id = e.class_session_id
               WHERE cs.instructor_id = u.id AND e.status IN ('confirmed', 'completed')) AS students
     FROM users u JOIN instructor_profiles ip ON ip.user_id = u.id AND ip.verification_status = 'approved'
     WHERE u.status != 'deleted' ORDER BY students DESC, courses DESC, u.display_name LIMIT 5`);
  const activity = await db.all<{ action: string; at: string; actor: string | null; target: string | null }>(
    `SELECT a.action, a.created_at AS at, au.display_name AS actor,
            COALESCE(tu.display_name, tc.title, (SELECT c2.title FROM class_sessions cs2 JOIN courses c2 ON c2.id = cs2.course_id WHERE cs2.id = a.target_id)) AS target
     FROM audit_logs a LEFT JOIN users au ON au.id = a.actor_id
     LEFT JOIN users tu ON a.target_type = 'user' AND tu.id = a.target_id
     LEFT JOIN courses tc ON a.target_type = 'course' AND tc.id = a.target_id
     WHERE a.action IN (${ACTIVITY.map(() => '?').join(', ')}) ORDER BY a.created_at DESC LIMIT 8`, ACTIVITY);

  return {
    days,
    totals: {
      students: await count(students), teachers: await count(teachers),
      verifiedTeachers: await count(`SELECT COUNT(*) AS n FROM instructor_profiles WHERE verification_status = 'approved'`),
      courses: await count(courses), meetingsDone: await count(meetings),
      pendingTeachers: await count(`SELECT COUNT(*) AS n FROM instructor_profiles WHERE verification_status = 'under_review'`),
      openReports: await count(`SELECT COUNT(*) AS n FROM reports WHERE status IN ('open', 'in_review')`),
    },
    growth: {
      students: await growthOf(students, 'u.created_at'), teachers: await growthOf(teachers, 'r.granted_at'),
      courses: await growthOf(courses, 'published_at'), meetingsDone: await growthOf(meetings, 'ended_at'),
    },
    usersSeries,
    popularCourses: popular.map((c) => ({ id: c.id, title: c.title, coverUrl: publicUrl(c.cover_key), students: c.students })),
    topTeachers: top.map((x) => ({ id: x.id, name: x.name, avatarUrl: publicUrl(x.avatar_key), courses: x.courses, students: x.students })),
    activity,
    platform: { site: 'online', email: deps.mailer ? 'online' : 'not_configured', payments: 'later', video: 'later', certificates: 'later' },
  };
}
