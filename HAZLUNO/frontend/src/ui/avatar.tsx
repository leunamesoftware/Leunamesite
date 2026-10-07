import { initials } from './format';

export function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  return url
    ? <img className="avatar" src={url} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="avatar avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>{initials(name)}</span>;
}
