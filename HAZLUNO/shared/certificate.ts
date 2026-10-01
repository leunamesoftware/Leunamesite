/**
 * Certificate rules (who answers for what), shared by app and API.
 *  - Hazluno issues and registers it (unique ID, public verification).
 *  - The teacher is responsible for the training and approves the issue.
 *  - The student receives it only after meeting the class criteria.
 * It is a certificate of completion/participation, never presented as an official professional qualification.
 */
export type CertificateKind = 'completion' | 'participation';

export interface EligibilityInput {
  allMeetingsEnded: boolean;
  attendanceBp: number;          // 0..10000 (basis points)
  minAttendanceBp: number;       // set per course (default 8000 = 80%)
  certificateEnabled: boolean;   // course offers a certificate
  instructorApproved: boolean;   // teacher approved the issue
  requireInstructorApproval: boolean;
  enrollmentStatus: 'confirmed' | 'completed' | 'other';
}

export type EligibilityResult =
  | { eligible: true; kind: CertificateKind }
  | { eligible: false; reason: 'no_certificate' | 'not_enrolled' | 'not_finished' | 'low_attendance' | 'awaiting_instructor' };

export function certificateEligibility(i: EligibilityInput): EligibilityResult {
  if (!i.certificateEnabled) return { eligible: false, reason: 'no_certificate' };
  if (i.enrollmentStatus === 'other') return { eligible: false, reason: 'not_enrolled' };
  if (!i.allMeetingsEnded) return { eligible: false, reason: 'not_finished' };
  if (i.attendanceBp < i.minAttendanceBp) return { eligible: false, reason: 'low_attendance' };
  if (i.requireInstructorApproval && !i.instructorApproved) return { eligible: false, reason: 'awaiting_instructor' };
  return { eligible: true, kind: 'completion' };
}

/** Human ID printed on the certificate: HZ-2026-000123. */
export function formatCertificateId(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(6, '0')}`;
}

export const CERTIFICATE_ID_PATTERN = /^[A-Z]{2,4}-\d{4}-\d{6}$/;
