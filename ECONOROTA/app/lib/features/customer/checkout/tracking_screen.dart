import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/errors.dart';
import '../../../data/models/order.dart';
import '../../../data/repositories/orders_repository.dart';
import '../../../widgets/app_image.dart';
import '../../../widgets/brand_header.dart';
import '../../../widgets/delivery_code_card.dart';
import '../../../widgets/delivery_map.dart';
import '../widgets/common.dart';
import 'checkout_widgets.dart';

/// Fase 10 — Rastreamento: mapa, entregador, rota, status por mercado (1, 2, 3) e cliente, farol e previsão.
class TrackingScreen extends StatefulWidget {
  const TrackingScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  OrderTracking? _t;
  String? _error;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 8), (_) {
      if (_t?.finished != true) _load();
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final t = await context.read<OrdersRepository>().tracking(widget.orderId);
      if (mounted) {
        setState(() {
          _t = t;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && _t == null) setState(() => _error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _t;
    return BrandScaffold(
      showBack: true,
      title: t == null ? 'Acompanhar pedido' : 'Pedido ${t.code}',
      subtitle: t == null ? null : _headline(t),
      onRefresh: _load,
      slivers: [
        SliverToBoxAdapter(child: CheckoutSteps(current: 5)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            child: _error != null && t == null
                ? RetryBox(message: _error!, onRetry: _load)
                : t == null
                ? const Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(child: CircularProgressIndicator()),
                  )
                : _Body(t: t),
          ),
        ),
      ],
    );
  }

  static String _headline(OrderTracking t) => switch (t.status) {
    'cancelado' => 'Pedido cancelado',
    'entregue' => 'Pedido entregue. Bom proveito!',
    'em_rota' when t.courierStatus == 'chegou' => 'O entregador chegou!',
    'em_rota' => 'A caminho de você',
    'pronto_coleta' => 'Pronto para o entregador retirar',
    'em_separacao' => 'Mercados separando seus produtos',
    'pago' => 'Pagamento aprovado',
    _ => 'Acompanhe sua entrega',
  };
}

class _Body extends StatelessWidget {
  const _Body({required this.t});

  final OrderTracking t;

  @override
  Widget build(BuildContext context) {
    final courierPos = t.courier?.lat == null ? null : (lat: t.courier!.lat!, lng: t.courier!.lng!);
    final map = DeliveryMap(
      stops: [for (final s in t.stops) (lat: s.lat, lng: s.lng, number: s.sequence, done: s.picked, name: s.name)],
      home: (lat: t.customerLat, lng: t.customerLng),
      courier: courierPos,
    );
    final side = <Widget>[
      _Eta(t: t),
      const SizedBox(height: 12),
      _Progress(t: t),
      const SizedBox(height: 12),
      for (final s in t.stops) ...[_StopCard(s: s, t: t), const SizedBox(height: 10)],
      _HomeCard(t: t),
      if (t.courier != null) ...[const SizedBox(height: 10), _CourierCard(t: t)],
      if (t.deliveryCode != null && !t.finished) ...[
        const SizedBox(height: 12),
        DeliveryCodeCard(code: t.deliveryCode!),
      ],
      if (t.status == 'entregue') ...[
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => context.push('/avaliar/${t.id}'),
          icon: const Icon(Icons.star_rounded),
          label: const Text('Avaliar mercado e entregador'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        ),
      ],
      if (t.status != 'aguardando_pagamento' && t.status != 'cancelado') ...[
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => context.push('/cliente/pedido/${t.id}/problema'),
          icon: const Icon(Icons.support_agent_rounded),
          label: const Text('Relatar um problema'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), foregroundColor: AppColors.primary),
        ),
      ],
      if (t.demo)
        const Padding(
          padding: EdgeInsets.only(top: 10),
          child: Text(
            'Demonstração: o trajeto do entregador é simulado.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
          ),
        ),
    ];
    return LayoutBuilder(
      builder: (_, b) => b.maxWidth >= 760
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 5,
                  child: DeliveryMap(stops: map.stops, home: map.home, courier: map.courier, height: 520),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 4,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: side),
                ),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (!t.finished) ...[map, const SizedBox(height: 12)],
                ...side,
              ],
            ),
    );
  }
}

/// Previsão de chegada + farol (no prazo / atrasando / atrasado).
class _Eta extends StatelessWidget {
  const _Eta({required this.t});

  final OrderTracking t;

  String _hhmm(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (t.light) {
      TrafficLight.green => (AppColors.success, 'No prazo'),
      TrafficLight.yellow => (
        const Color(0xFFD97706),
        t.lightReason == 'sinal_fraco' ? 'Sinal do entregador fraco' : 'Pode atrasar um pouco',
      ),
      TrafficLight.red => (AppColors.discount, t.lightReason == 'sem_sinal' ? 'Sem sinal do entregador' : 'Atrasado'),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(gradient: AppColors.headerGradient, borderRadius: BorderRadius.circular(18)),
      child: Row(
        children: [
          const Icon(Icons.schedule_rounded, color: AppColors.accent, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    t.status == 'entregue'
                        ? 'Entregue'
                        : t.status == 'cancelado'
                        ? 'Cancelado'
                        : t.courierStatus == 'chegou'
                        ? 'Chegou!'
                        : 'Chega em ~${t.etaMin} min',
                    style: const TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w800,
                      fontSize: 22,
                      color: Colors.white,
                    ),
                  ),
                ),
                Text(
                  [
                    if (t.arrivalAt != null && !t.finished) 'por volta das ${_hhmm(t.arrivalAt!)}',
                    'rota de ${t.totalKm.toStringAsFixed(1).replaceAll('.', ',')} km',
                  ].join(' · '),
                  style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                ),
              ],
            ),
          ),
          if (!t.finished)
            Semantics(
              label: 'Farol: $label',
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.circle, size: 12, color: color),
                    const SizedBox(width: 6),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 110),
                      child: Text(
                        label,
                        style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Mercado 1 → Mercado 2 → Mercado 3 → Cliente.
class _Progress extends StatelessWidget {
  const _Progress({required this.t});

  final OrderTracking t;

  @override
  Widget build(BuildContext context) {
    final nodes = [
      for (final s in t.stops) (label: 'Mercado ${s.sequence}', done: s.picked, icon: Icons.storefront_rounded),
      (label: 'Você', done: t.status == 'entregue', icon: Icons.home_rounded),
    ];
    final current = nodes.indexWhere((n) => !n.done);
    return Row(
      children: [
        for (final (i, n) in nodes.indexed) ...[
          if (i > 0)
            Expanded(
              child: Container(height: 3, color: i <= current || current < 0 ? AppColors.success : AppColors.line),
            ),
          Column(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: n.done ? AppColors.success : (i == current ? AppColors.primary : AppColors.line),
                child: Icon(
                  n.done ? Icons.check_rounded : n.icon,
                  size: 17,
                  color: n.done || i == current ? Colors.white : AppColors.inkMuted,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                n.label,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: i == current ? FontWeight.w800 : FontWeight.w500,
                  color: i == current ? AppColors.primary : AppColors.inkMuted,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _StopCard extends StatelessWidget {
  const _StopCard({required this.s, required this.t});

  final TrackStop s;
  final OrderTracking t;

  @override
  Widget build(BuildContext context) {
    final isNext = t.nextStop?.id == s.id && t.courier != null;
    final (text, fg, bg) = s.picked
        ? ('Concluído', AppColors.success, AppColors.successSoft)
        : isNext
        ? (
            s.courierHere ? 'Entregador no mercado' : 'Entregador a caminho',
            const Color(0xFF92400E),
            const Color(0xFFFEF3C7),
          )
        : ('Aguardando', AppColors.inkMuted, AppColors.sheet);
    String hhmm(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    Widget check(bool ok, String label) => Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(
            ok ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            size: 18,
            color: ok ? AppColors.success : AppColors.inkMuted,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(label, style: TextStyle(color: ok ? AppColors.ink : AppColors.inkMuted, fontSize: 13)),
          ),
        ],
      ),
    );
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isNext ? const Color(0xFFF59E0B) : AppColors.line, width: isNext ? 1.5 : 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 48,
              height: 48,
              child: AppImage(
                s.imageUrl,
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
                  '${s.sequence}. ${s.name}',
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                ),
                check(s.status != 'novo', s.status == 'novo' ? 'Pedido recebido' : 'Separando seus produtos'),
                check(s.ready, 'Pedido pronto'),
                check(
                  s.picked,
                  s.picked && s.pickedAt != null ? 'Retirado às ${hhmm(s.pickedAt!)}' : 'Retirada pelo entregador',
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
            child: Text(
              text,
              style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 11.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeCard extends StatelessWidget {
  const _HomeCard({required this.t});

  final OrderTracking t;

  @override
  Widget build(BuildContext context) {
    final (label, ok) = switch (t.status) {
      'entregue' => ('Entregue', true),
      'em_rota' when t.courierStatus == 'chegou' => ('O entregador está na sua porta', false),
      'em_rota' => ('A caminho de você', false),
      _ => ('Aguardando a coleta nos mercados', false),
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: ok ? AppColors.success : AppColors.ink,
            child: Icon(ok ? Icons.check_rounded : Icons.home_rounded, color: Colors.white),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Sua casa',
                  style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                ),
                Text(label, style: const TextStyle(color: AppColors.inkMuted, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CourierCard extends StatelessWidget {
  const _CourierCard({required this.t});

  final OrderTracking t;

  @override
  Widget build(BuildContext context) {
    final c = t.courier!;
    final next = t.nextStop;
    final doing = t.status == 'entregue'
        ? 'Entrega concluída'
        : t.courierStatus == 'chegou'
        ? 'Na sua porta'
        : next == null
        ? 'A caminho de você'
        : 'A caminho de ${next.name}';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.brandSoft, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.primary,
            child: Icon(Icons.delivery_dining_rounded, color: AppColors.accent, size: 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${c.firstName} · seu entregador',
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                ),
                Text(
                  [c.vehicle, if (c.plate != null) 'placa ${c.plate}'].where((s) => s.isNotEmpty).join(' · '),
                  style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                ),
                const SizedBox(height: 2),
                Text(
                  doing,
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
