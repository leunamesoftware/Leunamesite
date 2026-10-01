import type { ErrorCode } from '../../../shared/contracts.js';

/**
 * Expected failure (business rule, invalid input...). The app shows a translated text
 * chosen by `code`; `message` is the English fallback for logs and API clients.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 500 | 503,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const errors = {
  invalid: (fields: Record<string, string>) => new AppError('invalid_input', 400, 'Check the highlighted fields.', fields),
  unauthenticated: () => new AppError('unauthenticated', 401, 'Your session has expired. Sign in again.'),
  forbidden: () => new AppError('forbidden', 403, 'You do not have permission to do this.'),
  notFound: (what = 'Record') => new AppError('not_found', 404, `${what} not found.`),
};
