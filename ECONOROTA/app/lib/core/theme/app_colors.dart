import 'package:flutter/material.dart';

/// Paleta oficial EconoRota.
abstract final class AppColors {
  static const primary = Color(0xFF480082);
  static const primaryLight = Color(0xFF6A1FC2);
  static const accent = Color(0xFF39FF14);
  static const accentDark = Color(0xFF1FB84A);
  static const background = Color(0xFF14062B);
  static const surface = Color(0xFF1F0B40);
  static const surfaceHigh = Color(0xFF2A1255);
  static const border = Color(0xFF3D2270);
  static const text = Color(0xFFFFFFFF);
  static const textMuted = Color(0xFFBBAED8);
  static const onAccent = Color(0xFF14062B);
  static const error = Color(0xFFFF4D6D);
  static const warning = Color(0xFFFFC23D);

  static const roleCustomer = Color(0xFF1E6BFF);
  static const roleMarket = Color(0xFF1FA84F);
  static const roleCourier = Color(0xFF7B2CBF);
  static const roleAdmin = Color(0xFFD9820B);

  // Área de conteúdo clara (produtos e listas), abaixo do cabeçalho escuro da marca.
  static const sheet = Color(0xFFF4F5FA);
  static const card = Color(0xFFFFFFFF);
  static const ink = Color(0xFF1A0B33);
  static const inkMuted = Color(0xFF6B7094);
  static const line = Color(0xFFE4E6EF);
  static const brandSoft = Color(0xFFEFE6FB);
  static const discount = Color(0xFFE5294D);
  static const success = Color(0xFF16A34A);
  static const successSoft = Color(0xFFDCFCE7);
  static const info = Color(0xFF2563EB);
  static const infoSoft = Color(0xFFDBEAFE);
  static const dangerSoft = Color(0xFFFFE4E8);
  static const star = Color(0xFFF5B301);

  static const headerGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF5A0FA0), primary, Color(0xFF2A0859)],
  );
}
