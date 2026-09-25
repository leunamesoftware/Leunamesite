/// Notificação da central do app (Fase 16).
class AppNotification {
  const AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    required this.createdAt,
    this.link,
    this.read = false,
  });

  final String id;
  final String kind;
  final String title;
  final String body;
  final String? link;
  final bool read;
  final DateTime createdAt;

  AppNotification asRead() =>
      AppNotification(id: id, kind: kind, title: title, body: body, createdAt: createdAt, link: link, read: true);

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
    id: j['id'] as String,
    kind: j['kind'] as String,
    title: j['title'] as String,
    body: j['body'] as String,
    link: j['link'] as String?,
    read: j['read_at'] != null,
    createdAt: DateTime.parse(j['created_at'] as String).toLocal(),
  );
}
