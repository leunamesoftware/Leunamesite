import 'package:flutter/material.dart';

/// Imagem de produto/mercado: arquivo do app ("assets/…") ou URL, com reserva em caso de falha.
class AppImage extends StatelessWidget {
  const AppImage(this.src, {super.key, this.fit = BoxFit.cover, required this.fallback});

  final String? src;
  final BoxFit fit;
  final Widget fallback;

  @override
  Widget build(BuildContext context) {
    final s = src;
    if (s == null || s.isEmpty) return fallback;
    Widget error(BuildContext _, Object _, StackTrace? _) => fallback;
    return s.startsWith('assets/')
        ? Image.asset(s, fit: fit, errorBuilder: error)
        : Image.network(
            s,
            fit: fit,
            errorBuilder: error,
            frameBuilder: (_, child, frame, sync) => sync
                ? child
                : AnimatedOpacity(
                    opacity: frame == null ? 0 : 1,
                    duration: const Duration(milliseconds: 250),
                    child: child,
                  ),
          );
  }
}
