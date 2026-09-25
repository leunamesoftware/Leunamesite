import 'package:flutter/material.dart';

import 'app_colors.dart';

abstract final class AppTheme {
  static const _title = 'Montserrat';
  static const _body = 'Roboto';

  static ThemeData get dark {
    const scheme = ColorScheme.dark(
      primary: AppColors.accent,
      onPrimary: AppColors.onAccent,
      secondary: AppColors.primaryLight,
      onSecondary: AppColors.text,
      surface: AppColors.surface,
      onSurface: AppColors.text,
      error: AppColors.error,
      outline: AppColors.border,
    );

    TextStyle title(double size, [FontWeight w = FontWeight.w700]) =>
        TextStyle(fontFamily: _title, fontSize: size, fontWeight: w, color: AppColors.text);
    TextStyle body(double size, [FontWeight w = FontWeight.w400, Color c = AppColors.text]) =>
        TextStyle(fontFamily: _body, fontSize: size, fontWeight: w, color: c);

    final radius = BorderRadius.circular(14);

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      fontFamily: _body,
      textTheme: TextTheme(
        displaySmall: title(32, FontWeight.w800),
        headlineMedium: title(26, FontWeight.w800),
        headlineSmall: title(22),
        titleLarge: title(18),
        titleMedium: title(16, FontWeight.w600),
        titleSmall: title(14, FontWeight.w600),
        bodyLarge: body(16),
        bodyMedium: body(14),
        bodySmall: body(12, FontWeight.w400, AppColors.textMuted),
        labelLarge: body(15, FontWeight.w700),
        labelMedium: body(12, FontWeight.w500),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.text,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: title(18),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        hintStyle: body(15, FontWeight.w400, AppColors.textMuted),
        labelStyle: body(15, FontWeight.w400, AppColors.textMuted),
        floatingLabelStyle: body(14, FontWeight.w500, AppColors.accent),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: radius,
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: const BorderSide(color: AppColors.error),
        ),
        prefixIconColor: AppColors.textMuted,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.accent.withValues(alpha: .16),
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => body(12, FontWeight.w500, s.contains(WidgetState.selected) ? AppColors.accent : AppColors.textMuted),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(color: s.contains(WidgetState.selected) ? AppColors.accent : AppColors.textMuted),
        ),
      ),
      drawerTheme: const DrawerThemeData(backgroundColor: AppColors.background),
      dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.surfaceHigh,
        contentTextStyle: body(14),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: radius),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surface,
        side: const BorderSide(color: AppColors.border),
        labelStyle: body(13, FontWeight.w500),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
    );
  }

  /// Tema claro das áreas de conteúdo (listas de produtos, mercados, pedidos).
  static ThemeData get light {
    final base = dark;
    TextStyle? ink(TextStyle? s, [Color c = AppColors.ink]) => s?.copyWith(color: c);
    final t = base.textTheme;
    final radius = BorderRadius.circular(14);
    return base.copyWith(
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.sheet,
      colorScheme: base.colorScheme.copyWith(
        brightness: Brightness.light,
        primary: AppColors.primary,
        onPrimary: Colors.white,
        surface: AppColors.card,
        onSurface: AppColors.ink,
        outline: AppColors.line,
      ),
      textTheme: t.copyWith(
        displaySmall: ink(t.displaySmall),
        headlineMedium: ink(t.headlineMedium),
        headlineSmall: ink(t.headlineSmall),
        titleLarge: ink(t.titleLarge),
        titleMedium: ink(t.titleMedium),
        titleSmall: ink(t.titleSmall),
        bodyLarge: ink(t.bodyLarge),
        bodyMedium: ink(t.bodyMedium),
        bodySmall: ink(t.bodySmall, AppColors.inkMuted),
        labelLarge: ink(t.labelLarge),
        labelMedium: ink(t.labelMedium),
      ),
      iconTheme: const IconThemeData(color: AppColors.ink),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AppColors.line),
        ),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.line, thickness: 1),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AppColors.card,
        selectedColor: AppColors.primary,
        side: const BorderSide(color: AppColors.line),
        labelStyle: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w500, fontSize: 13),
        secondaryLabelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
        checkmarkColor: Colors.white,
      ),
      inputDecorationTheme: base.inputDecorationTheme.copyWith(
        fillColor: AppColors.card,
        hintStyle: const TextStyle(color: AppColors.inkMuted, fontSize: 15),
        // Fundo claro: rótulos em roxo/cinza (o verde da marca some sobre o branco).
        labelStyle: const TextStyle(color: AppColors.inkMuted, fontSize: 15),
        floatingLabelStyle: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 14),
        focusedBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: const BorderSide(color: AppColors.primary, width: 1.6),
        ),
        prefixIconColor: AppColors.inkMuted,
        enabledBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: const BorderSide(color: AppColors.line),
        ),
        border: OutlineInputBorder(
          borderRadius: radius,
          borderSide: const BorderSide(color: AppColors.line),
        ),
      ),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: AppColors.primaryLight)),
    );
  }
}
