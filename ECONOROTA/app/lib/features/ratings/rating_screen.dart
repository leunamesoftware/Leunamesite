import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/rating.dart';
import '../../data/models/user.dart';
import '../../data/repositories/ratings_repository.dart';
import '../../state/auth_controller.dart';
import '../../widgets/brand_header.dart';
import '../customer/widgets/common.dart';
import '../market/market_widgets.dart';

/// Cliente usa o cabeçalho da marca; mercado e entregador, o do painel.
Widget _page(BuildContext context, {required String title, String? subtitle, required List<Widget> children}) {
  final customer = context.read<AuthController>().user?.role == UserRole.customer;
  if (!customer) return PanelPage(title: title, subtitle: subtitle, showBack: true, maxWidth: 720, children: children);
  return BrandScaffold(
    showBack: true,
    title: title,
    subtitle: subtitle,
    slivers: [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        ),
      ),
    ],
  );
}

IconData _icon(RatingTargetType t) => switch (t) {
  RatingTargetType.mercado => Icons.storefront_rounded,
  RatingTargetType.entregador => Icons.delivery_dining_rounded,
  RatingTargetType.cliente => Icons.person_rounded,
};

class _Stars extends StatelessWidget {
  const _Stars({required this.value, this.onChanged, this.size = 36});

  final int value;
  final ValueChanged<int>? onChanged;
  final double size;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var i = 1; i <= 5; i++)
        onChanged == null
            ? Icon(i <= value ? Icons.star_rounded : Icons.star_outline_rounded, color: AppColors.star, size: size)
            : IconButton(
                tooltip: '$i ${i == 1 ? 'estrela' : 'estrelas'}',
                visualDensity: VisualDensity.compact,
                onPressed: () => onChanged!(i),
                icon: Icon(
                  i <= value ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: i <= value ? AppColors.star : AppColors.inkMuted,
                  size: size,
                ),
              ),
    ],
  );
}

/// Avaliar os participantes de um pedido entregue (todas as áreas).
class RatingScreen extends StatefulWidget {
  const RatingScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<RatingScreen> createState() => _RatingScreenState();
}

class _RatingScreenState extends State<RatingScreen> {
  RatingForm? _form;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final f = await context.read<RatingsRepository>().form(widget.orderId);
      if (mounted) {
        setState(() {
          _form = f;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  void _sent(RatingTarget t) => setState(
    () => _form = RatingForm(
      open: _form!.open,
      targets: [for (final x in _form!.targets) x.type == t.type && x.id == t.id ? x.asDone() : x],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final f = _form;
    final allDone = f != null && f.targets.every((t) => t.done);
    return _page(
      context,
      title: 'Avaliar pedido',
      subtitle: 'Pedido ${shortCode(widget.orderId)}',
      children: [
        if (_error != null && f == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (f == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (!f.open)
          const LightEmpty(
            icon: Icons.schedule_rounded,
            title: 'Avaliação indisponível',
            message: 'Você pode avaliar depois que o pedido for entregue, por até 7 dias.',
          )
        else ...[
          const Text(
            'Sua avaliação ajuda a manter a qualidade para todos. Leva menos de um minuto.',
            style: TextStyle(color: AppColors.inkMuted),
          ),
          const SizedBox(height: 12),
          for (final t in f.targets) ...[
            _TargetCard(key: ValueKey('${t.type.name}:${t.id}'), orderId: widget.orderId, target: t, onSent: _sent),
            const SizedBox(height: 12),
          ],
          if (allDone)
            FilledButton.icon(
              onPressed: () => context.canPop() ? context.pop() : context.go('/'),
              icon: const Icon(Icons.check_rounded),
              label: const Text('Concluir'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
            ),
        ],
      ],
    );
  }
}

class _TargetCard extends StatefulWidget {
  const _TargetCard({super.key, required this.orderId, required this.target, required this.onSent});

  final String orderId;
  final RatingTarget target;
  final ValueChanged<RatingTarget> onSent;

  @override
  State<_TargetCard> createState() => _TargetCardState();
}

class _TargetCardState extends State<_TargetCard> {
  var _stars = 0;
  final _tags = <String>{};
  final _comment = TextEditingController();
  var _busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final text = _comment.text.trim();
      await context.read<RatingsRepository>().send(
        widget.orderId,
        widget.target,
        _stars,
        tags: _tags.toList(),
        comment: text.isEmpty ? null : text,
      );
      widget.onSent(widget.target);
      messenger.showSnackBar(SnackBar(content: Text('Obrigado! ${widget.target.name} foi avaliado.')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.target;
    return PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primary.withValues(alpha: .1),
                child: Icon(_icon(t.type), color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t.name.isEmpty ? t.type.label : t.name,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                    ),
                    Text(t.type.label, style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5)),
                  ],
                ),
              ),
              if (t.done)
                const Pill('Avaliado', fg: AppColors.success, bg: AppColors.successSoft, icon: Icons.check_rounded),
            ],
          ),
          if (!t.done) ...[
            const SizedBox(height: 8),
            Center(
              child: _Stars(value: _stars, onChanged: _busy ? null : (v) => setState(() => _stars = v)),
            ),
            if (_stars > 0) ...[
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final tag in t.tags)
                    FilterChip(
                      label: Text(tag),
                      selected: _tags.contains(tag),
                      onSelected: (on) => setState(() => on ? _tags.add(tag) : _tags.remove(tag)),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _comment,
                maxLength: 500,
                maxLines: 3,
                minLines: 1,
                decoration: const InputDecoration(labelText: 'Comentário (opcional)'),
              ),
              FilledButton(
                onPressed: _busy ? null : _send,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                    : const Text('Enviar avaliação'),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

/// Avaliações que o usuário já fez.
class MyRatingsScreen extends StatelessWidget {
  const MyRatingsScreen({super.key});

  @override
  Widget build(BuildContext context) => FutureBuilder<List<MyRating>>(
    future: context.read<RatingsRepository>().mine(),
    builder: (context, snap) => _page(
      context,
      title: 'Minhas avaliações',
      subtitle: 'O que você avaliou depois das entregas',
      children: [
        if (snap.hasError)
          Text(friendlyError(snap.error!))
        else if (!snap.hasData)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (snap.data!.isEmpty)
          const LightEmpty(
            icon: Icons.star_outline_rounded,
            title: 'Nenhuma avaliação ainda',
            message: 'Depois de cada entrega você pode avaliar quem participou do pedido.',
          )
        else
          for (final r in snap.data!)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(_icon(r.type), color: AppColors.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${r.name} · ${r.type.label}',
                            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                          ),
                          const SizedBox(height: 2),
                          _Stars(value: r.stars, size: 18),
                          if (r.comment != null) ...[
                            const SizedBox(height: 4),
                            Text(r.comment!, style: const TextStyle(color: AppColors.ink)),
                          ],
                          const SizedBox(height: 2),
                          Text(
                            'Pedido ${shortCode(r.orderId)} · ${date(r.createdAt)}',
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
      ],
    ),
  );
}
