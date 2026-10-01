/** Iniciais do negócio para o logo automático (ex.: "Pinta Cell Pinturas" → "PC", "Silva" → "SI"). */
export function iniciais(nome: string): string {
  const limpas = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const fortes = limpas.filter((p) => p.length > 2 || /\d/.test(p)); // ignora "de", "da", "e"…
  const palavras = fortes.length ? fortes : limpas;
  if (!palavras.length) return 'F';
  if (palavras.length === 1) return palavras[0]!.slice(0, 2).toUpperCase();
  return (palavras[0]![0]! + palavras[1]![0]!).toUpperCase();
}
