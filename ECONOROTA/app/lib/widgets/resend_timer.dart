import 'dart:async';

import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Contagem regressiva para reenviar o código.
class ResendTimer extends StatefulWidget {
  const ResendTimer({super.key, required this.seconds, required this.onResend, this.sending = false});

  /// Reiniciar a contagem: troque a key do widget.
  final int seconds;
  final VoidCallback onResend;
  final bool sending;

  @override
  State<ResendTimer> createState() => _ResendTimerState();
}

class _ResendTimerState extends State<ResendTimer> {
  late int _left = widget.seconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_left <= 1) t.cancel();
      setState(() => _left--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mm = (_left ~/ 60).toString().padLeft(2, '0');
    final ss = (_left % 60).toString().padLeft(2, '0');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.schedule_rounded, color: AppColors.accent, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: _left > 0
                ? Text.rich(
                    TextSpan(
                      children: [
                        const TextSpan(text: 'Não recebeu o código?\n'),
                        const TextSpan(
                          text: 'Reenviar em ',
                          style: TextStyle(color: AppColors.textMuted),
                        ),
                        TextSpan(
                          text: '$mm:$ss',
                          style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                    style: const TextStyle(fontSize: 15, height: 1.4),
                  )
                : const Text('Não recebeu o código?', style: TextStyle(fontSize: 15)),
          ),
          if (_left <= 0)
            widget.sending
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : TextButton(
                    onPressed: widget.onResend,
                    style: TextButton.styleFrom(foregroundColor: AppColors.accent),
                    child: const Text('Reenviar', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
        ],
      ),
    );
  }
}
