import 'package:flutter/foundation.dart';

import '../core/compare/compare_key.dart';
import '../data/models/catalog.dart';
import '../data/models/compare.dart';

/// Item da lista de compras: produto genérico (sem mercado). O mercado é escolhido pela comparação.
class ListEntry {
  const ListEntry({
    required this.key,
    required this.name,
    required this.unit,
    required this.categoryId,
    required this.refPriceCents,
    required this.qty,
    this.imageUrl,
    this.brand,
  });

  final String key;
  final String name;
  final String unit;
  final String categoryId;
  final String? imageUrl;

  /// Marca exigida pelo cliente (null = qualquer marca, a mais barata).
  final String? brand;

  /// Nome exibido: "Manteiga Qualy" quando a marca foi escolhida.
  String get label => brand == null ? name : '$name $brand';

  /// Menor preço conhecido quando o item foi adicionado (estimativa até comparar).
  final int refPriceCents;
  final int qty;

  ListEntry withQty(int q) => ListEntry(
    key: key,
    name: name,
    unit: unit,
    categoryId: categoryId,
    imageUrl: imageUrl,
    brand: brand,
    refPriceCents: refPriceCents,
    qty: q,
  );
}

/// Carrinho/lista de compras. Chave = produto genérico (nome + unidade normalizados).
class CartController extends ChangeNotifier {
  static const maxQty = 99;
  final Map<String, ListEntry> _items = {};

  List<ListEntry> get items => _items.values.toList();
  int get count => _items.values.fold(0, (s, i) => s + i.qty);
  int get estimatedCents => _items.values.fold(0, (s, i) => s + i.refPriceCents * i.qty);

  /// Lista no formato usado pela comparação: {chave: quantidade}.
  Map<String, int> get wants => {for (final e in _items.values) e.key: e.qty};

  int quantityOf(Product p) => _items[compareKey(p.name, p.unit)]?.qty ?? 0;
  int quantityOfKey(String key) => _items[key]?.qty ?? 0;

  void add(Product p, [int qty = 1]) => _upsert(
    ListEntry(
      key: compareKey(p.name, p.unit),
      name: p.name,
      unit: p.unit,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl,
      refPriceCents: p.finalPriceCents,
      qty: qty,
    ),
  );

  /// [brand] = só aquela marca (nunca é trocada na comparação).
  void addItem(CatalogItem c, [int qty = 1, String? brand]) => _upsert(
    ListEntry(
      key: brand == null ? c.key : brandKey(c.key, brand),
      brand: brand,
      name: c.name,
      unit: c.unit,
      categoryId: c.categoryId,
      imageUrl: c.imageUrl,
      refPriceCents: c.minPriceCents,
      qty: qty,
    ),
  );

  void _upsert(ListEntry e) {
    final cur = _items[e.key];
    final qty = ((cur?.qty ?? 0) + e.qty).clamp(1, maxQty);
    final price = cur == null || e.refPriceCents < cur.refPriceCents ? e.refPriceCents : cur.refPriceCents;
    _items[e.key] = ListEntry(
      key: e.key,
      name: e.name,
      unit: e.unit,
      categoryId: e.categoryId,
      imageUrl: e.imageUrl ?? cur?.imageUrl,
      brand: e.brand,
      refPriceCents: price,
      qty: qty,
    );
    notifyListeners();
  }

  void increment(String key) {
    final cur = _items[key];
    if (cur == null || cur.qty >= maxQty) return;
    _items[key] = cur.withQty(cur.qty + 1);
    notifyListeners();
  }

  void decrement(String key) {
    final cur = _items[key];
    if (cur == null) return;
    cur.qty <= 1 ? _items.remove(key) : _items[key] = cur.withQty(cur.qty - 1);
    notifyListeners();
  }

  /// Remove e devolve o item (para o "Desfazer").
  ListEntry? take(String key) {
    final e = _items.remove(key);
    if (e != null) notifyListeners();
    return e;
  }

  void restore(ListEntry e) {
    _items[e.key] = e;
    notifyListeners();
  }

  void removeKey(String key) {
    if (_items.remove(key) != null) notifyListeners();
  }

  void toggleItem(CatalogItem c) => _items.containsKey(c.key) ? removeKey(c.key) : addItem(c);

  void clear() {
    _items.clear();
    notifyListeners();
  }
}
