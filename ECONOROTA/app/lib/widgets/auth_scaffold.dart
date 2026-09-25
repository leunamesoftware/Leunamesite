import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import 'app_logo.dart';
import 'two_tone_title.dart';

/// Estrutura comum das telas de acesso: arte no topo com degradê, logo, título e conteúdo.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.highlight,
    required this.children,
    this.subtitle,
    this.art,
    this.artAlignment = Alignment.centerRight,
    this.onBack,
    this.titleOnNewLine = false,
  });

  final String title;
  final String highlight;
  final String? subtitle;
  final String? art;
  final Alignment artAlignment;
  final VoidCallback? onBack;
  final bool titleOnNewLine;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final width = MediaQuery.sizeOf(context).width;
    final artHeight = (width * .78).clamp(240.0, 340.0);

    return Scaffold(
      body: Stack(
        children: [
          if (art != null)
            Positioned(
              top: 0,
              right: 0,
              width: width.clamp(0, 520) * .62,
              height: artHeight,
              child: ExcludeSemantics(
                child: ShaderMask(
                  blendMode: BlendMode.dstIn,
                  shaderCallback: (r) => const LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [Colors.transparent, Colors.black],
                    stops: [0, .45],
                  ).createShader(r),
                  child: ShaderMask(
                    blendMode: BlendMode.dstIn,
                    shaderCallback: (r) => const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.black, Colors.transparent],
                      stops: [.55, 1],
                    ).createShader(r),
                    child: Image.asset(art!, fit: BoxFit.cover, alignment: artAlignment),
                  ),
                ),
              ),
            ),
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        height: 48,
                        child: Row(
                          children: [
                            if (onBack != null) ...[
                              IconButton(
                                onPressed: onBack,
                                tooltip: 'Voltar',
                                icon: const Icon(Icons.arrow_back_rounded),
                                style: IconButton.styleFrom(backgroundColor: AppColors.surface.withValues(alpha: .7)),
                              ),
                              const SizedBox(width: 8),
                            ],
                            const AppLogo(size: 34),
                          ],
                        ),
                      ),
                      SizedBox(height: art != null ? artHeight * .36 : 32),
                      TwoToneTitle(titleOnNewLine ? '$title\n' : title, highlight),
                      if (subtitle != null) ...[
                        const SizedBox(height: 10),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 300),
                          child: Text(subtitle!, style: t.bodyLarge?.copyWith(color: AppColors.textMuted, height: 1.4)),
                        ),
                      ],
                      const SizedBox(height: 28),
                      ...children,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Linha "── ou ──".
class OrDivider extends StatelessWidget {
  const OrDivider({super.key});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 20),
    child: Row(
      children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text('ou', style: Theme.of(context).textTheme.bodySmall),
        ),
        const Expanded(child: Divider()),
      ],
    ),
  );
}

/// Mensagem de erro em destaque dentro de formulários.
class FormErrorBanner extends StatelessWidget {
  const FormErrorBanner(this.message, {super.key});

  final String? message;

  @override
  Widget build(BuildContext context) => AnimatedSize(
    duration: const Duration(milliseconds: 200),
    child: message == null
        ? const SizedBox(width: double.infinity)
        : Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.error.withValues(alpha: .5)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(message!, style: const TextStyle(color: AppColors.text, fontSize: 14)),
                ),
              ],
            ),
          ),
  );
}
