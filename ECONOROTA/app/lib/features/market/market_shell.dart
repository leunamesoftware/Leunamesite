import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';

/// Painel do mercado: 5 áreas.
class MarketShell extends StatelessWidget {
  const MarketShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) => PanelShell(
    shell: shell,
    icon: Icons.storefront_rounded,
    tabs: const [
      (Icons.dashboard_outlined, Icons.dashboard_rounded, 'Início'),
      (Icons.receipt_long_outlined, Icons.receipt_long_rounded, 'Pedidos'),
      (Icons.inventory_2_outlined, Icons.inventory_2_rounded, 'Produtos'),
      (Icons.warehouse_outlined, Icons.warehouse_rounded, 'Estoque'),
      (Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, 'Financeiro'),
    ],
  );
}

/// Navegação dos painéis (mercado, entregador). Celular: barra inferior; computador: menu lateral.
class PanelShell extends StatelessWidget {
  const PanelShell({super.key, required this.shell, required this.tabs, required this.icon});

  final StatefulNavigationShell shell;
  final List<(IconData, IconData, String)> tabs;
  final IconData icon;

  void _go(int b) => shell.goBranch(b, initialLocation: b == shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    if (wide) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              backgroundColor: Colors.white,
              selectedIndex: shell.currentIndex,
              onDestinationSelected: _go,
              labelType: NavigationRailLabelType.all,
              indicatorColor: AppColors.brandSoft,
              selectedIconTheme: const IconThemeData(color: AppColors.primary),
              unselectedIconTheme: const IconThemeData(color: AppColors.inkMuted),
              selectedLabelTextStyle: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
              unselectedLabelTextStyle: const TextStyle(color: AppColors.inkMuted),
              leading: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Icon(icon, color: AppColors.primary, size: 30),
              ),
              destinations: [
                for (final (icon, selected, label) in tabs)
                  NavigationRailDestination(icon: Icon(icon), selectedIcon: Icon(selected), label: Text(label)),
              ],
            ),
            const VerticalDivider(width: 1, color: AppColors.line),
            Expanded(child: shell),
          ],
        ),
      );
    }
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          indicatorColor: AppColors.brandSoft,
          height: 66,
          labelTextStyle: WidgetStateProperty.resolveWith(
            (s) => TextStyle(
              fontSize: 11.5,
              fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
              color: s.contains(WidgetState.selected) ? AppColors.primary : AppColors.inkMuted,
            ),
          ),
          iconTheme: WidgetStateProperty.resolveWith(
            (s) => IconThemeData(color: s.contains(WidgetState.selected) ? AppColors.primary : AppColors.inkMuted),
          ),
        ),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          child: NavigationBar(
            selectedIndex: shell.currentIndex,
            onDestinationSelected: _go,
            destinations: [
              for (final (icon, selected, label) in tabs)
                NavigationDestination(icon: Icon(icon), selectedIcon: Icon(selected), label: label),
            ],
          ),
        ),
      ),
    );
  }
}
