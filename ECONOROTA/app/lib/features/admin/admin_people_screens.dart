import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/admin.dart';
import '../../data/repositories/admin_repository.dart';
import '../market/market_widgets.dart';
import 'admin_widgets.dart';

class AdminCustomersScreen extends StatelessWidget {
  const AdminCustomersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminCustomer>(
      title: 'Clientes',
      search: true,
      searchHint: 'Nome, e-mail ou telefone',
      filters: const [(null, 'Todos'), ('ativo', 'Ativos'), ('bloqueado', 'Bloqueados')],
      emptyTitle: 'Nenhum cliente encontrado',
      emptyIcon: Icons.people_outline_rounded,
      load: (f, q) => repo.customers(q: q, status: f),
      itemBuilder: (context, c, reload) => PanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(c.name, style: strong)),
                c.blocked ? badPill('Bloqueado') : okPill('Ativo'),
              ],
            ),
            Text([c.email, ?c.phone].join(' · '), style: muted),
            const SizedBox(height: 6),
            Wrap(
              spacing: 14,
              runSpacing: 4,
              children: [
                Text('${c.orders} pedidos', style: muted),
                Text('${money(c.spentCents)} em compras', style: muted),
                if (c.rating > 0) Text('Nota ${c.rating.toStringAsFixed(1).replaceAll('.', ',')} ★', style: muted),
                if (c.occurrences > 0) Text('${c.occurrences} ocorrência(s)', style: muted),
                Text('Desde ${date(c.createdAt)}', style: muted),
              ],
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                style: TextButton.styleFrom(foregroundColor: c.blocked ? AppColors.success : AppColors.discount),
                onPressed: () async {
                  String? reason;
                  if (!c.blocked) {
                    reason = await askText(
                      context,
                      title: 'Bloquear ${c.name}?',
                      label: 'Motivo (fica no registro)',
                      confirm: 'Bloquear',
                      danger: true,
                    );
                    if (reason == null) return;
                  }
                  if (!context.mounted) return;
                  final ok = await runAction(
                    context,
                    () => repo.setUserBlocked(c.id, !c.blocked, reason: reason),
                    c.blocked ? 'Conta desbloqueada.' : 'Conta bloqueada e sessões encerradas.',
                  );
                  if (ok) reload();
                },
                icon: Icon(c.blocked ? Icons.lock_open_rounded : Icons.block_rounded),
                label: Text(c.blocked ? 'Desbloquear' : 'Bloquear'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Pill marketStatusPill(String s) => switch (s) {
  'ativo' => okPill('Ativo'),
  'suspenso' => badPill('Suspenso'),
  _ => warnPill('Aguardando aprovação'),
};

class AdminMarketsScreen extends StatelessWidget {
  const AdminMarketsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminMarket>(
      title: 'Mercados',
      search: true,
      searchHint: 'Nome ou cidade',
      filters: const [(null, 'Todos'), ('pendente', 'Aguardando'), ('ativo', 'Ativos'), ('suspenso', 'Suspensos')],
      emptyTitle: 'Nenhum mercado',
      emptyIcon: Icons.storefront_outlined,
      load: (f, q) => repo.markets(status: f, q: q),
      itemBuilder: (context, m, reload) {
        Future<void> set(String status) async {
          String? reason;
          if (status == 'suspenso') {
            reason = await askText(
              context,
              title: 'Suspender ${m.name}?',
              label: 'Motivo (o mercado sai das buscas)',
              confirm: 'Suspender',
              danger: true,
            );
            if (reason == null) return;
          }
          if (!context.mounted) return;
          final ok = await runAction(
            context,
            () => repo.setMarketStatus(m.id, status, reason: reason),
            status == 'ativo' ? '${m.name} está ativo.' : '${m.name} foi suspenso.',
          );
          if (ok) reload();
        }

        return PanelCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(m.name, style: strong)),
                  marketStatusPill(m.status),
                ],
              ),
              Text([?m.district, ?m.city].join(' · '), style: muted),
              Text('Responsável: ${m.ownerName} · ${m.ownerEmail}', style: muted),
              const SizedBox(height: 6),
              Wrap(
                spacing: 14,
                runSpacing: 4,
                children: [
                  Text('${m.products} produtos', style: muted),
                  Text('${m.orders30d} pedidos em 30 dias', style: muted),
                  Text('${money(m.sales30dCents)} em vendas', style: muted),
                  if (m.ratingCount > 0)
                    Text('${m.rating.toStringAsFixed(1).replaceAll('.', ',')} ★ (${m.ratingCount})', style: muted),
                  if (m.status == 'ativo') Text(m.isOpen ? 'Loja aberta' : 'Loja fechada', style: muted),
                ],
              ),
              Align(
                alignment: Alignment.centerRight,
                child: Wrap(
                  spacing: 8,
                  children: [
                    if (m.status != 'ativo')
                      FilledButton.icon(
                        onPressed: () => set('ativo'),
                        icon: const Icon(Icons.check_rounded),
                        label: Text(m.status == 'pendente' ? 'Aprovar' : 'Reativar'),
                      ),
                    if (m.status != 'suspenso')
                      TextButton.icon(
                        style: TextButton.styleFrom(foregroundColor: AppColors.discount),
                        onPressed: () => set('suspenso'),
                        icon: const Icon(Icons.pause_circle_rounded),
                        label: const Text('Suspender'),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

Pill courierPill(AdminCourier c) => switch (c.status) {
  'aprovado' => c.isOnline ? okPill('Disponível', Icons.circle) : infoPill('Aprovado', Icons.verified_rounded),
  'bloqueado' => badPill('Bloqueado'),
  _ => c.inReview ? warnPill('Em análise') : mutedPill('Incompleto', Icons.edit_note_rounded),
};

class AdminCouriersScreen extends StatelessWidget {
  const AdminCouriersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminCourier>(
      title: 'Entregadores',
      filters: const [
        ('analise', 'Em análise'),
        ('aprovado', 'Aprovados'),
        ('online', 'Disponíveis'),
        ('bloqueado', 'Bloqueados'),
        ('incompleto', 'Incompletos'),
        (null, 'Todos'),
      ],
      emptyTitle: 'Nenhum entregador nesta lista',
      emptyIcon: Icons.two_wheeler_rounded,
      load: (f, _) => repo.couriers(filter: f),
      itemBuilder: (context, c, reload) => PanelCard(
        onTap: () async {
          await context.push('/admin/entregadores/${c.id}');
          reload();
        },
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: AppColors.roleCourier.withValues(alpha: .12),
              child: Icon(
                c.vehicleType == 'bicicleta' ? Icons.pedal_bike_rounded : Icons.two_wheeler_rounded,
                color: AppColors.roleCourier,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.name, style: strong),
                  Text(
                    [
                      c.vehicleLabel,
                      ?c.vehiclePlate,
                      if (c.deliveries > 0) '${c.deliveries} entregas',
                      if (c.ratingCount > 0) '${c.rating.toStringAsFixed(1).replaceAll('.', ',')} ★',
                      if (c.inReview) 'enviado ${timeAgo(c.submittedAt!)}',
                    ].join(' · '),
                    style: muted,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            courierPill(c),
          ],
        ),
      ),
    );
  }
}

/// Ficha do entregador: dados, documentos (CNH/CRLV) e decisão.
class AdminCourierScreen extends StatelessWidget {
  const AdminCourierScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return Loader<AdminCourier>(
      load: () => repo.courier(id),
      builder: (context, c, error, reload) {
        Future<void> decide(String decision, String success, {bool note = false}) async {
          String? text;
          if (note) {
            text = await askText(
              context,
              title: decision == 'recusar' ? 'Pedir correção do cadastro' : 'Bloquear entregador',
              label: 'Explique o motivo para o entregador',
              confirm: decision == 'recusar' ? 'Enviar' : 'Bloquear',
              danger: decision == 'bloquear',
            );
            if (text == null) return;
          }
          if (!context.mounted) return;
          if (await runAction(context, () => repo.decideCourier(id, decision, note: text), success)) await reload();
        }

        return PanelPage(
          title: c?.name ?? 'Entregador',
          subtitle: c?.statusLabel,
          showBack: true,
          maxWidth: 820,
          onRefresh: reload,
          bottom: c == null
              ? null
              : adminBottomBar(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
                    child: Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (c.inReview) ...[
                          OutlinedButton(
                            onPressed: () => decide('recusar', 'Pedido de correção enviado.', note: true),
                            child: const Text('Pedir correção'),
                          ),
                          FilledButton.icon(
                            style: FilledButton.styleFrom(backgroundColor: AppColors.success),
                            onPressed: () => decide('aprovar', 'Entregador aprovado.'),
                            icon: const Icon(Icons.verified_rounded),
                            label: const Text('Aprovar cadastro'),
                          ),
                        ],
                        if (c.status == 'aprovado')
                          TextButton.icon(
                            style: TextButton.styleFrom(foregroundColor: AppColors.discount),
                            onPressed: () => decide('bloquear', 'Entregador bloqueado.', note: true),
                            icon: const Icon(Icons.block_rounded),
                            label: const Text('Bloquear'),
                          ),
                        if (c.status == 'bloqueado')
                          FilledButton(
                            onPressed: () => decide('desbloquear', 'Entregador desbloqueado.'),
                            child: const Text('Desbloquear'),
                          ),
                      ],
                    ),
                  ),
                ),
          children: [
            ?loadingOrError(c, error, reload),
            if (c != null) ...[
              if (c.reviewNote != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: PanelCard(child: Text('Última nota da análise: ${c.reviewNote}', style: muted)),
                ),
              const SectionTitle('Dados pessoais'),
              PanelCard(
                child: Column(
                  children: [
                    Info('E-mail', c.email),
                    Info('Telefone', c.phone),
                    Info('CPF', c.cpf),
                    Info('Nascimento', c.birthDate == null ? null : date(DateTime.parse(c.birthDate!))),
                    Info('Chave Pix', c.pixKey),
                    Info('Raio de atuação', '${c.workRadiusKm} km'),
                  ],
                ),
              ),
              const SectionTitle('Veículo'),
              PanelCard(
                child: Column(
                  children: [
                    Info('Tipo', c.vehicleLabel),
                    if (c.needsLicense) ...[
                      Info('Placa', c.vehiclePlate),
                      Info('Modelo / cor', [?c.vehicleModel, ?c.vehicleColor].join(' · ')),
                      Info('CNH', c.cnhNumber),
                    ],
                  ],
                ),
              ),
              const SectionTitle('Documentos'),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _DocTile(
                    label: c.needsLicense ? 'CNH' : 'Documento com foto',
                    sent: c.hasDocument,
                    load: () => repo.courierDocument(id, 'documento'),
                  ),
                  if (c.needsLicense)
                    _DocTile(
                      label: 'Documento do veículo (CRLV)',
                      sent: c.hasVehicleDoc,
                      load: () => repo.courierDocument(id, 'crlv'),
                    ),
                ],
              ),
              if (c.status == 'aprovado') ...[
                const SectionTitle('Desempenho'),
                PanelCard(
                  child: Column(
                    children: [
                      Info('Entregas', '${c.deliveries}'),
                      Info(
                        'Nota',
                        c.ratingCount == 0
                            ? 'Sem avaliações'
                            : '${c.rating.toStringAsFixed(1).replaceAll('.', ',')} ★ (${c.ratingCount})',
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ],
        );
      },
    );
  }
}

class _DocTile extends StatelessWidget {
  const _DocTile({required this.label, required this.sent, required this.load});

  final String label;
  final bool sent;
  final Future<Uint8List> Function() load;

  Future<void> _open(BuildContext context) => showDialog<void>(
    context: context,
    builder: (c) => Dialog(
      child: FutureBuilder<Uint8List>(
        future: load(),
        builder: (c, snap) => Padding(
          padding: const EdgeInsets.all(12),
          child: snap.hasError
              ? Text(friendlyError(snap.error!))
              : !snap.hasData
              ? const SizedBox(height: 160, child: Center(child: CircularProgressIndicator()))
              : InteractiveViewer(child: Image.memory(snap.data!, fit: BoxFit.contain)),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => SizedBox(
    width: (MediaQuery.sizeOf(context).width - 32).clamp(200, 320).toDouble(),
    child: PanelCard(
      onTap: sent ? () => _open(context) : null,
      child: Row(
        children: [
          Icon(
            sent ? Icons.badge_rounded : Icons.hide_image_rounded,
            color: sent ? AppColors.primary : AppColors.inkMuted,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: strong),
                Text(sent ? 'Toque para ver' : 'Não enviado', style: muted),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
