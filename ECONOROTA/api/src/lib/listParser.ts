/**
 * Lista inteligente: interpreta linhas digitadas/coladas ("Manteiga Qualy", "Óleo de soja — 2", "3x arroz 5kg")
 * e encontra o produto genérico, a marca (se informada), o tamanho e a quantidade.
 * Nunca troca a marca pedida: se ela não existir, o resultado informa brandFound = false.
 */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export type CatalogType = { key: string; name: string; unit: string; brands: string[]; minPriceCents: number; markets: number; imageUrl: string | null };

export type Resolved = {
  line: string;
  qty: number;
  brand: string | null;
  brandFound: boolean;
  size: string | null;
  options: CatalogType[];
};

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'e', 'o', 'a', 'um', 'uma', 'tipo', 'pacote', 'pct', 'unidade', 'unidades', 'un', 'unid']);
const SIZE = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|lt|litro|litros)\b/;
const QTY_TRAIL = /(?:[-–—:x×*]\s*|\s)(\d{1,2})\s*(?:x|un|unid|unidades|pct|pacotes?)?\s*$/;
const QTY_LEAD = /^(\d{1,2})\s*(?:x|un|unid|unidades|pct|pacotes?)?\s+(?=\D)/;

const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
const stem = (w: string) => w.replace(/(oes|aes|ais|eis|s)$/, '');
const same = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && stem(a) === stem(b));

function normSize(n: string, u: string) {
  const unit = u.startsWith('l') ? 'l' : u;
  return `${n.replace(',', '.').replace(/\.0+$/, '')}${unit}`;
}

export function parseLine(raw: string): { text: string; qty: number; size: string | null } {
  let text = raw.replace(/^[\s•\-–—*☐☑✓✔\d]+[.)]\s+/, '').trim(); // marcadores e numeração "1." / "2)"
  let qty = 1;
  const sizeMatch = fold(text).match(SIZE);
  const size = sizeMatch ? normSize(sizeMatch[1], sizeMatch[2]) : null;
  const withoutSize = sizeMatch ? fold(text).replace(sizeMatch[0], ' ') : fold(text);
  const trail = withoutSize.match(QTY_TRAIL);
  const lead = withoutSize.match(QTY_LEAD);
  if (trail) qty = Number(trail[1]);
  else if (lead) qty = Number(lead[1]);
  text = withoutSize.replace(trail ? QTY_TRAIL : lead ? QTY_LEAD : /$^/, ' ').replace(/[-–—:]+\s*$/, '').trim();
  return { text, qty: Math.min(Math.max(qty || 1, 1), 99), size };
}

export function resolveLine(raw: string, catalog: CatalogType[]): Resolved {
  const { text, qty, size } = parseLine(raw);
  const tokens = words(text);
  const allBrands = [...new Set(catalog.flatMap((c) => c.brands))];
  const brand =
    allBrands
      .filter((b) => words(b).every((bw) => tokens.some((t) => same(t, bw))))
      .sort((a, b) => words(b).length - words(a).length)[0] ?? null;
  const brandWords = brand ? words(brand) : [];
  const nameTokens = tokens.filter((t) => !brandWords.some((bw) => same(t, bw)));

  const scored = catalog
    .map((c) => {
      const nw = words(c.name);
      const hits = nw.filter((w) => nameTokens.some((t) => same(t, w))).length;
      // O primeiro termo do produto ("açúcar", "manteiga") precisa aparecer.
      const main = nameTokens.some((t) => same(t, nw[0]));
      return { c, score: main ? hits * 10 - (nw.length - hits) : 0 };
    })
    .filter((s) => s.score > 0);
  const best = Math.max(0, ...scored.map((s) => s.score));
  let options = scored.filter((s) => s.score === best).map((s) => s.c);
  if (size) {
    const sized = options.filter((o) => o.unit.replace(/\s+/g, '').toLowerCase() === size);
    if (sized.length) options = sized;
  }
  const withBrand = brand ? options.filter((o) => o.brands.includes(brand)) : options;
  const brandFound = !brand || withBrand.length > 0;
  if (brand && withBrand.length) options = withBrand;
  options.sort((a, b) => b.markets - a.markets || a.minPriceCents - b.minPriceCents);
  return { line: raw.trim(), qty, brand, brandFound, size, options };
}

/** Separa a lista em linhas (também aceita itens separados por vírgula ou ponto e vírgula). */
export const splitList = (text: string) =>
  text
    .split(/\r?\n|;|,(?!\d)/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2)
    .slice(0, 60);
