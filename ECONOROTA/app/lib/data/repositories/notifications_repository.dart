import '../../services/api_client.dart';
import '../models/app_notification.dart';
import '../models/user.dart';

/// Central de notificações (Fase 16).
abstract interface class NotificationsRepository {
  Future<({List<AppNotification> items, int unread})> list();
  Future<int> unread();
  Future<void> markRead({List<String>? ids});
}

class ApiNotificationsRepository implements NotificationsRepository {
  ApiNotificationsRepository(this._api);

  final ApiClient _api;

  @override
  Future<({List<AppNotification> items, int unread})> list() async {
    final j = await _api.get('/me/notificacoes');
    return (
      items: [for (final n in (j['items'] as List).cast<Map<String, dynamic>>()) AppNotification.fromJson(n)],
      unread: (j['unread'] as num).toInt(),
    );
  }

  @override
  Future<int> unread() async => ((await _api.get('/me/notificacoes/nao-lidas'))['unread'] as num).toInt();

  @override
  Future<void> markRead({List<String>? ids}) => _api.post('/me/notificacoes/lidas', {'ids': ?ids});
}

/// Demonstração: avisos de exemplo de acordo com o perfil.
class MockNotificationsRepository implements NotificationsRepository {
  MockNotificationsRepository(this._role);

  final UserRole? Function() _role;
  final _read = <String>{};

  List<AppNotification> _items() {
    final now = DateTime.now();
    AppNotification n(String id, String kind, String title, String body, int minutes, [String? link]) =>
        AppNotification(
          id: id,
          kind: kind,
          title: title,
          body: body,
          link: link,
          createdAt: now.subtract(Duration(minutes: minutes)),
          read: _read.contains(id),
        );
    return switch (_role()) {
      UserRole.market => [
        n('m1', 'novo_pedido', 'Novo pedido pago', 'Aceite e comece a separar.', 3, '/mercado/pedidos'),
        n(
          'm2',
          'repasse',
          'Repasse de R\$ 4.123,00 enviado',
          'Pix enviado. Referência: E2E8812.',
          60 * 26,
          '/mercado/financeiro',
        ),
      ],
      UserRole.courier => [
        n(
          'c1',
          'pronto_retirada',
          'Pedido pronto para retirada',
          'SuperMais terminou a separação.',
          2,
          '/entregador/entrega',
        ),
        n(
          'c2',
          'cadastro',
          'Cadastro aprovado!',
          'Você já pode ficar disponível e receber entregas.',
          60 * 48,
          '/entregador/perfil',
        ),
      ],
      UserRole.admin => [
        n('a1', 'ocorrencia', 'Nova ocorrência', 'Um cliente relatou um problema no pedido.', 8, '/admin/ocorrencias'),
        n(
          'a2',
          'entregador_analise',
          'Novo cadastro de entregador',
          'Documentos enviados para análise.',
          40,
          '/admin/entregadores',
        ),
      ],
      _ => [
        n('u1', 'em_rota', 'Seu pedido saiu para entrega', 'Tenha o código de entrega em mãos.', 5, '/cliente/pedidos'),
        n(
          'u2',
          'reembolso',
          'Item em falta reembolsado',
          'SuperMais não tinha um item. Devolvemos R\$ 4,49 na hora.',
          25,
        ),
        n('u3', 'pedido_pago', 'Pagamento aprovado', 'Seu pedido foi confirmado.', 32, '/cliente/pedidos'),
      ],
    };
  }

  @override
  Future<({List<AppNotification> items, int unread})> list() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final items = _items();
    return (items: items, unread: items.where((n) => !n.read).length);
  }

  @override
  Future<int> unread() async => _items().where((n) => !n.read).length;

  @override
  Future<void> markRead({List<String>? ids}) async => _read.addAll(ids ?? [for (final n in _items()) n.id]);
}
