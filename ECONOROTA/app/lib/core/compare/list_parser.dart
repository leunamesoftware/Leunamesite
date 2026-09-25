import '../../data/models/compare.dart';
import 'compare_key.dart';

/// Lista inteligente (mesmas regras de api/src/lib/listParser.ts): interpreta "Manteiga Qualy",
/// "Óleo de soja — 2", "3x arroz 5kg" e encontra produto, marca, tamanho e quantidade.
/// Nunca troca a marca pedida: se ela não existir, brandFound = false.

const _stop = {
  'de',
  'da',
  'do',
  'das',
  'dos',
  'com',
  'sem',
  'e',
  'o',
  'a',
  'um',
  'uma',
  'tipo', //
  'pacote', 'pct', 'unidade', 'unidades', 'un', 'unid',
};
final _size = RegExp(r'(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|lt|litro|litros)\b');
final _qtyTrail = RegExp(r'(?:[-–—:x×*]\s*|\s)(\d{1,2})\s*(?:x|un|unid|unidades|pct|pacotes?)?\s*$');
final _qtyLead = RegExp(r'^(\d{1,2})\s*(?:x|un|unid|unidades|pct|pacotes?)?\s+(?=\D)');
final _bullet = RegExp(r'^[\s•\-–—*☐☑✓✔\d]+[.)]\s+');

List<String> _words(String s) =>
    foldText(s).split(RegExp(r'[^a-z0-9]+')).where((w) => w.isNotEmpty && !_stop.contains(w)).toList();
String _stem(String w) => w.replaceFirst(RegExp(r'(oes|aes|ais|eis|s)$'), '');
bool _same(String a, String b) => a == b || (a.length >= 4 && b.length >= 4 && _stem(a) == _stem(b));

String _normSize(String n, String u) =>
    '${n.replaceAll(',', '.').replaceFirst(RegExp(r'\.0+$'), '')}${u.startsWith('l') ? 'l' : u}';

({String text, int qty, String? size}) parseLine(String raw) {
  final folded = foldText(raw.replaceFirst(_bullet, ''));
  final sm = _size.firstMatch(folded);
  final size = sm == null ? null : _normSize(sm[1]!, sm[2]!);
  final noSize = sm == null ? folded : folded.replaceFirst(sm[0]!, ' ');
  final trail = _qtyTrail.firstMatch(noSize);
  final lead = trail == null ? _qtyLead.firstMatch(noSize) : null;
  final m = trail ?? lead;
  final qty = m == null ? 1 : int.parse(m[1]!);
  var text = m == null ? noSize : noSize.replaceRange(m.start, m.end, ' ');
  text = text.replaceFirst(RegExp(r'[-–—:]+\s*$'), '').trim();
  return (text: text, qty: qty.clamp(1, 99), size: size);
}

SmartLine resolveLine(String raw, List<CatalogItem> catalog) {
  final p = parseLine(raw);
  final tokens = _words(p.text);
  final allBrands = {for (final c in catalog) ...c.brands}.toList();
  final brands = allBrands.where((b) => _words(b).every((bw) => tokens.any((t) => _same(t, bw)))).toList()
    ..sort((a, b) => _words(b).length.compareTo(_words(a).length));
  final brand = brands.isEmpty ? null : brands.first;
  final brandWords = brand == null ? const <String>[] : _words(brand);
  final nameTokens = tokens.where((t) => !brandWords.any((bw) => _same(t, bw))).toList();

  final scored = <(CatalogItem, int)>[];
  for (final c in catalog) {
    final nw = _words(c.name);
    if (nw.isEmpty || !nameTokens.any((t) => _same(t, nw.first))) continue; // o 1º termo precisa aparecer
    final hits = nw.where((w) => nameTokens.any((t) => _same(t, w))).length;
    final score = hits * 10 - (nw.length - hits);
    if (score > 0) scored.add((c, score));
  }
  final best = scored.fold(0, (m, s) => s.$2 > m ? s.$2 : m);
  var options = [
    for (final s in scored)
      if (s.$2 == best) s.$1,
  ];
  if (p.size != null) {
    final sized = options.where((o) => o.unit.replaceAll(RegExp(r'\s+'), '').toLowerCase() == p.size).toList();
    if (sized.isNotEmpty) options = sized;
  }
  final withBrand = brand == null ? options : options.where((o) => o.brands.contains(brand)).toList();
  final brandFound = brand == null || withBrand.isNotEmpty;
  if (brand != null && withBrand.isNotEmpty) options = withBrand;
  options.sort(
    (a, b) => b.markets != a.markets ? b.markets.compareTo(a.markets) : a.minPriceCents.compareTo(b.minPriceCents),
  );
  return SmartLine(line: raw.trim(), qty: p.qty, brand: brand, brandFound: brandFound, size: p.size, options: options);
}

/// Uma linha por item (também aceita ";" e "," que não seja decimal). Máximo 60 itens.
List<String> splitList(String text) =>
    text.split(RegExp(r'\r?\n|;|,(?!\d)')).map((l) => l.trim()).where((l) => l.length >= 2).take(60).toList();
