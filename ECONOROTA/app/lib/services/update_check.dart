import '../core/config/env.dart';
import 'api_client.dart';

/// Compara versões "1.2.3".
int compareVersions(String a, String b) {
  final x = a.split('.').map((s) => int.tryParse(s) ?? 0).toList();
  final y = b.split('.').map((s) => int.tryParse(s) ?? 0).toList();
  for (var i = 0; i < 3; i++) {
    final d = (i < x.length ? x[i] : 0) - (i < y.length ? y[i] : 0);
    if (d != 0) return d.sign;
  }
  return 0;
}

/// Pergunta à API se esta versão ainda é aceita. Devolve o link da loja quando precisa atualizar.
Future<String?> requiredUpdate(ApiClient api) async {
  if (Env.useMock) return null;
  try {
    final j = await api.get('/app/versao');
    final min = j['min_version'] as String? ?? '0.0.0';
    return compareVersions(Env.appVersion, min) < 0 ? j['store_url'] as String? ?? '' : null;
  } catch (_) {
    return null; // sem conexão: não bloqueia
  }
}
