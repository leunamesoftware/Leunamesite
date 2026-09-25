import 'package:flutter/foundation.dart';

import '../data/models/address.dart';
import '../services/api_client.dart';
import '../services/session_store.dart';

/// Endereço de entrega atual e recentes (salvos no aparelho; sincronizados com a conta quando logado).
class AddressController extends ChangeNotifier {
  AddressController(this._store, this._api);

  static const _currentKey = 'econorota.address.current';
  static const _recentKey = 'econorota.address.recent';
  static const _maxRecent = 3;

  final SessionStore _store;
  final ApiClient? _api;

  Address? current;
  List<Address> recent = const [];

  Future<void> load() async {
    try {
      final c = await _store.read(_currentKey);
      final r = await _store.read(_recentKey);
      current = c == null ? null : Address.decodeList('[$c]').first;
      recent = r == null ? const [] : Address.decodeList(r);
    } catch (_) {
      // Dado local corrompido não pode travar o app: começa limpo.
      current = null;
      recent = const [];
    }
    notifyListeners();
  }

  Future<void> select(Address a, {bool signedIn = false}) async {
    current = a;
    recent = [a, ...recent.where((r) => r.key != a.key)].take(_maxRecent).toList();
    notifyListeners();
    await _store.write(_currentKey, Address.encodeList([a]).replaceAll(RegExp(r'^\[|\]$'), ''));
    await _store.write(_recentKey, Address.encodeList(recent));
    if (signedIn) await syncToAccount();
  }

  /// Envia o endereço atual para a conta (falha silenciosa: fica salvo no aparelho e tenta de novo depois).
  Future<void> syncToAccount() async {
    final a = current;
    if (a == null || a.id != null || _api == null || _api.token == null) return;
    try {
      final j = await _api.post('/me/addresses', {...a.toJson(), 'is_default': true});
      current = Address.fromJson(j['address'] as Map<String, dynamic>);
      await _store.write(_currentKey, Address.encodeList([current!]).replaceAll(RegExp(r'^\[|\]$'), ''));
    } on ApiException {
      return;
    }
  }

  /// Ao sair da conta, os dados de endereço deixam o aparelho.
  Future<void> clear() async {
    current = null;
    recent = const [];
    await _store.delete(_currentKey);
    await _store.delete(_recentKey);
    notifyListeners();
  }
}
