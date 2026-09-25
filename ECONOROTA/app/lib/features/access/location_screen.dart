import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../data/repositories/geo_repository.dart';
import '../../services/location_service.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_logo.dart';
import '../../widgets/two_tone_title.dart';

class LocationScreen extends StatefulWidget {
  const LocationScreen({super.key});

  @override
  State<LocationScreen> createState() => _LocationScreenState();
}

class _LocationScreenState extends State<LocationScreen> {
  bool _loading = false;

  void _toAddress([Object? extra]) => context.go('/endereco', extra: extra);

  Future<void> _allow() async {
    final location = context.read<LocationService>();
    final geo = context.read<GeoRepository>();
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _loading = true);
    try {
      final result = await location.requestPermission();
      if (!mounted) return;
      switch (result) {
        case LocationResult.granted:
          final pos = await location.current();
          final address = await geo.reverse(pos.lat, pos.lng);
          _toAddress(address);
        case LocationResult.serviceDisabled:
          messenger.showSnackBar(const SnackBar(content: Text('Ative a localização do aparelho ou digite seu CEP.')));
          _toAddress();
        case LocationResult.deniedForever:
          await _askSettings(location);
        case LocationResult.denied:
          _toAddress();
      }
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
      _toAddress();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _askSettings(LocationService location) async {
    final open = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Localização bloqueada'),
        content: const Text(
          'Para usar sua localização, libere a permissão nas configurações do aparelho. Você também pode digitar o CEP.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Digitar CEP')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Abrir configurações')),
        ],
      ),
    );
    if (open == true) await location.openSettings();
    if (mounted) _toAddress();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    const benefits = [
      (Icons.my_location_rounded, 'Encontre supermercados perto de você'),
      (Icons.percent_rounded, 'Veja as ofertas da sua região'),
      (Icons.near_me_rounded, 'Calcule a melhor rota de entrega'),
    ];
    return Scaffold(
      body: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: size.height * .5,
            child: ExcludeSemantics(
              child: ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (r) => const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.black, Colors.black, Colors.transparent],
                  stops: [0, .6, 1],
                ).createShader(r),
                child: Image.asset('assets/images/art/map_pins.webp', fit: BoxFit.cover),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Align(alignment: Alignment.centerLeft, child: AppLogo(size: 34)),
                      const Spacer(),
                      const TwoToneTitle('Permitir sua\n', 'localização', size: 32),
                      const SizedBox(height: 12),
                      const Text(
                        'Usamos sua localização só para mostrar mercados, ofertas e o valor da entrega na sua região.',
                        style: TextStyle(fontSize: 16, color: AppColors.textMuted, height: 1.45),
                      ),
                      const SizedBox(height: 20),
                      for (final (icon, text) in benefits)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: AppColors.accent.withValues(alpha: .15),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(icon, color: AppColors.accent, size: 20),
                              ),
                              const SizedBox(width: 14),
                              Expanded(child: Text(text, style: const TextStyle(fontSize: 15))),
                            ],
                          ),
                        ),
                      const SizedBox(height: 16),
                      AppButton(
                        label: 'Permitir localização',
                        icon: Icons.location_on_rounded,
                        loading: _loading,
                        onPressed: _allow,
                      ),
                      const SizedBox(height: 12),
                      AppButton.secondary(label: 'Agora não', onPressed: _loading ? null : _toAddress),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
