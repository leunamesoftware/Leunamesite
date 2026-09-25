import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'invalid_request') => new ApiError(400, code, message);
export const unauthorized = (message = 'Não autenticado.') => new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'Acesso negado.') => new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Não encontrado.') => new ApiError(404, 'not_found', message);
export const conflict = (message: string, code = 'conflict') => new ApiError(409, code, message);
