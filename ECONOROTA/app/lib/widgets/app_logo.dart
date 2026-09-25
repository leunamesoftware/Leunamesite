import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Ícone + nome "Econo" (branco) "Rota" (verde).
class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.size = 40,
    this.showName = true,
    this.showIcon = true,
    this.nameSize,
    this.onLight = false,
  });

  final double size;
  final bool showName;
  final bool showIcon;

  /// Versão para fundo claro (carrinho roxo).
  final bool onLight;
  final double? nameSize;

  @override
  Widget build(BuildContext context) {
    // Símbolo livre (sem o quadrado do ícone de instalação).
    final icon = Image.asset(
      onLight ? 'assets/images/logo_mark_light.png' : 'assets/images/logo_mark.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
      semanticLabel: showName ? null : 'EconoRota',
    );
    if (!showName) return icon;
    final fs = nameSize ?? size * .5;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showIcon) ...[icon, SizedBox(width: size * .25)],
        Text.rich(
          TextSpan(
            children: [
              const TextSpan(
                text: 'Econo',
                style: TextStyle(color: AppColors.text),
              ),
              const TextSpan(
                text: 'Rota',
                style: TextStyle(color: AppColors.accent),
              ),
            ],
          ),
          style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: fs, letterSpacing: -.5),
        ),
      ],
    );
  }
}
