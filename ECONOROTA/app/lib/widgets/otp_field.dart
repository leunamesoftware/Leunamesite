import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme/app_colors.dart';

/// Código de 6 dígitos em caixas separadas, com colar e preenchimento automático (SMS/e-mail).
class OtpField extends StatefulWidget {
  const OtpField({super.key, required this.controller, this.onCompleted, this.hasError = false, this.length = 6});

  final TextEditingController controller;
  final ValueChanged<String>? onCompleted;
  final bool hasError;
  final int length;

  @override
  State<OtpField> createState() => _OtpFieldState();
}

class _OtpFieldState extends State<OtpField> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _focus.dispose();
    super.dispose();
  }

  void _changed() {
    setState(() {});
    final v = widget.controller.text;
    if (v.length == widget.length) widget.onCompleted?.call(v);
  }

  @override
  Widget build(BuildContext context) {
    final text = widget.controller.text;
    return GestureDetector(
      onTap: () => _focus.requestFocus(),
      child: Stack(
        children: [
          Row(
            children: [
              for (var i = 0; i < widget.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: _box(
                    i < text.length ? text[i] : '',
                    _focus.hasFocus && i == text.length.clamp(0, widget.length - 1),
                  ),
                ),
              ],
            ],
          ),
          Positioned.fill(
            // Campo real por cima das caixas, com texto transparente: funciona com teclado,
            // colar, preenchimento automático, web e leitores de tela.
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              // Na web o foco automático conflita com o campo acessível do navegador.
              autofocus: !kIsWeb,
              keyboardType: TextInputType.number,
              autofillHints: const [AutofillHints.oneTimeCode],
              showCursor: false,
              enableInteractiveSelection: false,
              style: const TextStyle(color: Colors.transparent, fontSize: 1),
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(widget.length),
              ],
              decoration: InputDecoration(
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                contentPadding: EdgeInsets.zero,
                hintText: '',
                semanticCounterText: '',
                labelText: 'Código de verificação de ${widget.length} dígitos',
                labelStyle: const TextStyle(color: Colors.transparent, fontSize: 1),
                floatingLabelStyle: const TextStyle(color: Colors.transparent, fontSize: 1),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _box(String ch, bool active) {
    final color = widget.hasError
        ? AppColors.error
        : active
        ? AppColors.accent
        : ch.isNotEmpty
        ? AppColors.primaryLight
        : AppColors.border;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      height: 60,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color, width: active ? 2 : 1.4),
      ),
      child: Text(
        ch.isEmpty ? '' : ch,
        style: const TextStyle(
          fontFamily: 'Montserrat',
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: AppColors.text,
        ),
      ),
    );
  }
}
