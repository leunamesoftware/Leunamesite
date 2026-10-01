import { ApiError } from '../api';
import type { Dictionary } from '../i18n/pt';

/** Turns an API failure into a sentence in the user's language. */
export function errorText(t: Dictionary, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'generic';
  if (code === 'invalid_input') return t.errors.check_fields;
  return (t.errors as Record<string, string>)[code] ?? t.errors.generic;
}

/** Per-field messages from the API's field codes. */
export function fieldTexts(t: Dictionary, error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.fields) return {};
  const out: Record<string, string> = {};
  for (const [field, code] of Object.entries(error.fields)) {
    const key = field === 'password' && code === 'too_short' ? 'password_too_short' : code;
    out[field] = (t.fields as Record<string, string>)[key] ?? t.fields.invalid_option;
  }
  return out;
}
