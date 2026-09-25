import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../l10n/app_localizations.dart';
import '../../state/address_controller.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_logo.dart';
import 'access_flow.dart';

/// Tela de abertura: carrega sessão e endereço enquanto mostra a marca.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  static const _minDuration = Duration(milliseconds: 1600);
  late final _anim = AnimationController(vsync: this, duration: _minDuration)..forward();

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    final auth = context.read<AuthController>();
    final address = context.read<AddressController>();
    await Future.wait([auth.restore(), address.load(), Future<void>.delayed(_minDuration)]);
    if (mounted) context.go(nextAccessRoute(auth, address));
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final size = MediaQuery.sizeOf(context);
    final logoIn = CurvedAnimation(
      parent: _anim,
      curve: const Interval(0, .45, curve: Curves.easeOutBack),
    );
    final textIn = CurvedAnimation(
      parent: _anim,
      curve: const Interval(.2, .6, curve: Curves.easeOut),
    );

    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -.5),
            radius: 1.1,
            colors: [Color(0xFF4A0A8C), AppColors.background],
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: size.height * .46,
              child: FadeTransition(
                opacity: textIn,
                child: ShaderMask(
                  blendMode: BlendMode.dstIn,
                  shaderCallback: (r) => const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black, Colors.black],
                    stops: [0, .35, 1],
                  ).createShader(r),
                  child: Image.asset(
                    'assets/images/art/splash_hero.webp',
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  SizedBox(height: size.height * .1),
                  Center(
                    child: ScaleTransition(scale: logoIn, child: const AppLogo(size: 120, showName: false)),
                  ),
                  const SizedBox(height: 20),
                  FadeTransition(
                    opacity: textIn,
                    child: Column(
                      children: [
                        const AppLogo(showIcon: false, nameSize: 40),
                        const SizedBox(height: 8),
                        Text(l.slogan, style: const TextStyle(fontSize: 17, color: AppColors.text)),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(56, 0, 56, 32),
                    child: AnimatedBuilder(
                      animation: _anim,
                      builder: (_, _) => ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: _anim.value,
                          minHeight: 6,
                          color: AppColors.accent,
                          backgroundColor: AppColors.surfaceHigh.withValues(alpha: .8),
                          semanticsLabel: 'Carregando',
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
