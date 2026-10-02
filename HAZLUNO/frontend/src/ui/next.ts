/** Where to go after login/signup: a path inside the app given in ?next=, never another site. */
export function nextPath(params: URLSearchParams, fallback = '/home') {
  const next = params.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
