import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../data/models/courier.dart';
import '../../data/repositories/courier_repository.dart';
import '../../state/courier_controller.dart';
import '../../widgets/delivery_map.dart';
import '../customer/widgets/common.dart';
import '../market/market_widgets.dart';

/// Entrega em andamento: ir ao mercado → chegada → conferência e retirada → rota → cliente → QR Code → finalização.
class CourierDeliveryScreen extends StatefulWidget {
  const CourierDeliveryScreen({super.key});

  @override
  State<CourierDeliveryScreen> createState() => _CourierDeliveryScreenState();
}

class _CourierDeliveryScreenState extends State<CourierDeliveryScreen> {
  ActiveDelivery? _d;
  bool _loaded = false;
  String? _error;
  bool _busy = false;

  CourierRepository get _repo => context.read<CourierRepository>();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await _repo.current();
      if (mounted) {
        setState(() {
          _d = d;
          _loaded = true;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  Future<void> _run(Future<void> Function() f, [String? ok]) async {
    setState(() => _busy = true);
    try {
      await f();
      await _load();
      if (ok != null && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Rota no app de navegação preferido (Google Maps ou Waze).
  Future<void> _navigate(double lat, double lng) async {
    final app = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.map_rounded),
              title: const Text('Google Maps'),
              onTap: () => Navigator.pop(c, 'google'),
            ),
            ListTile(
              leading: const Icon(Icons.navigation_rounded),
              title: const Text('Waze'),
              onTap: () => Navigator.pop(c, 'waze'),
            ),
          ],
        ),
      ),
    );
    if (app == null) return;
    final url = app == 'waze'
        ? 'https://waze.com/ul?ll=$lat,$lng&navigate=yes'
        : 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving';
    if (!await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Não foi possível abrir o mapa.')));
    }
  }

  Future<void> _pickUp(DeliveryStop s) async {
    ScaffoldMessenger.of(context).clearSnackBars();
    var count = 0;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: Text('Conferência · ${s.name}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Conte os itens recebidos do mercado:'),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton.filledTonal(
                    tooltip: 'Menos um item',
                    onPressed: count > 0 ? () => set(() => count--) : null,
                    icon: const Icon(Icons.remove_rounded),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text('$count', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
                  ),
                  IconButton.filledTonal(
                    tooltip: 'Mais um item',
                    onPressed: () => set(() => count++),
                    icon: const Icon(Icons.add_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'O pedido deste mercado tem ${s.itemCount} itens.',
                style: const TextStyle(color: AppColors.inkMuted),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancelar')),
            FilledButton(
              onPressed: count > 0 ? () => Navigator.pop(c, true) : null,
              child: const Text('Confirmar retirada'),
            ),
          ],
        ),
      ),
    );
    if (ok == true) await _run(() => _repo.pickUp(_d!.id, s.id, count), 'Retirada confirmada em ${s.name}.');
  }

  Future<void> _deliver() async {
    ScaffoldMessenger.of(context).clearSnackBars(); // nada cobrindo o botão de finalizar
    final earning = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (_) => _DeliverSheet(orderId: _d!.id, repo: _repo),
    );
    if (earning == null || !mounted) return;
    final orderId = _d!.id;
    final rate = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        icon: const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 56),
        title: const Text('Entrega finalizada!'),
        content: Text('Você ganhou ${money(earning)} nesta entrega.', textAlign: TextAlign.center),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Avaliar')),
          FilledButton(onPressed: () => Navigator.pop(c), child: const Text('Continuar')),
        ],
      ),
    );
    if (rate == true && mounted) await context.push('/avaliar/$orderId');
    if (mounted) context.go('/entregador');
  }

  @override
  Widget build(BuildContext context) {
    final d = _d;
    return PanelPage(
      title: d == null ? 'Entrega' : 'Entrega ${d.code}',
      subtitle: d == null
          ? null
          : '${money(d.earningCents)} · ${d.routeKm.toStringAsFixed(1).replaceAll('.', ',')} km · ~${d.minutes} min',
      onRefresh: _load,
      maxWidth: 720,
      children: [
        if (_error != null && !_loaded)
          RetryBox(message: _error!, onRetry: _load)
        else if (!_loaded)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (d == null)
          LightEmpty(
            icon: Icons.delivery_dining_outlined,
            title: 'Nenhuma entrega em andamento',
            message: 'Aceite um pedido disponível na tela inicial.',
            action: FilledButton(
              onPressed: () => context.go('/entregador'),
              child: const Text('Ver pedidos disponíveis'),
            ),
          )
        else ...[
          // Rota: mercados na ordem de coleta, cliente e sua posição (GPS).
          DeliveryMap(
            stops: [
              for (final s in d.stops) (lat: s.lat, lng: s.lng, number: s.sequence, done: s.picked, name: s.name),
            ],
            home: (lat: d.customerLat, lng: d.customerLng),
            courier: context.watch<CourierController>().position,
            height: 220,
          ),
          const SizedBox(height: 12),
          for (final s in d.stops) ...[
            _StopCard(
              stop: s,
              current: d.nextStop?.id == s.id,
              busy: _busy,
              onNavigate: () => _navigate(s.lat, s.lng),
              onArrive: () => _run(() async {
                final ready = await _repo.arriveAtMarket(d.id, s.id);
                if (!ready && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Chegada registrada. O mercado ainda está separando — aguarde o "pronto".'),
                    ),
                  );
                }
              }),
              onPickUp: () => _pickUp(s),
            ),
            const SizedBox(height: 10),
          ],
          PanelCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const CircleAvatar(
                      radius: 14,
                      backgroundColor: AppColors.success,
                      child: Icon(Icons.home_rounded, color: Colors.white, size: 16),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Cliente: ${d.customerName}',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                      ),
                    ),
                    if (d.customerPhone != null)
                      IconButton(
                        tooltip: 'Ligar para o cliente',
                        onPressed: () => launchUrl(Uri.parse('tel:${d.customerPhone!.replaceAll(RegExp(r'\D'), '')}')),
                        icon: const Icon(Icons.call_rounded, color: AppColors.primary),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(d.customerAddress, style: const TextStyle(color: AppColors.ink)),
                const SizedBox(height: 10),
                if (!d.allPicked)
                  const Text(
                    'Retire em todos os mercados antes de seguir para o cliente.',
                    style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                  )
                else ...[
                  OutlinedButton.icon(
                    onPressed: () => _navigate(d.customerLat, d.customerLng),
                    icon: const Icon(Icons.navigation_rounded),
                    label: const Text('Rota até o cliente'),
                  ),
                  const SizedBox(height: 8),
                  if (d.courierStatus != 'chegou')
                    FilledButton(
                      onPressed: _busy
                          ? null
                          : () =>
                                _run(() => _repo.arriveAtCustomer(d.id), 'Chegada registrada. O cliente foi avisado.'),
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                      child: const Text('Cheguei no cliente', style: TextStyle(fontWeight: FontWeight.w800)),
                    )
                  else
                    FilledButton.icon(
                      onPressed: _busy ? null : _deliver,
                      icon: const Icon(Icons.qr_code_scanner_rounded),
                      label: const Text(
                        'Confirmar entrega',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.success,
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _StopCard extends StatelessWidget {
  const _StopCard({
    required this.stop,
    required this.current,
    required this.busy,
    required this.onNavigate,
    required this.onArrive,
    required this.onPickUp,
  });

  final DeliveryStop stop;
  final bool current;
  final bool busy;
  final VoidCallback onNavigate;
  final VoidCallback onArrive;
  final VoidCallback onPickUp;

  @override
  Widget build(BuildContext context) {
    final s = stop;
    return Opacity(
      opacity: s.picked ? .6 : 1,
      child: PanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 14,
                  backgroundColor: s.picked ? AppColors.success : AppColors.primary,
                  child: s.picked
                      ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
                      : Text(
                          '${s.sequence}',
                          style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w800),
                        ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.name,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
                      ),
                      if (s.address != null)
                        Text(s.address!, style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5)),
                    ],
                  ),
                ),
                s.picked
                    ? const Pill(
                        'Retirado',
                        fg: AppColors.success,
                        bg: AppColors.successSoft,
                        icon: Icons.check_circle_rounded,
                      )
                    : s.ready
                    ? const Pill(
                        'Pronto',
                        fg: AppColors.success,
                        bg: AppColors.successSoft,
                        icon: Icons.inventory_rounded,
                      )
                    : const Pill(
                        'Separando',
                        fg: Color(0xFF92400E),
                        bg: Color(0xFFFEF3C7),
                        icon: Icons.hourglass_top_rounded,
                      ),
              ],
            ),
            if (current) ...[
              const SizedBox(height: 10),
              Text('${s.itemCount} itens para retirar', style: const TextStyle(color: AppColors.ink)),
              if (s.coldItems > 0)
                Text(
                  '❄ ${s.coldItems} refrigerado(s): guarde na bolsa térmica',
                  style: const TextStyle(color: AppColors.info, fontWeight: FontWeight.w600),
                ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: onNavigate,
                    icon: const Icon(Icons.navigation_rounded),
                    label: const Text('Ir ao mercado'),
                  ),
                  if (!s.arrived)
                    FilledButton.tonal(onPressed: busy ? null : onArrive, child: const Text('Cheguei no mercado'))
                  else
                    FilledButton(
                      onPressed: busy || !s.ready ? null : onPickUp,
                      style: FilledButton.styleFrom(backgroundColor: AppColors.success),
                      child: Text(s.ready ? 'Conferir e retirar' : 'Aguardando o mercado'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Confirmação da entrega: QR Code do cliente (celular) ou os 6 dígitos.
class _DeliverSheet extends StatefulWidget {
  const _DeliverSheet({required this.orderId, required this.repo});

  final String orderId;
  final CourierRepository repo;

  @override
  State<_DeliverSheet> createState() => _DeliverSheetState();
}

class _DeliverSheetState extends State<_DeliverSheet> {
  final _code = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _send(String code) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final earning = await widget.repo.deliver(widget.orderId, code);
      if (mounted) Navigator.pop(context, earning);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _scan() async {
    final code = await Navigator.of(context).push<String>(MaterialPageRoute(builder: (_) => const _QrScanPage()));
    if (code != null && mounted) {
      _code.text = code;
      await _send(code);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Confirmar entrega',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.ink),
        ),
        const SizedBox(height: 4),
        const Text(
          'Peça ao cliente o QR Code ou o código de 6 dígitos que aparece no app dele.',
          style: TextStyle(color: AppColors.inkMuted),
        ),
        const SizedBox(height: 14),
        if (!kIsWeb) ...[
          FilledButton.icon(
            onPressed: _busy ? null : _scan,
            icon: const Icon(Icons.qr_code_scanner_rounded),
            label: const Text('Escanear QR Code', style: TextStyle(fontWeight: FontWeight.w800)),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Text(
              'ou digite o código',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.inkMuted),
            ),
          ),
        ],
        TextField(
          controller: _code,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 8),
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          decoration: InputDecoration(
            labelText: 'Código de entrega',
            errorText: _error,
            errorMaxLines: 2,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _busy || _code.text.length != 6 ? null : () => _send(_code.text),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.success,
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: Text(
            _busy ? 'Confirmando…' : 'Finalizar entrega',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
        ),
      ],
    ),
  );
}

class _QrScanPage extends StatefulWidget {
  const _QrScanPage();

  @override
  State<_QrScanPage> createState() => _QrScanPageState();
}

class _QrScanPageState extends State<_QrScanPage> {
  bool _done = false;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.black,
    appBar: AppBar(title: const Text('Escaneie o QR Code do cliente')),
    body: MobileScanner(
      onDetect: (capture) {
        if (_done) return;
        for (final b in capture.barcodes) {
          // QR do cliente: "econorota:entrega:123456".
          final m = RegExp(r'(\d{6})$').firstMatch(b.rawValue ?? '');
          if (m != null) {
            _done = true;
            Navigator.pop(context, m.group(1));
            return;
          }
        }
      },
    ),
  );
}
