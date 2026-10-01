import { z } from 'zod';
import { LANGUAGES } from '../../../../shared/contracts.js';
import { timezoneSchema } from '../auth/schemas.js';

const text = (min: number, max: number) => z.string({ required_error: 'required', invalid_type_error: 'required' }).trim().min(min, min > 1 ? 'too_short' : 'required').max(max, 'too_long');
const optText = (max: number) => z.string().trim().max(max, 'too_long').nullable().optional().transform((v) => (v ? v : null));
const list = (maxItems: number, maxLen: number) =>
  z.array(z.string().trim().min(1, 'required').max(maxLen, 'too_long')).max(maxItems, 'too_many').default([]);
const lang = z.enum(LANGUAGES, { errorMap: () => ({ message: 'invalid_option' }) });

export const instructorProfileSchema = z.object({
  headline: optText(120),
  bio: optText(2000),
  specialties: list(10, 60),
  teachingLanguages: z.array(lang).max(6, 'too_many').default([]),
  legalEntityType: z.enum(['individual', 'company'], { errorMap: () => ({ message: 'invalid_option' }) }).nullable().optional(),
  legalName: optText(160),
  taxId: optText(40),
  taxCountry: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'invalid_option').nullable().optional(),
  businessAddress: optText(300),
});

export const courseSchema = z.object({
  title: text(3, 120),
  summary: optText(240),
  description: optText(5000),
  categoryId: text(1, 40),
  languageCode: lang,
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all_levels'], { errorMap: () => ({ message: 'invalid_option' }) }),
  learningOutcomes: list(12, 160),
  requiredMaterials: list(20, 120),
  recommendedMaterials: list(20, 120),
  isHazardous: z.boolean().default(false),
  safetyNotice: optText(2000),
  certificateEnabled: z.boolean().default(true),
}).superRefine((c, ctx) => {
  if (c.isHazardous && !c.safetyNotice) ctx.addIssue({ code: 'custom', path: ['safetyNotice'], message: 'required' });
});

const iso = z.string({ required_error: 'required' }).datetime({ offset: true, message: 'invalid_option' })
  .transform((v) => new Date(v).toISOString());

export const classSchema = z.object({
  label: optText(40),
  timezone: timezoneSchema,
  capacity: z.number({ required_error: 'required', invalid_type_error: 'required' }).int('invalid_option').min(1, 'too_small'),
  priceCents: z.number({ required_error: 'required', invalid_type_error: 'required' }).int('invalid_option').min(0, 'too_small').max(500_000, 'too_large'),
  languageCode: lang.optional(),
  enrollmentDeadline: iso.optional(),
  meetings: z.array(z.object({ start: iso, end: iso })).min(1, 'required').max(60, 'too_many'),
});

export const rejectSchema = z.object({ reason: text(3, 500) });
