import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/errors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/catalog.dart';
import '../../../data/models/store.dart';
import '../../../data/repositories/store_repository.dart';
import '../../../state/cart_controller.dart';
import '../../../state/favorites_controller.dart';
import '../../../widgets/app_image.dart';
import '../../../widgets/brand_header.dart';
import '../../../widgets/category_icon.dart';
import '../../../widgets/skeleton.dart';
import '../widgets/common.dart';

/// Detalhe do produto: preço, estoque, oferta, loja e comparação com outros mercados.
class ProductDetailsScreen extends StatefulWidget {
  const ProductDetailsScreen({super.key, required this.productId});

  final String productId;

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  ProductDetails? _d;
  String? _error;
  int _qty = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final d = await context.read<StoreRepository>().product(widget.productId);
      if (mounted) setState(() => _d = d);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  void _add() {
    final p = _d!.product;
    context.read<CartController>().add(p, _qty);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          backgroundColor: AppColors.ink,
          content: Text('$_qty × ${p.name} no carrinho'),
          action: SnackBarAction(
            label: 'Ver carrinho',
            textColor: AppColors.accent,
            onPressed: () => context.push('/cliente/carrinho'),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final d = _d;
    return Theme(
      data: AppTheme.light,
      child: Scaffold(
        backgroundColor: AppColors.sheet,
        appBar: AppBar(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          leading: IconButton(
            tooltip: 'Voltar',
            onPressed: () => context.canPop() ? context.pop() : context.go('/cliente'),
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          ),
          title: const Text(
            'Detalhes do produto',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
          ),
          actions: const [CartButton()],
        ),
        body: _error != null
            ? Center(
                child: RetryBox(message: _error!, onRetry: _load),
              )
            : d == null
            ? ListView(
                padding: const EdgeInsets.all(16),
                children: const [
                  Skeleton(height: 260, radius: 20),
                  SizedBox(height: 16),
                  Skeleton(height: 24, width: 220),
                  SizedBox(height: 10),
                  Skeleton(height: 40, width: 160),
                  SizedBox(height: 16),
                  Skeleton(height: 120, radius: 18),
                ],
              )
            : _Body(d: d),
        bottomNavigationBar: d == null
            ? null
            : _BuyBar(d: d, qty: _qty, onQty: (q) => setState(() => _qty = q), onAdd: _add),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.d});

  final ProductDetails d;

  @override
  Widget build(BuildContext context) {
    final p = d.product;
    final saving = p.priceCents - p.finalPriceCents;
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Container(
          color: Colors.white,
          height: 280,
          padding: const EdgeInsets.all(24),
          child: Stack(
            fit: StackFit.expand,
            children: [
              AppImage(
                p.imageUrl,
                fit: BoxFit.contain,
                fallback: Icon(
                  categoryIcon(p.categoryId),
                  size: 110,
                  color: AppColors.primaryLight.withValues(alpha: .4),
                ),
              ),
              Positioned(top: 0, left: 0, child: _FavoriteButton(productId: p.id)),
              if (p.onSale)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: AppColors.discount, borderRadius: BorderRadius.circular(20)),
                    child: Text(
                      '-${p.discountPct}%',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (p.categoryName != null) _Breadcrumb(product: p),
              Text(
                p.name,
                style: const TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                  color: AppColors.ink,
                ),
              ),
              Text(p.detail, style: const TextStyle(fontSize: 15, color: AppColors.inkMuted)),
              const SizedBox(height: 12),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.end,
                spacing: 10,
                runSpacing: 6,
                children: [
                  Text(
                    money(p.finalPriceCents),
                    style: TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w800,
                      fontSize: 30,
                      color: p.onSale ? AppColors.discount : AppColors.ink,
                    ),
                  ),
                  if (p.onSale)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        money(p.priceCents),
                        style: const TextStyle(
                          fontSize: 16,
                          color: AppColors.inkMuted,
                          decoration: TextDecoration.lineThrough,
                          decorationColor: AppColors.inkMuted,
                        ),
                      ),
                    ),
                ],
              ),
              if (p.unitPrice != null)
                Text(
                  'Preço por ${p.unitPrice!.per}: ${money(p.unitPrice!.cents)}/${p.unitPrice!.per}',
                  style: const TextStyle(fontSize: 13, color: AppColors.inkMuted),
                ),
              if (saving > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: _Pill(
                    icon: Icons.savings_rounded,
                    text: 'Você economiza ${money(saving)} nesta oferta',
                    fg: AppColors.success,
                    bg: AppColors.successSoft,
                  ),
                ),
              if (p.onSale)
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Row(
                    children: [
                      Icon(Icons.sell_outlined, size: 15, color: AppColors.inkMuted),
                      SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Oferta válida enquanto durarem os estoques.',
                          style: TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
              _StockPill(stock: p.stock),
              const SizedBox(height: 16),
              _MarketRow(d: d),
              if (d.compare.isNotEmpty) ...[const SizedBox(height: 20), _Compare(d: d)],
              if (d.description?.isNotEmpty ?? false) ...[
                const SizedBox(height: 20),
                const Text(
                  'Descrição',
                  style: TextStyle(
                    fontFamily: 'Montserrat',
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 6),
                Text(d.description!, style: const TextStyle(color: AppColors.ink, height: 1.5)),
              ],
              const SizedBox(height: 20),
              const _TrustRow(),
              const SizedBox(height: 14),
              const Text(
                'Preço e estoque informados pelo mercado. Podem mudar até a confirmação do pedido.',
                style: TextStyle(fontSize: 12, color: AppColors.inkMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.text, required this.fg, required this.bg});

  final IconData icon;
  final String text;
  final Color fg;
  final Color bg;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: fg),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            text,
            style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 13),
          ),
        ),
      ],
    ),
  );
}

class _StockPill extends StatelessWidget {
  const _StockPill({required this.stock});

  final int stock;

  @override
  Widget build(BuildContext context) => switch (stock) {
    <= 0 => const _Pill(
      icon: Icons.block_rounded,
      text: 'Esgotado neste mercado',
      fg: AppColors.discount,
      bg: AppColors.dangerSoft,
    ),
    <= 5 => _Pill(
      icon: Icons.inventory_2_outlined,
      text: stock == 1 ? 'Última unidade' : 'Últimas $stock unidades',
      fg: const Color(0xFFB45309),
      bg: const Color(0xFFFEF3C7),
    ),
    _ => const _Pill(
      icon: Icons.check_circle_rounded,
      text: 'Em estoque',
      fg: AppColors.success,
      bg: AppColors.successSoft,
    ),
  };
}

class _MarketRow extends StatelessWidget {
  const _MarketRow({required this.d});

  final ProductDetails d;

  @override
  Widget build(BuildContext context) {
    final p = d.product;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/cliente/mercado/${p.marketId}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: AppImage(
                    d.marketImageUrl,
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
                    const Text('Vendido por', style: TextStyle(fontSize: 12, color: AppColors.inkMuted)),
                    Text(
                      p.marketName ?? 'Mercado',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                    ),
                    Text(
                      '${d.marketOpen ? 'Aberto' : 'Fechado'} · entrega ${d.deliveryFeeCents == 0 ? 'grátis' : money(d.deliveryFeeCents)}',
                      style: TextStyle(fontSize: 12.5, color: d.marketOpen ? AppColors.success : AppColors.discount),
                    ),
                  ],
                ),
              ),
              const Text(
                'Ver loja',
                style: TextStyle(color: AppColors.primaryLight, fontWeight: FontWeight.w700),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.primaryLight),
            ],
          ),
        ),
      ),
    );
  }
}

/// Comparação: o mesmo produto nos outros mercados, com o mais barato em destaque.
class _Compare extends StatelessWidget {
  const _Compare({required this.d});

  final ProductDetails d;

  @override
  Widget build(BuildContext context) {
    final p = d.product;
    final rows = [
      PriceOption(
        productId: p.id,
        marketId: p.marketId,
        marketName: p.marketName ?? 'Este mercado',
        priceCents: p.finalPriceCents,
        inStock: p.inStock,
      ),
      ...d.compare,
    ]..sort((a, b) => a.inStock == b.inStock ? a.priceCents.compareTo(b.priceCents) : (a.inStock ? -1 : 1));
    final best = rows.first;
    final cheaperElsewhere = best.productId != p.id && best.inStock;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.compare_arrows_rounded, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Compare nos mercados',
                    style: TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                      color: AppColors.ink,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (cheaperElsewhere)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppColors.successSoft, borderRadius: BorderRadius.circular(12)),
                child: Text(
                  'Economize ${money(p.finalPriceCents - best.priceCents)} comprando no ${best.marketName}.',
                  style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700),
                ),
              )
            else
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppColors.successSoft, borderRadius: BorderRadius.circular(12)),
                child: const Text(
                  'Este é o menor preço entre os mercados próximos.',
                  style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w700),
                ),
              ),
            for (final o in rows)
              _CompareRow(
                option: o,
                isCurrent: o.productId == p.id,
                isBest: o.productId == best.productId,
                onTap: o.productId == p.id ? null : () => context.pushReplacement('/cliente/produto/${o.productId}'),
              ),
          ],
        ),
      ),
    );
  }
}

class _CompareRow extends StatelessWidget {
  const _CompareRow({required this.option, required this.isCurrent, required this.isBest, this.onTap});

  final PriceOption option;
  final bool isCurrent;
  final bool isBest;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(10),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      child: Row(
        children: [
          Icon(
            isCurrent ? Icons.radio_button_checked_rounded : Icons.storefront_outlined,
            size: 20,
            color: isCurrent ? AppColors.primary : AppColors.inkMuted,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isCurrent ? '${option.marketName} (este)' : option.marketName,
              style: TextStyle(fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w500, color: AppColors.ink),
            ),
          ),
          if (isBest)
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: AppColors.success, borderRadius: BorderRadius.circular(10)),
              child: const Text(
                'Menor preço',
                style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
              ),
            ),
          Text(
            option.inStock ? money(option.priceCents) : 'Esgotado',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: option.inStock ? (isBest ? AppColors.success : AppColors.ink) : AppColors.inkMuted,
            ),
          ),
          if (onTap != null) const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted, size: 20),
        ],
      ),
    ),
  );
}

class _BuyBar extends StatelessWidget {
  const _BuyBar({required this.d, required this.qty, required this.onQty, required this.onAdd});

  final ProductDetails d;
  final int qty;
  final ValueChanged<int> onQty;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final p = d.product;
    final max = p.stock.clamp(0, 99);
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        child: Row(
          children: [
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.line),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  IconButton(
                    tooltip: 'Diminuir quantidade',
                    onPressed: qty > 1 ? () => onQty(qty - 1) : null,
                    icon: const Icon(Icons.remove_rounded),
                  ),
                  Semantics(
                    label: 'Quantidade $qty',
                    child: Text(
                      '$qty',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.ink),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Aumentar quantidade',
                    onPressed: qty < max ? () => onQty(qty + 1) : null,
                    icon: const Icon(Icons.add_rounded),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: p.inStock ? onAdd : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.success,
                  disabledBackgroundColor: AppColors.line,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    p.inStock ? 'Adicionar · ${money(p.finalPriceCents * qty)}' : 'Indisponível',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context) {
    final fav = context.watch<FavoritesController>().contains(productId);
    return Material(
      color: Colors.white,
      shape: const CircleBorder(side: BorderSide(color: AppColors.line)),
      child: IconButton(
        tooltip: fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos',
        onPressed: () => context.read<FavoritesController>().toggle(productId),
        icon: Icon(
          fav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          color: fav ? AppColors.discount : AppColors.ink,
        ),
      ),
    );
  }
}

class _Breadcrumb extends StatelessWidget {
  const _Breadcrumb({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(fontSize: 13, color: AppColors.primaryLight, fontWeight: FontWeight.w600);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          InkWell(
            onTap: () => context.push('/cliente/categoria/${product.categoryId}'),
            child: Text(product.categoryName!, style: style),
          ),
          if (product.subcategory != null) ...[
            const Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.inkMuted),
            Text(product.subcategory!, style: style.copyWith(color: AppColors.inkMuted)),
          ],
        ],
      ),
    );
  }
}

class _TrustRow extends StatelessWidget {
  const _TrustRow();

  @override
  Widget build(BuildContext context) {
    Widget item(IconData icon, String title, String text) => Expanded(
      child: Column(
        children: [
          Icon(icon, color: AppColors.primaryLight),
          const SizedBox(height: 4),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: AppColors.ink),
          ),
          Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11.5, color: AppColors.inkMuted),
          ),
        ],
      ),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            item(Icons.local_shipping_outlined, 'Entrega rastreada', 'Acompanhe em tempo real'),
            item(Icons.verified_user_outlined, 'Compra segura', 'Dados protegidos'),
            item(Icons.pix_rounded, 'Pix e cartão', 'Pague como preferir'),
          ],
        ),
      ),
    );
  }
}
