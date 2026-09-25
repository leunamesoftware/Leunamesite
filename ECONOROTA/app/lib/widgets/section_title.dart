import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Título de seção da área clara, com ícone e ação "Ver todos".
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.icon, this.iconColor, this.action, this.onAction, this.trailing});

  final String title;
  final IconData? icon;
  final Color? iconColor;
  final String? action;
  final VoidCallback? onAction;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 8, 10),
    child: Row(
      children: [
        if (icon != null) ...[Icon(icon, color: iconColor ?? AppColors.discount, size: 24), const SizedBox(width: 8)],
        Expanded(
          child: Semantics(
            header: true,
            child: Text(
              title,
              style: const TextStyle(
                fontFamily: 'Montserrat',
                fontWeight: FontWeight.w800,
                fontSize: 19,
                color: AppColors.ink,
              ),
            ),
          ),
        ),
        ?trailing,
        if (action != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(foregroundColor: AppColors.primaryLight),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(action!, style: const TextStyle(fontWeight: FontWeight.w700)),
                const Icon(Icons.chevron_right_rounded, size: 20),
              ],
            ),
          ),
      ],
    ),
  );
}
