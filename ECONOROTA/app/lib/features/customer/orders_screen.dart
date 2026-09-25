import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../data/models/order.dart';
import '../../data/repositories/orders_repository.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_image.dart';
import '../../widgets/brand_header.dart';
import '../../widgets/category_icon.dart';
import '../../widgets/skeleton.dart';
import 'widgets/common.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  OrderFilter _filter = OrderFilter.all;
  List<OrderSummary>? _orders;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (context.read<AuthController>().user != null) _load();
  }

  Future<void> _load() async {
    setState(() {
      _orders = null;
      _error = null;
    });
    try {
      final list = await context.read<OrdersRepository>().history(_filter);
      if (mounted) setState(() => _orders = list);
    } catch (_) {
      if (mounted) setState(() => _error = 'Não foi possível carregar seus pedidos.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = context.select<AuthController, bool>((a) => a.user != null);
    return BrandScaffold(
      title: 'Meus pedidos',
      subtitle: 'Acompanhe seus pedidos e veja os detalhes.',
      onRefresh: signedIn ? _load : null,
      slivers: [
        if (!signedIn)
          SliverToBoxAdapter(
            child: LightEmpty(
              icon: Icons.receipt_long_rounded,
              title: 'Entre para ver seus pedidos',
              message: 'Acompanhe entregas em tempo real e consulte seu histórico.',
              action: FilledButton(
                onPressed: () => context.push('/entrar'),
                child: const Text('Entrar ou criar conta'),
              ),
            ),
          )
        else ...[
          SliverToBoxAdapter(
            child: ChoiceChips<OrderFilter>(
              values: OrderFilter.values,
              selected: _filter,
              label: (f) => f.label,
              onSelected: (f) {
                _filter = f;
                _load();
              },
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          if (_error != null)
            SliverToBoxAdapter(
              child: RetryBox(message: _error!, onRetry: _load),
            ),
          if (_orders == null && _error == null)
            SliverList.separated(
              itemCount: 3,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (_, _) => const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Skeleton(height: 150, radius: 18),
              ),
            )
          else if (_orders != null && _orders!.isEmpty)
            SliverToBoxAdapter(
              child: LightEmpty(
                icon: Icons.shopping_bag_outlined,
                title: _filter == OrderFilter.all ? 'Você ainda não fez pedidos' : 'Nenhum pedido aqui',
                message: 'Compare preços e faça sua primeira compra com economia.',
                action: FilledButton(onPressed: () => context.go('/cliente'), child: const Text('Começar a comprar')),
              ),
            )
          else if (_orders != null)
            SliverList.separated(
              itemCount: _orders!.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (_, i) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: OrderCard(
                  order: _orders![i],
                  onTap: () => context.push(
                    _orders![i].status == 'aguardando_pagamento'
                        ? '/cliente/pedido/${_orders![i].id}/pagamento'
                        : '/cliente/pedido/${_orders![i].id}/rastreio',
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, this.onTap});

  final OrderSummary order;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final o = order;
    final (fg, bg, icon) = switch (o.stage) {
      OrderStage.delivered => (AppColors.success, AppColors.successSoft, Icons.check_circle_rounded),
      OrderStage.cancelled => (AppColors.discount, AppColors.dangerSoft, Icons.cancel_rounded),
      OrderStage.active when o.status == 'aguardando_pagamento' => (
        const Color(0xFF92400E),
        const Color(0xFFFEF3C7),
        Icons.hourglass_top_rounded,
      ),
      OrderStage.active => (AppColors.info, AppColors.infoSoft, Icons.local_shipping_rounded),
    };
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: SizedBox(
                      width: 56,
                      height: 56,
                      child: AppImage(
                        o.marketImageUrl,
                        fallback: const ColoredBox(
                          color: AppColors.primary,
                          child: Icon(Icons.storefront_rounded, color: AppColors.accent),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          o.marketCount > 1 ? '${o.marketName} +${o.marketCount - 1}' : o.marketName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'Montserrat',
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: AppColors.ink,
                          ),
                        ),
                        Text(dateTime(o.createdAt), style: const TextStyle(fontSize: 13, color: AppColors.inkMuted)),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(icon, size: 16, color: fg),
                              const SizedBox(width: 4),
                              Text(
                                o.statusLabel,
                                style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12.5),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, box) {
                        // Mostra quantas miniaturas couberem; o restante vira "+N".
                        final fit = (box.maxWidth / 52).floor();
                        final showCount = o.preview.length.clamp(0, fit - 1 < 0 ? 0 : fit - 1);
                        final rest = o.itemCount - showCount;
                        return Row(
                          children: [
                            for (final item in o.preview.take(showCount))
                              Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: Tooltip(
                                  message: item.name,
                                  child: Container(
                                    width: 46,
                                    height: 46,
                                    padding: const EdgeInsets.all(3),
                                    decoration: BoxDecoration(
                                      color: AppColors.sheet,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: AppImage(
                                      item.imageUrl,
                                      fit: BoxFit.contain,
                                      fallback: Icon(
                                        categoryIcon('mercearia'),
                                        color: AppColors.primaryLight.withValues(alpha: .5),
                                        size: 22,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            if (rest > 0)
                              Container(
                                width: 46,
                                height: 46,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: AppColors.sheet,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '+$rest',
                                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Total', style: TextStyle(fontSize: 12, color: AppColors.inkMuted)),
                      Text(
                        money(o.totalCents),
                        style: const TextStyle(
                          fontFamily: 'Montserrat',
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: onTap,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.brandSoft, width: 1.5),
                    backgroundColor: AppColors.brandSoft.withValues(alpha: .4),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    o.status == 'aguardando_pagamento'
                        ? 'Pagar agora'
                        : o.stage == OrderStage.active
                        ? 'Acompanhar pedido'
                        : 'Ver detalhes',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
