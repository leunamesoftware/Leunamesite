import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../data/models/admin.dart';
import '../../data/repositories/admin_repository.dart';
import '../../state/auth_controller.dart';
import '../market/market_widgets.dart';
import '../shared/notifications_screen.dart';
import 'admin_widgets.dart';

typedef AdminSection = ({String slug, String title, String subtitle, IconData icon, AdminArea area});

const adminSections = <AdminSection>[
  (
    slug: 'pedidos',
    title: 'Pedidos',
    subtitle: 'Todos os pedidos',
    icon: Icons.receipt_long_rounded,
    area: AdminArea.operacao,
  ),
  (
    slug: 'entregas',
    title: 'Entregas',
    subtitle: 'Em andamento e atrasos',
    icon: Icons.delivery_dining_rounded,
    area: AdminArea.operacao,
  ),
  (
    slug: 'ocorrencias',
    title: 'Ocorrências',
    subtitle: 'Problemas e reembolsos',
    icon: Icons.support_agent_rounded,
    area: AdminArea.operacao,
  ),
  (
    slug: 'clientes',
    title: 'Clientes',
    subtitle: 'Contas e histórico',
    icon: Icons.people_alt_rounded,
    area: AdminArea.operacao,
  ),
  (
    slug: 'mercados',
    title: 'Mercados',
    subtitle: 'Aprovar e suspender',
    icon: Icons.storefront_rounded,
    area: AdminArea.operacao,
  ),
  (
    slug: 'entregadores',
    title: 'Entregadores',
    subtitle: 'Cadastros e documentos',
    icon: Icons.two_wheeler_rounded,
    area: AdminArea.operacao,
  ),
  (
    slug: 'produtos',
    title: 'Produtos e estoque',
    subtitle: 'Todos os mercados',
    icon: Icons.inventory_2_rounded,
    area: AdminArea.operacao,
  ),
  (slug: 'avaliacoes', title: 'Avaliações', subtitle: 'Moderação', icon: Icons.star_rounded, area: AdminArea.operacao),
  (slug: 'regioes', title: 'Regiões', subtitle: 'Áreas atendidas', icon: Icons.map_rounded, area: AdminArea.operacao),
  (
    slug: 'pagamentos',
    title: 'Pagamentos',
    subtitle: 'Pix, cartão e estornos',
    icon: Icons.payments_rounded,
    area: AdminArea.financeiro,
  ),
  (
    slug: 'financeiro',
    title: 'Financeiro e repasses',
    subtitle: 'Saldos e Pix para parceiros',
    icon: Icons.account_balance_wallet_rounded,
    area: AdminArea.financeiro,
  ),
  (
    slug: 'relatorios',
    title: 'Relatórios',
    subtitle: 'Vendas e desempenho',
    icon: Icons.bar_chart_rounded,
    area: AdminArea.financeiro,
  ),
  (
    slug: 'configuracoes',
    title: 'Configurações',
    subtitle: 'Taxas, mínimo e comissão',
    icon: Icons.tune_rounded,
    area: AdminArea.sistema,
  ),
  (
    slug: 'equipe',
    title: 'Usuários e permissões',
    subtitle: 'Equipe administrativa',
    icon: Icons.admin_panel_settings_rounded,
    area: AdminArea.sistema,
  ),
  (
    slug: 'auditoria',
    title: 'Logs e auditoria',
    subtitle: 'Quem fez o quê',
    icon: Icons.manage_search_rounded,
    area: AdminArea.sistema,
  ),
];

/// Início do painel administrativo.
class AdminHomeScreen extends StatelessWidget {
  const AdminHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return Loader<(Set<AdminArea>, AdminSummary)>(
      load: () async => (await repo.areas(), await repo.summary()),
      builder: (context, v, error, reload) {
        final user = context.watch<AuthController>().user;
        return PanelPage(
          title: 'Administração',
          subtitle: user == null ? null : 'Olá, ${user.name.split(' ').first}',
          onRefresh: reload,
          actions: [
            const NotificationBell(),
            IconButton(
              tooltip: 'Sair',
              onPressed: () => context.read<AuthController>().logout(),
              icon: const Icon(Icons.logout_rounded, color: Colors.white),
            ),
          ],
          children: [?loadingOrError(v, error, reload), if (v != null) ..._content(context, v.$1, v.$2)],
        );
      },
    );
  }

  List<Widget> _content(BuildContext context, Set<AdminArea> areas, AdminSummary s) {
    void open(String slug) => context.push('/admin/$slug');
    final ops = areas.contains(AdminArea.operacao);
    final alerts = <(String, String, IconData)>[
      if (ops && s['markets_pending'] > 0)
        ('${s['markets_pending']} mercado(s) aguardando aprovação', 'mercados', Icons.storefront_rounded),
      if (ops && s['couriers_pending'] > 0)
        ('${s['couriers_pending']} entregador(es) para analisar', 'entregadores', Icons.badge_rounded),
      if (ops && s['occurrences_open'] > 0)
        ('${s['occurrences_open']} ocorrência(s) aberta(s)', 'ocorrencias', Icons.support_agent_rounded),
    ];
    return [
      for (final (text, slug, icon) in alerts)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Material(
            color: amberBg,
            borderRadius: BorderRadius.circular(14),
            child: ListTile(
              leading: Icon(icon, color: amberFg),
              title: Text(
                text,
                style: const TextStyle(color: amberFg, fontWeight: FontWeight.w700),
              ),
              trailing: const Icon(Icons.chevron_right_rounded, color: amberFg),
              onTap: () => open(slug),
            ),
          ),
        ),
      const SectionTitle('Hoje'),
      KpiGrid(
        children: [
          KpiCard(icon: Icons.receipt_long_rounded, label: 'Pedidos pagos hoje', value: '${s['orders_today']}'),
          KpiCard(
            icon: Icons.payments_rounded,
            label: 'Vendas hoje',
            value: money(s['gmv_today']),
            color: AppColors.success,
          ),
          KpiCard(
            icon: Icons.local_shipping_rounded,
            label: 'Pedidos em andamento',
            value: '${s['active_orders']}',
            onTap: ops ? () => open('entregas') : null,
          ),
          KpiCard(
            icon: Icons.delivery_dining_rounded,
            label: 'Entregadores disponíveis',
            value: '${s['couriers_online']} de ${s['couriers_approved']}',
            color: AppColors.roleCourier,
          ),
          KpiCard(
            icon: Icons.people_alt_rounded,
            label: 'Clientes (${s['new_customers']} novos hoje)',
            value: '${s['customers']}',
            color: AppColors.info,
          ),
          KpiCard(
            icon: Icons.storefront_rounded,
            label: 'Mercados ativos',
            value: '${s['markets_active']}',
            color: AppColors.roleMarket,
          ),
          KpiCard(
            icon: Icons.support_agent_rounded,
            label: 'Ocorrências abertas',
            value: '${s['occurrences_open']}',
            color: AppColors.discount,
            onTap: ops ? () => open('ocorrencias') : null,
          ),
          KpiCard(
            icon: Icons.remove_shopping_cart_rounded,
            label: 'Produtos sem estoque',
            value: '${s['products_out']}',
            color: amberFg,
            onTap: ops ? () => open('produtos') : null,
          ),
        ],
      ),
      if (s.byDay.isNotEmpty) ...[
        const SectionTitle('Vendas dos últimos 7 dias'),
        PanelCard(
          child: MiniBars(
            values: [for (final d in s.byDay) d.gmvCents],
            labels: [for (final d in s.byDay) '${d.day.day}/${d.day.month}'],
          ),
        ),
      ],
      const SectionTitle('Gestão'),
      LayoutBuilder(
        builder: (context, c) {
          final cols = c.maxWidth >= 900 ? 3 : (c.maxWidth >= 520 ? 2 : 1);
          final w = (c.maxWidth - 10 * (cols - 1)) / cols;
          return Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final sec in adminSections.where((x) => areas.contains(x.area)))
                SizedBox(
                  width: w,
                  child: PanelCard(
                    onTap: () => open(sec.slug),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: AppColors.primary.withValues(alpha: .1),
                          child: Icon(sec.icon, color: AppColors.primary),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(sec.title, style: strong),
                              Text(sec.subtitle, style: muted),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    ];
  }
}
