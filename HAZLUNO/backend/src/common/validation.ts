import type { ZodType, ZodTypeDef } from 'zod';
import { errors } from './errors.js';

/**
 * Validates input; on failure answers with a per-field error code (e.g. "too_short").
 * Codes, not sentences, so the app shows them in the user's language.
 */
export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const field = issue.path.join('.') || 'general';
    if (!fields[field]) fields[field] = issue.message;
  }
  throw errors.invalid(fields);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw errors.invalid({ general: 'invalid_json' });
  }
}
