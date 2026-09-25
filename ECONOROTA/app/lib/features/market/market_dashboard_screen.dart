import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/market_panel.dart';
import '../../data/repositories/market_panel_repository.dart';
import '../../state/auth_controller.dart';
import '../customer/widgets/common.dart';
import '../shared/notifications_screen.dart';
import 'market_widgets.dart';

/// Login do mercado → Dashboard: loja aberta/fechada, números de hoje e alertas.
class MarketDashboardScreen extends StatefulWidget {
  const MarketDashboardScreen({super.key});

  @override
  State<MarketDashboardScreen> createState() => _MarketDashboardScreenState();
}

class _MarketDashboardScreenState extends State<MarketDashboardScreen> {
  ({PanelMarket market, PanelKpis kpis})? _data;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await context.read<MarketPanelRepository>().summary();
      if (mounted) {
        setState(() {
          _data = d;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _toggleOpen(bool open) async {
    setState(() => _saving = true);
    try {
      final m = await context.read<MarketPanelRepository>().updateStore(isOpen: open);
      if (mounted) setState(() => _data = (market: m, kpis: _data!.kpis));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _data;
    return PanelPage(
      title: d?.market.name ?? 'Painel do mercado',
      subtitle: 'Painel do supermercado',
      onRefresh: _load,
      actions: [
        const NotificationBell(),
        IconButton(
          tooltip: 'Dados da loja',
          onPressed: () => context.push('/mercado/loja'),
          icon: const Icon(Icons.store_rounded, color: Colors.white),
        ),
        IconButton(
          tooltip: 'Sair',
          onPressed: () => context.read<AuthController>().logout(),
          icon: const Icon(Icons.logout_rounded, color: Colors.white),
        ),
      ],
      children: [
        if (_error != null && d == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (d == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else ...[
          PanelCard(
            child: Row(
              children: [
                Icon(
                  d.market.isOpen ? Icons.storefront_rounded : Icons.store_mall_directory_outlined,
                  color: d.market.isOpen ? AppColors.success : AppColors.inkMuted,
                  size: 30,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        d.market.isOpen ? 'Loja aberta' : 'Loja fechada',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                      ),
                      Text(
                        d.market.isOpen
                            ? 'Recebendo pedidos · ${d.market.opensAt}–${d.market.closesAt}'
                            : 'Os clientes não veem seus produtos agora.',
                        style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: d.market.isOpen,
                  activeThumbColor: Colors.white,
                  activeTrackColor: AppColors.success,
                  onChanged: _saving ? null : _toggleOpen,
                ),
              ],
            ),
          ),
          if (d.kpis.newOrders > 0) ...[
            const SizedBox(height: 12),
            Material(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => context.go('/mercado/pedidos'),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      const Icon(Icons.notifications_active_rounded, color: AppColors.accent),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          d.kpis.newOrders == 1
                              ? '1 pedido novo para separar'
                              : '${d.kpis.newOrders} pedidos novos para separar',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
                        ),
                      ),
                      const Text(
                        'Ver',
                        style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          const Text(
            'Hoje',
            style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.ink),
          ),
          const SizedBox(height: 8),
          _Grid(
            children: [
              KpiCard(icon: Icons.receipt_long_rounded, label: 'Pedidos hoje', value: '${d.kpis.ordersToday}'),
              KpiCard(
                icon: Icons.payments_rounded,
                label: 'Vendas hoje',
                value: money(d.kpis.revenueToday),
                color: AppColors.success,
              ),
              KpiCard(
                icon: Icons.fiber_new_rounded,
                label: 'Novos pedidos',
                value: '${d.kpis.newOrders}',
                color: AppColors.info,
                onTap: () => context.go('/mercado/pedidos'),
              ),
              KpiCard(
                icon: Icons.inventory_2_rounded,
                label: 'Em separação',
                value: '${d.kpis.separating}',
                color: const Color(0xFFB45309),
                onTap: () => context.go('/mercado/pedidos'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Estoque',
            style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.ink),
          ),
          const SizedBox(height: 8),
          _Grid(
            children: [
              KpiCard(
                icon: Icons.warning_amber_rounded,
                label: 'Estoque baixo',
                value: '${d.kpis.lowStock}',
                color: const Color(0xFFB45309),
                onTap: () => context.go('/mercado/produtos?filtro=baixo'),
              ),
              KpiCard(
                icon: Icons.block_rounded,
                label: 'Indisponíveis',
                value: '${d.kpis.unavailable}',
                color: AppColors.discount,
                onTap: () => context.go('/mercado/produtos?filtro=indisponivel'),
              ),
              KpiCard(
                icon: Icons.event_busy_rounded,
                label: 'Vencendo em 3 dias',
                value: '${d.kpis.expiring}',
                color: AppColors.discount,
                onTap: () => context.go('/mercado/produtos?filtro=vencendo'),
              ),
              KpiCard(
                icon: Icons.add_box_rounded,
                label: 'Cadastrar produto',
                value: 'Novo',
                onTap: () => context.push('/mercado/produto/novo'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Grid extends StatelessWidget {
  const _Grid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (_, box) {
      final cols = box.maxWidth >= 900 ? 4 : 2;
      final w = (box.maxWidth - 10 * (cols - 1)) / cols;
      return Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [for (final c in children) SizedBox(width: w, child: c)],
      );
    },
  );
}
