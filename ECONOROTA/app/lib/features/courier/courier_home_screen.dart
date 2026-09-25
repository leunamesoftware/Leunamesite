import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/courier.dart';
import '../../data/repositories/courier_repository.dart';
import '../../state/auth_controller.dart';
import '../../state/courier_controller.dart';
import '../customer/widgets/common.dart';
import '../market/market_widgets.dart';
import '../shared/notifications_screen.dart';

/// Início do entregador: cadastro/aprovação, disponível/indisponível, região e pedidos disponíveis.
class CourierHomeScreen extends StatefulWidget {
  const CourierHomeScreen({super.key});

  @override
  State<CourierHomeScreen> createState() => _CourierHomeScreenState();
}

class _CourierHomeScreenState extends State<CourierHomeScreen> {
  CourierProfile? _p;
  ActiveDelivery? _active;
  List<AvailableDelivery> _offers = const [];
  String? _error;
  String? _accepting;
  Timer? _poll;

  CourierRepository get _repo => context.read<CourierRepository>();

  @override
  void initState() {
    super.initState();
    _load();
    // Pedidos novos aparecem sozinhos enquanto disponível.
    _poll = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted && context.read<CourierController>().online && _active == null) _loadOffers();
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final p = await _repo.profile();
      if (!mounted) return;
      context.read<CourierController>().sync(online: p.isOnline);
      final active = p.approved ? await _repo.current() : null;
      if (!mounted) return;
      setState(() {
        _p = p;
        _active = active;
        _error = null;
      });
      await _loadOffers();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _loadOffers() async {
    if (_p?.approved != true || !context.read<CourierController>().online) {
      if (mounted) setState(() => _offers = const []);
      return;
    }
    try {
      final o = await _repo.available();
      if (mounted) setState(() => _offers = o);
    } catch (_) {}
  }

  Future<void> _toggle(bool v) async {
    final ctrl = context.read<CourierController>();
    await ctrl.setOnline(v);
    if (!mounted) return;
    if (ctrl.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ctrl.error!)));
    }
    await _loadOffers();
  }

  Future<void> _accept(AvailableDelivery d) async {
    setState(() => _accepting = d.id);
    try {
      await _repo.accept(d.id);
      if (!mounted) return;
      context.go('/entregador/entrega');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
      await _load();
    } finally {
      if (mounted) setState(() => _accepting = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _p;
    final ctrl = context.watch<CourierController>();
    return PanelPage(
      title: 'Entregador',
      subtitle: context.select<AuthController, String?>((a) => a.user?.name),
      onRefresh: _load,
      maxWidth: 760,
      actions: [
        const NotificationBell(),
        IconButton(
          tooltip: 'Sair',
          onPressed: () {
            context.read<CourierController>().reset();
            context.read<AuthController>().logout();
          },
          icon: const Icon(Icons.logout_rounded, color: Colors.white),
        ),
      ],
      children: [
        if (_error != null && p == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (p == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (!p.approved)
          _Signup(
            p: p,
            onOpen: () async {
              await context.push('/entregador/cadastro');
              _load();
            },
          )
        else ...[
          PanelCard(
            child: Row(
              children: [
                Icon(Icons.circle, size: 14, color: ctrl.online ? AppColors.success : AppColors.inkMuted),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ctrl.online ? 'Disponível' : 'Indisponível',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.ink),
                      ),
                      Text(
                        ctrl.online
                            ? 'Recebendo pedidos em até ${p.workRadiusKm} km de você'
                            : 'Fique disponível para ver pedidos perto de você.',
                        style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: ctrl.online,
                  activeThumbColor: Colors.white,
                  activeTrackColor: AppColors.success,
                  onChanged: ctrl.busy ? null : _toggle,
                ),
              ],
            ),
          ),
          if (ctrl.online && ctrl.position != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  const Icon(Icons.my_location_rounded, size: 16, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Região atual: GPS ativo (${ctrl.position!.lat.toStringAsFixed(4)}, ${ctrl.position!.lng.toStringAsFixed(4)})',
                      style: const TextStyle(color: AppColors.inkMuted, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          if (_active != null)
            Material(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(16),
              child: ListTile(
                onTap: () => context.go('/entregador/entrega'),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                leading: const Icon(Icons.delivery_dining_rounded, color: AppColors.accent, size: 32),
                title: const Text(
                  'Entrega em andamento',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  'Pedido ${_active!.code} · ${money(_active!.earningCents)}',
                  style: const TextStyle(color: Colors.white70),
                ),
                trailing: const Icon(Icons.chevron_right_rounded, color: Colors.white),
              ),
            )
          else ...[
            const Text(
              'Pedidos disponíveis',
              style: TextStyle(
                fontFamily: 'Montserrat',
                fontWeight: FontWeight.w800,
                fontSize: 17,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            if (!ctrl.online)
              const LightEmpty(icon: Icons.power_settings_new_rounded, title: 'Você está indisponível')
            else if (_offers.isEmpty)
              const LightEmpty(
                icon: Icons.radar_rounded,
                title: 'Procurando pedidos perto de você…',
                message: 'Novos pedidos aparecem aqui automaticamente.',
              )
            else
              for (final d in _offers) _Offer(d: d, busy: _accepting == d.id, onAccept: () => _accept(d)),
          ],
        ],
      ],
    );
  }
}

class _Offer extends StatelessWidget {
  const _Offer({required this.d, required this.busy, required this.onAccept});

  final AvailableDelivery d;
  final bool busy;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                money(d.earningCents),
                style: const TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w800,
                  fontSize: 24,
                  color: AppColors.success,
                ),
              ),
              const Text('ganho estimado', style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5)),
              Pill(
                '${d.routeKm.toStringAsFixed(1).replaceAll('.', ',')} km · ~${d.minutes} min',
                fg: AppColors.primary,
                bg: AppColors.brandSoft,
                icon: Icons.route_rounded,
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final (i, m) in d.markets.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 11,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      '${i + 1}',
                      style: const TextStyle(color: AppColors.accent, fontSize: 11.5, fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      [m.name, m.district].whereType<String>().join(' · '),
                      style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(
                    m.ready ? 'pronto' : 'separando',
                    style: TextStyle(
                      color: m.ready ? AppColors.success : AppColors.inkMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              const Icon(Icons.home_rounded, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Entrega em ${d.customerDistrict}', style: const TextStyle(color: AppColors.ink)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              'Primeiro mercado a ${d.distanceToFirstKm.toStringAsFixed(1).replaceAll('.', ',')} km de você',
              if (d.weightKg != null) '≈ ${d.weightKg!.toStringAsFixed(1).replaceAll('.', ',')} kg',
            ].join(' · '),
            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
          ),
          if (d.coldItems > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '❄ ${d.coldItems} ${d.coldItems == 1 ? 'item refrigerado' : 'itens refrigerados'} — leve a bolsa térmica',
                style: const TextStyle(color: AppColors.info, fontSize: 12.5, fontWeight: FontWeight.w600),
              ),
            ),
          const SizedBox(height: 10),
          FilledButton(
            onPressed: busy ? null : onAccept,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size.fromHeight(50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(
              busy ? 'Aceitando…' : 'Aceitar entrega',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ),
        ],
      ),
    ),
  );
}

class _Signup extends StatelessWidget {
  const _Signup({required this.p, required this.onOpen});

  final CourierProfile p;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    if (p.status == 'bloqueado') {
      return const LightEmpty(
        icon: Icons.block_rounded,
        title: 'Cadastro bloqueado',
        message: 'Fale com o suporte do EconoRota.',
      );
    }
    if (p.inReview) {
      return const LightEmpty(
        icon: Icons.hourglass_top_rounded,
        title: 'Cadastro em análise',
        message: 'Estamos conferindo seus documentos. Você será avisado assim que for aprovado.',
      );
    }
    final steps = [
      ('Dados pessoais', ['cpf', 'birth_date', 'pix_key']),
      ('Veículo', ['vehicle_type', 'vehicle_plate', 'cnh_number']),
      ('Documento com foto (CNH ou RG)', ['document_photo']),
      if (p.vehicleType?.needsLicense ?? true) ('Documento do veículo (CRLV)', ['vehicle_doc']),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Complete seu cadastro para começar a entregar',
          style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.ink),
        ),
        if (p.reviewNote != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Ajuste pedido: ${p.reviewNote}',
              style: const TextStyle(color: AppColors.discount, fontWeight: FontWeight.w700),
            ),
          ),
        const SizedBox(height: 12),
        for (final (label, keys) in steps)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: PanelCard(
              onTap: onOpen,
              child: Row(
                children: [
                  Icon(
                    keys.any(p.missing.contains) ? Icons.radio_button_unchecked_rounded : Icons.check_circle_rounded,
                    color: keys.any(p.missing.contains) ? AppColors.inkMuted : AppColors.success,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: onOpen,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.success,
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: Text(
            p.missing.isEmpty ? 'Revisar e enviar' : 'Continuar cadastro',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
        ),
      ],
    );
  }
}
