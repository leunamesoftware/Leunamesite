import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

enum AppButtonVariant { primary, secondary, text }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.icon,
    this.loading = false,
    this.expand = true,
    this.iconAfter = false,
  });

  const AppButton.secondary({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = true,
    this.iconAfter = false,
  }) : variant = AppButtonVariant.secondary;

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final IconData? icon;
  final bool loading;
  final bool expand;

  /// Ícone depois do texto (setas de avanço).
  final bool iconAfter;

  bool get _after => iconAfter || icon == Icons.arrow_forward_rounded;

  @override
  Widget build(BuildContext context) {
    final fg = variant == AppButtonVariant.primary ? AppColors.onAccent : AppColors.text;
    final child = loading
        ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: fg))
        : _after && icon != null && expand
        // Texto centralizado e seta na borda direita (padrão de avanço).
        ? Row(
            children: [
              const SizedBox(width: 24),
              Expanded(
                child: Text(label, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis),
              ),
              Icon(icon, size: 22),
            ],
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null && !_after) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
              if (icon != null && _after) ...[const SizedBox(width: 8), Icon(icon, size: 20)],
            ],
          );
    final onTap = loading ? null : onPressed;
    const shape = RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(14)));
    const size = Size(64, 54);
    const text = TextStyle(fontFamily: 'Roboto', fontSize: 15, fontWeight: FontWeight.w700);

    final Widget button = switch (variant) {
      AppButtonVariant.primary => FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.onAccent,
          disabledBackgroundColor: loading ? AppColors.accent : AppColors.surfaceHigh,
          disabledForegroundColor: loading ? AppColors.onAccent : AppColors.textMuted,
          minimumSize: size,
          shape: shape,
          textStyle: text,
        ),
        child: child,
      ),
      AppButtonVariant.secondary => OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.text,
          side: const BorderSide(color: AppColors.textMuted),
          minimumSize: size,
          shape: shape,
          textStyle: text,
        ),
        child: child,
      ),
      AppButtonVariant.text => TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(foregroundColor: AppColors.accent, textStyle: text),
        child: child,
      ),
    };
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}
