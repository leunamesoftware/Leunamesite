import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/errors.dart';
import '../../../core/utils/format.dart';
import '../../../data/models/occurrence.dart';
import '../../../data/repositories/occurrences_repository.dart';
import '../../../widgets/brand_header.dart';

/// Relatar um problema com o pedido: tipo → produtos → descrição → fotos (evidências).
class OccurrenceNewScreen extends StatefulWidget {
  const OccurrenceNewScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<OccurrenceNewScreen> createState() => _OccurrenceNewScreenState();
}

class _OccurrenceNewScreenState extends State<OccurrenceNewScreen> {
  OccurrenceType? _type;
  List<OrderItemRef>? _items;
  final Map<String, int> _chosen = {};
  final _desc = TextEditingController();
  final List<Uint8List> _photos = [];
  bool _sending = false;

  OccurrencesRepository get _repo => context.read<OccurrencesRepository>();

  @override
  void initState() {
    super.initState();
    _repo
        .orderItems(widget.orderId)
        .then((i) {
          if (mounted) setState(() => _items = i);
        })
        .catchError((_) {
          if (mounted) setState(() => _items = const []);
        });
  }

  @override
  void dispose() {
    _desc.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    if (_photos.length >= 5) return;
    try {
      final f = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 80);
      if (f == null) return;
      final b = await f.readAsBytes();
      setState(() => _photos.add(b));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Não foi possível abrir a galeria.')));
      }
    }
  }

  String _mime(Uint8List b) =>
      b.length > 3 && b[0] == 0x89 ? 'image/png' : (b.length > 11 && b[8] == 0x57 ? 'image/webp' : 'image/jpeg');

  Future<void> _send() async {
    final t = _type!;
    if (t.needsItems && _chosen.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Escolha os produtos com problema.')));
      return;
    }
    if (!t.needsItems && _desc.text.trim().length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Conte rapidamente o que aconteceu.')));
      return;
    }
    setState(() => _sending = true);
    try {
      final d = await _repo.open(
        widget.orderId,
        t,
        description: _desc.text.trim().isEmpty ? null : _desc.text.trim(),
        items: t.needsItems ? Map.of(_chosen) : const {},
      );
      for (final p in _photos) {
        await _repo.addEvidence(d.summary.id, p, _mime(p));
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Recebemos sua ocorrência. Vamos analisar e te responder.')));
      context.pushReplacement('/cliente/ocorrencias/${d.summary.id}');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _type;
    return BrandScaffold(
      showBack: true,
      title: 'Relatar um problema',
      subtitle: 'Pedido ${shortCode(widget.orderId)}',
      bottom: t == null
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: AppColors.line)),
                ),
                child: FilledButton(
                  onPressed: _sending ? null : _send,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.success,
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(
                    _sending ? 'Enviando…' : 'Enviar ocorrência',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
              ),
            ),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 620),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'O que aconteceu?',
                      style: TextStyle(
                        fontFamily: 'Montserrat',
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 10),
                    for (final type in OccurrenceType.values)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Material(
                          color: t == type ? AppColors.brandSoft : Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: BorderSide(
                              color: t == type ? AppColors.primary : AppColors.line,
                              width: t == type ? 1.5 : 1,
                            ),
                          ),
                          child: ListTile(
                            onTap: () => setState(() => _type = type),
                            leading: Icon(type.icon, color: AppColors.primary),
                            title: Text(
                              type.label,
                              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                            ),
                            subtitle: Text(
                              type.hint,
                              style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                            ),
                            trailing: t == type
                                ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
                                : null,
                          ),
                        ),
                      ),
                    if (t != null) ...[
                      if (t.needsItems) ...[
                        const SizedBox(height: 10),
                        const Text(
                          'Quais produtos?',
                          style: TextStyle(
                            fontFamily: 'Montserrat',
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 6),
                        if (_items == null)
                          const Padding(
                            padding: EdgeInsets.all(20),
                            child: Center(child: CircularProgressIndicator()),
                          )
                        else
                          for (final i in _items!)
                            _ItemRow(
                              item: i,
                              qty: _chosen[i.id],
                              onChanged: (q) => setState(() => q == null ? _chosen.remove(i.id) : _chosen[i.id] = q),
                            ),
                      ],
                      const SizedBox(height: 12),
                      TextField(
                        controller: _desc,
                        maxLines: 4,
                        maxLength: 1000,
                        decoration: InputDecoration(
                          labelText: t.needsItems ? 'Detalhes (opcional)' : 'Conte o que aconteceu',
                          alignLabelWithHint: true,
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                      const Text(
                        'Fotos ajudam a resolver mais rápido (até 5).',
                        style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final (i, p) in _photos.indexed)
                            Stack(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.memory(
                                    p,
                                    width: 72,
                                    height: 72,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) => Container(
                                      width: 72,
                                      height: 72,
                                      color: AppColors.brandSoft,
                                      child: const Icon(Icons.image_rounded, color: AppColors.primary),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  right: 0,
                                  top: 0,
                                  child: IconButton(
                                    tooltip: 'Remover foto',
                                    visualDensity: VisualDensity.compact,
                                    style: IconButton.styleFrom(backgroundColor: Colors.white),
                                    onPressed: () => setState(() => _photos.removeAt(i)),
                                    icon: const Icon(Icons.close_rounded, size: 16),
                                  ),
                                ),
                              ],
                            ),
                          if (_photos.length < 5)
                            InkWell(
                              borderRadius: BorderRadius.circular(12),
                              onTap: _addPhoto,
                              child: Container(
                                width: 72,
                                height: 72,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AppColors.line),
                                ),
                                child: const Icon(
                                  Icons.add_a_photo_rounded,
                                  color: AppColors.primary,
                                  semanticLabel: 'Adicionar foto',
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item, required this.qty, required this.onChanged});

  final OrderItemRef item;
  final int? qty;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) => CheckboxListTile(
    value: qty != null,
    contentPadding: EdgeInsets.zero,
    activeColor: AppColors.primary,
    onChanged: (v) => onChanged(v == true ? item.quantity : null),
    title: Text(
      item.name,
      style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w600),
    ),
    subtitle: Text(
      '${item.quantity}× ${money(item.unitPriceCents)}${qty != null && item.quantity > 1 ? ' · com problema: $qty' : ''}',
      style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
    ),
    secondary: qty != null && item.quantity > 1
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: 'Menos',
                onPressed: qty! > 1 ? () => onChanged(qty! - 1) : null,
                icon: const Icon(Icons.remove_rounded),
              ),
              IconButton(
                tooltip: 'Mais',
                onPressed: qty! < item.quantity ? () => onChanged(qty! + 1) : null,
                icon: const Icon(Icons.add_rounded),
              ),
            ],
          )
        : null,
  );
}
