import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/address.dart';
import '../../data/repositories/geo_repository.dart';
import '../../services/location_service.dart';
import '../../state/address_controller.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/auth_scaffold.dart';
import 'access_flow.dart';

/// Escolha do endereço de entrega: CEP, GPS ou recentes.
class AddressScreen extends StatefulWidget {
  const AddressScreen({super.key, this.initial});

  final Address? initial;

  @override
  State<AddressScreen> createState() => _AddressScreenState();
}

class _AddressScreenState extends State<AddressScreen> {
  final _form = GlobalKey<FormState>();
  final _cep = TextEditingController();
  final _street = TextEditingController();
  final _number = TextEditingController();
  final _complement = TextEditingController();
  final _district = TextEditingController();
  final _numberFocus = FocusNode();

  Address? _found;
  bool _noNumber = false;
  bool _searching = false;
  bool _locating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.initial != null) _fill(widget.initial!);
  }

  @override
  void dispose() {
    for (final c in [_cep, _street, _number, _complement, _district]) {
      c.dispose();
    }
    _numberFocus.dispose();
    super.dispose();
  }

  void _fill(Address a) {
    _found = a;
    _error = null;
    if (a.zip != null) _cep.text = cepMask.apply(a.zip!);
    _street.text = a.street;
    _district.text = a.district ?? '';
    _number.text = a.number ?? '';
    _complement.text = a.complement ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _number.text.isEmpty) _numberFocus.requestFocus();
    });
  }

  Future<void> _searchCep() async {
    final zip = digitsOnly(_cep.text);
    if (zip.length != 8) return;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final a = await context.read<GeoRepository>().byZip(zip);
      if (mounted) setState(() => _fill(a));
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _useGps() async {
    final location = context.read<LocationService>();
    final geo = context.read<GeoRepository>();
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      if (await location.requestPermission() != LocationResult.granted) {
        throw const _Msg('Não foi possível acessar sua localização. Digite o CEP.');
      }
      final pos = await location.current();
      final a = await geo.reverse(pos.lat, pos.lng);
      if (mounted) setState(() => _fill(a));
    } on _Msg catch (e) {
      if (mounted) setState(() => _error = e.text);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _confirm([Address? chosen]) async {
    Address? a = chosen;
    if (a == null) {
      if (!_form.currentState!.validate() || _found == null) return;
      a = _found!.copyWith(
        street: _street.text.trim(),
        district: _district.text.trim(),
        number: _noNumber ? null : _number.text.trim(),
        complement: _complement.text.trim().isEmpty ? null : _complement.text.trim(),
      );
    }
    final auth = context.read<AuthController>();
    final address = context.read<AddressController>();
    await address.select(a, signedIn: auth.user != null);
    if (mounted) context.go(nextAccessRoute(auth, address));
  }

  @override
  Widget build(BuildContext context) {
    final recent = context.watch<AddressController>().recent;
    final signedIn = context.watch<AuthController>().user != null;
    final t = Theme.of(context).textTheme;

    return AuthScaffold(
      title: 'Qual é o seu\n',
      highlight: 'endereço?',
      subtitle: 'Informe onde quer receber para mostrarmos os mercados que entregam aí.',
      art: 'assets/images/art/stores_map.webp',
      onBack: signedIn && context.canPop() ? () => context.pop() : null,
      children: [
        FormErrorBanner(_error),
        AppTextField(
          controller: _cep,
          hint: 'Digite seu CEP',
          icon: Icons.search_rounded,
          keyboardType: TextInputType.number,
          formatters: [cepMask],
          autofillHints: const [AutofillHints.postalCode],
          textInputAction: TextInputAction.search,
          onChanged: (v) {
            if (digitsOnly(v).length == 8) _searchCep();
          },
          onSubmitted: (_) => _searchCep(),
          suffix: _searching
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : null,
        ),
        const SizedBox(height: 12),
        _ActionTile(
          icon: Icons.my_location_rounded,
          label: 'Usar minha localização atual',
          loading: _locating,
          onTap: _locating ? null : _useGps,
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          child: _found == null
              ? const SizedBox(width: double.infinity)
              : Form(
                  key: _form,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Confirme o endereço', style: t.titleMedium),
                        const SizedBox(height: 4),
                        Text('${_found!.city} - ${_found!.state}', style: t.bodySmall),
                        const SizedBox(height: 12),
                        AppTextField(
                          controller: _street,
                          hint: 'Rua / Avenida',
                          icon: Icons.signpost_outlined,
                          textCapitalization: TextCapitalization.words,
                          autofillHints: const [AutofillHints.streetAddressLine1],
                          validator: (v) => (v ?? '').trim().length < 3 ? 'Informe a rua.' : null,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: AppTextField(
                                controller: _number,
                                focusNode: _numberFocus,
                                hint: 'Número',
                                icon: Icons.tag_rounded,
                                enabled: !_noNumber,
                                validator: (v) => !_noNumber && (v ?? '').trim().isEmpty ? 'Informe o número.' : null,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: FilterChip(
                                label: const Text('Sem número'),
                                selected: _noNumber,
                                onSelected: (v) => setState(() {
                                  _noNumber = v;
                                  if (v) _number.clear();
                                }),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        AppTextField(
                          controller: _complement,
                          hint: 'Complemento (opcional)',
                          icon: Icons.apartment_rounded,
                          textCapitalization: TextCapitalization.sentences,
                        ),
                        const SizedBox(height: 12),
                        AppTextField(
                          controller: _district,
                          hint: 'Bairro',
                          icon: Icons.map_outlined,
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.done,
                          validator: (v) => (v ?? '').trim().isEmpty ? 'Informe o bairro.' : null,
                        ),
                      ],
                    ),
                  ),
                ),
        ),
        if (recent.isNotEmpty && _found == null) ...[
          const SizedBox(height: 24),
          Text('Endereços recentes', style: t.titleMedium),
          const SizedBox(height: 12),
          for (final a in recent)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ActionTile(
                icon: Icons.location_on_rounded,
                label: a.line1,
                detail: a.line2,
                onTap: () => _confirm(a),
              ),
            ),
        ],
        const SizedBox(height: 24),
        AppButton(
          label: 'Continuar',
          icon: Icons.arrow_forward_rounded,
          onPressed: _found == null ? null : () => _confirm(),
        ),
      ],
    );
  }
}

class _Msg implements Exception {
  const _Msg(this.text);
  final String text;
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.label, this.detail, this.onTap, this.loading = false});

  final IconData icon;
  final String label;
  final String? detail;
  final VoidCallback? onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: const BorderSide(color: AppColors.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: AppColors.accent),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  if (detail != null) Text(detail!, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            loading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
          ],
        ),
      ),
    ),
  );
}
