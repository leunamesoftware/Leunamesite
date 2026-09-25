import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Botão "Ordenar por: X" que abre uma lista de opções.
class SortButton<T> extends StatelessWidget {
  const SortButton({
    super.key,
    required this.value,
    required this.options,
    required this.label,
    required this.onChanged,
  });

  final T value;
  final List<T> options;
  final String Function(T) label;
  final ValueChanged<T> onChanged;

  Future<void> _open(BuildContext context) async {
    final picked = await showModalBottomSheet<T>(
      context: context,
      backgroundColor: Colors.white,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'Ordenar por',
                style: TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: AppColors.ink,
                ),
              ),
            ),
            RadioGroup<T>(
              groupValue: value,
              onChanged: (v) => Navigator.pop(c, v),
              child: Column(
                children: [
                  for (final o in options)
                    RadioListTile<T>(
                      value: o,
                      activeColor: AppColors.primary,
                      title: Text(label(o), style: const TextStyle(color: AppColors.ink, fontSize: 16)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked != null && picked != value) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) => OutlinedButton(
    onPressed: () => _open(context),
    style: OutlinedButton.styleFrom(
      foregroundColor: AppColors.ink,
      backgroundColor: Colors.white,
      side: const BorderSide(color: AppColors.line),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      minimumSize: const Size(0, 36),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.swap_vert_rounded, size: 18),
        const SizedBox(width: 4),
        Text(label(value), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        const Icon(Icons.keyboard_arrow_down_rounded, size: 18),
      ],
    ),
  );
}
