import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/errors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/compare.dart';
import '../../../data/repositories/compare_repository.dart';
import '../../../state/cart_controller.dart';
import '../../../widgets/app_image.dart';
import '../../../widgets/brand_header.dart';
import '../../../widgets/category_icon.dart';

const _example = 'Manteiga Qualy\nAçúcar\nÓleo de soja — 2\nArroz 5 kg\nFeijão carioca\nLeite integral — 6\nCafé Pilão';

/// Lista inteligente: LISTA → INTELIGÊNCIA → COMPARAÇÃO → MELHOR COMBINAÇÃO → CARRINHO PRONTO.
class SmartListScreen extends StatefulWidget {
  const SmartListScreen({super.key});

  @override
  State<SmartListScreen> createState() => _SmartListScreenState();
}

enum _Pick { cheapest, brand }

/// Escolhas do cliente para uma linha interpretada.
class _Choice {
  _Choice(this.src) : qty = src.qty, option = src.options.isEmpty ? null : src.options.first {
    final o = option;
    if (o == null) return;
    if (src.brand != null && src.brandFound) {
      pick = _Pick.brand; // marca pedida: respeitada, sem perguntar
      brand = src.brand;
    } else if (src.brand == null && o.brands.length <= 1) {
      pick = _Pick.cheapest; // só existe uma opção: nada a perguntar
    }
  }

  final SmartLine src;
  int qty;
  CatalogItem? option;
  _Pick? pick;
  String? brand;
  bool removed = false;

  bool get found => option != null;
  bool get active => found && !removed;
  bool get pending => active && (pick == null || (pick == _Pick.brand && brand == null));

  /// Sem marca escrita e ainda sem escolha. Marca não encontrada nunca entra no "mais barato para todos".
  bool get askCheapest => active && pick == null && src.brand == null;
}

class _SmartListScreenState extends State<SmartListScreen> {
  final _text = TextEditingController();
  List<_Choice>? _lines;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _resolve() async {
    final text = _text.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Digite ou cole sua lista.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await context.read<CompareRepository>().resolveList(text);
      if (mounted) setState(() => _lines = [for (final l in r) _Choice(l)]);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _cheapestForPending() => setState(() {
    for (final c in _lines!) {
      if (c.askCheapest) c.pick = _Pick.cheapest;
    }
  });

  void _build() {
    final cart = context.read<CartController>();
    for (final c in _lines!.where((c) => c.active)) {
      cart.addItem(c.option!, c.qty, c.pick == _Pick.brand ? c.brand : null);
    }
    context.pushReplacement('/cliente/comparar?lista=1');
  }

  @override
  Widget build(BuildContext context) {
    final lines = _lines;
    final active = lines?.where((c) => c.active).length ?? 0;
    final pending = lines?.where((c) => c.pending).length ?? 0;
    final askCheapest = lines?.where((c) => c.askCheapest).length ?? 0;
    return BrandScaffold(
      showBack: true,
      title: 'Lista inteligente',
      subtitle: 'Digite ou cole sua lista. O EconoRota monta o carrinho mais barato para você.',
      bottom: lines == null ? null : _Bar(active: active, pending: pending, onBuild: _build),
      slivers: [
        if (lines == null)
          SliverToBoxAdapter(
            child: _Input(
              controller: _text,
              loading: _loading,
              error: _error,
              onSubmit: _resolve,
              onExample: () => setState(() => _text.text = _example),
            ),
          )
        else ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${lines.length} ${lines.length == 1 ? 'item na lista' : 'itens na lista'}',
                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink, fontSize: 16),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () => setState(() => _lines = null),
                    icon: const Icon(Icons.edit_rounded, size: 18),
                    label: const Text('Editar lista'),
                  ),
                ],
              ),
            ),
          ),
          if (askCheapest > 1)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: OutlinedButton.icon(
                  onPressed: _cheapestForPending,
                  icon: const Icon(Icons.savings_rounded),
                  label: Text('Quero o mais barato nos $askCheapest itens sem marca'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    minimumSize: const Size.fromHeight(46),
                    side: const BorderSide(color: AppColors.primary),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ),
          SliverList.separated(
            itemCount: lines.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _LineCard(choice: lines[i], onChanged: () => setState(() {})),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ],
    );
  }
}

class _Input extends StatelessWidget {
  const _Input({
    required this.controller,
    required this.loading,
    required this.error,
    required this.onSubmit,
    required this.onExample,
  });

  final TextEditingController controller;
  final bool loading;
  final String? error;
  final VoidCallback onSubmit;
  final VoidCallback onExample;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: controller,
          minLines: 8,
          maxLines: 14,
          maxLength: 4000,
          keyboardType: TextInputType.multiline,
          style: const TextStyle(color: AppColors.ink, fontSize: 15.5, height: 1.4),
          decoration: InputDecoration(
            labelText: 'Sua lista de compras',
            alignLabelWithHint: true,
            hintText: 'Um item por linha. Ex.:\nManteiga Qualy\nAçúcar\nÓleo de soja — 2',
            errorText: error,
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
        const SizedBox(height: 4),
        const _Tip(icon: Icons.sell_rounded, text: 'Escreveu a marca? Buscamos só ela. Nunca trocamos sem perguntar.'),
        const _Tip(icon: Icons.numbers_rounded, text: 'Quantidade: "Óleo — 2" ou "3x arroz". Tamanho: "arroz 5 kg".'),
        const _Tip(icon: Icons.content_paste_rounded, text: 'Pode colar a lista do WhatsApp ou das notas do celular.'),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: loading ? null : onSubmit,
          icon: loading
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
              : const Icon(Icons.auto_awesome_rounded),
          label: Text(
            loading ? 'Entendendo sua lista…' : 'Entender minha lista',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            minimumSize: const Size.fromHeight(54),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        const SizedBox(height: 8),
        TextButton(onPressed: loading ? null : onExample, child: const Text('Usar uma lista de exemplo')),
      ],
    ),
  );
}

class _Tip extends StatelessWidget {
  const _Tip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: const TextStyle(color: AppColors.inkMuted, fontSize: 13)),
        ),
      ],
    ),
  );
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.choice, required this.onChanged});

  final _Choice choice;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final c = choice;
    final o = c.option;
    final src = c.src;
    final sizes = src.options.length > 1 && src.options.map((x) => x.unit).toSet().length > 1;

    if (o == null) {
      return _Shell(
        faded: true,
        child: Row(
          children: [
            const Icon(Icons.search_off_rounded, color: AppColors.inkMuted),
            const SizedBox(width: 10),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(text: 'Não encontramos '),
                    TextSpan(
                      text: '“${src.line}”',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const TextSpan(text: ' nos mercados perto de você. Este item fica fora do carrinho.'),
                  ],
                ),
                style: const TextStyle(color: AppColors.inkMuted, fontSize: 13.5),
              ),
            ),
          ],
        ),
      );
    }

    return _Shell(
      faded: c.removed,
      highlight: c.pending,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: AppImage(
                    o.imageUrl,
                    fit: BoxFit.contain,
                    fallback: Icon(categoryIcon(o.categoryId), size: 26, color: AppColors.primaryLight),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.pick == _Pick.brand && c.brand != null ? '${o.name} ${c.brand}' : o.name,
                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink, fontSize: 15),
                    ),
                    Text(
                      '${o.unit} · a partir de ${money(o.minPriceCents)} · ${o.markets} ${o.markets == 1 ? 'mercado' : 'mercados'}',
                      style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                    ),
                    Text(
                      'Você escreveu: “${src.line}”',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.inkMuted, fontSize: 11.5, fontStyle: FontStyle.italic),
                    ),
                  ],
                ),
              ),
              if (c.removed)
                TextButton(
                  onPressed: () {
                    c.removed = false;
                    onChanged();
                  },
                  child: const Text('Incluir'),
                )
              else
                _Qty(
                  label: o.name,
                  qty: c.qty,
                  onMinus: () {
                    c.qty > 1 ? c.qty-- : c.removed = true;
                    onChanged();
                  },
                  onPlus: () {
                    if (c.qty < CartController.maxQty) c.qty++;
                    onChanged();
                  },
                ),
            ],
          ),
          if (!c.removed) ...[
            if (sizes) ...[
              const SizedBox(height: 10),
              const _Label('Tamanho'),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  for (final x in src.options)
                    ChoiceChip(
                      label: Text(x.unit),
                      selected: x == o,
                      onSelected: (_) {
                        c.option = x;
                        if (c.brand != null && !x.brands.contains(c.brand)) c.brand = null;
                        onChanged();
                      },
                    ),
                ],
              ),
            ],
            if (src.brand != null && !src.brandFound) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    const Icon(Icons.info_rounded, color: Color(0xFFB45309), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Não encontramos a marca ${src.brand} para este produto. Escolha como prefere — não trocamos sem você decidir.',
                        style: const TextStyle(color: Color(0xFF92400E), fontSize: 12.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (src.brand != null && src.brandFound)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Row(
                  children: [
                    const Icon(Icons.verified_rounded, color: AppColors.success, size: 18),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Somente ${src.brand} — sua marca será respeitada.',
                        style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              )
            else if (o.brands.length > 1 || (src.brand != null && !src.brandFound)) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  ChoiceChip(
                    avatar: const Icon(Icons.savings_rounded, size: 18),
                    label: const Text('Quero o mais barato'),
                    selected: c.pick == _Pick.cheapest,
                    onSelected: (_) {
                      c.pick = _Pick.cheapest;
                      onChanged();
                    },
                  ),
                  if (o.brands.isNotEmpty)
                    ChoiceChip(
                      avatar: const Icon(Icons.sell_rounded, size: 18),
                      label: const Text('Marca de preferência'),
                      selected: c.pick == _Pick.brand,
                      onSelected: (_) {
                        c.pick = _Pick.brand;
                        onChanged();
                      },
                    ),
                ],
              ),
              if (c.pick == _Pick.brand) ...[
                const SizedBox(height: 8),
                const _Label('Escolha a marca'),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    for (final b in o.brands)
                      ChoiceChip(
                        label: Text(b),
                        selected: c.brand == b,
                        onSelected: (_) {
                          c.brand = b;
                          onChanged();
                        },
                      ),
                  ],
                ),
              ],
            ],
          ],
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink, fontSize: 13),
    ),
  );
}

class _Shell extends StatelessWidget {
  const _Shell({required this.child, this.faded = false, this.highlight = false});

  final Widget child;
  final bool faded;
  final bool highlight;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: faded ? 0.55 : 1,
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: highlight ? AppColors.primary : AppColors.line, width: highlight ? 1.5 : 1),
      ),
      child: child,
    ),
  );
}

class _Qty extends StatelessWidget {
  const _Qty({required this.label, required this.qty, required this.onMinus, required this.onPlus});

  final String label;
  final int qty;
  final VoidCallback onMinus;
  final VoidCallback onPlus;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      IconButton(
        tooltip: qty == 1 ? 'Tirar $label' : 'Diminuir $label',
        onPressed: onMinus,
        icon: Icon(qty == 1 ? Icons.delete_outline_rounded : Icons.remove_rounded, color: AppColors.primary),
      ),
      Text(
        '$qty',
        style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink, fontSize: 16),
      ),
      IconButton(
        tooltip: 'Aumentar $label',
        onPressed: onPlus,
        icon: const Icon(Icons.add_rounded, color: AppColors.primary),
      ),
    ],
  );
}

class _Bar extends StatelessWidget {
  const _Bar({required this.active, required this.pending, required this.onBuild});

  final int active;
  final int pending;
  final VoidCallback onBuild;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              pending > 0
                  ? '$pending ${pending == 1 ? 'item precisa' : 'itens precisam'} da sua escolha'
                  : '$active ${active == 1 ? 'item pronto' : 'itens prontos'} para comparar',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: pending > 0 ? AppColors.primary : AppColors.ink,
                fontSize: 13.5,
              ),
            ),
          ),
          FilledButton.icon(
            onPressed: pending == 0 && active > 0 ? onBuild : null,
            icon: const Icon(Icons.shopping_cart_checkout_rounded),
            label: const Text('Montar carrinho', style: TextStyle(fontWeight: FontWeight.w800)),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size(0, 52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ),
    ),
  );
}
