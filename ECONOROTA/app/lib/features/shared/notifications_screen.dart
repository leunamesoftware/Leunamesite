import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../data/models/app_notification.dart';
import '../../data/repositories/notifications_repository.dart';
import '../../state/notifications_controller.dart';
import '../customer/widgets/common.dart';
import '../market/market_widgets.dart';

/// Sino com o número de avisos não lidos.
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key, this.color = Colors.white});

  final Color color;

  @override
  Widget build(BuildContext context) {
    final n = context.watch<NotificationsController>().unread;
    return IconButton(
      tooltip: n == 0 ? 'Notificações' : 'Notificações, $n novas',
      onPressed: () => context.push('/notificacoes'),
      icon: Badge(
        isLabelVisible: n > 0,
        backgroundColor: AppColors.discount,
        label: Text(n > 9 ? '9+' : '$n', style: const TextStyle(fontWeight: FontWeight.w700)),
        child: Icon(Icons.notifications_none_rounded, color: color, size: 27),
      ),
    );
  }
}

IconData _icon(String kind) => switch (kind) {
  'pedido_pago' || 'novo_pedido' => Icons.receipt_long_rounded,
  'separacao' || 'pronto_retirada' => Icons.inventory_2_rounded,
  'entregador' || 'em_rota' || 'chegou' => Icons.delivery_dining_rounded,
  'entregue' => Icons.check_circle_rounded,
  'reembolso' || 'estorno' || 'repasse' => Icons.payments_rounded,
  'ocorrencia' => Icons.support_agent_rounded,
  'cancelado' => Icons.cancel_rounded,
  _ => Icons.notifications_rounded,
};

String _ago(DateTime d) {
  final m = DateTime.now().difference(d).inMinutes;
  if (m < 1) return 'agora';
  if (m < 60) return 'há $m min';
  if (m < 60 * 24) return 'há ${m ~/ 60} h';
  return 'há ${m ~/ (60 * 24)} d';
}

/// Central de notificações (todos os perfis).
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<NotificationsRepository>().list();
      if (!mounted) return;
      context.read<NotificationsController>().set(r.unread);
      setState(() {
        _items = r.items;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _readAll() async {
    await context.read<NotificationsRepository>().markRead();
    if (!mounted) return;
    context.read<NotificationsController>().set(0);
    setState(() => _items = [for (final n in _items!) n.asRead()]);
  }

  Future<void> _open(AppNotification n) async {
    if (!n.read) {
      context.read<NotificationsRepository>().markRead(ids: [n.id]).ignore();
      final c = context.read<NotificationsController>();
      c.set(c.unread > 0 ? c.unread - 1 : 0);
      setState(() => _items = [for (final x in _items!) x.id == n.id ? x.asRead() : x]);
    }
    if (n.link != null) context.push(n.link!);
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    final hasUnread = items?.any((n) => !n.read) ?? false;
    return PanelPage(
      title: 'Notificações',
      showBack: true,
      maxWidth: 720,
      onRefresh: _load,
      actions: [
        if (hasUnread)
          TextButton(
            onPressed: _readAll,
            child: const Text('Marcar todas como lidas', style: TextStyle(color: Colors.white)),
          ),
      ],
      children: [
        if (_error != null && items == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (items == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (items.isEmpty)
          const LightEmpty(
            icon: Icons.notifications_none_rounded,
            title: 'Nenhuma notificação',
            message: 'Avisos sobre pedidos, entregas e pagamentos aparecem aqui.',
          )
        else
          for (final n in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                onTap: () => _open(n),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      backgroundColor: AppColors.primary.withValues(alpha: n.read ? .06 : .14),
                      child: Icon(_icon(n.kind), color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            n.title,
                            style: TextStyle(
                              fontWeight: n.read ? FontWeight.w600 : FontWeight.w800,
                              color: AppColors.ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(n.body, style: const TextStyle(color: AppColors.inkMuted, fontSize: 13)),
                          const SizedBox(height: 4),
                          Text(_ago(n.createdAt), style: const TextStyle(color: AppColors.inkMuted, fontSize: 11.5)),
                        ],
                      ),
                    ),
                    if (!n.read)
                      Container(
                        width: 10,
                        height: 10,
                        margin: const EdgeInsets.only(top: 6, left: 6),
                        decoration: const BoxDecoration(color: AppColors.discount, shape: BoxShape.circle),
                      ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}
