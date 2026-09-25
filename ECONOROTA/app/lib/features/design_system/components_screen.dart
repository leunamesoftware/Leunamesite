import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../data/mock/mock_data.dart';
import '../../l10n/app_localizations.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_logo.dart';
import '../../widgets/app_search_field.dart';
import '../../widgets/category_icon.dart';
import '../../widgets/market_card.dart';
import '../../widgets/product_card.dart';

/// Guia visual: identidade e componentes padrão do EconoRota.
class ComponentsScreen extends StatelessWidget {
  const ComponentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final t = Theme.of(context).textTheme;
    Widget title(String s) => Padding(
      padding: const EdgeInsets.fromLTRB(0, 28, 0, 12),
      child: Text(s, style: t.titleLarge),
    );

    const colors = [
      ('Roxo', AppColors.primary, '#480082'),
      ('Verde', AppColors.accent, '#39FF14'),
      ('Fundo', AppColors.background, '#0A0F2B'),
      ('Superfície', AppColors.surface, '#121A3F'),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(l.menuComponents)),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
            children: [
              const Center(child: AppLogo(size: 64)),
              const SizedBox(height: 8),
              Text(
                l.slogan,
                textAlign: TextAlign.center,
                style: t.bodyMedium?.copyWith(color: AppColors.textMuted),
              ),
              title('Cores'),
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  for (final (name, c, hex) in colors)
                    Column(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: c,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.border, width: 2),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(name, style: t.labelMedium),
                        Text(hex, style: t.bodySmall),
                      ],
                    ),
                ],
              ),
              title('Tipografia'),
              Text('Montserrat — títulos', style: t.headlineSmall),
              const SizedBox(height: 4),
              Text('Roboto — textos. Mais economia, mais perto de você.', style: t.bodyLarge),
              title('Botões'),
              AppButton(label: l.primaryButton, onPressed: () {}),
              const SizedBox(height: 12),
              AppButton.secondary(label: l.secondaryButton, onPressed: () {}),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: AppButton(label: 'Carregando', loading: true, onPressed: () {}),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(child: AppButton(label: 'Desativado', onPressed: null)),
                ],
              ),
              title('Campos'),
              AppSearchField(hint: l.searchHint),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(hintText: 'E-mail', prefixIcon: Icon(Icons.mail_outline_rounded)),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(
                  hintText: 'Senha',
                  prefixIcon: Icon(Icons.lock_outline_rounded),
                  errorText: 'Senha muito curta',
                ),
              ),
              title('Cards de produto'),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  ProductCard(product: MockData.products[0], onAdd: () {}),
                  ProductCard(product: MockData.products[1], onAdd: () {}),
                  ProductCard(product: MockData.products[5], onAdd: () {}),
                ],
              ),
              title('Mercado'),
              MarketCard(market: MockData.markets.first),
              title('Categorias e filtros'),
              Wrap(
                spacing: 4,
                runSpacing: 8,
                children: [for (final c in MockData.categories.take(4)) CategoryTile(category: c)],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  FilterChip(label: const Text('Selecionado'), selected: true, onSelected: (_) {}),
                  FilterChip(label: const Text('Normal'), selected: false, onSelected: (_) {}),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
