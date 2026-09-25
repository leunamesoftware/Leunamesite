import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/errors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/order.dart';
import '../../../data/repositories/compare_repository.dart';
import '../../../data/repositories/orders_repository.dart';
import '../../../services/api_client.dart';
import '../../../state/address_controller.dart';
import '../../../state/auth_controller.dart';
import '../../../state/cart_controller.dart';
import '../../../state/checkout_controller.dart';
import '../../../widgets/brand_header.dart';
import '../widgets/common.dart';
import 'checkout_widgets.dart';

/// Fase 6 — Confirmação do pedido: endereço, produtos por mercado, resumo e forma de pagamento.
class CheckoutConfirmScreen extends StatefulWidget {
  const CheckoutConfirmScreen({super.key});

  @override
  State<CheckoutConfirmScreen> createState() => _CheckoutConfirmScreenState();
}

class _CheckoutConfirmScreenState extends State<CheckoutConfirmScreen> {
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    // Chegou aqui depois do login (ou recarregou a página): recalcula com os preços de agora.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.read<CheckoutController>().result == null) _refresh();
    });
  }

  Future<void> _refresh() => context.read<CheckoutController>().refresh(
    context.read<CompareRepository>(),
    context.read<CartController>().wants,
    context.read<AddressController>().current,
  );

  Future<void> _changeAddress() async {
    await context.push('/cliente/localizacao');
    if (mounted) await _refresh(); // mercados e entrega dependem do endereço
  }

  Future<void> _confirm() async {
    final ck = context.read<CheckoutController>();
    final plan = ck.plan;
    final address = context.read<AddressController>().current;
    if (plan == null || address == null || _sending) return;
    if (context.read<AuthController>().user == null) {
      context.push('/entrar?voltar=/cliente/pedido/confirmar');
      return;
    }
    setState(() => _sending = true);
    try {
      final order = await context.read<OrdersRepository>().place(
        items: context.read<CartController>().wants,
        plan: plan,
        address: address,
        payment: ck.payment,
      );
      if (!mounted) return;
      final savings = ck.savings;
      context.read<CartController>().clear();
      ck.clear();
      context.go('/cliente/pedido/${order.id}/pagamento', extra: savings);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'unverified') {
        context.push('/verificar');
      } else if (e.code == 'cart_changed') {
        await _refresh();
        if (!mounted) return;
        await showDialog<void>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Valores atualizados'),
            content: Text('${e.message} Confira o novo total antes de confirmar.'),
            actions: [FilledButton(onPressed: () => Navigator.pop(c), child: const Text('Entendi'))],
          ),
        );
      } else {
        _snack(friendlyError(e));
      }
    } catch (e) {
      if (mounted) _snack(friendlyError(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _snack(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    final ck = context.watch<CheckoutController>();
    final address = context.watch<AddressController>().current;
    final guest = context.select<AuthController, bool>((a) => a.user == null);
    final r = ck.result;
    final plan = ck.plan;
    final hasAddress = address != null && address.lat != null;
    final ready =
        plan != null && !ck.loading && hasAddress && plan.missing.isEmpty && plan.itemsCents >= r!.minOrderCents;

    return BrandScaffold(
      showBack: true,
      title: 'Confirmação do pedido',
      subtitle: 'Revise endereço, produtos e forma de pagamento.',
      bottom: plan == null
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
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
                          const Text('Total', style: TextStyle(fontSize: 12.5, color: AppColors.inkMuted)),
                          Text(
                            money(plan.totalCents),
                            style: const TextStyle(
                              fontFamily: 'Montserrat',
                              fontWeight: FontWeight.w800,
                              fontSize: 20,
                              color: AppColors.ink,
                            ),
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: ready && !_sending ? _confirm : null,
                      icon: _sending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                            )
                          : const Icon(Icons.lock_rounded),
                      label: Text(
                        guest ? 'Entrar e confirmar' : 'Confirmar pedido',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                      ),
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
      slivers: [
        const SliverToBoxAdapter(child: CheckoutSteps(current: 3)),
        if (ck.error != null && r == null)
          SliverToBoxAdapter(
            child: RetryBox(message: ck.error!, onRetry: _refresh),
          )
        else if (r == null || plan == null)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(40),
              child: Center(child: CircularProgressIndicator()),
            ),
          )
        else
          SliverToBoxAdapter(
            child: CheckoutLayout(
              main: [
                _Card(
                  child: Row(
                    children: [
                      const Icon(Icons.location_on_rounded, color: AppColors.primary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: hasAddress
                            ? Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Entregar em',
                                    style: TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                                  ),
                                  Text(
                                    address.line1,
                                    style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                                  ),
                                  Text(
                                    address.line2,
                                    style: const TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                                  ),
                                ],
                              )
                            : const Text(
                                'Informe o endereço de entrega.',
                                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.discount),
                              ),
                      ),
                      TextButton(onPressed: _changeAddress, child: Text(hasAddress ? 'Alterar' : 'Informar')),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                for (final (i, id) in (plan.route?.order ?? plan.marketIds).indexed) ...[
                  _Card(
                    child: Column(
                      children: [
                        MarketHeader(market: r.market(id), stop: i + 1),
                        const Divider(height: 18),
                        for (final l in plan.linesOf(id))
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              children: [
                                Text(
                                  '${l.qty}×',
                                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    '${r.row(l.key).name} · ${r.row(l.key).unit}',
                                    style: const TextStyle(color: AppColors.ink, fontSize: 13.5),
                                  ),
                                ),
                                Text(money(l.totalCents), style: const TextStyle(color: AppColors.ink, fontSize: 13.5)),
                              ],
                            ),
                          ),
                        const Divider(height: 16),
                        KeyValue(
                          'Subtotal deste mercado',
                          money(plan.linesOf(id).fold<int>(0, (s, l) => s + l.totalCents)),
                          bold: true,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                TextButton.icon(
                  onPressed: () => context.canPop() ? context.pop() : context.go('/cliente/pedido'),
                  icon: const Icon(Icons.arrow_back_rounded),
                  label: const Text('Voltar para o carrinho'),
                ),
                const SizedBox(height: 8),
              ],
              side: [
                PurchaseSummary(result: r, plan: plan, savings: ck.savings, savingsPct: ck.savingsPct),
                const SizedBox(height: 12),
                _Card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Forma de pagamento',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                      ),
                      RadioGroup<PaymentMethod>(
                        groupValue: ck.payment,
                        onChanged: (p) => p == null ? null : ck.setPayment(p),
                        child: Column(
                          children: [
                            for (final p in PaymentMethod.values)
                              RadioListTile<PaymentMethod>(
                                value: p,
                                contentPadding: EdgeInsets.zero,
                                activeColor: AppColors.primary,
                                secondary: Icon(
                                  p == PaymentMethod.pix ? Icons.pix_rounded : Icons.credit_card_rounded,
                                  color: AppColors.primary,
                                ),
                                title: Text(
                                  p.label,
                                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                                ),
                                subtitle: Text(
                                  p.hint,
                                  style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const Text(
                        'Você paga no próximo passo, com segurança. Nada é cobrado antes.',
                        style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (plan.itemsCents < r.minOrderCents) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Pedido mínimo de ${money(r.minOrderCents)} em produtos.',
                    style: const TextStyle(color: AppColors.discount, fontWeight: FontWeight.w700),
                  ),
                ],
                const SizedBox(height: 24),
              ],
            ),
          ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: const BorderSide(color: AppColors.line),
    ),
    child: Padding(padding: const EdgeInsets.all(14), child: child),
  );
}
