import type { ClassSessionStatus } from './contracts.js';

/**
 * What a person can do with a class (turma), decided in one place for the app and the API.
 * Owner's rule: outsiders can only click to BUY a class that has not started and still has seats.
 * Once it starts (or fills up, or ends), nobody outside can click anything; only enrolled students enter.
 */
export type ClassBadge =
  | 'starts_on'      // "Inicia el ..." + seats left
  | 'full'           // no seats left
  | 'closed'         // enrollment deadline passed, not started yet
  | 'live'           // happening now
  | 'in_progress'    // started, between live meetings
  | 'finished'
  | 'canceled';

export type ClassAction =
  | 'buy'            // outsider, before start, seats left, before deadline
  | 'open'           // enrolled, before start: details, materials, schedule
  | 'enter'          // enrolled, class is live right now
  | 'recording'      // enrolled, after the end
  | 'none';

export interface ClassAccessInput {
  status: ClassSessionStatus;
  startsAt: string;
  endsAt: string;
  enrollmentDeadline: string;
  capacity: number;
  seatsTaken: number;
  viewerEnrolled: boolean;
  now: Date;
}

export interface ClassAccess {
  visible: boolean;
  badge: ClassBadge;
  action: ClassAction;
  /** Card/page reacts to taps only when there is an action. */
  clickable: boolean;
  seatsLeft: number;
}

export function classAccess(c: ClassAccessInput): ClassAccess {
  const now = c.now.getTime();
  const started = now >= Date.parse(c.startsAt) || c.status === 'live';
  const ended = c.status === 'completed' || now >= Date.parse(c.endsAt);
  const seatsLeft = Math.max(0, c.capacity - c.seatsTaken);
  const result = (badge: ClassBadge, action: ClassAction): ClassAccess =>
    ({ visible: c.status !== 'draft', badge, action, clickable: action !== 'none', seatsLeft });

  if (c.status === 'draft') return { visible: false, badge: 'closed', action: 'none', clickable: false, seatsLeft };
  if (c.status === 'canceled') return result('canceled', 'none');

  if (c.viewerEnrolled) {
    if (ended) return result('finished', 'recording');
    if (c.status === 'live') return result('live', 'enter');
    if (started) return result('in_progress', 'open');
    return result('starts_on', 'open');
  }

  // Outsiders: only "buy", and only before the class starts.
  if (ended) return result('finished', 'none');
  if (c.status === 'live') return result('live', 'none');
  if (started) return result('in_progress', 'none');
  if (seatsLeft === 0 || c.status === 'full') return result('full', 'none');
  if (c.status !== 'enrollment_open' || now >= Date.parse(c.enrollmentDeadline)) return result('closed', 'none');
  return result('starts_on', 'buy');
}
