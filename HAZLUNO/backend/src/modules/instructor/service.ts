import type { ClassSummary, InstructorCourse, InstructorProfile, Me, AgendaItem } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { newId } from '../../common/security.js';
import { parseJsonList } from '../../common/sql.js';
import { parse } from '../../common/validation.js';
import { auditStatement } from '../audit/audit.js';
import { authRepo } from '../auth/repository.js';
import type { RequestMeta } from '../auth/service.js';
import { loadClasses } from '../explore/queries.js';
import { publicUrl, storeImage } from '../files/images.js';
import { classSchema, courseSchema, instructorProfileSchema } from './schemas.js';

const MIN_MEETING_MIN = 15;
const MAX_MEETING_MIN = 8 * 60;

// ---------- profile & verification ----------

interface ProfileRow {
  cover_key: string | null; phone: string | null; city: string | null; experience: InstructorProfile['experience']; links: string;
  verification_status: InstructorProfile['verificationStatus']; rejection_reason: string | null; headline: string | null; bio: string | null;
  specialties: string; teaching_languages: string; legal_entity_type: 'individual' | 'company' | null; legal_name: string | null;
  tax_id: string | null; tax_country: string | null; business_address: string | null;
}

async function profileRow(deps: Deps, me: Me) {
  const p = await deps.db.one<ProfileRow>('SELECT * FROM instructor_profiles WHERE user_id = ?', [me.id]);
  if (!p) throw errors.forbidden();
  return p;
}

const toProfile = (p: ProfileRow): InstructorProfile => ({
  verificationStatus: p.verification_status, rejectionReason: p.rejection_reason, coverUrl: publicUrl(p.cover_key), phone: p.phone, city: p.city,
  experience: p.experience, links: parseJsonList(p.links), headline: p.headline, bio: p.bio,
  specialties: parseJsonList(p.specialties), teachingLanguages: parseJsonList(p.teaching_languages), legalEntityType: p.legal_entity_type,
  legalName: p.legal_name, taxId: p.tax_id, taxCountry: p.tax_country, businessAddress: p.business_address,
});

export const getProfile = async (deps: Deps, me: Me) => toProfile(await profileRow(deps, me));

/** Public fields are always editable. Legal identity is locked while under review and after approval (changes go through support). */
export async function saveProfile(deps: Deps, me: Me, input: unknown): Promise<InstructorProfile> {
  const d = parse(instructorProfileSchema, input);
  const p = await profileRow(deps, me);
  const locked = ['under_review', 'approved', 'suspended'].includes(p.verification_status);
  const legalChanged = (d.legalEntityType ?? null) !== p.legal_entity_type || d.legalName !== p.legal_name || d.taxId !== p.tax_id
    || (d.taxCountry ?? null) !== p.tax_country || d.businessAddress !== p.business_address;
  if (locked && legalChanged) throw new AppError('invalid_state', 409, 'Legal details cannot be changed while under review or after approval. Contact support.');
  await deps.db.run(
    `UPDATE instructor_profiles SET experience = ?, links = ?, phone = ?, city = ?, headline = ?, bio = ?, specialties = ?, teaching_languages = ?, legal_entity_type = ?, legal_name = ?,
       tax_id = ?, tax_country = ?, business_address = ?, updated_at = ? WHERE user_id = ?`,
    [d.experience ?? null, JSON.stringify(d.links), d.phone ?? null, d.city, d.headline, d.bio, JSON.stringify(d.specialties), JSON.stringify(d.teachingLanguages), d.legalEntityType ?? null, d.legalName, d.taxId,
      d.taxCountry ?? null, d.businessAddress, deps.clock.now().toISOString(), me.id]);
  return getProfile(deps, me);
}

/** Sends the profile for verification. Everything needed to issue real certificates and receive payouts must be filled in. */
export async function submitForReview(deps: Deps, me: Me, meta: RequestMeta): Promise<InstructorProfile> {
  const p = await profileRow(deps, me);
  if (!['pending', 'rejected'].includes(p.verification_status)) throw new AppError('invalid_state', 409, 'This profile is not waiting for submission.');
  const missing: Record<string, string> = {};
  for (const [field, value] of Object.entries({ phone: p.phone, city: p.city, headline: p.headline, bio: p.bio, legalEntityType: p.legal_entity_type, legalName: p.legal_name,
    taxId: p.tax_id, taxCountry: p.tax_country, businessAddress: p.business_address })) if (!value) missing[field] = 'required';
  if (!parseJsonList(p.teaching_languages).length) missing.teachingLanguages = 'required';
  if (Object.keys(missing).length) throw errors.invalid(missing);
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    { sql: `UPDATE instructor_profiles SET verification_status = 'under_review', rejection_reason = NULL, updated_at = ? WHERE user_id = ?`, params: [now, me.id] },
    auditStatement(deps, { actorId: me.id, action: 'instructor.submitted', ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  return getProfile(deps, me);
}

/** Wide cover image of the public teacher profile. */
export async function setProfileCover(deps: Deps, me: Me, request: Request): Promise<InstructorProfile> {
  const p = await profileRow(deps, me);
  const key = await storeImage(deps, request, 'covers');
  await deps.db.run('UPDATE instructor_profiles SET cover_key = ?, updated_at = ? WHERE user_id = ?', [key, deps.clock.now().toISOString(), me.id]);
  if (p.cover_key) await deps.storage.delete(p.cover_key);
  return getProfile(deps, me);
}

async function requireApproved(deps: Deps, me: Me) {
  const p = await profileRow(deps, me);
  if (p.verification_status !== 'approved') {
    throw new AppError('instructor_not_approved', 403, 'Your teacher profile must be approved before publishing.');
  }
}

// ---------- courses ----------

interface CourseRow {
  id: string; instructor_id: string; title: string; summary: string | null; description: string | null; cover_key: string | null;
  category_id: string; language_code: InstructorCourse['languageCode']; level: InstructorCourse['level']; learning_outcomes: string;
  required_materials: string; recommended_materials: string; is_hazardous: number; safety_notice: string | null;
  certificate_enabled: number; status: InstructorCourse['status']; created_at: string;
}

async function ownCourse(deps: Deps, me: Me, courseId: string) {
  const c = await deps.db.one<CourseRow>('SELECT * FROM courses WHERE id = ? AND instructor_id = ?', [courseId, me.id]);
  if (!c) throw errors.notFound('Course');
  return c;
}

async function toInstructorCourses(deps: Deps, me: Me, rows: CourseRow[]): Promise<InstructorCourse[]> {
  const classes = await loadClasses(deps.db, { courseIds: rows.map((r) => r.id), viewerId: me.id, now: deps.clock.now(), includeDrafts: true });
  return rows.map((c) => ({
    id: c.id, title: c.title, summary: c.summary, description: c.description, coverUrl: publicUrl(c.cover_key), categoryId: c.category_id,
    languageCode: c.language_code, level: c.level, learningOutcomes: parseJsonList(c.learning_outcomes),
    requiredMaterials: parseJsonList(c.required_materials), recommendedMaterials: parseJsonList(c.recommended_materials),
    isHazardous: !!c.is_hazardous, safetyNotice: c.safety_notice, certificateEnabled: !!c.certificate_enabled, status: c.status,
    classes: classes.filter((k) => k.courseId === c.id), createdAt: c.created_at,
  }));
}

export async function listCourses(deps: Deps, me: Me) {
  const rows = await deps.db.all<CourseRow>(`SELECT * FROM courses WHERE instructor_id = ? AND status != 'archived' ORDER BY created_at DESC`, [me.id]);
  return toInstructorCourses(deps, me, rows);
}

export async function getCourse(deps: Deps, me: Me, courseId: string) {
  return (await toInstructorCourses(deps, me, [await ownCourse(deps, me, courseId)]))[0]!;
}

async function checkCategory(deps: Deps, categoryId: string) {
  if (!(await deps.db.one('SELECT 1 FROM categories WHERE id = ? AND is_active = 1', [categoryId]))) throw errors.invalid({ categoryId: 'invalid_option' });
}

/** Instructors can prepare drafts while their verification is pending. */
export async function createCourse(deps: Deps, me: Me, input: unknown) {
  const d = parse(courseSchema, input);
  await checkCategory(deps, d.categoryId);
  const id = newId();
  const now = deps.clock.now().toISOString();
  await deps.db.run(
    `INSERT INTO courses (id, instructor_id, category_id, title, summary, description, language_code, level, learning_outcomes,
       required_materials, recommended_materials, is_hazardous, safety_notice, certificate_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, me.id, d.categoryId, d.title, d.summary, d.description, d.languageCode, d.level, JSON.stringify(d.learningOutcomes),
      JSON.stringify(d.requiredMaterials), JSON.stringify(d.recommendedMaterials), d.isHazardous ? 1 : 0, d.safetyNotice,
      d.certificateEnabled ? 1 : 0, now, now]);
  return getCourse(deps, me, id);
}

export async function updateCourse(deps: Deps, me: Me, courseId: string, input: unknown) {
  const c = await ownCourse(deps, me, courseId);
  if (c.status === 'archived') throw new AppError('invalid_state', 409, 'Archived courses cannot be edited.');
  const d = parse(courseSchema, input);
  await checkCategory(deps, d.categoryId);
  await deps.db.run(
    `UPDATE courses SET category_id = ?, title = ?, summary = ?, description = ?, language_code = ?, level = ?, learning_outcomes = ?,
       required_materials = ?, recommended_materials = ?, is_hazardous = ?, safety_notice = ?, certificate_enabled = ?, updated_at = ? WHERE id = ?`,
    [d.categoryId, d.title, d.summary, d.description, d.languageCode, d.level, JSON.stringify(d.learningOutcomes),
      JSON.stringify(d.requiredMaterials), JSON.stringify(d.recommendedMaterials), d.isHazardous ? 1 : 0, d.safetyNotice,
      d.certificateEnabled ? 1 : 0, deps.clock.now().toISOString(), courseId]);
  return getCourse(deps, me, courseId);
}

export async function publishCourse(deps: Deps, me: Me, courseId: string, meta: RequestMeta) {
  await requireApproved(deps, me);
  const c = await ownCourse(deps, me, courseId);
  if (c.status !== 'draft') throw new AppError('invalid_state', 409, 'Only drafts can be published.');
  const missing: Record<string, string> = {};
  if (!c.summary) missing.summary = 'required';
  if (!c.description) missing.description = 'required';
  if (Object.keys(missing).length) throw errors.invalid(missing);
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    { sql: `UPDATE courses SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`, params: [now, now, courseId] },
    auditStatement(deps, { actorId: me.id, action: 'course.published', targetType: 'course', targetId: courseId, ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  return getCourse(deps, me, courseId);
}

/** A course leaves the catalog only when no class is still to happen. */
export async function archiveCourse(deps: Deps, me: Me, courseId: string) {
  await ownCourse(deps, me, courseId);
  const active = await deps.db.one(`SELECT 1 FROM class_sessions WHERE course_id = ? AND status NOT IN ('draft', 'canceled', 'completed') AND ends_at > ?`,
    [courseId, deps.clock.now().toISOString()]);
  if (active) throw new AppError('invalid_state', 409, 'Cancel or finish the open classes before archiving.');
  await deps.db.run(`UPDATE courses SET status = 'archived', updated_at = ? WHERE id = ?`, [deps.clock.now().toISOString(), courseId]);
}

export async function setCourseCover(deps: Deps, me: Me, courseId: string, request: Request) {
  const c = await ownCourse(deps, me, courseId);
  const key = await storeImage(deps, request, 'covers');
  await deps.db.run('UPDATE courses SET cover_key = ?, updated_at = ? WHERE id = ?', [key, deps.clock.now().toISOString(), courseId]);
  if (c.cover_key) await deps.storage.delete(c.cover_key);
  return getCourse(deps, me, courseId);
}

// ---------- classes ----------

interface ClassValidated { label: string | null; description: string | null; timezone: string; capacity: number; priceCents: number; languageCode: string;
  enrollmentDeadline: string; meetings: { start: string; end: string }[] }

/** Checks a class: seats limit, meetings in the future, no overlaps (also against the teacher's other classes). */
async function validateClass(deps: Deps, me: Me, course: CourseRow, input: unknown, excludeClassId: string | null): Promise<ClassValidated> {
  const d = parse(classSchema, input);
  const fields: Record<string, string> = {};
  const max = await authRepo.setting(deps.db, 'class.max_capacity', 25);
  if (d.capacity > max) fields.capacity = 'too_large';
  const now = deps.clock.now().getTime();
  const meetings = [...d.meetings].sort((a, b) => a.start.localeCompare(b.start));
  meetings.forEach((m, i) => {
    const minutes = (Date.parse(m.end) - Date.parse(m.start)) / 60_000;
    if (minutes <= 0) fields[`meetings.${i}.end`] = 'end_before_start';
    else if (minutes < MIN_MEETING_MIN) fields[`meetings.${i}.end`] = 'too_small';
    else if (minutes > MAX_MEETING_MIN) fields[`meetings.${i}.end`] = 'too_large';
    if (Date.parse(m.start) <= now) fields[`meetings.${i}.start`] = 'in_the_past';
    if (i > 0 && m.start < meetings[i - 1]!.end) fields[`meetings.${i}.start`] = 'overlap';
  });
  const first = meetings[0]!;
  const deadline = d.enrollmentDeadline ?? first.start;
  if (deadline > first.start) fields.enrollmentDeadline = 'after_start';
  else if (Date.parse(deadline) <= now) fields.enrollmentDeadline = 'in_the_past';
  if (Object.keys(fields).length) throw errors.invalid(fields);

  // A teacher cannot be in two live classes at once.
  for (const m of meetings) {
    const clash = await deps.db.one(
      `SELECT 1 FROM live_sessions ls JOIN class_sessions cs ON cs.id = ls.class_session_id
       WHERE cs.instructor_id = ? AND cs.status != 'canceled' AND ls.status != 'canceled' AND cs.id != ?
         AND ls.scheduled_start < ? AND ls.scheduled_end > ?`, [me.id, excludeClassId ?? '', m.end, m.start]);
    if (clash) throw new AppError('schedule_conflict', 409, 'You already have a class at this time.', { meetings: 'overlap' });
  }
  return { label: d.label, description: d.description ?? null, timezone: d.timezone, capacity: d.capacity, priceCents: d.priceCents,
    languageCode: d.languageCode ?? course.language_code, enrollmentDeadline: deadline, meetings };
}

const meetingStatements = (classId: string, meetings: { start: string; end: string }[]) => meetings.map((m, i) => ({
  sql: 'INSERT INTO live_sessions (id, class_session_id, sequence, scheduled_start, scheduled_end) VALUES (?, ?, ?, ?, ?)',
  params: [newId(), classId, i + 1, m.start, m.end],
}));

async function ownClass(deps: Deps, me: Me, classId: string) {
  const k = await deps.db.one<{ id: string; course_id: string; status: string; starts_at: string; seats_taken: number }>(
    'SELECT id, course_id, status, starts_at, seats_taken FROM class_sessions WHERE id = ? AND instructor_id = ?', [classId, me.id]);
  if (!k) throw errors.notFound('Class');
  return k;
}

async function classOut(deps: Deps, me: Me, classId: string): Promise<ClassSummary> {
  return (await loadClasses(deps.db, { classIds: [classId], viewerId: me.id, now: deps.clock.now(), includeDrafts: true }))[0]!;
}

/** New class (turma) of a course: starts as a draft, invisible to students until published. */
export async function createClass(deps: Deps, me: Me, courseId: string, input: unknown) {
  const course = await ownCourse(deps, me, courseId);
  if (course.status === 'archived') throw new AppError('invalid_state', 409, 'Archived courses cannot get new classes.');
  const v = await validateClass(deps, me, course, input, null);
  const id = newId();
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    {
      sql: `INSERT INTO class_sessions (id, course_id, instructor_id, label, description, timezone, starts_at, ends_at, capacity, price_cents, currency,
              language_code, enrollment_deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, 'draft', ?, ?)`,
      params: [id, courseId, me.id, v.label, v.description, v.timezone, v.meetings[0]!.start, v.meetings.at(-1)!.end, v.capacity, v.priceCents,
        v.languageCode, v.enrollmentDeadline, now, now],
    },
    ...meetingStatements(id, v.meetings),
  ]);
  return classOut(deps, me, id);
}

/** Only drafts can be changed; a published class keeps the conditions students bought. */
export async function updateClass(deps: Deps, me: Me, classId: string, input: unknown) {
  const k = await ownClass(deps, me, classId);
  if (k.status !== 'draft') throw new AppError('invalid_state', 409, 'Only draft classes can be edited.');
  const course = await ownCourse(deps, me, k.course_id);
  const v = await validateClass(deps, me, course, input, classId);
  await deps.db.batch([
    { sql: 'DELETE FROM live_sessions WHERE class_session_id = ?', params: [classId] },
    {
      sql: `UPDATE class_sessions SET label = ?, description = ?, timezone = ?, starts_at = ?, ends_at = ?, capacity = ?, price_cents = ?, language_code = ?,
              enrollment_deadline = ?, updated_at = ? WHERE id = ?`,
      params: [v.label, v.description, v.timezone, v.meetings[0]!.start, v.meetings.at(-1)!.end, v.capacity, v.priceCents, v.languageCode,
        v.enrollmentDeadline, deps.clock.now().toISOString(), classId],
    },
    ...meetingStatements(classId, v.meetings),
  ]);
  return classOut(deps, me, classId);
}

/**
 * Opens enrollment. Requires an approved teacher, a published course and a future start.
 * Phase 3 adds: the €5 opening fee must be confirmed by the payment provider first.
 */
export async function publishClass(deps: Deps, me: Me, classId: string, meta: RequestMeta) {
  await requireApproved(deps, me);
  const k = await ownClass(deps, me, classId);
  if (k.status !== 'draft') throw new AppError('invalid_state', 409, 'Only draft classes can be published.');
  const course = await ownCourse(deps, me, k.course_id);
  if (course.status !== 'published') throw new AppError('invalid_state', 409, 'Publish the course first.');
  const deadline = (await deps.db.one<{ enrollment_deadline: string }>('SELECT enrollment_deadline FROM class_sessions WHERE id = ?', [classId]))!;
  const now = deps.clock.now().toISOString();
  if (deadline.enrollment_deadline <= now) throw new AppError('invalid_state', 409, 'The enrollment deadline has passed. Change the dates.');
  await deps.db.batch([
    { sql: `UPDATE class_sessions SET status = 'enrollment_open', enrollment_opens_at = ?, updated_at = ? WHERE id = ?`, params: [now, now, classId] },
    auditStatement(deps, { actorId: me.id, action: 'class.published', targetType: 'class_session', targetId: classId, ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  return classOut(deps, me, classId);
}

export async function cancelClass(deps: Deps, me: Me, classId: string, reason: string | null, meta: RequestMeta) {
  const k = await ownClass(deps, me, classId);
  if (['canceled', 'completed', 'live'].includes(k.status) || k.starts_at <= deps.clock.now().toISOString()) {
    throw new AppError('invalid_state', 409, 'Only classes that have not started can be canceled.');
  }
  // Refunds arrive with payments (Phase 3); until then a class with students cannot be canceled here.
  if (k.seats_taken > 0) throw new AppError('invalid_state', 409, 'This class has students. Contact support to cancel it with refunds.');
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    { sql: `UPDATE class_sessions SET status = 'canceled', canceled_reason = ?, canceled_at = ?, updated_at = ? WHERE id = ?`, params: [reason, now, now, classId] },
    { sql: `UPDATE live_sessions SET status = 'canceled' WHERE class_session_id = ?`, params: [classId] },
    auditStatement(deps, { actorId: me.id, action: 'class.canceled', targetType: 'class_session', targetId: classId, ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  return classOut(deps, me, classId);
}

export async function deleteDraftClass(deps: Deps, me: Me, classId: string) {
  const k = await ownClass(deps, me, classId);
  if (k.status !== 'draft') throw new AppError('invalid_state', 409, 'Only drafts can be deleted; cancel a published class instead.');
  await deps.db.batch([
    { sql: 'DELETE FROM live_sessions WHERE class_session_id = ?', params: [classId] },
    { sql: 'DELETE FROM class_sessions WHERE id = ?', params: [classId] },
  ]);
}

/** Tela 18: every meeting of the teacher's non-canceled classes in a period. */
export async function agenda(deps: Deps, me: Me, from: string | undefined, to: string | undefined): Promise<AgendaItem[]> {
  const start = from && !Number.isNaN(Date.parse(from)) ? new Date(from).toISOString() : deps.clock.now().toISOString();
  const end = to && !Number.isNaN(Date.parse(to)) ? new Date(to).toISOString() : new Date(Date.parse(start) + 60 * 86_400_000).toISOString();
  const rows = await deps.db.all<{ meeting_id: string; class_id: string; course_id: string; title: string; label: string | null; start: string;
    end: string; status: AgendaItem['classStatus']; seats_taken: number; capacity: number }>(
    `SELECT ls.id AS meeting_id, cs.id AS class_id, c.id AS course_id, c.title, cs.label, ls.scheduled_start AS start, ls.scheduled_end AS end,
            cs.status, cs.seats_taken, cs.capacity
     FROM live_sessions ls JOIN class_sessions cs ON cs.id = ls.class_session_id JOIN courses c ON c.id = cs.course_id
     WHERE cs.instructor_id = ? AND cs.status != 'canceled' AND ls.status != 'canceled' AND ls.scheduled_end > ? AND ls.scheduled_start < ?
     ORDER BY ls.scheduled_start`, [me.id, start, end]);
  return rows.map((r) => ({ meetingId: r.meeting_id, classId: r.class_id, courseId: r.course_id, courseTitle: r.title, label: r.label,
    start: r.start, end: r.end, classStatus: r.status, seatsTaken: r.seats_taken, capacity: r.capacity }));
}

