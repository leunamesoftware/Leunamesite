import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../data/models/admin.dart';
import '../../data/repositories/admin_repository.dart';
import '../market/market_widgets.dart';
import 'admin_widgets.dart';

class AdminProductsScreen extends StatelessWidget {
  const AdminProductsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminProduct>(
      title: 'Produtos e estoque',
      subtitle: 'Todos os mercados',
      search: true,
      searchHint: 'Produto, marca ou código de barras',
      filters: const [
        ('indisponivel', 'Sem estoque'),
        ('baixo', 'Estoque baixo'),
        ('vencendo', 'Vencendo'),
        ('inativo', 'Fora do ar'),
        (null, 'Todos'),
      ],
      emptyTitle: 'Nenhum produto nesta lista',
      emptyIcon: Icons.inventory_2_outlined,
      load: (f, q) => repo.products(q: q, filter: f),
      itemBuilder: (context, p, reload) => PanelCard(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text([p.name, ?p.brand, p.unit].join(' · '), style: strong),
                  Text(
                    '${p.marketName} · ${money(p.promoPriceCents ?? p.priceCents)}'
                    '${p.promoPriceCents != null ? ' (de ${money(p.priceCents)})' : ''}',
                    style: muted,
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      if (!p.active)
                        badPill('Fora do ar')
                      else if (p.stock == 0)
                        badPill('Sem estoque')
                      else if (p.stock <= p.minStock)
                        warnPill('Estoque baixo · ${p.stock}', Icons.warning_amber_rounded)
                      else
                        okPill('Estoque · ${p.stock}'),
                      if (p.expiresOn != null) ExpiryPill(p.expiresOn!),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: p.active ? 'Tirar do ar' : 'Voltar ao ar',
              onPressed: () async {
                String? reason;
                if (p.active) {
                  reason = await askText(
                    context,
                    title: 'Tirar "${p.name}" do ar?',
                    label: 'Motivo (ex.: produto irregular, preço abusivo)',
                    confirm: 'Tirar do ar',
                    danger: true,
                  );
                  if (reason == null) return;
                }
                if (!context.mounted) return;
                final ok = await runAction(
                  context,
                  () => repo.setProductActive(p.id, !p.active, reason: reason),
                  p.active ? 'Produto fora do ar.' : 'Produto de volta ao ar.',
                );
                if (ok) reload();
              },
              icon: Icon(
                p.active ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                color: p.active ? AppColors.discount : AppColors.success,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AdminRatingsScreen extends StatelessWidget {
  const AdminRatingsScreen({super.key});

  static const _roles = {'cliente': 'Cliente', 'mercado': 'Mercado', 'entregador': 'Entregador'};

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminRating>(
      title: 'Avaliações',
      subtitle: 'Oculte avaliações ofensivas ou indevidas',
      filters: const [('2', 'Até 2 estrelas'), ('5', 'Todas'), ('ocultas', 'Ocultas')],
      emptyTitle: 'Nenhuma avaliação nesta lista',
      emptyIcon: Icons.star_outline_rounded,
      load: (f, _) => f == 'ocultas' ? repo.ratings(hidden: true) : repo.ratings(maxStars: int.parse(f ?? '5')),
      itemBuilder: (context, r, reload) => PanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${_roles[r.fromRole]} ${r.fromName.split(' ').first} → ${_roles[r.toType]} ${r.toName}',
                    style: strong,
                  ),
                ),
                Text('${'★' * r.stars}${'☆' * (5 - r.stars)}', style: const TextStyle(color: AppColors.star)),
              ],
            ),
            if (r.comment != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(r.comment!)),
            if (r.tags.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [for (final t in r.tags) mutedPill(t, Icons.sell_rounded)],
                ),
              ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${r.source == 'loja' ? 'Pública na loja' : 'Interna'} · pedido ${shortCode(r.orderId)} · ${date(r.createdAt)}',
                    style: muted,
                  ),
                ),
                TextButton(
                  onPressed: () async {
                    if (await runAction(
                      context,
                      () => repo.setRatingHidden(r, !r.hidden),
                      r.hidden ? 'Avaliação visível novamente.' : 'Avaliação ocultada. A nota foi recalculada.',
                    )) {
                      reload();
                    }
                  },
                  child: Text(r.hidden ? 'Reexibir' : 'Ocultar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class AdminRegionsScreen extends StatelessWidget {
  const AdminRegionsScreen({super.key});

  Future<void> _edit(BuildContext context, VoidCallback reload, [AdminRegion? r]) async {
    final repo = context.read<AdminRepository>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => _RegionDialog(repo: repo, region: r),
    );
    if (ok == true) reload();
  }

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AdminRepository>();
    return AdminListPage<AdminRegion>(
      title: 'Regiões atendidas',
      subtitle: 'Centro e raio de cada área',
      emptyTitle: 'Nenhuma região cadastrada',
      emptyIcon: Icons.map_outlined,
      load: (_, _) => repo.regions(),
      fab: (reload) => FloatingActionButton.extended(
        onPressed: () => _edit(context, reload),
        icon: const Icon(Icons.add_location_alt_rounded),
        label: const Text('Nova região'),
      ),
      itemBuilder: (context, r, reload) => PanelCard(
        onTap: () => _edit(context, reload, r),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.name, style: strong),
                  Text('${r.city}/${r.state} · raio de ${km(r.radiusKm)} km', style: muted),
                  Text(
                    '${r.markets} mercados ativos · ${r.couriersOnline} entregadores disponíveis agora',
                    style: muted,
                  ),
                ],
              ),
            ),
            Switch(
              value: r.active,
              onChanged: (v) async {
                if (await runAction(
                  context,
                  () => repo.setRegionActive(r.id, v),
                  v ? 'Região ativada.' : 'Região pausada.',
                )) {
                  reload();
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _RegionDialog extends StatefulWidget {
  const _RegionDialog({required this.repo, this.region});

  final AdminRepository repo;
  final AdminRegion? region;

  @override
  State<_RegionDialog> createState() => _RegionDialogState();
}

class _RegionDialogState extends State<_RegionDialog> {
  late final _name = TextEditingController(text: widget.region?.name);
  late final _city = TextEditingController(text: widget.region?.city);
  late final _state = TextEditingController(text: widget.region?.state);
  late final _lat = TextEditingController(text: widget.region?.lat.toString());
  late final _lng = TextEditingController(text: widget.region?.lng.toString());
  late final _radius = TextEditingController(text: (widget.region?.radiusKm ?? 8).toString());
  var _busy = false;

  double? _num(TextEditingController c) => double.tryParse(c.text.trim().replaceAll(',', '.'));

  Future<void> _save() async {
    final lat = _num(_lat), lng = _num(_lng), radius = _num(_radius);
    if (_name.text.trim().length < 2 || _city.text.trim().length < 2 || _state.text.trim().length != 2) {
      notify(context, 'Preencha nome, cidade e UF.');
      return;
    }
    if (lat == null || lng == null || radius == null) {
      notify(context, 'Latitude, longitude e raio inválidos.');
      return;
    }
    setState(() => _busy = true);
    final ok = await runAction(
      context,
      () => widget.repo.saveRegion(
        id: widget.region?.id,
        name: _name.text.trim(),
        city: _city.text.trim(),
        state: _state.text.trim(),
        lat: lat,
        lng: lng,
        radiusKm: radius,
      ),
      'Região salva.',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.region == null ? 'Nova região' : 'Editar região'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Nome (ex.: Centro expandido)'),
          ),
          TextField(
            controller: _city,
            decoration: const InputDecoration(labelText: 'Cidade'),
          ),
          TextField(
            controller: _state,
            maxLength: 2,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'UF'),
          ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _lat,
                  keyboardType: const TextInputType.numberWithOptions(signed: true, decimal: true),
                  decoration: const InputDecoration(labelText: 'Latitude'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _lng,
                  keyboardType: const TextInputType.numberWithOptions(signed: true, decimal: true),
                  decoration: const InputDecoration(labelText: 'Longitude'),
                ),
              ),
            ],
          ),
          TextField(
            controller: _radius,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Raio (km)'),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Voltar')),
      FilledButton(onPressed: _busy ? null : _save, child: const Text('Salvar')),
    ],
  );
}
