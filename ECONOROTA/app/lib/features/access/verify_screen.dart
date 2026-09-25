import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../data/repositories/auth_repository.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_button.dart';
import '../../widgets/auth_scaffold.dart';
import '../../widgets/otp_field.dart';
import '../../widgets/resend_timer.dart';

/// Verificação da conta com código de 6 dígitos (e-mail por padrão; WhatsApp quando disponível).
class VerifyScreen extends StatefulWidget {
  const VerifyScreen({super.key});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  final _code = TextEditingController();
  CodeChannel _channel = CodeChannel.email;
  CodeDelivery? _delivery;
  int _round = 0;
  bool _sending = false;
  bool _confirming = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _send();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _send([CodeChannel? channel]) async {
    setState(() {
      _sending = true;
      _error = null;
      if (channel != null) _channel = channel;
    });
    try {
      final d = await context.read<AuthController>().sendVerification(_channel);
      if (mounted) {
        setState(() {
          _delivery = d;
          _round++;
          _code.clear();
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _confirm() async {
    if (_code.text.length != 6 || _confirming) return;
    setState(() {
      _confirming = true;
      _error = null;
    });
    try {
      await context.read<AuthController>().confirmVerification(_code.text);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final isEmail = _channel == CodeChannel.email;
    final canSwitch = isEmail ? auth.config.whatsapp && (auth.user?.phone?.isNotEmpty ?? false) : auth.config.email;
    final t = Theme.of(context).textTheme;

    return AuthScaffold(
      title: 'Verifique seu\n',
      highlight: isEmail ? 'e-mail' : 'WhatsApp',
      subtitle: _delivery == null
          ? 'Estamos enviando um código de verificação…'
          : 'Enviamos um código de 6 dígitos para ${_delivery!.target}.',
      art: 'assets/images/art/storefront.webp',
      onBack: () => auth.logout(forgetDevice: false),
      children: [
        FormErrorBanner(_error),
        OtpField(controller: _code, hasError: _error != null, onCompleted: (_) => _confirm()),
        const SizedBox(height: 14),
        Text('O código vale por 10 minutos.', textAlign: TextAlign.center, style: t.bodySmall),
        if (_delivery?.devCode != null) ...[
          const SizedBox(height: 8),
          Text(
            'Modo demonstração: use ${_delivery!.devCode}',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.warning, fontSize: 13),
          ),
        ],
        const SizedBox(height: 20),
        if (_delivery != null)
          ResendTimer(key: ValueKey(_round), seconds: _delivery!.resendIn, sending: _sending, onResend: _send)
        else if (_sending)
          const Center(child: CircularProgressIndicator()),
        const SizedBox(height: 20),
        AnimatedBuilder(
          animation: _code,
          builder: (_, _) => AppButton(
            label: 'Continuar',
            icon: Icons.arrow_forward_rounded,
            loading: _confirming,
            onPressed: _code.text.length == 6 ? _confirm : null,
          ),
        ),
        if (canSwitch) ...[
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: _sending ? null : () => _send(isEmail ? CodeChannel.whatsapp : CodeChannel.email),
            style: TextButton.styleFrom(foregroundColor: AppColors.accent),
            icon: Icon(isEmail ? Icons.chat_rounded : Icons.mail_outline_rounded, size: 18),
            label: Text(isEmail ? 'Receber pelo WhatsApp' : 'Receber por e-mail'),
          ),
        ],
        const SizedBox(height: 4),
        TextButton.icon(
          onPressed: () => auth.logout(forgetDevice: false),
          style: TextButton.styleFrom(foregroundColor: AppColors.text),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
          label: const Text('Voltar e usar outra conta'),
        ),
      ],
    );
  }
}
