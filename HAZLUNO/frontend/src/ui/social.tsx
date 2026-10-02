import type { PublicConfig } from '../../../shared/contracts';
import { useI18n } from '../i18n';

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6a24 24 0 0 0 0 21.4l7.8-6z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
  </svg>
);
const AppleMark = () => (
  <svg width="18" height="20" viewBox="0 0 384 470" aria-hidden fill="currentColor">
    <path d="M318 249c-1-55 45-82 47-83-26-38-66-43-80-44-34-3-66 20-84 20-17 0-44-19-72-19-37 1-71 22-90 55-39 67-10 166 28 220 18 27 40 56 69 55 28-1 38-18 72-18s43 18 72 17c30 0 49-27 67-54 21-31 30-61 30-62-1 0-58-22-59-87zM263 85c15-19 26-44 23-70-22 1-49 15-65 33-14 16-27 42-23 67 25 2 50-12 65-30z" />
  </svg>
);

/** Google/Apple buttons. Rendered only when the server says the flow is really available. */
export function SocialButtons({ config, onPick }: { config: PublicConfig | null; onPick(provider: 'google' | 'apple'): void }) {
  const { t } = useI18n();
  if (!config?.socialLogin.google && !config?.socialLogin.apple) return null;
  return (
    <div className="social">
      <div className="divider"><span>{t.common.or}</span></div>
      {config.socialLogin.google && (
        <button type="button" className="btn btn-google" onClick={() => onPick('google')}><GoogleMark />{t.login.google}</button>
      )}
      {config.socialLogin.apple && (
        <button type="button" className="btn btn-apple" onClick={() => onPick('apple')}><AppleMark />{t.login.apple}</button>
      )}
    </div>
  );
}
