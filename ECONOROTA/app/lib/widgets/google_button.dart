import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Botão "Continuar com Google" (padrão visual claro recomendado pelo Google).
class GoogleButton extends StatelessWidget {
  const GoogleButton({super.key, required this.onPressed, this.loading = false});

  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    height: 54,
    child: FilledButton(
      onPressed: loading ? null : onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1F1F1F),
        disabledBackgroundColor: Colors.white70,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(14))),
        textStyle: const TextStyle(fontFamily: 'Roboto', fontSize: 15, fontWeight: FontWeight.w500),
      ),
      child: loading
          ? const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF1F1F1F)),
            )
          : const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(width: 20, height: 20, child: CustomPaint(painter: _GoogleLogoPainter())),
                SizedBox(width: 12),
                Text('Continuar com Google'),
              ],
            ),
    ),
  );
}

class _GoogleLogoPainter extends CustomPainter {
  const _GoogleLogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final stroke = s * .2;
    final rect = Rect.fromCircle(center: Offset(s / 2, s / 2), radius: (s - stroke) / 2);
    Paint p(Color c) => Paint()
      ..color = c
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    const deg = math.pi / 180;
    canvas
      ..drawArc(rect, -40 * deg, -100 * deg, false, p(const Color(0xFFEA4335)))
      ..drawArc(rect, -140 * deg, -90 * deg, false, p(const Color(0xFFFBBC05)))
      ..drawArc(rect, 130 * deg, -95 * deg, false, p(const Color(0xFF34A853)))
      ..drawArc(rect, 35 * deg, -35 * deg, false, p(const Color(0xFF4285F4)))
      ..drawRect(
        Rect.fromLTWH(s / 2, s / 2 - stroke / 2, s / 2 - stroke / 4, stroke),
        Paint()..color = const Color(0xFF4285F4),
      );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
