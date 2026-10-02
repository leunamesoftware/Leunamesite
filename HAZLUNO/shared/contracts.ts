/**
 * Contract between the app (frontend) and the API (backend).
 * Both sides import this file, so the data shape is always the same.
 */

export const LANGUAGES = ['pt', 'en', 'es', 'fr', 'it', 'de'] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

export type Role = 'student' | 'instructor' | 'admin' | 'moderator';
export type SignupIntent = 'learn' | 'teach';
export type InstructorVerification = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';

export type ClassSessionStatus =
  | 'draft' | 'enrollment_open' | 'full' | 'enrollment_closed' | 'scheduled' | 'live' | 'completed' | 'canceled';

// ---------- API envelope ----------

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode; message: string; fields?: Record<string, string> };

export type ErrorCode =
  | 'invalid_input'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'email_taken'
  | 'invalid_credentials'
  | 'too_many_attempts'
  | 'wrong_password'
  | 'account_suspended'
  | 'email_unavailable'
  | 'invalid_token'
  | 'instructor_not_approved'
  | 'invalid_state'
  | 'schedule_conflict'
  | 'file_invalid'
  | 'file_too_large'
  | 'payments_unavailable'
  | 'class_full'
  | 'enrollment_closed'
  | 'already_enrolled'
  | 'opening_fee_required'
  | 'payout_account_required'
  | 'webhook_invalid'
  | 'internal_error';

/** Field-level validation codes (translated by the app). */
export type FieldError =
  | 'required' | 'too_short' | 'too_long' | 'invalid_email' | 'invalid_option' | 'must_accept' | 'invalid_json'
  | 'too_small' | 'too_large' | 'in_the_past' | 'overlap' | 'after_start' | 'end_before_start' | 'too_many' | 'contact_link';

// ---------- account ----------

export interface Me {
  id: string;
  email: string;
  displayName: string;
  countryCode: string;
  languageCode: LanguageCode;
  timezone: string;
  roles: Role[];
  instructor: { verificationStatus: InstructorVerification } | null;
  avatarUrl: string | null;
  /** Category ids the user likes (profile → areas of interest). */
  interests: string[];
  emailVerified: boolean;
  createdAt: string;
}

export interface MyStats {
  completedClasses: number;
  certificates: number;
  inProgress: number;
}

export interface SessionCreated {
  token: string;
  expiresAt: string;
  me: Me;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

// ---------- catalog / public config ----------

export interface PublicConfig {
  languages: { code: LanguageCode; nativeName: string }[];
  countries: { code: string; currency: string; defaultLanguage: LanguageCode }[];
  socialLogin: { google: boolean; apple: boolean };
  passwordRecovery: boolean;
  legal: { termsVersion: string; privacyVersion: string };
}

export interface Category {
  id: string;
  icon: string;
  name: string;
}

// ---------- courses & classes ----------

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
export type CourseStatus = 'draft' | 'pending_review' | 'published' | 'archived' | 'rejected';

export interface InstructorMini {
  id: string;
  name: string;
  avatarUrl: string | null;
  countryCode: string;
  rating: number | null;      // null = no reviews yet ("Nuevo")
  reviewsCount: number;
}

/** A meeting of a class (one live session). Times are UTC; the app shows them in the viewer's time zone. */
export interface Meeting {
  id: string;
  sequence: number;
  start: string;
  end: string;
  status: 'scheduled' | 'live' | 'ended' | 'canceled';
}

/** A class (turma) as seen by the current viewer; `access` already applies the owner's rule. */
export interface ClassSummary {
  id: string;
  courseId: string;
  label: string | null;
  description: string | null;
  timezone: string;
  startsAt: string;
  endsAt: string;
  enrollmentDeadline: string;
  capacity: number;
  seatsLeft: number;
  priceCents: number;
  currency: string;
  languageCode: LanguageCode;
  status: ClassSessionStatus;
  meetings: Meeting[];
  access: import('./class-access.js').ClassAccess;
}

export interface CourseCard {
  id: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  categoryId: string;
  languageCode: LanguageCode;
  level: Level;
  instructor: InstructorMini;
  rating: number | null;
  reviewsCount: number;
  liveNow: boolean;
  /** Next class an outsider can buy (null = nothing to buy right now). */
  nextClass: Pick<ClassSummary, 'id' | 'startsAt' | 'seatsLeft' | 'priceCents' | 'currency' | 'meetings'> | null;
  minPriceCents: number | null;
  favorite: boolean;
}

export interface CourseDetail extends CourseCard {
  description: string | null;
  learningOutcomes: string[];
  requiredMaterials: string[];
  recommendedMaterials: string[];
  isHazardous: boolean;
  safetyNotice: string | null;
  certificateEnabled: boolean;
  studentsCount: number;
  classes: ClassSummary[];
  instructorBio: string | null;
  instructorHeadline: string | null;
  instructorStudentsCount: number;
}

export interface ExploreQuery {
  q?: string;
  category?: string;
  language?: LanguageCode;
  level?: Level;
  country?: string;
  price?: 'free' | 'paid';
  liveNow?: boolean;
  from?: string;   // ISO date: classes starting on/after
  to?: string;     // ISO date: classes starting before
  sort?: 'relevance' | 'soonest' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  limit?: number;
  offset?: number;
}

export interface ExploreResult {
  total: number;
  items: CourseCard[];
}

export type Experience = 'lt1' | '1_3' | '3_5' | '5_10' | 'gt10';
export interface ProfileLink { kind: 'instagram' | 'youtube' | 'website'; url: string }

export interface InstructorPublic {
  id: string;
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  verified: true;
  countryCode: string;
  headline: string | null;
  bio: string | null;
  specialties: string[];
  teachingLanguages: LanguageCode[];
  experience: Experience | null;
  links: ProfileLink[];
  rating: number | null;
  reviewsCount: number;
  studentsCount: number;
  courses: CourseCard[];
}

// ---------- instructor area ----------

export interface InstructorProfile {
  verificationStatus: InstructorVerification;
  rejectionReason: string | null;
  coverUrl: string | null;
  /** Private: used only to verify and contact the teacher. */
  phone: string | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  specialties: string[];
  teachingLanguages: LanguageCode[];
  experience: Experience | null;
  links: ProfileLink[];
  legalEntityType: 'individual' | 'company' | null;
  legalName: string | null;
  taxId: string | null;
  taxCountry: string | null;
  businessAddress: string | null;
  /** When the teacher accepted the teacher agreement (null = not yet). */
  agreementAcceptedAt: string | null;
}

export interface InstructorCourse {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  coverUrl: string | null;
  categoryId: string;
  languageCode: LanguageCode;
  level: Level;
  learningOutcomes: string[];
  requiredMaterials: string[];
  recommendedMaterials: string[];
  isHazardous: boolean;
  safetyNotice: string | null;
  certificateEnabled: boolean;
  status: CourseStatus;
  classes: ClassSummary[];
  createdAt: string;
}

export interface CourseInput {
  title: string;
  summary?: string | null;
  description?: string | null;
  categoryId: string;
  languageCode: LanguageCode;
  level: Level;
  learningOutcomes?: string[];
  requiredMaterials?: string[];
  recommendedMaterials?: string[];
  isHazardous?: boolean;
  safetyNotice?: string | null;
  certificateEnabled?: boolean;
}

export interface ClassInput {
  label?: string | null;
  description?: string | null;
  timezone: string;
  capacity: number;
  priceCents: number;
  languageCode?: LanguageCode;
  /** Defaults to the start of the first meeting (enrollment closes when the class begins). */
  enrollmentDeadline?: string;
  meetings: { start: string; end: string }[];
}

/** "Mis clases": a class the student is enrolled in. */
export interface MyClass extends ClassSummary {
  enrollmentId: string;
  courseTitle: string;
  coverUrl: string | null;
  instructor: InstructorMini;
}

/** One line of the instructor's agenda. */
export interface AgendaItem {
  meetingId: string;
  classId: string;
  courseId: string;
  courseTitle: string;
  label: string | null;
  start: string;
  end: string;
  classStatus: ClassSessionStatus;
  seatsTaken: number;
  capacity: number;
}

export interface AdminInstructorRow {
  userId: string;
  name: string;
  email: string;
  countryCode: string;
  verificationStatus: InstructorVerification;
  legalEntityType: 'individual' | 'company' | null;
  legalName: string | null;
  taxId: string | null;
  taxCountry: string | null;
  businessAddress: string | null;
  headline: string | null;
  phone: string | null;
  city: string | null;
  submittedAt: string;
}

/** "Mis alumnos": one enrollment in one of the teacher's groups. No e-mail: contact stays inside the platform. */
export type StudentState = 'active' | 'pending' | 'completed' | 'inactive';
export interface MyStudent {
  enrollmentId: string;
  studentId: string;
  name: string;
  avatarUrl: string | null;
  languageCode: LanguageCode;
  courseId: string;
  courseTitle: string;
  classId: string;
  classLabel: string | null;
  classStartsAt: string;
  state: StudentState;
  enrolledAt: string;
  meetingsTotal: number;
  meetingsDone: number;
  meetingsAttended: number;
  lastMeetingAt: string | null;
  note: string | null;
}
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'fraud' | 'safety' | 'other';

/** Tela 29: admin dashboard. Only real numbers; money arrives with payments (Phase 3). */
export interface AdminDashboard {
  days: number;
  totals: { students: number; teachers: number; verifiedTeachers: number; courses: number; meetingsDone: number; pendingTeachers: number; openReports: number };
  /** New in the chosen period and in the period before it (for the "+N%" line). */
  growth: Record<'students' | 'teachers' | 'courses' | 'meetingsDone', { now: number; before: number }>;
  /** Accumulated totals per day over the period. */
  usersSeries: { date: string; students: number; teachers: number }[];
  popularCourses: { id: string; title: string; coverUrl: string | null; students: number }[];
  topTeachers: { id: string; name: string; avatarUrl: string | null; courses: number; students: number }[];
  activity: { action: string; at: string; actor: string | null; target: string | null }[];
  platform: { site: 'online'; email: 'online' | 'not_configured'; payments: 'later'; video: 'later'; certificates: 'later' };
}

// ---------- payments (Phase 3, Stripe Connect) ----------

/** Result of "Reservar plaza": free groups confirm at once; paid ones go to the provider's page. */
export interface EnrollmentStart {
  enrollmentId: string;
  status: 'confirmed' | 'pending_payment';
  /** Provider page where the student pays (never inside the app). */
  checkoutUrl: string | null;
  /** The seat is held until this moment while the student pays. */
  holdExpiresAt: string | null;
}

export interface EnrollmentInfo {
  id: string;
  classId: string;
  courseId: string;
  status: 'pending_payment' | 'confirmed' | 'completed' | 'canceled' | 'expired';
  holdExpiresAt: string | null;
  priceCents: number;
  currency: string;
  /** Can still withdraw (before the first meeting starts). */
  canWithdraw: boolean;
  /** What a withdrawal returns now (policy: 50% retained). */
  withdrawalRefundCents: number;
}

export interface PayoutStatus {
  /** false = no payment provider configured yet. */
  paymentsAvailable: boolean;
  connected: boolean;
  payoutsEnabled: boolean;
  openingFeeCents: number;
}

export type EarningKind = 'sale' | 'withdrawal' | 'refund' | 'opening_fee';
export interface EarningLine {
  at: string;
  kind: EarningKind;
  courseTitle: string;
  classLabel: string | null;
  /** First name + initial: enough for the teacher, no e-mail. */
  student: string | null;
  grossCents: number;
  /** Payment processor fee (paid by the teacher, shown openly). */
  feeCents: number;
  /** What the teacher receives (negative for the opening fee). */
  netCents: number;
  state: 'held' | 'transferred' | 'refunded' | 'paid';
}
export interface Earnings {
  paymentsAvailable: boolean;
  payoutsEnabled: boolean;
  currency: string;
  /** Net of finished groups already sent to the teacher's account. */
  transferredCents: number;
  /** Net waiting for the group to finish (or for the payout account). */
  heldCents: number;
  grossCents: number;
  feesCents: number;
  openingFeesCents: number;
  salesCount: number;
  lines: EarningLine[];
}

// ---------- admin: users (Tela 30) ----------
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  countryCode: string;
  roles: Role[];
  status: 'active' | 'suspended';
  createdAt: string;
  lastSeenAt: string | null;
  teacherStatus: InstructorProfile['verificationStatus'] | null;
  enrollments: number;
  courses: number;
}
export interface AdminUserList {
  items: AdminUserRow[];
  total: number;
  counts: { all: number; students: number; teachers: number; suspended: number };
}

// ---------- admin: courses & groups (Telas 31–32) ----------
export interface AdminCourseRow {
  id: string;
  title: string;
  coverUrl: string | null;
  teacherId: string;
  teacherName: string;
  categoryId: string;
  status: CourseStatus;
  groups: number;
  openGroups: number;
  students: number;
  createdAt: string;
}
export interface AdminClassRow {
  id: string;
  courseId: string;
  courseTitle: string;
  teacherName: string;
  label: string | null;
  startsAt: string;
  endsAt: string;
  meetings: number;
  status: ClassSessionStatus;
  capacity: number;
  seatsTaken: number;
  priceCents: number;
  currency: string;
  openingFeePaid: boolean;
}
export interface AdminPage<T> { items: T[]; total: number; counts: Record<string, number> }
