import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/admin.dart';
import '../../data/models/occurrence.dart';
import '../../data/repositories/admin_repository.dart';
import '../market/market_widgets.dart';
import 'admin_widgets.dart';

Pill occurrencePill(String s) => switch (s) {
  'resolvida' => okPill(occurrenceStatusLabel(s)),
  'recusada' => mutedPill(occurrenceStatusLabel(s), Icons.do_not_disturb_rounded),
  'em_analise' => warnPill(occurrenceStatusLabel(s), Icons.manage_search_rounded),
  _ => infoPill(occurrenceStatusLabel(s), Icons.fiber_new_rounded),
};

class AdminOccurrencesScreen extends StatelessWidget {
  const AdminOccurrencesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminOccurrence>(
      title: 'Ocorrências',
      subtitle: 'Abertas primeiro',
      filters: const [
        (null, 'Fila'),
        ('aberta', 'Abertas'),
        ('em_analise', 'Em análise'),
        ('resolvida', 'Resolvidas'),
        ('recusada', 'Sem reembolso'),
      ],
      emptyTitle: 'Nenhuma ocorrência',
      emptyIcon: Icons.support_agent_rounded,
      load: (f, _) => repo.occurrences(status: f),
      itemBuilder: (context, o, reload) => PanelCard(
        onTap: () async {
          await context.push('/admin/ocorrencias/${o.summary.id}');
          reload();
        },
        child: Row(
          children: [
            Icon(o.summary.type.icon, color: AppColors.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(o.summary.type.label, style: strong),
                  Text(
                    [
                      o.customerName,
                      ?o.marketName,
                      'pedido ${shortCode(o.summary.orderId)}',
                      timeAgo(o.summary.createdAt),
                    ].join(' · '),
                    style: muted,
                  ),
                  Text(
                    [
                      if (o.summary.requestedCents > 0) 'pedido de ${money(o.summary.requestedCents)}',
                      if (o.summary.refundCents > 0) 'reembolsado ${money(o.summary.refundCents)}',
                      if (o.evidenceCount > 0) '${o.evidenceCount} foto(s)',
                      if (o.summary.auto) 'automática',
                    ].join(' · '),
                    style: muted,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            occurrencePill(o.summary.status),
          ],
        ),
      ),
    );
  }
}

class AdminOccurrenceScreen extends StatelessWidget {
  const AdminOccurrenceScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return Loader<AdminOccurrenceDetail>(
      load: () => repo.occurrence(id),
      builder: (context, v, error, reload) {
        final d = v?.detail;
        final s = d?.summary;
        final open = s != null && (s.status == 'aberta' || s.status == 'em_analise');
        return PanelPage(
          title: s?.type.label ?? 'Ocorrência',
          subtitle: s == null ? null : 'Pedido ${shortCode(s.orderId)} · ${occurrenceStatusLabel(s.status)}',
          showBack: true,
          maxWidth: 820,
          onRefresh: reload,
          bottom: !open
              ? null
              : adminBottomBar(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
                    child: Row(
                      children: [
                        if (s.status == 'aberta') ...[
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () async {
                                if (await runAction(context, () => repo.analyze(id), 'Ocorrência em análise.')) {
                                  await reload();
                                }
                              },
                              child: const Text('Assumir análise'),
                            ),
                          ),
                          const SizedBox(width: 10),
                        ],
                        Expanded(
                          child: FilledButton(
                            onPressed: () async {
                              final done = await showDialog<bool>(
                                context: context,
                                builder: (_) => _DecideDialog(repo: repo, detail: v!),
                              );
                              if (done == true) await reload();
                            },
                            child: const Text('Decidir'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
          children: [
            ?loadingOrError(v, error, reload),
            if (v != null && d != null && s != null) ...[
              PanelCard(
                child: Column(
                  children: [
                    Info('Cliente', v.customerName),
                    Info('Mercado', d.marketName),
                    Info('Aberta em', dateTime(s.createdAt)),
                    Info('Total do pedido', money(v.orderTotalCents)),
                    Info('Valor pedido', s.requestedCents > 0 ? money(s.requestedCents) : null),
                    Info('Reembolsado', s.refundCents > 0 ? money(s.refundCents) : null),
                    if (d.description != null) Info('Relato', d.description),
                    if (d.adminNote != null) Info('Nota da decisão', d.adminNote),
                  ],
                ),
              ),
              if (d.items.isNotEmpty) ...[
                const SectionTitle('Produtos'),
                PanelCard(
                  child: Column(
                    children: [
                      for (final i in d.items)
                        Row(
                          children: [
                            Expanded(child: Text('${i.quantity}× ${i.name}')),
                            Text(money(i.unitPriceCents * i.quantity), style: strong),
                          ],
                        ),
                    ],
                  ),
                ),
              ],
              if (d.evidenceIds.isNotEmpty) ...[
                const SectionTitle('Fotos enviadas'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [for (final e in d.evidenceIds) _Evidence(load: () => repo.evidence(id, e))],
                ),
              ],
              const SectionTitle('Histórico'),
              for (final e in d.events)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: PanelCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${e.role} · ${e.kind.replaceAll('_', ' ')}', style: strong),
                        if (e.message != null) Text(e.message!),
                        Text(dateTime(e.createdAt), style: muted),
                      ],
                    ),
                  ),
                ),
            ],
          ],
        );
      },
    );
  }
}

class _Evidence extends StatelessWidget {
  const _Evidence({required this.load});

  final Future<Uint8List> Function() load;

  @override
  Widget build(BuildContext context) => FutureBuilder<Uint8List>(
    future: load(),
    builder: (context, snap) => ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 120,
        height: 120,
        color: AppColors.line,
        child: snap.hasData
            ? InkWell(
                onTap: () => showDialog<void>(
                  context: context,
                  builder: (_) => Dialog(child: InteractiveViewer(child: Image.memory(snap.data!))),
                ),
                child: Image.memory(snap.data!, fit: BoxFit.cover),
              )
            : Center(
                child: snap.hasError
                    ? Tooltip(message: friendlyError(snap.error!), child: const Icon(Icons.broken_image_rounded))
                    : const CircularProgressIndicator(),
              ),
      ),
    ),
  );
}

class _DecideDialog extends StatefulWidget {
  const _DecideDialog({required this.repo, required this.detail});

  final AdminRepository repo;
  final AdminOccurrenceDetail detail;

  @override
  State<_DecideDialog> createState() => _DecideDialogState();
}

class _DecideDialogState extends State<_DecideDialog> {
  var _resolution = 'reembolso_parcial';
  late final _value = TextEditingController(text: moneyInput(widget.detail.detail.summary.requestedCents));
  final _note = TextEditingController();
  var _busy = false;

  Future<void> _send() async {
    int? cents;
    if (_resolution == 'reembolso_parcial') {
      cents = parseMoney(_value.text);
      if (cents == null || cents <= 0 || cents > widget.detail.orderTotalCents) {
        notify(context, 'Valor de reembolso inválido.');
        return;
      }
    }
    setState(() => _busy = true);
    final ok = await runAction(
      context,
      () => widget.repo.decide(widget.detail.detail.summary.id, _resolution, _note.text.trim(), cents: cents),
      'Decisão registrada. O cliente será avisado.',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Decisão'),
    content: SingleChildScrollView(
      child: RadioGroup<String>(
        groupValue: _resolution,
        onChanged: (v) => setState(() => _resolution = v!),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            RadioListTile(
              value: 'reembolso_parcial',
              title: const Text('Reembolso parcial'),
              contentPadding: EdgeInsets.zero,
            ),
            if (_resolution == 'reembolso_parcial')
              TextField(
                controller: _value,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Valor (R\$)'),
              ),
            RadioListTile(
              value: 'reembolso_total',
              title: Text('Reembolso total (${money(widget.detail.orderTotalCents)})'),
              contentPadding: EdgeInsets.zero,
            ),
            const RadioListTile(value: 'sem_reembolso', title: Text('Sem reembolso'), contentPadding: EdgeInsets.zero),
            TextField(
              controller: _note,
              maxLines: 3,
              minLines: 2,
              maxLength: 1000,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Nota para o cliente (obrigatória)'),
            ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Voltar')),
      FilledButton(onPressed: _busy || _note.text.trim().length < 3 ? null : _send, child: const Text('Confirmar')),
    ],
  );
}
