import 'dart:convert';

import '../../services/api_client.dart';

/// LGPD (Fase 17): exportar os próprios dados e excluir a conta.
abstract interface class PrivacyRepository {
  /// JSON formatado com os dados da conta.
  Future<String> export();
  Future<void> deleteAccount(String password);
}

class ApiPrivacyRepository implements PrivacyRepository {
  ApiPrivacyRepository(this._api);

  final ApiClient _api;

  @override
  Future<String> export() async => const JsonEncoder.withIndent('  ').convert(await _api.get('/me/dados'));

  @override
  Future<void> deleteAccount(String password) => _api.post('/me/conta/excluir', {'password': password});
}

class MockPrivacyRepository implements PrivacyRepository {
  @override
  Future<String> export() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return const JsonEncoder.withIndent('  ').convert({
      'gerado_em': DateTime.now().toIso8601String(),
      'conta': {'name': 'Maria Silva', 'email': 'demo@econorota.app', 'role': 'cliente'},
      'enderecos': [
        {'street': 'Rua das Flores', 'number': '123', 'city': 'São Paulo'},
      ],
      'pedidos': [
        {'id': 'o2', 'status': 'entregue', 'total_cents': 5890},
      ],
    });
  }

  @override
  Future<void> deleteAccount(String password) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (password.length < 8) throw const ApiException(400, 'wrong_password', 'Senha incorreta.');
  }
}
