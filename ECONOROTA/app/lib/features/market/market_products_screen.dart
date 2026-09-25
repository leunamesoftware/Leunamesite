import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/market_panel.dart';
import '../../data/repositories/market_panel_repository.dart';
import '../../widgets/app_image.dart';
import '../../widgets/category_icon.dart';
import '../customer/widgets/common.dart';
import 'market_widgets.dart';

const _filters = [
  (null, 'Todos'),
  ('baixo', 'Estoque baixo'),
  ('indisponivel', 'Indisponíveis'),
  ('vencendo', 'Vencendo'),
  ('inativos', 'Inativos'),
];

/// Produtos do mercado: busca, filtros, categorias, preço, estoque e validade.
class MarketProductsScreen extends StatefulWidget {
  const MarketProductsScreen({super.key, this.filter, this.categoryId});

  final String? filter;
  final String? categoryId;

  @override
  State<MarketProductsScreen> createState() => _MarketProductsScreenState();
}

class _MarketProductsScreenState extends State<MarketProductsScreen> {
  late String? _filter = widget.filter;
  late String? _category = widget.categoryId;
  String _q = '';
  Timer? _debounce;
  List<PanelProduct>? _items;
  List<PanelCategory> _cats = const [];
  String? _error;
  int _gen = 0;

  MarketPanelRepository get _repo => context.read<MarketPanelRepository>();

  @override
  void initState() {
    super.initState();
    _repo
        .categories()
        .then((c) {
          if (mounted) setState(() => _cats = c);
        })
        .catchError((_) {});
    _load();
  }

  @override
  void didUpdateWidget(MarketProductsScreen old) {
    super.didUpdateWidget(old);
    if (old.filter != widget.filter || old.categoryId != widget.categoryId) {
      _filter = widget.filter;
      _category = widget.categoryId;
      _load();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final gen = ++_gen;
    try {
      final r = await _repo.products(query: _q, categoryId: _category, filter: _filter);
      if (mounted && gen == _gen) {
        setState(() {
          _items = r;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && gen == _gen) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _open(PanelProduct? p) async {
    await context.push(p == null ? '/mercado/produto/novo' : '/mercado/produto/${p.id}', extra: p);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final names = {for (final c in _cats) c.id: c.name};
    final items = _items;
    return PanelPage(
      title: 'Produtos',
      subtitle: items == null ? null : '${items.length} ${items.length == 1 ? 'produto' : 'produtos'}',
      onRefresh: _load,
      actions: [
        IconButton(
          tooltip: 'Categorias',
          onPressed: () => context.push('/mercado/categorias'),
          icon: const Icon(Icons.category_rounded, color: Colors.white),
        ),
      ],
      fab: FloatingActionButton.extended(
        onPressed: () => _open(null),
        backgroundColor: AppColors.accent,
        foregroundColor: AppColors.onAccent,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Adicionar produto', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      children: [
        TextField(
          decoration: InputDecoration(
            labelText: 'Buscar por nome, marca ou código de barras',
            prefixIcon: const Icon(Icons.search_rounded),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onChanged: (v) {
            _q = v.trim();
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 300), _load);
          },
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final (value, label) in _filters)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(label),
                    selected: _filter == value,
                    onSelected: (_) {
                      setState(() => _filter = value);
                      _load();
                    },
                  ),
                ),
            ],
          ),
        ),
        if (_cats.isNotEmpty) ...[
          const SizedBox(height: 6),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final c in [null, ..._cats.where((c) => c.products > 0)])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      avatar: c == null ? null : Icon(categoryIcon(c.id), size: 16),
                      label: Text(c == null ? 'Todas as categorias' : '${c.name} (${c.products})'),
                      selected: _category == c?.id,
                      onSelected: (_) {
                        setState(() => _category = c?.id);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        if (_error != null && items == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (items == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (items.isEmpty)
          const LightEmpty(icon: Icons.inventory_2_outlined, title: 'Nenhum produto aqui')
        else
          for (final p in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                onTap: () => _open(p),
                padding: const EdgeInsets.all(10),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: SizedBox(
                        width: 56,
                        height: 56,
                        child: AppImage(
                          p.imageUrl,
                          fit: BoxFit.contain,
                          fallback: ColoredBox(
                            color: AppColors.brandSoft,
                            child: Icon(categoryIcon(p.categoryId), color: AppColors.primaryLight),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.name,
                            style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                          ),
                          Text(
                            [p.brand, p.unit, names[p.categoryId]].whereType<String>().join(' · '),
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              if (!p.active)
                                const Pill(
                                  'Inativo',
                                  fg: AppColors.inkMuted,
                                  bg: AppColors.sheet,
                                  icon: Icons.visibility_off_rounded,
                                )
                              else
                                StockPill(p),
                              if (p.expiresOn != null) ExpiryPill(p.expiresOn!),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          money(p.promoPriceCents ?? p.priceCents),
                          style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                        ),
                        if (p.promoPriceCents != null)
                          Text(
                            money(p.priceCents),
                            style: const TextStyle(
                              color: AppColors.inkMuted,
                              fontSize: 12,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

/// Categorias do mercado com a quantidade de produtos (toque para filtrar).
class PanelCategoriesScreen extends StatelessWidget {
  const PanelCategoriesScreen({super.key});

  @override
  Widget build(BuildContext context) => FutureBuilder<List<PanelCategory>>(
    future: context.read<MarketPanelRepository>().categories(),
    builder: (context, snap) => PanelPage(
      title: 'Categorias',
      subtitle: 'Seus produtos organizados por seção',
      showBack: true,
      maxWidth: 820,
      children: [
        if (snap.hasError)
          RetryBox(message: friendlyError(snap.error!), onRetry: () => context.pushReplacement('/mercado/categorias'))
        else if (!snap.hasData)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else
          for (final c in snap.data!)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                onTap: () => context.go('/mercado/produtos?categoria=${c.id}'),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: AppColors.brandSoft,
                      child: Icon(categoryIcon(c.id), color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        c.name,
                        style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                      ),
                    ),
                    Text(
                      c.products == 0 ? 'nenhum produto' : '${c.products} ${c.products == 1 ? 'produto' : 'produtos'}',
                      style: const TextStyle(color: AppColors.inkMuted),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted),
                  ],
                ),
              ),
            ),
      ],
    ),
  );
}

/// Cadastro e edição de produto (preço, promoção, estoque mínimo, validade, código de barras).
class MarketProductFormScreen extends StatefulWidget {
  const MarketProductFormScreen({super.key, this.product});

  final PanelProduct? product;

  @override
  State<MarketProductFormScreen> createState() => _MarketProductFormScreenState();
}

class _MarketProductFormScreenState extends State<MarketProductFormScreen> {
  final _form = GlobalKey<FormState>();
  late final PanelProduct? p = widget.product;
  late final _name = TextEditingController(text: p?.name);
  late final _brand = TextEditingController(text: p?.brand);
  late final _unit = TextEditingController(text: p?.unit ?? '1 un');
  late final _price = TextEditingController(text: p == null ? '' : moneyInput(p!.priceCents));
  late final _promo = TextEditingController(text: p?.promoPriceCents == null ? '' : moneyInput(p!.promoPriceCents!));
  late final _stock = TextEditingController(text: '0');
  late final _min = TextEditingController(text: '${p?.minStock ?? 5}');
  late final _barcode = TextEditingController(text: p?.barcode);
  late final _desc = TextEditingController(text: p?.description);
  late String? _category = p?.categoryId;
  late DateTime? _expires = p?.expiresOn;
  List<PanelCategory> _cats = const [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    context
        .read<MarketPanelRepository>()
        .categories()
        .then((c) {
          if (mounted) setState(() => _cats = c);
        })
        .catchError((_) {});
  }

  @override
  void dispose() {
    for (final c in [_name, _brand, _unit, _price, _promo, _stock, _min, _barcode, _desc]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _opt(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final repo = context.read<MarketPanelRepository>();
    setState(() => _saving = true);
    try {
      final draft = ProductDraft(
        name: _name.text.trim(),
        brand: _opt(_brand),
        unit: _unit.text.trim(),
        categoryId: _category!,
        priceCents: parseMoney(_price.text)!,
        promoPriceCents: parseMoney(_promo.text),
        stock: int.tryParse(_stock.text) ?? 0,
        minStock: int.tryParse(_min.text) ?? 0,
        barcode: _opt(_barcode),
        description: _opt(_desc),
        expiresOn: _expires,
      );
      if (p == null) {
        await repo.createProduct(draft);
      } else {
        await repo.updateProduct(p!.id, draft.toJson());
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(p == null ? 'Produto cadastrado.' : 'Alterações salvas.')));
      context.pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleActive() async {
    final repo = context.read<MarketPanelRepository>();
    setState(() => _saving = true);
    try {
      await repo.updateProduct(p!.id, {'is_active': !p!.active});
      if (mounted) context.pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  InputDecoration _dec(String label, {String? hint, String? prefix, String? helper}) => InputDecoration(
    labelText: label,
    hintText: hint,
    prefixText: prefix,
    helperText: helper,
    helperMaxLines: 2,
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
  );

  @override
  Widget build(BuildContext context) {
    final money = [FilteringTextInputFormatter.allow(RegExp(r'[\d,\.]'))];
    final digits = [FilteringTextInputFormatter.digitsOnly];
    Widget row(List<Widget> children) => LayoutBuilder(
      builder: (_, b) => b.maxWidth >= 560
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (i, c) in children.indexed) ...[if (i > 0) const SizedBox(width: 12), Expanded(child: c)],
              ],
            )
          : Column(
              children: [
                for (final (i, c) in children.indexed) ...[if (i > 0) const SizedBox(height: 12), c],
              ],
            ),
    );
    return PanelPage(
      title: p == null ? 'Novo produto' : 'Editar produto',
      subtitle: p?.name,
      showBack: true,
      maxWidth: 760,
      bottom: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(
              p == null ? 'Cadastrar produto' : 'Salvar alterações',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ),
        ),
      ),
      children: [
        Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.sentences,
                decoration: _dec('Nome do produto', hint: 'Ex.: Arroz Tipo 1'),
                validator: (v) => (v ?? '').trim().length < 2 ? 'Informe o nome.' : null,
              ),
              const SizedBox(height: 12),
              row([
                TextFormField(
                  controller: _brand,
                  decoration: _dec('Marca (opcional)', hint: 'Ex.: Camil'),
                ),
                TextFormField(
                  controller: _unit,
                  decoration: _dec('Unidade / tamanho', hint: 'Ex.: 5 kg, 900 ml, 1 un'),
                  validator: (v) => (v ?? '').trim().isEmpty ? 'Informe a unidade.' : null,
                ),
              ]),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _category,
                decoration: _dec('Categoria'),
                items: [for (final c in _cats) DropdownMenuItem(value: c.id, child: Text(c.name))],
                onChanged: (v) => setState(() => _category = v),
                validator: (v) => v == null ? 'Escolha a categoria.' : null,
              ),
              const SizedBox(height: 12),
              row([
                TextFormField(
                  controller: _price,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: money,
                  decoration: _dec('Preço', prefix: 'R\$ '),
                  validator: (v) => (parseMoney(v ?? '') ?? 0) <= 0 ? 'Informe o preço.' : null,
                ),
                TextFormField(
                  controller: _promo,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: money,
                  decoration: _dec('Preço promocional (opcional)', prefix: 'R\$ '),
                  validator: (v) {
                    final promo = parseMoney(v ?? '');
                    final price = parseMoney(_price.text);
                    return promo != null && price != null && promo >= price ? 'Deve ser menor que o preço.' : null;
                  },
                ),
              ]),
              const SizedBox(height: 12),
              row([
                if (p == null)
                  TextFormField(
                    controller: _stock,
                    keyboardType: TextInputType.number,
                    inputFormatters: digits,
                    decoration: _dec('Estoque inicial'),
                  )
                else
                  InputDecorator(
                    decoration: _dec('Estoque atual', helper: 'Altere pela tela Estoque (entrada/saída).'),
                    child: Text(
                      '${p!.stock}',
                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                    ),
                  ),
                TextFormField(
                  controller: _min,
                  keyboardType: TextInputType.number,
                  inputFormatters: digits,
                  decoration: _dec('Estoque mínimo', helper: 'Abaixo disso, aparece como "estoque baixo".'),
                ),
              ]),
              const SizedBox(height: 12),
              row([
                TextFormField(
                  controller: _barcode,
                  keyboardType: TextInputType.number,
                  inputFormatters: digits,
                  decoration: _dec('Código de barras (opcional)'),
                  validator: (v) =>
                      (v ?? '').isNotEmpty && !RegExp(r'^\d{8,14}$').hasMatch(v!) ? '8 a 14 números.' : null,
                ),
                InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () async {
                    final now = DateTime.now();
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _expires ?? now.add(const Duration(days: 7)),
                      firstDate: now.subtract(const Duration(days: 1)),
                      lastDate: now.add(const Duration(days: 365 * 3)),
                    );
                    if (d != null) setState(() => _expires = d);
                  },
                  child: InputDecorator(
                    decoration: _dec('Validade (perecíveis)').copyWith(
                      suffixIcon: _expires == null
                          ? const Icon(Icons.event_rounded)
                          : IconButton(
                              tooltip: 'Remover validade',
                              onPressed: () => setState(() => _expires = null),
                              icon: const Icon(Icons.close_rounded),
                            ),
                    ),
                    child: Text(
                      _expires == null ? 'Sem validade' : date(_expires!),
                      style: const TextStyle(color: AppColors.ink),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              TextFormField(controller: _desc, maxLines: 3, maxLength: 500, decoration: _dec('Descrição (opcional)')),
              if (p != null) ...[
                const SizedBox(height: 4),
                OutlinedButton.icon(
                  onPressed: _saving ? null : _toggleActive,
                  icon: Icon(p!.active ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                  label: Text(p!.active ? 'Desativar produto (some da loja)' : 'Reativar produto'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: p!.active ? AppColors.discount : AppColors.success,
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text(
                    'Produtos não são apagados para manter o histórico dos pedidos.',
                    style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
