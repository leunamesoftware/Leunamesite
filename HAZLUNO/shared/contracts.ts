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
  | 'internal_error';

/** Field-level validation codes (translated by the app). */
export type FieldError =
  | 'required' | 'too_short' | 'too_long' | 'invalid_email' | 'invalid_option' | 'must_accept' | 'invalid_json';

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
  emailVerified: boolean;
  createdAt: string;
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
