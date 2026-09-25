import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../data/models/market_panel.dart';
import '../../data/repositories/geo_repository.dart';
import '../../data/repositories/market_panel_repository.dart';
import '../../services/location_service.dart';
import '../customer/widgets/common.dart';
import 'market_widgets.dart';

/// Dados da loja: CNPJ, contato, endereço com localização, horário, tempo de separação e Pix.
class StoreDataScreen extends StatefulWidget {
  const StoreDataScreen({super.key});

  @override
  State<StoreDataScreen> createState() => _StoreDataScreenState();
}

class _StoreDataScreenState extends State<StoreDataScreen> {
  StoreProfile? _p;
  String? _error;
  var _busy = false;
  final _c = {
    for (final k in [
      'document',
      'phone',
      'zip',
      'address',
      'district',
      'city',
      'state',
      'eta',
      'opens',
      'closes',
      'pix',
    ])
      k: TextEditingController(),
  };
  ({double lat, double lng})? _loc;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final p = await context.read<MarketPanelRepository>().storeProfile();
      if (!mounted) return;
      _fill(p);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  void _fill(StoreProfile p) => setState(() {
    _p = p;
    _error = null;
    _c['document']!.text = p.document ?? '';
    _c['phone']!.text = p.phone ?? '';
    _c['address']!.text = p.address ?? '';
    _c['district']!.text = p.district ?? '';
    _c['city']!.text = p.city ?? '';
    _c['state']!.text = p.state ?? '';
    _c['eta']!.text = '${p.etaMin}';
    _c['opens']!.text = p.opensAt;
    _c['closes']!.text = p.closesAt;
    _c['pix']!.text = p.pixKey ?? '';
    _loc = p.lat == null || p.lng == null ? null : (lat: p.lat!, lng: p.lng!);
  });

  void _say(String t) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(t)));

  Future<void> _byZip() async {
    final zip = _c['zip']!.text.replaceAll(RegExp(r'\D'), '');
    if (zip.length != 8) return _say('Digite o CEP com 8 números.');
    try {
      final a = await context.read<GeoRepository>().byZip(zip);
      setState(() {
        _c['address']!.text = '${a.street}, ';
        _c['district']!.text = a.district ?? '';
        _c['city']!.text = a.city;
        _c['state']!.text = a.state;
        if (a.lat != null && a.lng != null) _loc = (lat: a.lat!, lng: a.lng!);
      });
      _say('Endereço encontrado. Complete com o número.');
    } catch (e) {
      _say(friendlyError(e));
    }
  }

  Future<void> _here() async {
    try {
      final p = await context.read<LocationService>().current();
      setState(() => _loc = p);
      _say('Localização da loja registrada.');
    } catch (_) {
      _say('Não foi possível obter a localização. Use o CEP.');
    }
  }

  Future<void> _save() async {
    final repo = context.read<MarketPanelRepository>();
    final eta = int.tryParse(_c['eta']!.text.trim());
    final hhmm = RegExp(r'^\d{2}:\d{2}$');
    if (eta == null || eta < 5 || eta > 120) return _say('Tempo de separação de 5 a 120 minutos.');
    if (!hhmm.hasMatch(_c['opens']!.text) || !hhmm.hasMatch(_c['closes']!.text)) {
      return _say('Horário no formato 08:00.');
    }
    String? t(String k) => _c[k]!.text.trim().isEmpty ? null : _c[k]!.text.trim();
    setState(() => _busy = true);
    try {
      await repo.updateStore(opensAt: _c['opens']!.text, closesAt: _c['closes']!.text, pixKey: t('pix'));
      final p = await repo.saveStoreProfile({
        'document': ?t('document'),
        'phone': ?t('phone'),
        'address': ?t('address'),
        'district': ?t('district'),
        'city': ?t('city'),
        'state': ?t('state'),
        if (_loc != null) 'lat': _loc!.lat,
        if (_loc != null) 'lng': _loc!.lng,
        'eta_min': eta,
      });
      if (!mounted) return;
      _fill(p);
      _say(p.missing.isEmpty ? 'Dados da loja salvos.' : 'Salvo. Ainda falta: ${_missing(p)}.');
    } catch (e) {
      _say(friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _missing(StoreProfile p) => p.missing.map((m) => StoreProfile.missingLabels[m] ?? m).join(', ');

  Widget _field(String k, String label, {TextInputType? type, String? hint}) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: TextField(
      controller: _c[k],
      keyboardType: type,
      decoration: InputDecoration(labelText: label, hintText: hint),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final p = _p;
    return PanelPage(
      title: 'Dados da loja',
      subtitle: p?.name,
      showBack: true,
      maxWidth: 720,
      bottom: p == null
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: AppColors.line)),
                ),
                child: FilledButton(
                  onPressed: _busy ? null : _save,
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                  child: const Text('Salvar dados da loja'),
                ),
              ),
            ),
      children: [
        if (_error != null && p == null)
          RetryBox(message: _error!, onRetry: _load)
        else if (p == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else ...[
          if (p.status == 'pendente' || p.missing.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: PanelCard(
                child: Text(
                  p.status == 'pendente'
                      ? (p.missing.isEmpty
                            ? 'Dados completos. A equipe EconoRota vai conferir e aprovar sua loja.'
                            : 'Para aprovarmos sua loja, informe: ${_missing(p)}.')
                      : 'Falta informar: ${_missing(p)}.',
                  style: const TextStyle(color: Color(0xFF92400E), fontWeight: FontWeight.w700),
                ),
              ),
            ),
          const Text(
            'Empresa',
            style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
          ),
          const SizedBox(height: 8),
          _field('document', 'CNPJ', type: TextInputType.number),
          _field('phone', 'Telefone da loja', type: TextInputType.phone),
          const SizedBox(height: 6),
          const Text(
            'Endereço',
            style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _field('zip', 'CEP', type: TextInputType.number)),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: OutlinedButton(onPressed: _byZip, child: const Text('Buscar')),
              ),
            ],
          ),
          _field('address', 'Rua e número', hint: 'Rua Augusta, 900'),
          _field('district', 'Bairro'),
          Row(
            children: [
              Expanded(flex: 3, child: _field('city', 'Cidade')),
              const SizedBox(width: 8),
              Expanded(child: _field('state', 'UF')),
            ],
          ),
          PanelCard(
            child: Row(
              children: [
                Icon(
                  _loc == null ? Icons.location_off_rounded : Icons.location_on_rounded,
                  color: _loc == null ? AppColors.discount : AppColors.success,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _loc == null
                        ? 'Localização não definida (necessária para calcular distâncias).'
                        : 'Localização da loja definida.',
                    style: const TextStyle(color: AppColors.ink),
                  ),
                ),
                TextButton(onPressed: _here, child: const Text('Estou na loja')),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Operação',
            style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _field('opens', 'Abre às', hint: '07:00')),
              const SizedBox(width: 8),
              Expanded(child: _field('closes', 'Fecha às', hint: '22:00')),
            ],
          ),
          _field('eta', 'Tempo médio de separação (min)', type: TextInputType.number),
          _field('pix', 'Chave Pix para repasses'),
        ],
      ],
    );
  }
}
