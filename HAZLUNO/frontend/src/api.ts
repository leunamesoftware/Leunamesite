import type {
  AgendaItem, ApiResponse, Category, ClassInput, ClassSummary, CourseCard, CourseDetail, CourseInput, ExploreQuery, ExploreResult,
  InstructorCourse, InstructorProfile, InstructorPublic, LanguageCode, Me, MyClass, PublicConfig, SessionCreated, SessionInfo,
} from '../../shared/contracts';

const TOKEN_KEY = 'hazluno.token';

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
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
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
  uploadAvatar: (file: File) => request<Me>('POST', '/me/avatar', formWith(file)),
  sessions: () => request<SessionInfo[]>('GET', '/me/sessions'),
  revokeSession: (id: string) => request<null>('DELETE', `/me/sessions/${id}`),
  becomeInstructor: () => request<Me>('POST', '/me/instructor'),
  favorites: () => request<CourseCard[]>('GET', '/me/favorites'),
  setFavorite: (courseId: string, on: boolean) => request<null>(on ? 'PUT' : 'DELETE', `/me/favorites/${courseId}`),
  myClasses: () => request<MyClass[]>('GET', '/me/classes'),

  explore: (q: ExploreQuery) => request<ExploreResult>('GET', `/public/explore?${new URLSearchParams(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== '' && v !== false).map(([k, v]) => [k, String(v)]))}`),
  course: (id: string) => request<CourseDetail>('GET', `/public/courses/${id}`),
  instructor: (id: string) => request<InstructorPublic>('GET', `/public/instructors/${id}`),

  teacher: {
    profile: () => request<InstructorProfile>('GET', '/instructor/profile'),
    saveProfile: (body: Omit<InstructorProfile, 'verificationStatus' | 'rejectionReason'>) => request<InstructorProfile>('PUT', '/instructor/profile', body),
    submit: () => request<InstructorProfile>('POST', '/instructor/profile/submit'),
    courses: () => request<InstructorCourse[]>('GET', '/instructor/courses'),
    course: (id: string) => request<InstructorCourse>('GET', `/instructor/courses/${id}`),
    createCourse: (body: CourseInput) => request<InstructorCourse>('POST', '/instructor/courses', body),
    updateCourse: (id: string, body: CourseInput) => request<InstructorCourse>('PUT', `/instructor/courses/${id}`, body),
    publishCourse: (id: string) => request<InstructorCourse>('POST', `/instructor/courses/${id}/publish`),
    archiveCourse: (id: string) => request<null>('POST', `/instructor/courses/${id}/archive`),
    uploadCover: (id: string, file: File) => request<InstructorCourse>('POST', `/instructor/courses/${id}/cover`, formWith(file)),
    createClass: (courseId: string, body: ClassInput) => request<ClassSummary>('POST', `/instructor/courses/${courseId}/classes`, body),
    updateClass: (id: string, body: ClassInput) => request<ClassSummary>('PUT', `/instructor/classes/${id}`, body),
    publishClass: (id: string) => request<ClassSummary>('POST', `/instructor/classes/${id}/publish`),
    cancelClass: (id: string, reason: string) => request<ClassSummary>('POST', `/instructor/classes/${id}/cancel`, { reason }),
    deleteClass: (id: string) => request<null>('DELETE', `/instructor/classes/${id}`),
    agenda: () => request<AgendaItem[]>('GET', '/instructor/agenda'),
  },
};

function formWith(file: File) {
  const f = new FormData();
  f.append('file', file);
  return f;
}
