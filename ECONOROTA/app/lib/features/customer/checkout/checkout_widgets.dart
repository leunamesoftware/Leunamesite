import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/compare.dart';
import '../../../widgets/app_image.dart';

/// Etapas da compra: Lista → Carrinho → Confirmação → Pagamento → Entrega.
class CheckoutSteps extends StatelessWidget {
  const CheckoutSteps({super.key, required this.current});

  /// 1 a 5.
  final int current;
  static const _labels = ['Lista', 'Carrinho', 'Confirmação', 'Pagamento', 'Entrega'];

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Etapa $current de 5: ${_labels[current - 1]}',
    child: ExcludeSemantics(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: Row(
          children: [
            for (var i = 1; i <= 5; i++)
              Expanded(
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(child: Container(height: 2, color: i == 1 ? Colors.transparent : _lineColor(i))),
                        CircleAvatar(
                          radius: 13,
                          backgroundColor: i < current
                              ? AppColors.success
                              : i == current
                              ? AppColors.primary
                              : AppColors.line,
                          child: i < current
                              ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                              : Text(
                                  '$i',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w800,
                                    color: i == current ? Colors.white : AppColors.inkMuted,
                                  ),
                                ),
                        ),
                        Expanded(child: Container(height: 2, color: i == 5 ? Colors.transparent : _lineColor(i + 1))),
                      ],
                    ),
                    const SizedBox(height: 4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        _labels[i - 1],
                        maxLines: 1,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: i == current ? FontWeight.w800 : FontWeight.w500,
                          color: i == current ? AppColors.primary : AppColors.inkMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ),
  );

  Color _lineColor(int step) => step <= current ? AppColors.primary : AppColors.line;
}

/// Transparência: de onde vem o valor da entrega única.
void showDeliveryDetails(BuildContext context, CompareResult result, ComparePlan plan) => showModalBottomSheet<void>(
  context: context,
  showDragHandle: true,
  backgroundColor: Colors.white,
  builder: (_) => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Como calculamos a entrega',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.ink),
          ),
          const SizedBox(height: 6),
          const Text(
            'Um único entregador passa nos mercados, na melhor ordem da rota, e leva tudo até você. '
            'Você paga uma entrega só: o valor base e um pequeno adicional por mercado extra.',
            style: TextStyle(color: AppColors.inkMuted, fontSize: 13.5),
          ),
          const SizedBox(height: 10),
          for (final (i, id) in plan.marketIds.indexed)
            KeyValue(
              i == 0 ? 'Entrega com coleta em ${result.market(id).name}' : '+ Coleta em ${result.market(id).name}',
              money(i == 0 ? result.deliveryBaseCents : result.deliveryExtraCents),
            ),
          const Divider(height: 18),
          KeyValue('Entrega total', money(plan.deliveryCents), bold: true),
        ],
      ),
    ),
  ),
);

class KeyValue extends StatelessWidget {
  const KeyValue(this.label, this.value, {super.key, this.bold = false, this.color});

  final String label;
  final String value;
  final bool bold;
  final Color? color;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: bold ? AppColors.ink : AppColors.inkMuted,
              fontWeight: bold ? FontWeight.w800 : null,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(color: color ?? AppColors.ink, fontWeight: bold ? FontWeight.w800 : FontWeight.w600),
        ),
      ],
    ),
  );
}

/// Cabeçalho de cada mercado do pedido: número da parada, logo, distância e previsão.
class MarketHeader extends StatelessWidget {
  const MarketHeader({super.key, required this.market, required this.stop, this.trailing});

  final CompareMarket market;
  final int stop;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      CircleAvatar(
        radius: 13,
        backgroundColor: AppColors.primary,
        child: Text(
          '$stop',
          style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w800, fontSize: 13),
        ),
      ),
      const SizedBox(width: 10),
      ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: 40,
          height: 40,
          child: AppImage(
            market.imageUrl,
            fallback: const ColoredBox(
              color: AppColors.primary,
              child: Icon(Icons.storefront_rounded, color: AppColors.accent),
            ),
          ),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              market.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
            ),
            Text(
              [if (market.distanceKm != null) distance(market.distanceKm!), 'até ${market.etaMax} min'].join(' · '),
              style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
            ),
          ],
        ),
      ),
      ?trailing,
    ],
  );
}

/// Resumo da compra: subtotal por mercado, produtos, entrega única, total e economia real.
class PurchaseSummary extends StatelessWidget {
  const PurchaseSummary({
    super.key,
    required this.result,
    required this.plan,
    required this.savings,
    required this.savingsPct,
  });

  final CompareResult result;
  final ComparePlan plan;
  final int savings;
  final int savingsPct;

  @override
  Widget build(BuildContext context) {
    final order = plan.route?.order ?? plan.marketIds;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Resumo da compra',
                style: TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w800,
                  fontSize: 17,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 8),
              if (order.length > 1)
                for (final (i, id) in order.indexed)
                  KeyValue(
                    '${i + 1}. ${result.market(id).name}',
                    money(plan.linesOf(id).fold<int>(0, (s, l) => s + l.totalCents)),
                  ),
              KeyValue('Produtos (${plan.lines.fold<int>(0, (s, l) => s + l.qty)} un.)', money(plan.itemsCents)),
              Row(
                children: [
                  const Expanded(
                    child: Text('Entrega (única)', style: TextStyle(color: AppColors.inkMuted)),
                  ),
                  InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () => showDeliveryDetails(context, result, plan),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.info_outline_rounded,
                            size: 16,
                            color: AppColors.primary,
                            semanticLabel: 'Ver detalhes da entrega',
                          ),
                          const SizedBox(width: 4),
                          Text(
                            money(plan.deliveryCents),
                            style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const Text(
                'Você paga uma entrega só, mesmo comprando em mais de um mercado.',
                style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
              ),
              const Divider(height: 20),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Total',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                    ),
                  ),
                  Text(
                    money(plan.totalCents),
                    style: const TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w800,
                      fontSize: 20,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (savings > 0) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(gradient: AppColors.headerGradient, borderRadius: BorderRadius.circular(18)),
            child: Row(
              children: [
                const Icon(Icons.savings_rounded, color: AppColors.accent, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Você está economizando', style: TextStyle(color: Colors.white70, fontSize: 12.5)),
                      Text(
                        money(savings),
                        style: const TextStyle(
                          fontFamily: 'Montserrat',
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                          color: AppColors.accent,
                        ),
                      ),
                      const Text(
                        'Comparado à compra em um único mercado, com entrega.',
                        style: TextStyle(color: Colors.white70, fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(12)),
                  child: Text(
                    '$savingsPct%',
                    style: const TextStyle(color: AppColors.onAccent, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Lista (itens + resumo) lado a lado em telas largas; empilhada no celular.
class CheckoutLayout extends StatelessWidget {
  const CheckoutLayout({super.key, required this.main, required this.side});

  final List<Widget> main;
  final List<Widget> side;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (_, c) => c.maxWidth >= 720
        ? Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: main),
                ),
                const SizedBox(width: 16),
                SizedBox(
                  width: 300,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: side),
                ),
              ],
            ),
          )
        : Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [...main, ...side]),
          ),
  );
}
