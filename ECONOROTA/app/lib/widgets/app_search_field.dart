import 'package:flutter/material.dart';

class AppSearchField extends StatelessWidget {
  const AppSearchField({
    super.key,
    required this.hint,
    this.onChanged,
    this.onTap,
    this.readOnly = false,
    this.autofocus = false,
  });

  final String hint;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final bool readOnly;
  final bool autofocus;

  @override
  Widget build(BuildContext context) => TextField(
    readOnly: readOnly,
    autofocus: autofocus,
    onTap: onTap,
    onChanged: onChanged,
    textInputAction: TextInputAction.search,
    decoration: InputDecoration(hintText: hint, prefixIcon: const Icon(Icons.search_rounded)),
  );
}
