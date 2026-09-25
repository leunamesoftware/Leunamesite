import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../services/session_store.dart';

/// Produtos favoritos, só no aparelho (apagados ao sair da conta).
class FavoritesController extends ChangeNotifier {
  FavoritesController(this._store);

  static const _key = 'econorota.favorites';
  final SessionStore _store;
  Set<String> _ids = {};

  bool contains(String id) => _ids.contains(id);

  Future<void> load() async {
    try {
      final raw = await _store.read(_key);
      _ids = raw == null ? {} : (jsonDecode(raw) as List).cast<String>().toSet();
    } catch (_) {
      _ids = {};
    }
    notifyListeners();
  }

  Future<void> toggle(String id) async {
    _ids = {..._ids};
    _ids.contains(id) ? _ids.remove(id) : _ids.add(id);
    notifyListeners();
    await _store.write(_key, jsonEncode(_ids.toList()));
  }

  Future<void> clear() async {
    _ids = {};
    notifyListeners();
    await _store.delete(_key);
  }
}
