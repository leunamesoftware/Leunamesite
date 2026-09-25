import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../customer/widgets/common.dart';
import '../market/market_widgets.dart';

const amberFg = Color(0xFF92400E);
const amberBg = Color(0xFFFEF3C7);

Pill okPill(String t, [IconData icon = Icons.check_circle_rounded]) =>
    Pill(t, fg: AppColors.success, bg: AppColors.successSoft, icon: icon);
Pill warnPill(String t, [IconData icon = Icons.schedule_rounded]) => Pill(t, fg: amberFg, bg: amberBg, icon: icon);
Pill badPill(String t, [IconData icon = Icons.block_rounded]) =>
    Pill(t, fg: AppColors.discount, bg: AppColors.dangerSoft, icon: icon);
Pill infoPill(String t, [IconData icon = Icons.info_rounded]) =>
    Pill(t, fg: AppColors.info, bg: AppColors.infoSoft, icon: icon);
Pill mutedPill(String t, [IconData icon = Icons.history_rounded]) =>
    Pill(t, fg: AppColors.inkMuted, bg: AppColors.sheet, icon: icon);

/// Barra de ações fixa no rodapé (fundo branco, sem sobrepor o conteúdo).
Widget adminBottomBar({required Widget child}) => DecoratedBox(
  decoration: const BoxDecoration(
    color: Colors.white,
    border: Border(top: BorderSide(color: AppColors.line)),
  ),
  child: SafeArea(child: child),
);

const muted = TextStyle(color: AppColors.inkMuted, fontSize: 12.5);
const strong = TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink);

/// Pede um texto (motivo/nota). Devolve null se cancelar.
Future<String?> askText(
  BuildContext context, {
  required String title,
  required String label,
  String confirm = 'Confirmar',
  bool required = true,
  bool danger = false,
}) {
  final ctrl = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (c) => StatefulBuilder(
      builder: (c, set) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          minLines: 1,
          maxLength: 300,
          onChanged: (_) => set(() {}),
          decoration: InputDecoration(labelText: label),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Voltar')),
          FilledButton(
            style: danger ? FilledButton.styleFrom(backgroundColor: AppColors.discount) : null,
            onPressed: required && ctrl.text.trim().length < 3 ? null : () => Navigator.pop(c, ctrl.text.trim()),
            child: Text(confirm),
          ),
        ],
      ),
    ),
  );
}

Future<bool> confirmAction(BuildContext context, String title, String message, {String confirm = 'Confirmar'}) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Voltar')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(confirm)),
        ],
      ),
    ) ??
    false;

/// Aviso rápido (substitui o anterior, sem fila).
void notify(BuildContext context, String text) => ScaffoldMessenger.of(context)
  ..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(text)));

/// Executa uma ação com aviso de sucesso/erro. Devolve true se deu certo.
Future<bool> runAction(BuildContext context, Future<void> Function() action, String success) async {
  final messenger = ScaffoldMessenger.of(context);
  void show(String t) => messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(t)));
  try {
    await action();
    show(success);
    return true;
  } catch (e) {
    show(friendlyError(e));
    return false;
  }
}

/// Lista administrativa: filtros, busca, carregamento, erro, vazio e atualizar.
class AdminListPage<T> extends StatefulWidget {
  const AdminListPage({
    super.key,
    required this.title,
    required this.load,
    required this.itemBuilder,
    this.subtitle,
    this.filters = const [],
    this.search = false,
    this.searchHint = 'Buscar',
    this.emptyTitle = 'Nada por aqui',
    this.emptyIcon = Icons.inbox_rounded,
    this.header,
    this.fab,
  });

  final String title;
  final String? subtitle;

  /// (valor, rótulo). O primeiro é o filtro inicial; valor null = todos.
  final List<(String?, String)> filters;
  final bool search;
  final String searchHint;
  final Future<List<T>> Function(String? filter, String query) load;
  final Widget Function(BuildContext context, T item, VoidCallback reload) itemBuilder;
  final String emptyTitle;
  final IconData emptyIcon;
  final Widget? header;
  final Widget Function(VoidCallback reload)? fab;

  @override
  State<AdminListPage<T>> createState() => _AdminListPageState<T>();
}

class _AdminListPageState<T> extends State<AdminListPage<T>> {
  late String? _filter = widget.filters.isEmpty ? null : widget.filters.first.$1;
  final _query = TextEditingController();
  List<T>? _items;
  String? _error;
  var _seq = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final seq = ++_seq;
    try {
      final r = await widget.load(_filter, _query.text.trim());
      if (mounted && seq == _seq) {
        setState(() {
          _items = r;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && seq == _seq) setState(() => _error = friendlyError(e));
    }
  }

  void _reload() {
    setState(() => _items = null);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return PanelPage(
      title: widget.title,
      subtitle: widget.subtitle,
      showBack: true,
      onRefresh: _load,
      fab: widget.fab?.call(_reload),
      children: [
        ?widget.header,
        if (widget.search)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: TextField(
              controller: _query,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _reload(),
              decoration: InputDecoration(
                hintText: widget.searchHint,
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: IconButton(
                  tooltip: 'Buscar',
                  onPressed: _reload,
                  icon: const Icon(Icons.arrow_forward_rounded),
                ),
              ),
            ),
          ),
        if (widget.filters.length > 1)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final (value, label) in widget.filters)
                  ChoiceChip(
                    label: Text(label),
                    selected: _filter == value,
                    onSelected: (_) {
                      _filter = value;
                      _reload();
                    },
                  ),
              ],
            ),
          ),
        if (_error != null && items == null)
          RetryBox(message: _error!, onRetry: _reload)
        else if (items == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (items.isEmpty)
          LightEmpty(icon: widget.emptyIcon, title: widget.emptyTitle)
        else
          for (final it in items)
            Padding(padding: const EdgeInsets.only(bottom: 8), child: widget.itemBuilder(context, it, _reload)),
      ],
    );
  }
}

/// Carrega um valor e mostra carregando/erro (telas de detalhe e relatórios).
class Loader<T> extends StatefulWidget {
  const Loader({super.key, required this.load, required this.builder});

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T? value, String? error, Future<void> Function() reload) builder;

  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  T? _value;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await widget.load();
      if (mounted) {
        setState(() {
          _value = v;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _value, _error, _load);
}

/// Estado padrão enquanto carrega ou quando falhou.
Widget? loadingOrError(Object? value, String? error, Future<void> Function() reload) => value != null
    ? null
    : error != null
    ? RetryBox(message: error, onRetry: reload)
    : const Padding(
        padding: EdgeInsets.all(40),
        child: Center(child: CircularProgressIndicator()),
      );

/// Linha "rótulo: valor".
class Info extends StatelessWidget {
  const Info(this.label, this.value, {super.key});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 130, child: Text(label, style: muted)),
        Expanded(
          child: Text(
            value ?? '—',
            style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 14, 2, 8),
    child: Text(
      text,
      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.ink),
    ),
  );
}

/// Grade de KPIs responsiva.
class KpiGrid extends StatelessWidget {
  const KpiGrid({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final cols = c.maxWidth >= 900 ? 4 : (c.maxWidth >= 560 ? 3 : 2);
      const gap = 10.0;
      final w = (c.maxWidth - gap * (cols - 1)) / cols;
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [for (final k in children) SizedBox(width: w, child: k)],
      );
    },
  );
}

/// Barras simples (sem biblioteca de gráficos).
class MiniBars extends StatelessWidget {
  const MiniBars({super.key, required this.values, required this.labels, this.height = 120});

  final List<int> values;
  final List<String> labels;
  final double height;

  @override
  Widget build(BuildContext context) {
    final max = values.fold<int>(1, (a, b) => b > a ? b : a);
    return SizedBox(
      height: height + 22,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < values.length; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      height: (height * values[i] / max).clamp(2, height),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: i == values.length - 1 ? 1 : .55),
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(labels[i], maxLines: 1, style: const TextStyle(fontSize: 10, color: AppColors.inkMuted)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
