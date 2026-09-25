import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme/app_colors.dart';

/// Campo de texto padrão com ícone, validação e opção de mostrar/ocultar senha.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    required this.hint,
    required this.icon,
    this.controller,
    this.validator,
    this.keyboardType,
    this.textInputAction = TextInputAction.next,
    this.autofillHints,
    this.formatters,
    this.obscure = false,
    this.onChanged,
    this.onSubmitted,
    this.suffix,
    this.enabled = true,
    this.textCapitalization = TextCapitalization.none,
    this.autofocus = false,
    this.focusNode,
  });

  final String hint;
  final IconData icon;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final TextInputAction textInputAction;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? formatters;
  final bool obscure;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final Widget? suffix;
  final bool enabled;
  final TextCapitalization textCapitalization;
  final bool autofocus;
  final FocusNode? focusNode;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late bool _hidden = widget.obscure;

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: widget.controller,
    focusNode: widget.focusNode,
    validator: widget.validator,
    keyboardType: widget.keyboardType,
    textInputAction: widget.textInputAction,
    autofillHints: widget.autofillHints,
    inputFormatters: widget.formatters,
    obscureText: _hidden,
    enableSuggestions: !widget.obscure,
    autocorrect: false,
    enabled: widget.enabled,
    autofocus: widget.autofocus,
    textCapitalization: widget.textCapitalization,
    onChanged: widget.onChanged,
    onFieldSubmitted: widget.onSubmitted,
    autovalidateMode: AutovalidateMode.onUserInteraction,
    style: const TextStyle(fontSize: 16),
    decoration: InputDecoration(
      labelText: widget.hint,
      prefixIcon: Icon(widget.icon),
      errorMaxLines: 2,
      suffixIcon: widget.obscure
          ? IconButton(
              tooltip: _hidden ? 'Mostrar senha' : 'Ocultar senha',
              icon: Icon(
                _hidden ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                color: AppColors.textMuted,
              ),
              onPressed: () => setState(() => _hidden = !_hidden),
            )
          : widget.suffix,
    ),
  );
}
