import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/utils/validators.dart';

class PasswordStrength extends StatelessWidget {
  const PasswordStrength({super.key, required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    if (password.isEmpty) return const SizedBox.shrink();
    final score = Validators.passwordStrength(password);
    final (label, color) = switch (score) {
      <= 1 => ('Senha fraca', AppColors.error),
      2 => ('Senha média', AppColors.warning),
      _ => ('Senha forte', AppColors.accent),
    };
    return Padding(
      padding: const EdgeInsets.only(top: 8, left: 4),
      child: Row(
        children: [
          for (var i = 0; i < 4; i++) ...[
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 4,
                decoration: BoxDecoration(
                  color: i < score.clamp(1, 4) ? color : AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(width: 4),
          ],
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
