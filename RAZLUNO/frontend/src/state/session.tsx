import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Me, SessionCreated } from '../../../shared/contracts';
import { api, ApiError, tokenStore } from '../api';
import { useI18n } from '../i18n';

interface Session {
  me: Me | null;
  /** true while checking a token saved on the device. */
  restoring: boolean;
  start(created: SessionCreated): void;
  logout(): Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { setLang } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [restoring, setRestoring] = useState(() => !!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.me()
      .then((m) => { setMe(m); setLang(m.languageCode); })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) tokenStore.set(null); })
      .finally(() => setRestoring(false));
  }, [setLang]);

  const start = useCallback((created: SessionCreated) => {
    tokenStore.set(created.token);
    setMe(created.me);
    setLang(created.me.languageCode);
  }, [setLang]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* signing out locally is what matters */ }
    tokenStore.set(null);
    setMe(null);
  }, []);

  return <Ctx.Provider value={{ me, restoring, start, logout }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
