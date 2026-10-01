import type { ApiResponse, Category, LanguageCode, Me, PublicConfig, SessionCreated } from '../../shared/contracts';

const TOKEN_KEY = 'razluno.token';

export const tokenStore = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string | null) {
    try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
  },
};

/** Failure the screens can translate: an API error code, or "network". */
export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fields?: Record<string, string>) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('network', 0);
  }
  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(res.ok ? 'generic' : 'network', res.status);
  }
  if (!json.ok) throw new ApiError(json.error, res.status, json.fields);
  return json.data;
}

export const api = {
  config: () => request<PublicConfig>('GET', '/public/config'),
  categories: (lang: LanguageCode) => request<Category[]>('GET', `/public/categories?lang=${lang}`),
  signup: (body: {
    displayName: string; email: string; password: string; countryCode: string; languageCode: LanguageCode;
    timezone: string; intent: 'learn' | 'teach'; acceptTerms: boolean;
  }) => request<SessionCreated>('POST', '/auth/signup', body),
  login: (email: string, password: string) => request<SessionCreated>('POST', '/auth/login', { email, password }),
  logout: () => request<null>('POST', '/auth/logout'),
  me: () => request<Me>('GET', '/me'),
  updateMe: (body: Partial<Pick<Me, 'displayName' | 'countryCode' | 'languageCode' | 'timezone'>>) => request<Me>('PATCH', '/me', body),
};
