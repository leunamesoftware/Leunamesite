import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../data/models/admin.dart';
import '../../data/models/occurrence.dart';
import '../../data/repositories/admin_repository.dart';
import '../market/market_widgets.dart';
import 'admin_widgets.dart';

Pill adminOrderPill(String status) {
  final label = orderStatusLabel(status);
  return switch (status) {
    'entregue' => okPill(label),
    'cancelado' => badPill(label, Icons.cancel_rounded),
    'aguardando_pagamento' => mutedPill(label, Icons.hourglass_top_rounded),
    'em_rota' => infoPill(label, Icons.delivery_dining_rounded),
    _ => warnPill(label, Icons.inventory_2_rounded),
  };
}

String _payMethod(String? m) => m == 'cartao' ? 'Cartão' : (m == 'pix' ? 'Pix' : '—');

class AdminOrdersScreen extends StatelessWidget {
  const AdminOrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminOrder>(
      title: 'Pedidos',
      search: true,
      searchHint: 'Código do pedido, cliente ou e-mail',
      filters: const [
        ('andamento', 'Em andamento'),
        ('pagamento', 'Aguardando pagamento'),
        ('entregues', 'Entregues'),
        ('cancelados', 'Cancelados'),
        (null, 'Todos'),
      ],
      emptyTitle: 'Nenhum pedido nesta lista',
      emptyIcon: Icons.receipt_long_outlined,
      load: (f, q) => repo.orders(group: f, q: q),
      itemBuilder: (context, o, reload) => PanelCard(
        onTap: () async {
          await context.push('/admin/pedidos/${o.id}');
          reload();
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('Pedido ${o.code} · ${money(o.totalCents)}', style: strong)),
                adminOrderPill(o.status),
              ],
            ),
            Text('${o.customerName} · ${o.markets}', style: muted, maxLines: 2, overflow: TextOverflow.ellipsis),
            Text(
              [
                dateTime(o.createdAt),
                _payMethod(o.paymentMethod),
                if (o.courierName != null) 'Entregador: ${o.courierName}',
              ].join(' · '),
              style: muted,
            ),
            if (o.openOccurrences > 0)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: badPill('${o.openOccurrences} ocorrência(s) aberta(s)', Icons.support_agent_rounded),
              ),
          ],
        ),
      ),
    );
  }
}

class AdminOrderScreen extends StatelessWidget {
  const AdminOrderScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return Loader<AdminOrderDetail>(
      load: () => repo.order(id),
      builder: (context, d, error, reload) => PanelPage(
        title: 'Pedido ${shortCode(id)}',
        subtitle: d == null ? null : orderStatusLabel(d.order.status),
        showBack: true,
        maxWidth: 860,
        onRefresh: reload,
        bottom: d == null || !d.cancellable
            ? null
            : adminBottomBar(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.discount,
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: () async {
                      final reason = await askText(
                        context,
                        title: 'Cancelar o pedido?',
                        label: 'Motivo (o cliente recebe o estorno integral se já pagou)',
                        confirm: 'Cancelar pedido',
                        danger: true,
                      );
                      if (reason == null || !context.mounted) return;
                      if (await runAction(context, () => repo.cancelOrder(id, reason), 'Pedido cancelado.')) {
                        await reload();
                      }
                    },
                    icon: const Icon(Icons.cancel_rounded),
                    label: const Text('Cancelar pedido'),
                  ),
                ),
              ),
        children: [
          ?loadingOrError(d, error, reload),
          if (d != null) ...[
            PanelCard(
              child: Column(
                children: [
                  Info('Situação', orderStatusLabel(d.order.status)),
                  Info('Criado em', dateTime(d.order.createdAt)),
                  Info('Pago em', d.paidAt == null ? null : dateTime(d.paidAt!)),
                  Info('Entregue em', d.deliveredAt == null ? null : dateTime(d.deliveredAt!)),
                  if (d.cancelReason != null) Info('Motivo do cancelamento', d.cancelReason),
                  Info('Produtos', money(d.subtotalCents)),
                  Info('Entrega', money(d.deliveryFeeCents)),
                  Info('Total', money(d.order.totalCents)),
                ],
              ),
            ),
            const SectionTitle('Cliente e entrega'),
            PanelCard(
              child: Column(
                children: [
                  Info('Cliente', d.order.customerName),
                  Info('Contato', [d.customerEmail, ?d.customerPhone].join(' · ')),
                  Info('Endereço', d.address),
                  Info('Entregador', d.order.courierName ?? 'Ainda não atribuído'),
                ],
              ),
            ),
            for (final m in d.markets) ...[
              SectionTitle('Mercado ${m.sequence} · ${m.name}'),
              PanelCard(
                child: Column(
                  children: [
                    for (final i in m.items)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            Icon(
                              i.checked == false ? Icons.remove_circle_rounded : Icons.check_circle_rounded,
                              size: 18,
                              color: i.checked == false
                                  ? AppColors.discount
                                  : (i.checked == true ? AppColors.success : AppColors.line),
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text('${i.quantity}× ${i.name}')),
                            Text(money(i.unitPriceCents * i.quantity), style: strong),
                          ],
                        ),
                      ),
                    const Divider(),
                    Info('Situação no mercado', m.status),
                    Info('Subtotal', money(m.subtotalCents)),
                  ],
                ),
              ),
            ],
            const SectionTitle('Pagamentos'),
            if (d.payments.isEmpty) const Text('Nenhuma cobrança gerada.', style: muted),
            for (final p in d.payments)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: PanelCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${_payMethod(p.method)} · ${money(p.amountCents)}'
                          '${p.refundedCents > 0 ? ' · devolvido ${money(p.refundedCents)}' : ''}\n${dateTime(p.createdAt)}',
                        ),
                      ),
                      paymentPill(p.status),
                    ],
                  ),
                ),
              ),
            if (d.occurrences.isNotEmpty) ...[
              const SectionTitle('Ocorrências'),
              for (final o in d.occurrences)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: PanelCard(
                    onTap: () => context.push('/admin/ocorrencias/${o.id}'),
                    child: Row(
                      children: [
                        Expanded(child: Text(OccurrenceType.of(o.type).label)),
                        Text(occurrenceStatusLabel(o.status), style: muted),
                      ],
                    ),
                  ),
                ),
            ],
          ],
        ],
      ),
    );
  }
}

Pill paymentPill(String status) => switch (status) {
  'aprovado' => okPill('Aprovado'),
  'pendente' => warnPill('Pendente'),
  'estornado' => infoPill('Estornado', Icons.undo_rounded),
  'recusado' => badPill('Recusado'),
  _ => mutedPill('Cancelado'),
};

class AdminDeliveriesScreen extends StatelessWidget {
  const AdminDeliveriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminDelivery>(
      title: 'Entregas em andamento',
      subtitle: 'Atualize para ver as posições mais recentes',
      emptyTitle: 'Nenhuma entrega em andamento',
      emptyIcon: Icons.delivery_dining_outlined,
      load: (_, _) => repo.deliveries(),
      itemBuilder: (context, d, _) => PanelCard(
        onTap: () => context.push('/admin/pedidos/${d.orderId}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('Pedido ${shortCode(d.orderId)}', style: strong)),
                if (d.late)
                  badPill('Atrasado', Icons.warning_rounded)
                else if (d.minutesLeft != null && d.minutesLeft! <= 10)
                  warnPill('${d.minutesLeft} min', Icons.timer_rounded)
                else if (d.minutesLeft != null)
                  okPill('${d.minutesLeft} min', Icons.timer_rounded),
              ],
            ),
            Text(orderStatusLabel(d.status), style: muted),
            Text(
              d.courierName == null
                  ? 'Aguardando entregador'
                  : 'Entregador: ${d.courierName} · coletas ${d.picked}/${d.stops}',
              style: muted,
            ),
            if (d.gpsStale == true)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: warnPill('Sem sinal do GPS há mais de 2 min', Icons.gps_off_rounded),
              ),
          ],
        ),
      ),
    );
  }
}

class AdminPaymentsScreen extends StatelessWidget {
  const AdminPaymentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    ({int receivedCents, int refundedCents, int pending})? totals;
    return StatefulBuilder(
      builder: (context, setState) => AdminListPage<AdminPayment>(
        title: 'Pagamentos',
        filters: const [
          (null, 'Todos'),
          ('aprovado', 'Aprovados'),
          ('pendente', 'Pendentes'),
          ('estornado', 'Estornados'),
          ('recusado', 'Recusados'),
        ],
        header: totals == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: KpiGrid(
                  children: [
                    KpiCard(
                      icon: Icons.payments_rounded,
                      label: 'Recebido (30 dias)',
                      value: money(totals!.receivedCents),
                    ),
                    KpiCard(
                      icon: Icons.undo_rounded,
                      label: 'Devolvido (30 dias)',
                      value: money(totals!.refundedCents),
                      color: AppColors.discount,
                    ),
                    KpiCard(
                      icon: Icons.hourglass_top_rounded,
                      label: 'Cobranças pendentes',
                      value: '${totals!.pending}',
                      color: amberFg,
                    ),
                  ],
                ),
              ),
        emptyTitle: 'Nenhum pagamento',
        emptyIcon: Icons.payments_outlined,
        load: (f, _) async {
          final r = await repo.payments(status: f);
          if (totals == null && context.mounted) {
            setState(
              () => totals = (receivedCents: r.receivedCents, refundedCents: r.refundedCents, pending: r.pending),
            );
          }
          return r.items;
        },
        itemBuilder: (context, p, _) => PanelCard(
          onTap: () => context.push('/admin/pedidos/${p.orderId}'),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${_payMethod(p.method)} · ${money(p.amountCents)}', style: strong),
                    Text('${p.customerName} · pedido ${shortCode(p.orderId)}', style: muted),
                    Text(
                      [
                        dateTime(p.createdAt),
                        if (p.refundedCents > 0) 'devolvido ${money(p.refundedCents)}',
                        ?p.failureReason,
                      ].join(' · '),
                      style: muted,
                    ),
                  ],
                ),
              ),
              paymentPill(p.status),
            ],
          ),
        ),
      ),
    );
  }
}
