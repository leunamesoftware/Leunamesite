import 'package:flutter/services.dart';

/// Máscara simples baseada em "#" (ex.: "#####-###").
class MaskFormatter extends TextInputFormatter {
  MaskFormatter(this.masks) : assert(masks.isNotEmpty);

  /// Várias máscaras: usa a primeira que comporta a quantidade de dígitos.
  final List<String> masks;

  static int _slots(String m) => '#'.allMatches(m).length;

  String apply(String digits) {
    final mask = masks.firstWhere((m) => digits.length <= _slots(m), orElse: () => masks.last);
    final out = StringBuffer();
    var i = 0;
    for (final ch in mask.split('')) {
      if (i >= digits.length) break;
      if (ch == '#') {
        out.write(digits[i++]);
      } else {
        out.write(ch);
      }
    }
    return out.toString();
  }

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final max = _slots(masks.last);
    var digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length > max) digits = digits.substring(0, max);
    final text = apply(digits);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

final cepMask = MaskFormatter(['#####-###']);
final phoneMask = MaskFormatter(['(##) ####-####', '(##) #####-####']);

String digitsOnly(String s) => s.replaceAll(RegExp(r'\D'), '');
final cpfMask = MaskFormatter(['###.###.###-##']);
