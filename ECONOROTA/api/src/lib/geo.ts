/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Hora local de São Paulo no formato HH:MM. */
export function localTime(now = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

/** Hora local; em desenvolvimento pode ser fixada por DEV_CLOCK (ex.: "12:00") para testes previsíveis. */
export function clock(env: { DEV_MODE?: string; DEV_CLOCK?: string }) {
  return env.DEV_MODE === 'true' && /^\d{2}:\d{2}$/.test(env.DEV_CLOCK ?? '') ? env.DEV_CLOCK! : localTime();
}

/** Aberto agora? Suporta horários que passam da meia-noite (ex.: 18:00–02:00). */
export function isOpenNow(opensAt: string, closesAt: string, manualOpen: number, now = localTime()) {
  if (!manualOpen) return false;
  return opensAt <= closesAt ? now >= opensAt && now < closesAt : now >= opensAt || now < closesAt;
}
