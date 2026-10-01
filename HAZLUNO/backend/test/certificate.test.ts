import { describe, expect, it } from 'vitest';
import { CERTIFICATE_ID_PATTERN, certificateEligibility, formatCertificateId, type EligibilityInput } from '../../shared/certificate.js';
import { setup } from './helpers.js';

const ok: EligibilityInput = { allMeetingsEnded: true, attendanceBp: 9000, minAttendanceBp: 8000, certificateEnabled: true,
  instructorApproved: true, requireInstructorApproval: true, enrollmentStatus: 'completed' };

describe('certificate rules (Hazluno issues, teacher answers for the training, student meets the criteria)', () => {
  it('issues a completion certificate when every criterion is met', () => {
    expect(certificateEligibility(ok)).toEqual({ eligible: true, kind: 'completion' });
  });
  it('never before the last meeting ends', () => {
    expect(certificateEligibility({ ...ok, allMeetingsEnded: false })).toEqual({ eligible: false, reason: 'not_finished' });
  });
  it('needs the minimum attendance of the course', () => {
    expect(certificateEligibility({ ...ok, attendanceBp: 7999 })).toEqual({ eligible: false, reason: 'low_attendance' });
  });
  it('waits for the teacher to approve when the platform requires it', () => {
    expect(certificateEligibility({ ...ok, instructorApproved: false })).toEqual({ eligible: false, reason: 'awaiting_instructor' });
    expect(certificateEligibility({ ...ok, instructorApproved: false, requireInstructorApproval: false }).eligible).toBe(true);
  });
  it('only for enrolled students of courses that offer a certificate', () => {
    expect(certificateEligibility({ ...ok, enrollmentStatus: 'other' })).toEqual({ eligible: false, reason: 'not_enrolled' });
    expect(certificateEligibility({ ...ok, certificateEnabled: false })).toEqual({ eligible: false, reason: 'no_certificate' });
  });
  it('human ID looks like HZ-2026-000123', () => {
    expect(formatCertificateId('HZ', 2026, 123)).toBe('HZ-2026-000123');
    expect(CERTIFICATE_ID_PATTERN.test('HZ-2026-000123')).toBe(true);
  });
  it('the database stores who answers for what', async () => {
    const t = await setup();
    const cols = (await t.deps.db.all<{ name: string }>(`SELECT name FROM pragma_table_info('certificates')`)).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['code', 'instructor_id', 'instructor_name', 'issuer_name', 'instructor_approved_at',
      'total_minutes', 'completed_on', 'kind', 'verify_key_hash']));
    expect(await t.deps.db.one(`SELECT 1 FROM sqlite_master WHERE name = 'certificate_sequences'`)).toBeTruthy();
  });
  it('reviews keep the 4 aspects of the owner screen, highlights and the teacher reply', async () => {
    const t = await setup();
    const cols = (await t.deps.db.all<{ name: string }>(`SELECT name FROM pragma_table_info('reviews')`)).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['rating', 'rating_content', 'rating_teaching', 'rating_organization', 'rating_punctuality',
      'highlights', 'comment', 'instructor_reply']));
  });
});
