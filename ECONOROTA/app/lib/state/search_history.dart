import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../services/session_store.dart';

/// Buscas recentes, só no aparelho (apagadas ao sair da conta).
class SearchHistory extends ChangeNotifier {
  SearchHistory(this._store);

  static const _key = 'econorota.search.recent';
  static const _max = 8;
  final SessionStore _store;
  List<String> items = const [];

  Future<void> load() async {
    try {
      final raw = await _store.read(_key);
      items = raw == null ? const [] : (jsonDecode(raw) as List).cast<String>();
    } catch (_) {
      items = const [];
    }
    notifyListeners();
  }

  Future<void> add(String term) async {
    final t = term.trim().toLowerCase();
    if (t.length < 2) return;
    items = [t, ...items.where((i) => i != t)].take(_max).toList();
    notifyListeners();
    await _store.write(_key, jsonEncode(items));
  }

  Future<void> clear() async {
    items = const [];
    notifyListeners();
    await _store.delete(_key);
  }
}
