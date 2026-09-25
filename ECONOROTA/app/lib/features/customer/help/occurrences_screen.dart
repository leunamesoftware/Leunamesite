import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/errors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/occurrence.dart';
import '../../../data/repositories/occurrences_repository.dart';
import '../../../widgets/brand_header.dart';
import '../widgets/common.dart';

Widget _statusPill(OccurrenceSummary o) {
  final (fg, bg) = switch (o.status) {
    'resolvida' => (AppColors.success, AppColors.successSoft),
    'recusada' => (AppColors.inkMuted, AppColors.sheet),
    'em_analise' => (const Color(0xFF92400E), const Color(0xFFFEF3C7)),
    _ => (AppColors.info, AppColors.infoSoft),
  };
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
    child: Text(
      occurrenceStatusLabel(o.status),
      style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 12),
    ),
  );
}

/// Histórico de ocorrências do cliente.
class OccurrencesScreen extends StatefulWidget {
  const OccurrencesScreen({super.key});

  @override
  State<OccurrencesScreen> createState() => _OccurrencesScreenState();
}

class _OccurrencesScreenState extends State<OccurrencesScreen> {
  List<OccurrenceSummary>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<OccurrencesRepository>().list();
      if (mounted) {
        setState(() {
          _items = r;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return BrandScaffold(
      showBack: true,
      title: 'Minhas ocorrências',
      subtitle: 'Problemas relatados e reembolsos',
      onRefresh: _load,
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            child: _error != null && items == null
                ? RetryBox(message: _error!, onRetry: _load)
                : items == null
                ? const Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(child: CircularProgressIndicator()),
                  )
                : items.isEmpty
                ? const LightEmpty(
                    icon: Icons.support_agent_rounded,
                    title: 'Nenhuma ocorrência',
                    message: 'Teve algum problema? Abra pelo pedido em "Meus pedidos".',
                  )
                : Column(
                    children: [
                      for (final o in items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Material(
                            color: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: const BorderSide(color: AppColors.line),
                            ),
                            child: ListTile(
                              onTap: () async {
                                await context.push('/cliente/ocorrencias/${o.id}');
                                _load();
                              },
                              leading: Icon(o.type.icon, color: AppColors.primary),
                              title: Text(
                                o.type.label,
                                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                              ),
                              subtitle: Text(
                                'Pedido ${o.orderCode} · ${dateTime(o.createdAt)}'
                                '${o.refundCents > 0 ? ' · reembolso ${money(o.refundCents)}' : ''}',
                                style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                              ),
                              trailing: _statusPill(o),
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

/// Detalhe: itens, histórico (linha do tempo), reembolso e mensagens.
class OccurrenceDetailScreen extends StatefulWidget {
  const OccurrenceDetailScreen({super.key, required this.id});

  final String id;

  @override
  State<OccurrenceDetailScreen> createState() => _OccurrenceDetailScreenState();
}

class _OccurrenceDetailScreenState extends State<OccurrenceDetailScreen> {
  OccurrenceDetail? _d;
  String? _error;
  final _msg = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _msg.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await context.read<OccurrencesRepository>().detail(widget.id);
      if (mounted) {
        setState(() {
          _d = d;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _send() async {
    final text = _msg.text.trim();
    if (text.length < 2) return;
    setState(() => _sending = true);
    try {
      await context.read<OccurrencesRepository>().message(widget.id, text);
      _msg.clear();
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _d;
    return BrandScaffold(
      showBack: true,
      title: d?.summary.type.label ?? 'Ocorrência',
      subtitle: d == null ? null : 'Pedido ${d.summary.orderCode}',
      onRefresh: _load,
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            child: _error != null && d == null
                ? RetryBox(message: _error!, onRetry: _load)
                : d == null
                ? const Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(child: CircularProgressIndicator()),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          _statusPill(d.summary),
                          const Spacer(),
                          Text(
                            dateTime(d.summary.createdAt),
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                          ),
                        ],
                      ),
                      if (d.summary.refundCents > 0) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.successSoft,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                            'Reembolso de ${money(d.summary.refundCents)} aprovado. Pix volta em instantes; no cartão, em até 2 faturas.',
                            style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                      if (d.items.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        const Text(
                          'Produtos',
                          style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                        ),
                        for (final i in d.items)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              '${i.quantity}× ${i.name} · ${money(i.unitPriceCents * i.quantity)}',
                              style: const TextStyle(color: AppColors.ink),
                            ),
                          ),
                      ],
                      if (d.description != null) ...[
                        const SizedBox(height: 14),
                        Text(d.description!, style: const TextStyle(color: AppColors.ink)),
                      ],
                      if (d.adminNote != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.brandSoft,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                            'Resposta do EconoRota: ${d.adminNote}',
                            style: const TextStyle(color: AppColors.ink),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      const Text(
                        'Histórico',
                        style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                      ),
                      for (final e in d.events)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          leading: Icon(
                            e.kind.startsWith('reembolso') ? Icons.payments_rounded : Icons.circle,
                            size: e.kind.startsWith('reembolso') ? 20 : 10,
                            color: AppColors.primary,
                          ),
                          title: Text(
                            e.label,
                            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                          ),
                          subtitle: Text(
                            [if (e.message != null) e.message!, dateTime(e.createdAt)].join('\n'),
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                          ),
                        ),
                      if (d.summary.open) ...[
                        const SizedBox(height: 8),
                        TextField(
                          controller: _msg,
                          maxLength: 1000,
                          decoration: InputDecoration(
                            labelText: 'Enviar mais detalhes',
                            filled: true,
                            fillColor: Colors.white,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                            suffixIcon: IconButton(
                              tooltip: 'Enviar',
                              onPressed: _sending ? null : _send,
                              icon: const Icon(Icons.send_rounded, color: AppColors.primary),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}
