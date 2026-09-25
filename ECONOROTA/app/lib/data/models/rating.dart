/// Avaliações depois da entrega (Fase 12).
library;

enum RatingTargetType {
  mercado('Mercado'),
  entregador('Entregador'),
  cliente('Cliente');

  const RatingTargetType(this.label);
  final String label;
}

class RatingTarget {
  const RatingTarget({
    required this.type,
    required this.id,
    required this.name,
    this.done = false,
    this.tags = const [],
  });

  final RatingTargetType type;
  final String id;
  final String name;
  final bool done;

  /// Etiquetas rápidas permitidas para este tipo de avaliação.
  final List<String> tags;

  factory RatingTarget.fromJson(Map<String, dynamic> j) => RatingTarget(
    type: RatingTargetType.values.byName(j['type'] as String),
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    done: j['done'] as bool? ?? false,
    tags: (j['tags'] as List? ?? const []).cast<String>(),
  );

  RatingTarget asDone() => RatingTarget(type: type, id: id, name: name, done: true, tags: tags);
}

class RatingForm {
  const RatingForm({required this.open, required this.targets});

  /// false: pedido ainda não entregue ou prazo de 7 dias encerrado.
  final bool open;
  final List<RatingTarget> targets;

  factory RatingForm.fromJson(Map<String, dynamic> j) => RatingForm(
    open: j['open'] as bool? ?? false,
    targets: [for (final t in (j['targets'] as List).cast<Map<String, dynamic>>()) RatingTarget.fromJson(t)],
  );
}

class MyRating {
  const MyRating({
    required this.orderId,
    required this.type,
    required this.name,
    required this.stars,
    required this.createdAt,
    this.comment,
  });

  final String orderId;
  final RatingTargetType type;
  final String name;
  final int stars;
  final String? comment;
  final DateTime createdAt;

  factory MyRating.fromJson(Map<String, dynamic> j) => MyRating(
    orderId: j['order_id'] as String,
    type: RatingTargetType.values.byName(j['to_type'] as String),
    name: j['to_name'] as String? ?? '',
    stars: j['stars'] as int,
    comment: j['comment'] as String?,
    createdAt: DateTime.parse(j['created_at'] as String).toLocal(),
  );
}
