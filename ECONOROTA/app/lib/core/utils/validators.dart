import 'formatters.dart';

/// Validações de formulário com mensagens claras (retorna null quando válido).
abstract final class Validators {
  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

  static String? name(String? v) {
    final s = v?.trim() ?? '';
    if (s.isEmpty) return 'Informe seu nome.';
    if (s.split(RegExp(r'\s+')).length < 2) return 'Informe nome e sobrenome.';
    return null;
  }

  static String? email(String? v) {
    final s = v?.trim() ?? '';
    if (s.isEmpty) return 'Informe seu e-mail.';
    return _email.hasMatch(s) ? null : 'E-mail inválido.';
  }

  static bool isPhone(String? v) {
    final d = digitsOnly(v ?? '');
    return (d.length == 10 || d.length == 11) && int.parse(d.substring(0, 2)) >= 11;
  }

  static String? phone(String? v) {
    if ((v ?? '').trim().isEmpty) return 'Informe seu WhatsApp.';
    return isPhone(v) ? null : 'Telefone inválido. Use DDD + número.';
  }

  static String? login(String? v) {
    final s = v?.trim() ?? '';
    if (s.isEmpty) return 'Informe seu e-mail ou telefone.';
    if (s.contains('@')) return email(s);
    return isPhone(s) ? null : 'E-mail ou telefone inválido.';
  }

  static String? password(String? v) {
    final s = v ?? '';
    if (s.isEmpty) return 'Informe sua senha.';
    if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
    return null;
  }

  static String? newPassword(String? v) {
    final base = password(v);
    if (base != null) return base;
    if (!RegExp(r'[A-Za-z]').hasMatch(v!) || !RegExp(r'\d').hasMatch(v)) return 'Use letras e números.';
    return null;
  }

  static String? Function(String?) confirm(String Function() original) =>
      (v) => (v ?? '').isEmpty ? 'Confirme sua senha.' : (v == original() ? null : 'As senhas não conferem.');

  /// 0 a 4: fraca → forte.
  static int passwordStrength(String s) {
    var score = 0;
    if (s.length >= 8) score++;
    if (s.length >= 12) score++;
    if (RegExp(r'[A-Z]').hasMatch(s) && RegExp(r'[a-z]').hasMatch(s)) score++;
    if (RegExp(r'\d').hasMatch(s) && RegExp(r'[^A-Za-z0-9]').hasMatch(s)) score++;
    return score;
  }
}

/// CPF com dígitos verificadores válidos (mesma regra da API).
bool isValidCpf(String input) {
  final d = input.replaceAll(RegExp(r'\D'), '');
  if (d.length != 11 || RegExp(r'^(\d)\1{10}$').hasMatch(d)) return false;
  int dv(int len) {
    var sum = 0;
    for (var i = 0; i < len; i++) {
      sum += int.parse(d[i]) * (len + 1 - i);
    }
    final r = (sum * 10) % 11;
    return r == 10 ? 0 : r;
  }

  return dv(9) == int.parse(d[9]) && dv(10) == int.parse(d[10]);
}
