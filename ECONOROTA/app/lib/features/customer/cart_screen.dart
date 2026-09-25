import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../state/cart_controller.dart';
import '../../widgets/app_image.dart';
import '../../core/compare/rules.dart';
import '../../widgets/category_icon.dart';
import 'widgets/common.dart';

const minOrderCents = platformMinOrderCents;

/// Minha lista: produtos genéricos + quantidade. O mercado é definido na comparação.
class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    return Theme(
      data: AppTheme.light,
      child: Scaffold(
        backgroundColor: AppColors.sheet,
        appBar: AppBar(
          backgroundColor: AppColors.sheet,
          foregroundColor: AppColors.ink,
          title: const Text(
            'Minha lista',
            style: TextStyle(color: AppColors.ink, fontWeight: FontWeight.w800),
          ),
          actions: [if (cart.items.isNotEmpty) TextButton(onPressed: cart.clear, child: const Text('Limpar'))],
        ),
        body: cart.items.isEmpty
            ? Center(
                child: LightEmpty(
                  icon: Icons.playlist_add_rounded,
                  title: 'Sua lista está vazia',
                  message: 'Adicione os produtos que você precisa. O EconoRota encontra os menores preços.',
                  action: FilledButton(
                    onPressed: () => context.push('/cliente/selecionar'),
                    child: const Text('Montar lista'),
                  ),
                ),
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (cart.estimatedCents < minOrderCents)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: AppColors.infoSoft, borderRadius: BorderRadius.circular(14)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Pedido mínimo: ${money(minOrderCents)} em produtos. Pela estimativa, faltam cerca de ${money(minOrderCents - cart.estimatedCents)}.',
                              style: const TextStyle(color: AppColors.info, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: cart.estimatedCents / minOrderCents,
                                minHeight: 8,
                                color: AppColors.info,
                                backgroundColor: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  for (final it in cart.items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Row(
                            children: [
                              Container(
                                width: 52,
                                height: 52,
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: AppColors.sheet,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: AppImage(
                                  it.imageUrl,
                                  fit: BoxFit.contain,
                                  fallback: Icon(categoryIcon(it.categoryId), color: AppColors.primaryLight),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      it.label,
                                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                                    ),
                                    Text(it.unit, style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted)),
                                    Text(
                                      'a partir de ${money(it.refPriceCents)}',
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        color: AppColors.success,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                tooltip: it.qty == 1 ? 'Remover ${it.label}' : 'Diminuir ${it.label}',
                                onPressed: () => cart.decrement(it.key),
                                icon: Icon(
                                  it.qty == 1 ? Icons.delete_outline_rounded : Icons.remove_circle_outline_rounded,
                                ),
                                color: AppColors.inkMuted,
                              ),
                              Text(
                                '${it.qty}',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                              ),
                              IconButton(
                                tooltip: 'Aumentar ${it.label}',
                                onPressed: () => cart.increment(it.key),
                                icon: const Icon(Icons.add_circle_rounded),
                                color: AppColors.success,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/cliente/selecionar'),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Adicionar mais produtos'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ],
              ),
        bottomNavigationBar: cart.items.isEmpty
            ? null
            : SafeArea(
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(top: BorderSide(color: AppColors.line)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${cart.count} ${cart.count == 1 ? 'item' : 'itens'} · estimativa',
                              style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                            ),
                            Text(
                              money(cart.estimatedCents),
                              style: const TextStyle(
                                fontFamily: 'Montserrat',
                                fontWeight: FontWeight.w800,
                                fontSize: 22,
                                color: AppColors.ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                      FilledButton.icon(
                        onPressed: () => context.push('/cliente/comparar'),
                        icon: const Icon(Icons.compare_arrows_rounded),
                        label: const Text('Comparar mercados', style: TextStyle(fontWeight: FontWeight.w800)),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.success,
                          minimumSize: const Size(0, 52),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}
