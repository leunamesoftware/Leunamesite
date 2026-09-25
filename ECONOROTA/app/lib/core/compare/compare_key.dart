const _accents = {
  'á': 'a',
  'à': 'a',
  'â': 'a',
  'ã': 'a',
  'ä': 'a',
  'é': 'e',
  'ê': 'e',
  'è': 'e',
  'ë': 'e',
  'í': 'i',
  'î': 'i',
  'ì': 'i',
  'ï': 'i',
  'ó': 'o',
  'ô': 'o',
  'õ': 'o',
  'ò': 'o',
  'ö': 'o',
  'ú': 'u',
  'û': 'u',
  'ù': 'u',
  'ü': 'u',
  'ç': 'c',
  'ñ': 'n',
};

/// Minúsculas e sem acento.
String foldText(String s) => s.toLowerCase().trim().split('').map((c) => _accents[c] ?? c).join();

/// Mesma regra da API: sem acento, minúsculas e unidade sem espaço ("Óleo de Soja", "900 ml" → "oleo de soja|900ml").
String compareKey(String name, String unit) => '${foldText(name)}|${foldText(unit).replaceAll(RegExp(r'\s+'), '')}';

/// Item "só desta marca": "manteiga|200g#qualy". A comparação nunca troca a marca.
String brandKey(String key, String brand) => '$key#${foldText(brand)}';
