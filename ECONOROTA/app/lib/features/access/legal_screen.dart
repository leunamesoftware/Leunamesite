import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'legal_texts.dart';

class LegalScreen extends StatelessWidget {
  const LegalScreen.terms({super.key}) : title = termsTitle, sections = termsSections;
  const LegalScreen.privacy({super.key}) : title = privacyTitle, sections = privacySections;

  final String title;
  final List<(String, String)> sections;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            itemCount: sections.length,
            separatorBuilder: (_, _) => const SizedBox(height: 20),
            itemBuilder: (_, i) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(sections[i].$1, style: t.titleMedium),
                const SizedBox(height: 6),
                Text(sections[i].$2, style: t.bodyMedium?.copyWith(color: AppColors.textMuted, height: 1.55)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
