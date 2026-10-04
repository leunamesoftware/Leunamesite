import type { AdminReport, Me, ReportStatus, SupportMessage, Ticket, TicketStatus } from '../../../../shared/contracts.js';
import type { Deps } from '../../common/env.js';
import { AppError, errors } from '../../common/errors.js';
import { newId } from '../../common/security.js';
import type { Param } from '../../infra/db/types.js';
import { auditStatement } from '../audit/audit.js';
import type { RequestMeta } from '../auth/service.js';

const TOPICS = ['account', 'payment', 'class', 'instructor', 'certificate', 'technical', 'other'];
const REASONS = ['spam', 'harassment', 'inappropriate', 'fraud', 'safety', 'other'];
const text = (v: unknown, min: number, max: number) => (typeof v === 'string' && v.trim().length >= min ? v.trim().slice(0, max) : null);

interface TicketRow { id: string; user_id: string; subject: string; topic: Ticket['topic']; status: TicketStatus; created_at: string; updated_at: string;
  name?: string; email?: string; last_at: string; count: number }

async function messages(deps: Deps, ticketId: string): Promise<SupportMessage[]> {
  return (await deps.db.all<{ id: string; body: string; is_staff: number; name: string; created_at: string }>(
    `SELECT m.id, m.body, m.is_staff, u.display_name AS name, m.created_at FROM support_messages m JOIN users u ON u.id = m.author_id
     WHERE m.ticket_id = ? ORDER BY m.created_at`, [ticketId]))
    // Staff replies are signed by the team, not by a person's name.
    .map((m) => ({ id: m.id, body: m.body, staff: !!m.is_staff, author: m.is_staff ? 'Hazluno' : m.name, at: m.created_at }));
}

const SELECT = `SELECT t.*, u.display_name AS name, u.email,
  (SELECT MAX(created_at) FROM support_messages m WHERE m.ticket_id = t.id) AS last_at,
  (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS count
  FROM support_tickets t JOIN users u ON u.id = t.user_id`;

const toTicket = (r: TicketRow, msgs: SupportMessage[], admin: boolean): Ticket => ({
  id: r.id, subject: r.subject, topic: r.topic, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
  ...(admin ? { user: { id: r.user_id, name: r.name!, email: r.email! } } : {}), messages: msgs, lastAt: r.last_at, count: r.count,
});

// ---------- people using the app ----------

export async function openTicket(deps: Deps, me: Me, input: unknown): Promise<Ticket> {
  const b = (input ?? {}) as Record<string, unknown>;
  const subject = text(b.subject, 3, 140);
  const body = text(b.message, 10, 4000);
  const fields: Record<string, string> = {};
  if (!TOPICS.includes(String(b.topic))) fields.topic = 'invalid_option';
  if (!subject) fields.subject = 'too_short';
  if (!body) fields.message = 'too_short';
  if (Object.keys(fields).length) throw errors.invalid(fields);
  const id = newId();
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    { sql: `INSERT INTO support_tickets (id, user_id, subject, topic, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?)`, params: [id, me.id, subject, String(b.topic), now, now] },
    { sql: `INSERT INTO support_messages (id, ticket_id, author_id, is_staff, body, created_at) VALUES (?, ?, ?, 0, ?, ?)`, params: [newId(), id, me.id, body, now] },
  ]);
  return myTicket(deps, me, id);
}

export async function myTickets(deps: Deps, me: Me): Promise<Ticket[]> {
  const rows = await deps.db.all<TicketRow>(`${SELECT} WHERE t.user_id = ? ORDER BY t.updated_at DESC`, [me.id]);
  return rows.map((r) => toTicket(r, [], false));
}

export async function myTicket(deps: Deps, me: Me, id: string): Promise<Ticket> {
  const r = await deps.db.one<TicketRow>(`${SELECT} WHERE t.id = ? AND t.user_id = ?`, [id, me.id]);
  if (!r) throw errors.notFound('Ticket');
  return toTicket(r, await messages(deps, id), false);
}

async function addMessage(deps: Deps, ticketId: string, authorId: string, staff: boolean, input: unknown, status: TicketStatus) {
  const body = text((input as { body?: unknown } | null)?.body, 1, 4000);
  if (!body) throw errors.invalid({ body: 'required' });
  const now = deps.clock.now().toISOString();
  await deps.db.batch([
    { sql: `INSERT INTO support_messages (id, ticket_id, author_id, is_staff, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`, params: [newId(), ticketId, authorId, staff ? 1 : 0, body, now] },
    { sql: `UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?`, params: [status, now, ticketId] },
  ]);
}

export async function replyAsUser(deps: Deps, me: Me, id: string, input: unknown): Promise<Ticket> {
  const t = await deps.db.one<{ status: string }>('SELECT status FROM support_tickets WHERE id = ? AND user_id = ?', [id, me.id]);
  if (!t) throw errors.notFound('Ticket');
  if (t.status === 'closed') throw new AppError('invalid_state', 409, 'This conversation is closed. Open a new one.');
  await addMessage(deps, id, me.id, false, input, 'open');
  return myTicket(deps, me, id);
}

/** Anyone signed in can report a course or a person; the team reviews it in the admin panel. */
export async function report(deps: Deps, me: Me, input: unknown, meta: RequestMeta) {
  const b = (input ?? {}) as Record<string, unknown>;
  const targetType = b.targetType === 'course' ? 'course' : b.targetType === 'user' ? 'user' : null;
  const targetId = typeof b.targetId === 'string' ? b.targetId : null;
  const fields: Record<string, string> = {};
  if (!targetType || !targetId) fields.targetId = 'required';
  if (!REASONS.includes(String(b.reason))) fields.reason = 'invalid_option';
  if (Object.keys(fields).length) throw errors.invalid(fields);
  const exists = targetType === 'course'
    ? await deps.db.one('SELECT 1 FROM courses WHERE id = ?', [targetId])
    : await deps.db.one(`SELECT 1 FROM users WHERE id = ? AND status != 'deleted'`, [targetId]);
  if (!exists || targetId === me.id) throw errors.notFound('Target');
  const id = newId();
  await deps.db.batch([
    { sql: `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      params: [id, me.id, targetType, targetId, String(b.reason), text(b.details, 1, 1000), deps.clock.now().toISOString()] },
    auditStatement(deps, { actorId: me.id, action: targetType === 'course' ? 'course.reported' : 'student.reported', targetType: targetType!, targetId: targetId!, ipHash: meta.ipHash, userAgent: meta.userAgent }),
  ]);
  return { id };
}

// ---------- team (admin panel, Tela 37) ----------

export async function adminTickets(deps: Deps, q: { status?: string }) {
  const params: Param[] = [];
  let where = '';
  if (q.status === 'waiting') where = `WHERE t.status = 'open'`;
  else if (q.status === 'answered') where = `WHERE t.status = 'pending'`;
  else if (q.status === 'done') where = `WHERE t.status IN ('resolved', 'closed')`;
  const rows = await deps.db.all<TicketRow>(`${SELECT} ${where} ORDER BY t.updated_at DESC LIMIT 100`, params);
  const n = async (sql: string) => (await deps.db.one<{ n: number }>(sql))!.n;
  return {
    items: rows.map((r) => toTicket(r, [], true)),
    counts: { waiting: await n(`SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'open'`), answered: await n(`SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'pending'`),
      done: await n(`SELECT COUNT(*) AS n FROM support_tickets WHERE status IN ('resolved', 'closed')`) },
  };
}

export async function adminTicket(deps: Deps, id: string): Promise<Ticket> {
  const r = await deps.db.one<TicketRow>(`${SELECT} WHERE t.id = ?`, [id]);
  if (!r) throw errors.notFound('Ticket');
  return toTicket(r, await messages(deps, id), true);
}

export async function replyAsStaff(deps: Deps, me: Me, id: string, input: unknown): Promise<Ticket> {
  if (!(await deps.db.one('SELECT 1 FROM support_tickets WHERE id = ?', [id]))) throw errors.notFound('Ticket');
  await addMessage(deps, id, me.id, true, input, 'pending');
  return adminTicket(deps, id);
}

export async function setTicketStatus(deps: Deps, id: string, input: unknown): Promise<Ticket> {
  const status = (input as { status?: unknown } | null)?.status;
  if (status !== 'resolved' && status !== 'closed' && status !== 'open') throw errors.invalid({ status: 'invalid_option' });
  const r = await deps.db.run('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?', [status, deps.clock.now().toISOString(), id]);
  if (!r.changes) throw errors.notFound('Ticket');
  return adminTicket(deps, id);
}

export async function adminReports(deps: Deps, q: { status?: string }) {
  const status = ['open', 'in_review', 'resolved', 'dismissed'].includes(String(q.status)) ? String(q.status) : null;
  const rows = await deps.db.all<{ id: string; reporter: string; target_type: AdminReport['targetType']; target_id: string; label: string | null; reason: AdminReport['reason'];
    details: string | null; status: ReportStatus; created_at: string }>(
    `SELECT r.id, u.display_name AS reporter, r.target_type, r.target_id,
            COALESCE((SELECT display_name FROM users WHERE id = r.target_id), (SELECT title FROM courses WHERE id = r.target_id)) AS label,
            r.reason, r.details, r.status, r.created_at
     FROM reports r JOIN users u ON u.id = r.reporter_id ${status ? 'WHERE r.status = ?' : ''} ORDER BY r.created_at DESC LIMIT 100`, status ? [status] : []);
  const counts = Object.fromEntries((await deps.db.all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM reports GROUP BY status')).map((r) => [r.status, r.n]));
  return {
    items: rows.map((r): AdminReport => ({ id: r.id, reporter: r.reporter, targetType: r.target_type, targetId: r.target_id, targetLabel: r.label, reason: r.reason,
      details: r.details, status: r.status, createdAt: r.created_at })),
    counts,
  };
}

export async function decideReport(deps: Deps, me: Me, id: string, input: unknown, meta: RequestMeta) {
  const status = (input as { status?: unknown } | null)?.status;
  if (status !== 'in_review' && status !== 'resolved' && status !== 'dismissed') throw errors.invalid({ status: 'invalid_option' });
  const now = deps.clock.now().toISOString();
  const done = status !== 'in_review';
  const r = await deps.db.run(`UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`, [status, done ? now : null, done ? me.id : null, id]);
  if (!r.changes) throw errors.notFound('Report');
  const s = auditStatement(deps, { actorId: me.id, action: `admin.report_${status}`, targetType: 'report', targetId: id, ipHash: meta.ipHash, userAgent: meta.userAgent });
  await deps.db.run(s.sql, s.params);
}
