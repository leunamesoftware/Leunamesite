import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../data/models/market_panel.dart';

/// Página do painel: cabeçalho roxo + conteúdo claro, com largura confortável em telas grandes.
class PanelPage extends StatelessWidget {
  const PanelPage({
    super.key,
    required this.title,
    required this.children,
    this.subtitle,
    this.actions = const [],
    this.onRefresh,
    this.fab,
    this.bottom,
    this.showBack = false,
    this.maxWidth = 1100,
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final Widget? fab;
  final Widget? bottom;
  final bool showBack;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxWidth),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
          ),
        ),
      ],
    );
    return Theme(
      data: AppTheme.light,
      child: Scaffold(
        backgroundColor: AppColors.sheet,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          // Voltar sempre disponível (também quando a tela foi aberta por link direto).
          leading: showBack
              ? IconButton(
                  tooltip: 'Voltar',
                  onPressed: () => context.canPop() ? context.pop() : context.go('/'),
                  icon: const Icon(Icons.arrow_back_rounded),
                )
              : null,
          foregroundColor: Colors.white,
          iconTheme: const IconThemeData(color: Colors.white),
          backgroundColor: AppColors.primary,
          surfaceTintColor: Colors.transparent,
          titleSpacing: showBack ? 0 : 16,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w800,
                  fontSize: 19,
                ),
              ),
              if (subtitle != null) Text(subtitle!, style: const TextStyle(color: Colors.white70, fontSize: 12.5)),
            ],
          ),
          actions: actions,
        ),
        floatingActionButton: fab,
        bottomNavigationBar: bottom,
        body: onRefresh == null ? list : RefreshIndicator(onRefresh: onRefresh!, color: AppColors.primary, child: list),
      ),
    );
  }
}

class PanelCard extends StatelessWidget {
  const PanelCard({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(14)});

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: const BorderSide(color: AppColors.line),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

class KpiCard extends StatelessWidget {
  const KpiCard({super.key, required this.icon, required this.label, required this.value, this.color, this.onTap});

  final IconData icon;
  final String label;
  final String value;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => PanelCard(
    onTap: onTap,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: (color ?? AppColors.primary).withValues(alpha: .12),
              child: Icon(icon, color: color ?? AppColors.primary, size: 20),
            ),
            const Spacer(),
            if (onTap != null) const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted),
          ],
        ),
        const SizedBox(height: 10),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            style: const TextStyle(
              fontFamily: 'Montserrat',
              fontWeight: FontWeight.w800,
              fontSize: 20,
              color: AppColors.ink,
            ),
          ),
        ),
        Text(
          label,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
        ),
      ],
    ),
  );
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, required this.fg, required this.bg, this.icon});

  final String text;
  final Color fg;
  final Color bg;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 4)],
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12),
          ),
        ),
      ],
    ),
  );
}

const _amberFg = Color(0xFF92400E);
const _amberBg = Color(0xFFFEF3C7);

class StockPill extends StatelessWidget {
  const StockPill(this.p, {super.key});

  final PanelProduct p;

  @override
  Widget build(BuildContext context) => switch (p.level) {
    StockLevel.out => const Pill(
      'Indisponível',
      fg: AppColors.discount,
      bg: AppColors.dangerSoft,
      icon: Icons.block_rounded,
    ),
    StockLevel.low => Pill('Estoque baixo · ${p.stock}', fg: _amberFg, bg: _amberBg, icon: Icons.warning_amber_rounded),
    StockLevel.ok => Pill(
      'Em estoque · ${p.stock}',
      fg: AppColors.success,
      bg: AppColors.successSoft,
      icon: Icons.check_circle_rounded,
    ),
  };
}

class ExpiryPill extends StatelessWidget {
  const ExpiryPill(this.date, {super.key});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final days = DateTime(date.year, date.month, date.day).difference(DateUtils.dateOnly(DateTime.now())).inDays;
    final text = days < 0
        ? 'Vencido'
        : days == 0
        ? 'Vence hoje'
        : days <= 3
        ? 'Vence em $days ${days == 1 ? 'dia' : 'dias'}'
        : 'Val. ${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    return days <= 3
        ? Pill(text, fg: AppColors.discount, bg: AppColors.dangerSoft, icon: Icons.event_busy_rounded)
        : Pill(text, fg: AppColors.inkMuted, bg: AppColors.sheet, icon: Icons.event_rounded);
  }
}

Pill orderStatusPill(PanelOrder o) => switch (o.status) {
  'novo' => Pill(o.statusLabel, fg: AppColors.info, bg: AppColors.infoSoft, icon: Icons.fiber_new_rounded),
  'em_separacao' || 'conferido' => Pill(o.statusLabel, fg: _amberFg, bg: _amberBg, icon: Icons.inventory_2_rounded),
  'pronto' => Pill(o.statusLabel, fg: AppColors.success, bg: AppColors.successSoft, icon: Icons.check_circle_rounded),
  'cancelado' => Pill(o.statusLabel, fg: AppColors.discount, bg: AppColors.dangerSoft, icon: Icons.cancel_rounded),
  _ => Pill(o.statusLabel, fg: AppColors.inkMuted, bg: AppColors.sheet, icon: Icons.history_rounded),
};

/// "há 5 min", "há 2 h", "ontem".
String timeAgo(DateTime d) {
  final m = DateTime.now().difference(d).inMinutes;
  if (m < 1) return 'agora';
  if (m < 60) return 'há $m min';
  if (m < 60 * 24) return 'há ${m ~/ 60} h';
  return m < 60 * 48 ? 'ontem' : 'há ${m ~/ (60 * 24)} dias';
}

/// "12,90" → 1290 (null se vazio/inválido).
int? parseMoney(String s) {
  final t = s.replaceAll(RegExp(r'[^\d,\.]'), '').replaceAll('.', '').replaceAll(',', '.');
  if (t.isEmpty) return null;
  final v = double.tryParse(t);
  return v == null ? null : (v * 100).round();
}

String moneyInput(int cents) => (cents / 100).toStringAsFixed(2).replaceAll('.', ',');
