import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/errors.dart';
import '../../../core/utils/format.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../../../data/models/order.dart';
import '../../../data/repositories/orders_repository.dart';
import '../../../services/api_client.dart';
import '../../../widgets/brand_header.dart';
import '../widgets/common.dart';
import '../../../widgets/delivery_code_card.dart';
import 'checkout_widgets.dart';

/// Fase 7 — Pagamento: forma de pagamento, Pix, cartão, processamento, aprovado, recusado e cancelamento/reembolso.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.orderId, this.savings = 0});

  final String orderId;

  /// Economia calculada no carrinho (mostrada na confirmação do pagamento).
  final int savings;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  PaymentState? _st;
  String? _error;
  PaymentMethod? _method;
  bool _busy = false;
  bool _needCpf = false;
  final _cpf = TextEditingController();
  final _cpfKey = GlobalKey<FormState>();
  Timer? _poll;
  Timer? _tick;

  OrdersRepository get _repo => context.read<OrdersRepository>();
  String get _code => shortCode(widget.orderId);

  @override
  void initState() {
    super.initState();
    _load();
    // Atualiza a contagem do Pix a cada segundo.
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _st?.payment?.pixExpiresAt != null) setState(() {});
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _tick?.cancel();
    _cpf.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final st = await _repo.paymentState(widget.orderId);
      if (!mounted) return;
      setState(() {
        _st = st;
        _method ??= st.payment?.method ?? st.method;
        _error = null;
      });
      _watch();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  /// Processamento: enquanto houver cobrança pendente, consulta a situação a cada 4 s.
  void _watch() {
    _poll?.cancel();
    if (_st?.payment?.status != PaymentStatus.pending || _st!.orderStatus != 'aguardando_pagamento') return;
    _poll = Timer.periodic(const Duration(seconds: 4), (_) async {
      try {
        final st = await _repo.paymentState(widget.orderId);
        if (!mounted) return;
        setState(() => _st = st);
        if (st.payment?.status != PaymentStatus.pending) _poll?.cancel();
      } catch (_) {
        // Sem internet por um instante: tenta de novo na próxima volta.
      }
    });
  }

  Future<void> _pay() async {
    if (_needCpf && !_cpfKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final st = await _repo.pay(widget.orderId, _method!, cpf: _needCpf ? _cpf.text : null);
      if (!mounted) return;
      setState(() {
        _st = st;
        _needCpf = false;
      });
      _watch();
      if (_method == PaymentMethod.card && st.payment?.invoiceUrl != null) await _openCard(st.payment!.invoiceUrl!);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'invalid_cpf') {
        setState(() => _needCpf = true);
        if (_cpf.text.isNotEmpty) _snack(e.message);
      } else {
        _snack(friendlyError(e));
        await _load();
      }
    } catch (e) {
      if (mounted) _snack(friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openCard(String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && mounted) _snack('Não foi possível abrir a página de pagamento.');
  }

  Future<void> _simulate(bool approve) async {
    setState(() => _busy = true);
    try {
      await _repo.simulate(widget.orderId, approve: approve);
      await _load();
    } catch (e) {
      if (mounted) _snack(friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final paid = _st?.paid ?? false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Cancelar pedido?'),
        content: Text(
          paid
              ? 'Os mercados ainda não começaram a separar. Devolvemos o valor pelo mesmo meio de pagamento: '
                    'Pix em instantes; no cartão, o estorno aparece em até 2 faturas.'
              : 'Nenhum valor foi cobrado. O pedido será cancelado.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Voltar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.discount),
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Cancelar pedido'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await _repo.cancel(widget.orderId);
      await _load();
    } catch (e) {
      if (mounted) _snack(friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String m) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    final st = _st;
    return BrandScaffold(
      showBack: true,
      title: 'Pagamento',
      subtitle: 'Pedido nº $_code',
      slivers: [
        SliverToBoxAdapter(child: CheckoutSteps(current: st != null && st.paid ? 5 : 4)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: _error != null && st == null
                    ? RetryBox(message: _error!, onRetry: _load)
                    : st == null
                    ? const Padding(
                        padding: EdgeInsets.all(40),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    : _body(st),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _body(PaymentState st) {
    if (st.cancelled) return _Cancelled(st: st);
    if (st.paid) return _Approved(st: st, busy: _busy, onCancel: st.orderStatus == 'pago' ? _cancel : null);

    final p = st.payment;
    final pending = p != null && p.status == PaymentStatus.pending;
    final pixExpired = p?.pixExpiresAt?.isBefore(DateTime.now()) ?? false;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Total(totalCents: st.totalCents, savings: widget.savings),
        const SizedBox(height: 14),
        if (p?.status == PaymentStatus.refused)
          const _Banner(
            icon: Icons.credit_card_off_rounded,
            color: AppColors.discount,
            text: 'Pagamento recusado pelo banco. Tente outro cartão ou pague com Pix — seu pedido continua reservado.',
          ),
        if (p != null && (p.expired || (pending && pixExpired)))
          const _Banner(
            icon: Icons.timer_off_rounded,
            color: Color(0xFF92400E),
            text: 'O código Pix expirou. Gere um novo para pagar.',
          ),
        if (pending && !pixExpired)
          p.method == PaymentMethod.pix
              ? _PixBox(payment: p, onCopied: () => _snack('Código Pix copiado.'))
              : _CardBox(onOpen: () => _openCard(p.invoiceUrl!), onCheck: _load)
        else ...[
          _MethodPicker(value: _method!, onChanged: (m) => setState(() => _method = m)),
          if (_needCpf) ...[
            const SizedBox(height: 12),
            Form(
              key: _cpfKey,
              child: TextFormField(
                controller: _cpf,
                keyboardType: TextInputType.number,
                inputFormatters: [cpfMask],
                decoration: InputDecoration(
                  labelText: 'CPF',
                  helperText: 'Exigido pelo banco para emitir o pagamento. Pedimos só uma vez.',
                  helperStyle: const TextStyle(color: AppColors.inkMuted),
                  helperMaxLines: 2,
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                ),
                validator: (v) => v != null && isValidCpf(v) ? null : 'CPF inválido.',
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _busy ? null : _pay,
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                  )
                : Icon(_method == PaymentMethod.pix ? Icons.pix_rounded : Icons.lock_rounded),
            label: Text(
              _method == PaymentMethod.pix
                  ? 'Gerar Pix de ${money(st.totalCents)}'
                  : 'Pagar ${money(st.totalCents)} no cartão',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size.fromHeight(54),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
        if (pending && !pixExpired) ...[
          const SizedBox(height: 12),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
              SizedBox(width: 8),
              Flexible(
                child: Text('Aguardando a confirmação do pagamento…', style: TextStyle(color: AppColors.inkMuted)),
              ),
            ],
          ),
          TextButton(
            onPressed: _busy
                ? null
                : () => setState(() {
                    _poll?.cancel();
                    _st = PaymentState(
                      orderId: st.orderId,
                      orderStatus: st.orderStatus,
                      totalCents: st.totalCents,
                      method: st.method,
                    );
                  }),
            child: const Text('Trocar forma de pagamento'),
          ),
          if (p.simulated) _DemoControls(busy: _busy, onResult: _simulate),
        ],
        const SizedBox(height: 8),
        const _Security(),
        TextButton(
          onPressed: _busy ? null : _cancel,
          style: TextButton.styleFrom(foregroundColor: AppColors.inkMuted),
          child: const Text('Cancelar pedido'),
        ),
      ],
    );
  }
}

class _Total extends StatelessWidget {
  const _Total({required this.totalCents, required this.savings});

  final int totalCents;
  final int savings;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(gradient: AppColors.headerGradient, borderRadius: BorderRadius.circular(18)),
    child: Row(
      children: [
        const Icon(Icons.receipt_long_rounded, color: AppColors.accent, size: 30),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Total a pagar (com entrega)', style: TextStyle(color: Colors.white70, fontSize: 12.5)),
              Text(
                money(totalCents),
                style: const TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w800,
                  fontSize: 24,
                  color: Colors.white,
                ),
              ),
              if (savings > 0)
                Text(
                  'Você economiza ${money(savings)} nesta compra',
                  style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700, fontSize: 12.5),
                ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _MethodPicker extends StatelessWidget {
  const _MethodPicker({required this.value, required this.onChanged});

  final PaymentMethod value;
  final ValueChanged<PaymentMethod> onChanged;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: const BorderSide(color: AppColors.line),
    ),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Forma de pagamento',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
          ),
          RadioGroup<PaymentMethod>(
            groupValue: value,
            onChanged: (m) => m == null ? null : onChanged(m),
            child: Column(
              children: [
                for (final m in PaymentMethod.values)
                  RadioListTile<PaymentMethod>(
                    value: m,
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppColors.primary,
                    secondary: Icon(
                      m == PaymentMethod.pix ? Icons.pix_rounded : Icons.credit_card_rounded,
                      color: AppColors.primary,
                    ),
                    title: Text(
                      m.label,
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                    ),
                    subtitle: Text(
                      m == PaymentMethod.pix
                          ? 'Aprovação na hora. Pague pelo app do seu banco.'
                          : 'Pague na página segura do Asaas. Não guardamos dados do seu cartão.',
                      style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _PixBox extends StatelessWidget {
  const _PixBox({required this.payment, required this.onCopied});

  final PaymentInfo payment;
  final VoidCallback onCopied;

  @override
  Widget build(BuildContext context) {
    final left = payment.pixExpiresAt?.difference(DateTime.now());
    final mm = left == null ? null : '${left.inMinutes}:${(left.inSeconds % 60).toString().padLeft(2, '0')}';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          const Text(
            'Pague com Pix',
            style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.ink),
          ),
          if (mm != null)
            Text('O código expira em $mm', style: const TextStyle(color: AppColors.inkMuted, fontSize: 13)),
          const SizedBox(height: 12),
          Semantics(
            label: 'QR Code do Pix',
            child: QrImageView(data: payment.pixPayload!, size: 210, backgroundColor: Colors.white),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: payment.pixPayload!));
              onCopied();
            },
            icon: const Icon(Icons.copy_rounded),
            label: const Text('Copiar código Pix', style: TextStyle(fontWeight: FontWeight.w800)),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              minimumSize: const Size.fromHeight(50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
          const SizedBox(height: 12),
          const _Step(n: 1, text: 'Abra o app do seu banco e escolha Pix.'),
          const _Step(n: 2, text: 'Escaneie o QR Code ou use "Pix copia e cola".'),
          const _Step(n: 3, text: 'Confirme. A aprovação aparece aqui sozinha.'),
        ],
      ),
    );
  }
}

class _CardBox extends StatelessWidget {
  const _CardBox({required this.onOpen, required this.onCheck});

  final VoidCallback onOpen;
  final VoidCallback onCheck;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppColors.line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Pagamento com cartão',
          textAlign: TextAlign.center,
          style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.ink),
        ),
        const SizedBox(height: 6),
        const Text(
          'Você digita os dados do cartão na página segura do Asaas, nosso parceiro de pagamentos. '
          'Depois, volte para o app: a confirmação aparece aqui.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.inkMuted, fontSize: 13.5),
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: onOpen,
          icon: const Icon(Icons.lock_rounded),
          label: const Text('Abrir pagamento seguro', style: TextStyle(fontWeight: FontWeight.w800)),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        TextButton(onPressed: onCheck, child: const Text('Já paguei, verificar')),
      ],
    ),
  );
}

class _Approved extends StatelessWidget {
  const _Approved({required this.st, required this.busy, required this.onCancel});

  final PaymentState st;
  final bool busy;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const SizedBox(height: 8),
      const CircleAvatar(
        radius: 40,
        backgroundColor: AppColors.successSoft,
        child: Icon(Icons.check_circle_rounded, color: AppColors.success, size: 56),
      ),
      const SizedBox(height: 14),
      Text(
        switch (st.orderStatus) {
          'em_separacao' => 'Mercados separando seu pedido',
          'pronto_coleta' => 'Pedido pronto para coleta',
          'em_rota' => 'Pedido a caminho!',
          'entregue' => 'Pedido entregue',
          _ => 'Pagamento aprovado!',
        },
        textAlign: TextAlign.center,
        style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 24, color: AppColors.ink),
      ),
      const SizedBox(height: 6),
      Text(
        '${money(st.totalCents)} · ${st.payment?.method.label ?? st.method.label}\n'
        'Os mercados já foram avisados e vão separar seus produtos.',
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.inkMuted, height: 1.4),
      ),
      if (st.deliveryCode != null) ...[const SizedBox(height: 16), DeliveryCodeCard(code: st.deliveryCode!)],
      const SizedBox(height: 20),
      FilledButton.icon(
        onPressed: () => context.go('/cliente/pedido/${st.orderId}/rastreio'),
        icon: const Icon(Icons.delivery_dining_rounded),
        label: const Text('Acompanhar pedido', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.success,
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      TextButton(onPressed: () => context.go('/cliente'), child: const Text('Voltar ao início')),
      if (onCancel != null)
        TextButton(
          onPressed: busy ? null : onCancel,
          style: TextButton.styleFrom(foregroundColor: AppColors.inkMuted),
          child: const Text('Cancelar pedido e receber o reembolso'),
        ),
    ],
  );
}

class _Cancelled extends StatelessWidget {
  const _Cancelled({required this.st});

  final PaymentState st;

  @override
  Widget build(BuildContext context) {
    final refunded = st.payment?.status == PaymentStatus.refunded;
    final noStock = st.cancelReason == 'sem_estoque' || st.payment?.failureReason == 'sem_estoque';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const CircleAvatar(
          radius: 40,
          backgroundColor: AppColors.dangerSoft,
          child: Icon(Icons.cancel_rounded, color: AppColors.discount, size: 56),
        ),
        const SizedBox(height: 14),
        const Text(
          'Pedido cancelado',
          textAlign: TextAlign.center,
          style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 24, color: AppColors.ink),
        ),
        const SizedBox(height: 6),
        Text(
          noStock
              ? 'Um produto esgotou enquanto você pagava. Devolvemos o valor integral de ${money(st.totalCents)}.'
              : refunded
              ? 'Reembolso de ${money(st.totalCents)} solicitado: Pix volta em instantes; no cartão, aparece em até 2 faturas.'
              : 'Nenhum valor foi cobrado.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.inkMuted, height: 1.4),
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () => context.go('/cliente/selecionar'),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: const Text('Fazer uma nova lista'),
        ),
        TextButton(onPressed: () => context.go('/cliente/pedidos'), child: const Text('Ver meus pedidos')),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: color.withValues(alpha: .08), borderRadius: BorderRadius.circular(14)),
    child: Row(
      children: [
        Icon(icon, color: color),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13.5),
          ),
        ),
      ],
    ),
  );
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.text});

  final int n;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        CircleAvatar(
          radius: 11,
          backgroundColor: AppColors.brandSoft,
          child: Text(
            '$n',
            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: const TextStyle(color: AppColors.ink, fontSize: 13.5)),
        ),
      ],
    ),
  );
}

class _Security extends StatelessWidget {
  const _Security();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 6),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.verified_user_rounded, size: 16, color: AppColors.success),
        SizedBox(width: 6),
        Flexible(
          child: Text(
            'Pagamento protegido pelo Asaas. Nada é cobrado antes da sua confirmação.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.inkMuted, fontSize: 12),
          ),
        ),
      ],
    ),
  );
}

/// Só aparece no ambiente de testes (sem cobrança real).
class _DemoControls extends StatelessWidget {
  const _DemoControls({required this.busy, required this.onResult});

  final bool busy;
  final ValueChanged<bool> onResult;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 8),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      border: Border.all(color: AppColors.line),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      children: [
        const Text(
          'Ambiente de demonstração — sem cobrança real',
          style: TextStyle(color: AppColors.inkMuted, fontSize: 12, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          alignment: WrapAlignment.center,
          children: [
            OutlinedButton(onPressed: busy ? null : () => onResult(true), child: const Text('Simular aprovado')),
            OutlinedButton(onPressed: busy ? null : () => onResult(false), child: const Text('Simular recusado')),
          ],
        ),
      ],
    ),
  );
}
