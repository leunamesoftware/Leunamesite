import { describe, expect, it } from 'vitest';
import { classAccess, type ClassAccessInput } from '../../shared/class-access.js';

// Class: Monday 5 Oct 09:00 → Sunday 11 Oct 11:00 (UTC); enrollment closes 08:00 on the first day.
const base: ClassAccessInput = {
  status: 'enrollment_open',
  startsAt: '2026-10-05T09:00:00.000Z',
  endsAt: '2026-10-11T11:00:00.000Z',
  enrollmentDeadline: '2026-10-05T08:00:00.000Z',
  capacity: 20,
  seatsTaken: 12,
  viewerEnrolled: false,
  now: new Date('2026-10-02T10:00:00Z'),
};
const at = (iso: string) => new Date(iso);

describe('who can do what with a class (owner rule)', () => {
  it('before the start, with seats: outsiders see "starts on" + seats left and can only buy', () => {
    expect(classAccess(base)).toEqual({ visible: true, badge: 'starts_on', action: 'buy', clickable: true, seatsLeft: 8 });
  });

  it('full class: outsiders cannot click anything', () => {
    const r = classAccess({ ...base, seatsTaken: 20, status: 'full' });
    expect([r.badge, r.action, r.clickable, r.seatsLeft]).toEqual(['full', 'none', false, 0]);
  });

  it('enrollment deadline passed: no more buying even with free seats', () => {
    const r = classAccess({ ...base, now: at('2026-10-05T08:30:00Z') });
    expect([r.badge, r.clickable]).toEqual(['closed', false]);
  });

  it('live now: outsiders cannot join, the enrolled student enters', () => {
    const live = { ...base, status: 'live' as const, now: at('2026-10-05T09:10:00Z') };
    expect(classAccess(live)).toMatchObject({ badge: 'live', action: 'none', clickable: false });
    expect(classAccess({ ...live, viewerEnrolled: true })).toMatchObject({ badge: 'live', action: 'enter', clickable: true });
  });

  it('started but between meetings: still closed to outsiders', () => {
    const r = classAccess({ ...base, status: 'scheduled', now: at('2026-10-07T20:00:00Z') });
    expect([r.badge, r.clickable]).toEqual(['in_progress', false]);
  });

  it('starting time beats a stale status: once it starts nobody new gets in', () => {
    const r = classAccess({ ...base, status: 'enrollment_open', now: at('2026-10-05T09:00:00Z') });
    expect([r.badge, r.action]).toEqual(['in_progress', 'none']);
  });

  it('finished: outsiders cannot click, enrolled students get the recording', () => {
    const done = { ...base, status: 'completed' as const, now: at('2026-10-12T10:00:00Z') };
    expect(classAccess(done)).toMatchObject({ badge: 'finished', action: 'none', clickable: false });
    expect(classAccess({ ...done, viewerEnrolled: true })).toMatchObject({ action: 'recording', clickable: true });
  });

  it('enrolled before the start can open the class (schedule, materials) but not buy again', () => {
    expect(classAccess({ ...base, viewerEnrolled: true })).toMatchObject({ badge: 'starts_on', action: 'open' });
  });

  it('canceled classes have no action; drafts are not shown at all', () => {
    expect(classAccess({ ...base, status: 'canceled' })).toMatchObject({ badge: 'canceled', clickable: false });
    expect(classAccess({ ...base, status: 'draft' }).visible).toBe(false);
  });
});
