import { z } from 'zod';
import { LANGUAGES } from '../../../../shared/contracts.js';

const req = { required_error: 'required', invalid_type_error: 'required' };

export const emailSchema = z.string(req).trim().toLowerCase().min(1, 'required').email('invalid_email').max(200, 'too_long');
export const passwordSchema = z.string(req).min(8, 'too_short').max(200, 'too_long');
export const nameSchema = z.string(req).trim().min(2, 'too_short').max(80, 'too_long');
export const languageSchema = z.enum(LANGUAGES, { errorMap: () => ({ message: 'invalid_option' }) });
export const countrySchema = z.string(req).trim().toUpperCase().regex(/^[A-Z]{2}$/, 'invalid_option');
export const timezoneSchema = z.string().trim().max(64).refine((tz) => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}, 'invalid_option');

export const signupSchema = z.object({
  displayName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  countryCode: countrySchema,
  languageCode: languageSchema,
  timezone: timezoneSchema.optional(),
  intent: z.enum(['learn', 'teach'], { errorMap: () => ({ message: 'invalid_option' }) }),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'must_accept' }) }),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string(req).min(1, 'required') });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string(req).min(32, 'required').max(128), password: passwordSchema });
