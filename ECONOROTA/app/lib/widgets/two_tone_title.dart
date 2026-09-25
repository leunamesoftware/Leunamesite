import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Título em duas cores: "Faça seu " (branco) + "login" (verde).
class TwoToneTitle extends StatelessWidget {
  const TwoToneTitle(this.text, this.highlight, {super.key, this.size = 30, this.align = TextAlign.start});

  final String text;
  final String highlight;
  final double size;
  final TextAlign align;

  @override
  Widget build(BuildContext context) => Text.rich(
    TextSpan(
      children: [
        TextSpan(text: text),
        TextSpan(
          text: highlight,
          style: const TextStyle(color: AppColors.accent),
        ),
      ],
    ),
    textAlign: align,
    style: TextStyle(
      fontFamily: 'Montserrat',
      fontWeight: FontWeight.w800,
      fontSize: size,
      height: 1.1,
      letterSpacing: -.5,
      color: AppColors.text,
    ),
  );
}
