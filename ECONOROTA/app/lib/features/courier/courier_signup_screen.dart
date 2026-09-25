import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../data/models/courier.dart';
import '../../data/repositories/courier_repository.dart';
import '../market/market_widgets.dart';

/// Cadastro do entregador: dados pessoais, veículo, documento com foto e foto do veículo.
class CourierSignupScreen extends StatefulWidget {
  const CourierSignupScreen({super.key});

  @override
  State<CourierSignupScreen> createState() => _CourierSignupScreenState();
}

class _CourierSignupScreenState extends State<CourierSignupScreen> {
  final _form = GlobalKey<FormState>();
  final _cpf = TextEditingController();
  final _pix = TextEditingController();
  final _plate = TextEditingController();
  final _model = TextEditingController();
  final _color = TextEditingController();
  final _cnh = TextEditingController();
  DateTime? _birth;
  VehicleType? _vehicle;
  Uint8List? _docPhoto;
  Uint8List? _vehicleDoc;
  CourierProfile? _p;
  bool _busy = false;

  CourierRepository get _repo => context.read<CourierRepository>();

  @override
  void initState() {
    super.initState();
    _repo.profile().then((p) {
      if (!mounted) return;
      setState(() {
        _p = p;
        _pix.text = p.pixKey ?? '';
        _plate.text = p.vehiclePlate ?? '';
        _model.text = p.vehicleModel ?? '';
        _color.text = p.vehicleColor ?? '';
        _cnh.text = p.cnhNumber ?? '';
        _birth = p.birthDate == null ? null : DateTime.tryParse(p.birthDate!);
        _vehicle = p.vehicleType;
      });
    });
  }

  @override
  void dispose() {
    for (final c in [_cpf, _pix, _plate, _model, _color, _cnh]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pick(bool document) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_rounded),
              title: const Text('Tirar foto'),
              onTap: () => Navigator.pop(c, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('Escolher da galeria'),
              onTap: () => Navigator.pop(c, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    try {
      // Reduz a foto no aparelho (envio rápido, menos dados).
      final f = await ImagePicker().pickImage(source: source, maxWidth: 1600, imageQuality: 80);
      if (f == null) return;
      final bytes = await f.readAsBytes();
      setState(() => document ? _docPhoto = bytes : _vehicleDoc = bytes);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Não foi possível abrir a câmera/galeria.')));
      }
    }
  }

  String _type(Uint8List b) =>
      b.length > 3 && b[0] == 0x89 ? 'image/png' : (b.length > 11 && b[8] == 0x57 ? 'image/webp' : 'image/jpeg');

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_vehicle == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Escolha o veículo.')));
      return;
    }
    final p = _p!;
    final needsCrlv = _vehicle!.needsLicense;
    if ((_docPhoto == null && !p.hasDocumentPhoto) || (needsCrlv && _vehicleDoc == null && !p.hasVehicleDoc)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            needsCrlv ? 'Envie a foto da CNH e do documento do veículo (CRLV).' : 'Envie a foto do seu documento.',
          ),
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      await _repo.updateProfile({
        if (_cpf.text.isNotEmpty) 'cpf': _cpf.text,
        'birth_date': _birth!.toIso8601String().substring(0, 10),
        'pix_key': _pix.text.trim(),
        'vehicle_type': _vehicle!.name,
        if (_vehicle!.needsLicense) 'vehicle_plate': _plate.text.trim().toUpperCase(),
        if (_vehicle!.needsLicense) 'cnh_number': _cnh.text.trim(),
        'vehicle_model': _model.text.trim(),
        'vehicle_color': _color.text.trim(),
      });
      if (_docPhoto != null) await _repo.uploadPhoto('documento', _docPhoto!, _type(_docPhoto!));
      if (needsCrlv && _vehicleDoc != null) await _repo.uploadPhoto('crlv', _vehicleDoc!, _type(_vehicleDoc!));
      final done = await _repo.submit();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            done.approved ? 'Cadastro aprovado! Você já pode ficar disponível.' : 'Cadastro enviado para análise.',
          ),
        ),
      );
      context.pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  InputDecoration _dec(String label, {String? hint, String? helper}) => InputDecoration(
    labelText: label,
    hintText: hint,
    helperText: helper,
    helperMaxLines: 2,
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
  );

  Widget _title(String t) => Padding(
    padding: const EdgeInsets.only(top: 18, bottom: 10),
    child: Text(
      t,
      style: const TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.ink),
    ),
  );

  Widget _photo(String label, String hint, Uint8List? bytes, bool sent, VoidCallback onTap) => PanelCard(
    onTap: onTap,
    child: Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: 64,
            height: 64,
            child: bytes != null
                ? Image.memory(
                    bytes,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const Icon(Icons.image_rounded, color: AppColors.primary),
                  )
                : ColoredBox(
                    color: AppColors.brandSoft,
                    child: Icon(sent ? Icons.check_rounded : Icons.add_a_photo_rounded, color: AppColors.primary),
                  ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
              ),
              Text(
                bytes != null ? 'Pronta para enviar' : (sent ? 'Já enviada · toque para trocar' : hint),
                style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
              ),
            ],
          ),
        ),
        const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final p = _p;
    return PanelPage(
      title: 'Cadastro do entregador',
      subtitle: 'Leva menos de 3 minutos',
      showBack: true,
      maxWidth: 640,
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
                  onPressed: _busy ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.success,
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(
                    _busy ? 'Enviando…' : 'Enviar cadastro',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
              ),
            ),
      children: [
        if (p == null)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else
          Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _title('1. Dados pessoais'),
                TextFormField(
                  controller: _cpf,
                  keyboardType: TextInputType.number,
                  inputFormatters: [cpfMask],
                  decoration: _dec(
                    'CPF',
                    hint: p.cpf ?? '000.000.000-00',
                    helper: p.cpf != null ? 'Já informado. Deixe em branco para manter.' : null,
                  ),
                  validator: (v) =>
                      (v ?? '').isEmpty && p.cpf != null ? null : (v != null && isValidCpf(v) ? null : 'CPF inválido.'),
                ),
                const SizedBox(height: 12),
                InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () async {
                    final now = DateTime.now();
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _birth ?? DateTime(now.year - 25),
                      firstDate: DateTime(now.year - 90),
                      lastDate: DateTime(now.year - 18, now.month, now.day),
                      helpText: 'Data de nascimento',
                    );
                    if (d != null) setState(() => _birth = d);
                  },
                  child: FormField<DateTime>(
                    validator: (_) => _birth == null ? 'Informe a data de nascimento.' : null,
                    builder: (f) => InputDecorator(
                      decoration: _dec('Data de nascimento')
                          .copyWith(errorText: f.errorText, suffixIcon: const Icon(Icons.event_rounded)),
                      child: Text(
                        _birth == null ? 'Toque para escolher' : date(_birth!),
                        style: const TextStyle(color: AppColors.ink),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _pix,
                  decoration: _dec('Chave Pix para receber', hint: 'CPF, e-mail, telefone ou chave aleatória'),
                  validator: (v) => (v ?? '').trim().length < 5 ? 'Informe a chave Pix.' : null,
                ),
                _title('2. Veículo'),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final v in VehicleType.values)
                      ChoiceChip(
                        avatar: Icon(switch (v) {
                          VehicleType.moto => Icons.two_wheeler_rounded,
                          VehicleType.bicicleta => Icons.pedal_bike_rounded,
                          VehicleType.carro => Icons.directions_car_rounded,
                        }, size: 18),
                        label: Text(v.label),
                        selected: _vehicle == v,
                        onSelected: (_) => setState(() => _vehicle = v),
                      ),
                  ],
                ),
                if (_vehicle?.needsLicense ?? false) ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _plate,
                    textCapitalization: TextCapitalization.characters,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9-]')),
                      LengthLimitingTextInputFormatter(8),
                    ],
                    decoration: _dec('Placa', hint: 'ABC1D23'),
                    validator: (v) => RegExp(r'^[A-Z]{3}-?\d[A-Z0-9]\d{2}$').hasMatch((v ?? '').toUpperCase())
                        ? null
                        : 'Placa inválida.',
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _cnh,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                    decoration: _dec('Número da CNH', hint: '11 números'),
                    validator: (v) => (v ?? '').length == 11 ? null : 'CNH com 11 números.',
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _model,
                        decoration: _dec('Modelo', hint: 'Ex.: CG 160'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(controller: _color, decoration: _dec('Cor')),
                    ),
                  ],
                ),
                _title('3. Documentos'),
                _photo(
                  (_vehicle?.needsLicense ?? true) ? 'CNH (habilitação)' : 'Documento com foto',
                  (_vehicle?.needsLicense ?? true) ? 'Foto da CNH, frente, legível' : 'RG ou CNH, frente, legível',
                  _docPhoto,
                  p.hasDocumentPhoto,
                  () => _pick(true),
                ),
                if (_vehicle?.needsLicense ?? false) ...[
                  const SizedBox(height: 8),
                  _photo(
                    'Documento do veículo (CRLV)',
                    'Foto do CRLV (documento da moto/carro), legível',
                    _vehicleDoc,
                    p.hasVehicleDoc,
                    () => _pick(false),
                  ),
                ],
                const SizedBox(height: 10),
                const Text(
                  'Seus documentos ficam guardados com segurança e só a equipe do EconoRota vê, para aprovar o cadastro.',
                  style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
