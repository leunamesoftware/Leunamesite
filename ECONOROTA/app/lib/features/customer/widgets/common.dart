import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/catalog.dart';
import '../../../state/cart_controller.dart';
import '../../../widgets/product_card.dart';
import '../../../widgets/skeleton.dart';

/// Adiciona ao carrinho com confirmação discreta.
void addToCart(BuildContext context, Product p) {
  context.read<CartController>().add(p);
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text('${p.name} adicionado ao carrinho'),
        duration: const Duration(seconds: 2),
        backgroundColor: AppColors.ink,
      ),
    );
}

/// Card de produto já ligado ao carrinho.
class CartProductCard extends StatelessWidget {
  const CartProductCard({super.key, required this.product, this.width = 158});

  final Product product;
  final double width;

  @override
  Widget build(BuildContext context) => ProductCard(
    product: product,
    width: width,
    quantity: context.select<CartController, int>((c) => c.quantityOf(product)),
    onTap: () => context.push('/cliente/produto/${product.id}'),
    onAdd: () => addToCart(context, product),
  );
}

/// Lista horizontal de produtos com carregamento.
class ProductRail extends StatelessWidget {
  const ProductRail({super.key, required this.products});

  final List<Product>? products;

  static const height = 290.0;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: height,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: products?.length ?? 4,
      separatorBuilder: (_, _) => const SizedBox(width: 12),
      itemBuilder: (_, i) => products == null
          ? const Skeleton(width: 158, height: height, radius: 18)
          : CartProductCard(product: products![i]),
    ),
  );
}

/// Grade responsiva de produtos (sliver).
class ProductGridSliver extends StatelessWidget {
  const ProductGridSliver({super.key, required this.products, this.loading = false});

  final List<Product> products;
  final bool loading;

  @override
  Widget build(BuildContext context) => SliverPadding(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    sliver: SliverGrid(
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 210,
        mainAxisExtent: ProductRail.height,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      delegate: SliverChildBuilderDelegate(
        (_, i) => i < products.length
            ? CartProductCard(product: products[i], width: double.infinity)
            : const Skeleton(height: ProductRail.height, radius: 18),
        childCount: products.length + (loading ? 4 : 0),
      ),
    ),
  );
}

/// Mensagem de erro com botão "Tentar novamente".
class RetryBox extends StatelessWidget {
  const RetryBox({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      children: [
        const Icon(Icons.wifi_off_rounded, size: 40, color: AppColors.inkMuted),
        const SizedBox(height: 10),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.ink),
        ),
        const SizedBox(height: 10),
        OutlinedButton(onPressed: onRetry, child: const Text('Tentar novamente')),
      ],
    ),
  );
}

/// Estado vazio da área clara.
class LightEmpty extends StatelessWidget {
  const LightEmpty({super.key, required this.icon, required this.title, this.message, this.action});

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(32, 32, 32, 16),
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(color: AppColors.brandSoft, shape: BoxShape.circle),
          child: Icon(icon, size: 38, color: AppColors.primary),
        ),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontFamily: 'Montserrat',
            fontWeight: FontWeight.w800,
            fontSize: 18,
            color: AppColors.ink,
          ),
        ),
        if (message != null) ...[
          const SizedBox(height: 6),
          Text(
            message!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.inkMuted, height: 1.4),
          ),
        ],
        if (action != null) ...[const SizedBox(height: 18), action!],
      ],
    ),
  );
}

/// Chips de filtro horizontais.
class ChoiceChips<T> extends StatelessWidget {
  const ChoiceChips({
    super.key,
    required this.values,
    required this.selected,
    required this.label,
    required this.onSelected,
  });

  final List<T> values;
  final T selected;
  final String Function(T) label;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Row(
      children: [
        for (final v in values) ...[
          ChoiceChip(
            label: Text(label(v)),
            selected: v == selected,
            showCheckmark: false,
            onSelected: (_) => onSelected(v),
            selectedColor: AppColors.primary,
            backgroundColor: Colors.white,
            labelStyle: TextStyle(color: v == selected ? Colors.white : AppColors.ink, fontWeight: FontWeight.w600),
            side: BorderSide(color: v == selected ? AppColors.primary : AppColors.line),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          ),
          const SizedBox(width: 8),
        ],
      ],
    ),
  );
}
