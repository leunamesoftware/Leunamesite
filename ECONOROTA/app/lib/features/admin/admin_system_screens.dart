import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../data/models/admin.dart';
import '../../data/repositories/admin_repository.dart';
import '../market/market_widgets.dart';
import 'admin_widgets.dart';

class AdminReportsScreen extends StatefulWidget {
  const AdminReportsScreen({super.key});

  @override
  State<AdminReportsScreen> createState() => _AdminReportsScreenState();
}

class _AdminReportsScreenState extends State<AdminReportsScreen> {
  var _days = 30;

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return Loader<AdminReport>(
      key: ValueKey(_days),
      load: () => repo.report(_days),
      builder: (context, r, error, reload) => PanelPage(
        title: 'Relatórios',
        subtitle: 'Últimos $_days dias',
        showBack: true,
        onRefresh: reload,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 7, label: Text('7 dias')),
                ButtonSegment(value: 30, label: Text('30 dias')),
                ButtonSegment(value: 90, label: Text('90 dias')),
              ],
              selected: {_days},
              onSelectionChanged: (s) => setState(() => _days = s.first),
            ),
          ),
          ?loadingOrError(r, error, reload),
          if (r != null) ...[
            KpiGrid(
              children: [
                KpiCard(icon: Icons.receipt_long_rounded, label: 'Pedidos pagos', value: '${r['orders']}'),
                KpiCard(icon: Icons.payments_rounded, label: 'Vendas totais (GMV)', value: money(r['gmv_cents'])),
                KpiCard(
                  icon: Icons.shopping_basket_rounded,
                  label: 'Ticket médio',
                  value: money(r['avg_ticket_cents']),
                ),
                KpiCard(
                  icon: Icons.account_balance_rounded,
                  label: 'Receita da plataforma',
                  value: money(r['platform_revenue_cents']),
                  color: AppColors.success,
                ),
                KpiCard(
                  icon: Icons.percent_rounded,
                  label: 'Comissão dos mercados',
                  value: money(r['commission_cents']),
                ),
                KpiCard(
                  icon: Icons.local_shipping_rounded,
                  label: 'Entregas (parte da plataforma)',
                  value: money(r['platform_delivery_cents']),
                ),
                KpiCard(
                  icon: Icons.savings_rounded,
                  label: 'Economia gerada aos clientes',
                  value: money(r['savings_cents']),
                  color: AppColors.roleMarket,
                ),
                KpiCard(icon: Icons.people_alt_rounded, label: 'Clientes que compraram', value: '${r['customers']}'),
              ],
            ),
            if (r.byDay.isNotEmpty) ...[
              const SectionTitle('Vendas por dia'),
              PanelCard(
                child: MiniBars(
                  values: [for (final d in r.byDay) d.gmvCents],
                  labels: [
                    for (final (i, d) in r.byDay.indexed)
                      i % (r.byDay.length ~/ 7 + 1) == 0 ? '${d.day.day}/${d.day.month}' : '',
                  ],
                ),
              ),
            ],
            const SectionTitle('Entregas'),
            PanelCard(
              child: Column(
                children: [
                  Info('Entregues', '${r.delivered}'),
                  Info(
                    'No prazo',
                    r.delivered == 0 ? null : '${r.onTime} (${(r.onTime * 100 / r.delivered).round()}%)',
                  ),
                  Info(
                    'Tempo médio',
                    r.avgMinutes == null ? null : '${r.avgMinutes!.round()} min do pagamento à entrega',
                  ),
                ],
              ),
            ),
            const SectionTitle('Mercados que mais vendem'),
            PanelCard(
              child: Column(
                children: [
                  if (r.byMarket.isEmpty) const Text('Sem vendas no período.', style: muted),
                  for (final m in r.byMarket)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Expanded(child: Text(m.name)),
                          Text('${m.orders} pedidos · ', style: muted),
                          Text(money(m.salesCents), style: strong),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SectionTitle('Produtos mais vendidos'),
            PanelCard(
              child: Column(
                children: [
                  if (r.topProducts.isEmpty) const Text('Sem vendas no período.', style: muted),
                  for (final p in r.topProducts)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Expanded(child: Text(p.name)),
                          Text('${p.quantity} un · ', style: muted),
                          Text(money(p.salesCents), style: strong),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class AdminSettingsScreen extends StatefulWidget {
  const AdminSettingsScreen({super.key});

  @override
  State<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends State<AdminSettingsScreen> {
  AdminSettings? _s;
  final _ctrl = <String, TextEditingController>{};
  var _busy = false;

  @override
  void dispose() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _fill(AdminSettings s) {
    _s = s;
    for (final e in s.values.entries) {
      final money = AdminSettings.labels[e.key]?.$2 == 'money';
      (_ctrl[e.key] ??= TextEditingController()).text = money ? moneyInput(e.value) : '${e.value}';
    }
  }

  Future<void> _save(Future<void> Function() reload) async {
    final s = _s!;
    final changes = <String, int>{};
    for (final e in s.values.entries) {
      final isMoney = AdminSettings.labels[e.key]?.$2 == 'money';
      final t = _ctrl[e.key]!.text;
      final v = isMoney ? parseMoney(t) : int.tryParse(t.trim());
      final l = s.limits[e.key]!;
      if (v == null || v < l.min || v > l.max) {
        final range = isMoney ? '${money(l.min)} a ${money(l.max)}' : '${l.min} a ${l.max}';
        notify(context, '${AdminSettings.labels[e.key]?.$1 ?? e.key}: use de $range.');
        return;
      }
      if (v != e.value) changes[e.key] = v;
    }
    if (changes.isEmpty) {
      notify(context, 'Nada foi alterado.');
      return;
    }
    final ok = await confirmAction(
      context,
      'Aplicar ${changes.length} alteração(ões)?',
      'Os novos valores valem em até 30 segundos para novos pedidos. Pedidos já feitos não mudam.',
      confirm: 'Aplicar',
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    final repo = context.read<AdminRepository>();
    AdminSettings? saved;
    await runAction(context, () async => saved = await repo.saveSettings(changes), 'Configurações salvas.');
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (saved != null) _fill(saved!);
    });
  }

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return Loader<AdminSettings>(
      load: () async {
        final s = await repo.settings();
        _fill(s);
        return s;
      },
      builder: (context, s, error, reload) => PanelPage(
        title: 'Configurações',
        subtitle: 'Valores usados em todo o aplicativo',
        showBack: true,
        maxWidth: 720,
        onRefresh: reload,
        bottom: s == null
            ? null
            : adminBottomBar(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
                  child: FilledButton(
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                    onPressed: _busy ? null : () => _save(reload),
                    child: const Text('Salvar alterações'),
                  ),
                ),
              ),
        children: [
          ?loadingOrError(s, error, reload),
          if (s != null) ...[
            const PanelCard(
              child: Text(
                'Toda alteração fica registrada na auditoria (quem mudou, de quanto para quanto).',
                style: muted,
              ),
            ),
            const SizedBox(height: 12),
            for (final key in AdminSettings.labels.keys.where(s.values.containsKey))
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  controller: _ctrl[key],
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: AdminSettings.labels[key]!.$1,
                    prefixText: AdminSettings.labels[key]!.$2 == 'money' ? r'R$ ' : null,
                    suffixText: switch (AdminSettings.labels[key]!.$2) {
                      'pct' => '%',
                      'days' => 'dias',
                      _ => null,
                    },
                    helperText: AdminSettings.labels[key]!.$2 == 'money'
                        ? 'Padrão ${money(s.limits[key]!.def)}'
                        : 'Padrão ${s.limits[key]!.def} · de ${s.limits[key]!.min} a ${s.limits[key]!.max}',
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class AdminTeamScreen extends StatelessWidget {
  const AdminTeamScreen({super.key});

  Future<void> _add(BuildContext context, VoidCallback reload) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => _MemberDialog(repo: context.read<AdminRepository>()),
    );
    if (ok == true) reload();
  }

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminMember>(
      title: 'Usuários e permissões',
      subtitle: 'Equipe administrativa',
      header: const Padding(
        padding: EdgeInsets.only(bottom: 12),
        child: PanelCard(
          child: Text(
            'Operação: clientes, mercados, entregadores, pedidos, entregas, ocorrências, avaliações e regiões.\n'
            'Financeiro: pagamentos e relatórios.\n'
            'Sistema: configurações, equipe e auditoria.',
            style: muted,
          ),
        ),
      ),
      emptyTitle: 'Nenhum administrador',
      load: (_, _) => repo.team(),
      fab: (reload) => FloatingActionButton.extended(
        onPressed: () => _add(context, reload),
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: const Text('Adicionar'),
      ),
      itemBuilder: (context, m, reload) => PanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(m.name, style: strong)),
                m.status == 'bloqueado' ? badPill('Bloqueado') : okPill('Ativo'),
              ],
            ),
            Text(m.email, style: muted),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final a in AdminArea.values)
                  FilterChip(
                    label: Text(a.label),
                    selected: m.areas.contains(a),
                    onSelected: (on) async {
                      final areas = {...m.areas};
                      on ? areas.add(a) : areas.remove(a);
                      if (areas.isEmpty) return;
                      if (await runAction(
                        context,
                        () => repo.updateMember(m.id, areas: areas),
                        'Permissões atualizadas.',
                      )) {
                        reload();
                      }
                    },
                  ),
              ],
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () async {
                  final block = m.status != 'bloqueado';
                  if (await runAction(
                    context,
                    () => repo.updateMember(m.id, blocked: block),
                    block ? 'Acesso bloqueado.' : 'Acesso liberado.',
                  )) {
                    reload();
                  }
                },
                child: Text(m.status == 'bloqueado' ? 'Liberar acesso' : 'Bloquear acesso'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MemberDialog extends StatefulWidget {
  const _MemberDialog({required this.repo});

  final AdminRepository repo;

  @override
  State<_MemberDialog> createState() => _MemberDialogState();
}

class _MemberDialogState extends State<_MemberDialog> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _areas = <AdminArea>{AdminArea.operacao};
  var _busy = false;

  Future<void> _save() async {
    setState(() => _busy = true);
    final ok = await runAction(
      context,
      () => widget.repo.addMember(
        name: _name.text.trim(),
        email: _email.text.trim(),
        password: _pass.text,
        areas: _areas,
      ),
      'Administrador adicionado.',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Novo administrador'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Nome'),
          ),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-mail'),
          ),
          TextField(
            controller: _pass,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Senha inicial (mín. 8)'),
          ),
          const SizedBox(height: 12),
          const Text('Áreas liberadas', style: strong),
          Wrap(
            spacing: 6,
            children: [
              for (final a in AdminArea.values)
                FilterChip(
                  label: Text(a.label),
                  selected: _areas.contains(a),
                  onSelected: (on) => setState(() => on ? _areas.add(a) : _areas.remove(a)),
                ),
            ],
          ),
        ],
      ),
    ),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Voltar')),
      FilledButton(onPressed: _busy || _areas.isEmpty ? null : _save, child: const Text('Adicionar')),
    ],
  );
}

class AdminAuditScreen extends StatelessWidget {
  const AdminAuditScreen({super.key});

  static String describe(String action) => switch (action.split('.').first) {
    'settings' => 'Configurações',
    'user' || 'admin' => 'Usuários',
    'market' => 'Mercados',
    'courier' => 'Entregadores',
    'order' => 'Pedidos',
    'payment' => 'Pagamentos',
    'product' => 'Produtos',
    'region' => 'Regiões',
    'rating' => 'Avaliações',
    'occurrence' => 'Ocorrências',
    'auth' => 'Acesso',
    _ => 'Sistema',
  };

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AuditEntry>(
      title: 'Logs e auditoria',
      subtitle: 'Últimos 100 registros',
      filters: const [
        (null, 'Tudo'),
        ('settings', 'Configurações'),
        ('courier', 'Entregadores'),
        ('market', 'Mercados'),
        ('order', 'Pedidos'),
        ('payment', 'Pagamentos'),
        ('user', 'Usuários'),
        ('auth', 'Acessos'),
      ],
      emptyTitle: 'Nenhum registro',
      emptyIcon: Icons.manage_search_rounded,
      load: (f, _) async => (await repo.audit(action: f)).items,
      itemBuilder: (context, a, _) => PanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(a.action, style: strong)),
                mutedPill(describe(a.action), Icons.label_rounded),
              ],
            ),
            Text(
              [
                dateTime(a.createdAt),
                if (a.userName != null) '${a.userName} (${a.userRole})' else 'sistema',
                if (a.entityId != null) '${a.entity} ${shortCode(a.entityId!)}',
              ].join(' · '),
              style: muted,
            ),
            if (a.data != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '${a.data}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.ink),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
