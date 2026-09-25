/** Normaliza telefone brasileiro para E.164 (+55DDNNNNNNNNN). Retorna null se inválido. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith('55') || (d.length !== 12 && d.length !== 13)) return null;
  const ddd = Number(d.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  return `+${d}`;
}

export const maskPhone = (p: string) => `${p.slice(0, 5)} ***** ${p.slice(-4)}`;

export function maskEmail(e: string) {
  const [user, domain] = e.split('@');
  const visible = user.length <= 2 ? user[0] : user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}
