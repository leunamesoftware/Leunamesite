import '../../services/api_client.dart';
import '../models/rating.dart';
import '../models/user.dart';

/// Avaliações entre cliente, mercado e entregador (Fase 12).
abstract interface class RatingsRepository {
  Future<RatingForm> form(String orderId);
  Future<void> send(String orderId, RatingTarget target, int stars, {List<String> tags, String? comment});
  Future<List<MyRating>> mine();
}

class ApiRatingsRepository implements RatingsRepository {
  ApiRatingsRepository(this._api);

  final ApiClient _api;

  @override
  Future<RatingForm> form(String orderId) async => RatingForm.fromJson(await _api.get('/avaliacoes/pedidos/$orderId'));

  @override
  Future<void> send(String orderId, RatingTarget target, int stars, {List<String> tags = const [], String? comment}) =>
      _api.post('/avaliacoes', {
        'pedido': orderId,
        'alvo_tipo': target.type.name,
        'alvo_id': target.id,
        'estrelas': stars,
        'tags': tags,
        'comentario': ?comment,
      });

  @override
  Future<List<MyRating>> mine() async {
    final j = await _api.get('/avaliacoes/minhas');
    return [for (final r in (j['items'] as List).cast<Map<String, dynamic>>()) MyRating.fromJson(r)];
  }
}

/// Demonstração: as mesmas regras (uma avaliação por participante e pedido).
class MockRatingsRepository implements RatingsRepository {
  MockRatingsRepository(this._role);

  final UserRole? Function() _role;
  final _done = <String>{};
  final _mine = <MyRating>[];

  static const _tags = {
    'customer>mercado': [
      'Produtos frescos',
      'Bem embalado',
      'Preço justo',
      'Faltou item',
      'Produto errado',
      'Embalagem ruim',
    ],
    'customer>entregador': ['Educado', 'Pontual', 'Cuidado com os produtos', 'Atrasou', 'Não seguiu as instruções'],
    'courier>cliente': ['Educado', 'Endereço fácil', 'Atendeu rápido', 'Demorou a atender', 'Endereço difícil'],
    'courier>mercado': [
      'Pedido pronto na hora',
      'Bem embalado',
      'Atendimento rápido',
      'Demora no balcão',
      'Pedido incompleto',
    ],
    'market>cliente': ['Educado', 'Pedido claro', 'Pagamento sem problemas'],
    'market>entregador': ['Pontual', 'Educado', 'Conferiu direitinho', 'Atrasou na retirada'],
  };

  Future<void> _wait() => Future<void>.delayed(const Duration(milliseconds: 250));

  List<RatingTarget> _targets(String orderId) {
    final role = _role() ?? UserRole.customer;
    final base = switch (role) {
      UserRole.courier => const [
        (RatingTargetType.cliente, 'u-cliente', 'Mariana'),
        (RatingTargetType.mercado, 'm1', 'SuperMais'),
      ],
      UserRole.market => const [
        (RatingTargetType.cliente, 'u-cliente', 'Mariana'),
        (RatingTargetType.entregador, 'c1', 'Carlos'),
      ],
      _ => const [(RatingTargetType.mercado, 'm1', 'SuperMais'), (RatingTargetType.entregador, 'c1', 'Carlos')],
    };
    return [
      for (final (type, id, name) in base)
        RatingTarget(
          type: type,
          id: id,
          name: name,
          done: _done.contains('$orderId:${type.name}:$id'),
          tags: _tags['${role.name}>${type.name}'] ?? const [],
        ),
    ];
  }

  @override
  Future<RatingForm> form(String orderId) async {
    await _wait();
    return RatingForm(open: true, targets: _targets(orderId));
  }

  @override
  Future<void> send(
    String orderId,
    RatingTarget target,
    int stars, {
    List<String> tags = const [],
    String? comment,
  }) async {
    await _wait();
    if (stars < 1 || stars > 5) throw const ApiException(400, 'validation', 'Escolha de 1 a 5 estrelas.');
    if (!_done.add('$orderId:${target.type.name}:${target.id}')) {
      throw const ApiException(409, 'duplicate', 'Você já fez esta avaliação.');
    }
    _mine.insert(
      0,
      MyRating(
        orderId: orderId,
        type: target.type,
        name: target.name,
        stars: stars,
        comment: comment,
        createdAt: DateTime.now(),
      ),
    );
  }

  @override
  Future<List<MyRating>> mine() async {
    await _wait();
    return List.of(_mine);
  }
}
