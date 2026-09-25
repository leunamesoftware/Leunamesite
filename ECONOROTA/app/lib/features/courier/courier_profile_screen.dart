import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../data/models/courier.dart';
import '../../data/repositories/courier_repository.dart';
import '../../state/auth_controller.dart';
import '../../state/courier_controller.dart';
import '../customer/widgets/common.dart';
import '../market/market_widgets.dart';

/// Perfil do entregador: dados, veículo, raio de atuação.
class CourierProfileScreen extends StatefulWidget {
  const CourierProfileScreen({super.key});

  @override
  State<CourierProfileScreen> createState() => _CourierProfileScreenState();
}

class _CourierProfileScreenState extends State<CourierProfileScreen> {
  CourierProfile? _p;
  String? _error;
  double? _radius;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await context.read<CourierRepository>().profile();
      if (mounted) {
        setState(() {
          _p = p;
          _radius = p.workRadiusKm.toDouble();
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _saveRadius(double v) async {
    try {
      await context.read<CourierRepository>().updateProfile({'work_radius_km': v.round()});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Raio de atuação: ${v.round()} km.')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _p;
    Widget row(IconData i, String label, String? value) => ListTile(
      leading: Icon(i, color: AppColors.primary),
      title: Text(label, style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5)),
      subtitle: Text(
        value ?? '—',
        style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w700, fontSize: 15),
      ),
    );
    return PanelPage(
      title: 'Perfil',
      subtitle: context.select<AuthController, String?>((a) => a.user?.name),
      onRefresh: _load,
      maxWidth: 640,
      children: [
        if (_error != null && p == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (p == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else ...[
          PanelCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                row(
                  Icons.verified_user_rounded,
                  'Situação do cadastro',
                  p.approved ? 'Aprovado' : (p.inReview ? 'Em análise' : 'Incompleto'),
                ),
                row(Icons.badge_rounded, 'CPF', p.cpf),
                row(Icons.pix_rounded, 'Chave Pix', p.pixKey),
                row(
                  Icons.two_wheeler_rounded,
                  'Veículo',
                  p.vehicleType == null
                      ? null
                      : [
                          p.vehicleType!.label,
                          p.vehicleModel,
                          p.vehicleColor,
                          p.vehiclePlate,
                        ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                ),
              ],
            ),
          ),
          if (!p.approved) ...[
            const SizedBox(height: 10),
            FilledButton(
              onPressed: () => context.push('/entregador/cadastro'),
              child: const Text('Completar cadastro'),
            ),
          ] else ...[
            const SizedBox(height: 16),
            PanelCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Raio de atuação: ${_radius!.round()} km',
                    style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                  ),
                  const Text(
                    'Você recebe pedidos cujo primeiro mercado fica até esta distância de você.',
                    style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                  ),
                  Slider(
                    value: _radius!,
                    min: 1,
                    max: 20,
                    divisions: 19,
                    label: '${_radius!.round()} km',
                    onChanged: (v) => setState(() => _radius = v),
                    onChangeEnd: _saveRadius,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Para trocar documentos ou veículo, fale com o suporte do EconoRota.',
              style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
            ),
          ],
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: () => context.push('/conta/dados'),
            icon: const Icon(Icons.shield_rounded),
            label: const Text('Meus dados e privacidade'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () {
              context.read<CourierController>().reset();
              context.read<AuthController>().logout();
            },
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sair'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.discount,
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ],
      ],
    );
  }
}
