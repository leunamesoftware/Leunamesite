import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../data/repositories/auth_repository.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/auth_scaffold.dart';
import '../../widgets/otp_field.dart';
import '../../widgets/password_strength.dart';
import '../../widgets/resend_timer.dart';

/// Recuperação de senha em 2 passos: pedir código → código + nova senha.
class RecoverScreen extends StatefulWidget {
  const RecoverScreen({super.key, this.initialLogin});

  final String? initialLogin;

  @override
  State<RecoverScreen> createState() => _RecoverScreenState();
}

class _RecoverScreenState extends State<RecoverScreen> {
  final _requestForm = GlobalKey<FormState>();
  final _resetForm = GlobalKey<FormState>();
  late final _login = TextEditingController(text: widget.initialLogin);
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  late CodeChannel _channel = (widget.initialLogin ?? '').contains('@') || (widget.initialLogin ?? '').isEmpty
      ? CodeChannel.email
      : CodeChannel.whatsapp;
  CodeDelivery? _delivery;
  int _round = 0;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_login, _code, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _request() async {
    FocusScope.of(context).unfocus();
    if (_delivery == null && !_requestForm.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final d = await context.read<AuthController>().forgotPassword(_login.text, _channel);
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
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reset() async {
    FocusScope.of(context).unfocus();
    if (_code.text.length != 6) {
      setState(() => _error = 'Digite o código de 6 dígitos.');
      return;
    }
    if (!_resetForm.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthController>().resetPassword(_login.text, _code.text, _password.text);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = context.select<AuthController, AuthConfig>((a) => a.config);
    final isEmail = _channel == CodeChannel.email;
    final t = Theme.of(context).textTheme;
    final step2 = _delivery != null;

    return AuthScaffold(
      title: 'Recuperar\n',
      highlight: 'senha',
      subtitle: step2
          ? 'Se houver uma conta com esses dados, você receberá um código em instantes.'
          : 'Informe seu e-mail ou WhatsApp para receber um código de recuperação.',
      art: 'assets/images/art/lock.webp',
      artAlignment: Alignment.center,
      onBack: () {
        if (step2) {
          setState(() => _delivery = null);
        } else {
          context.canPop() ? context.pop() : context.go('/entrar');
        }
      },
      children: [
        FormErrorBanner(_error),
        if (!step2) ...[
          if (config.whatsapp)
            SegmentedButton<CodeChannel>(
              segments: const [
                ButtonSegment(value: CodeChannel.email, icon: Icon(Icons.mail_outline_rounded), label: Text('E-mail')),
                ButtonSegment(value: CodeChannel.whatsapp, icon: Icon(Icons.chat_outlined), label: Text('WhatsApp')),
              ],
              selected: {_channel},
              showSelectedIcon: false,
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: AppColors.primaryLight,
                selectedForegroundColor: AppColors.text,
                foregroundColor: AppColors.textMuted,
                side: const BorderSide(color: AppColors.border),
                minimumSize: const Size.fromHeight(52),
              ),
              onSelectionChanged: (s) => setState(() {
                _channel = s.first;
                _login.clear();
                _error = null;
              }),
            ),
          const SizedBox(height: 16),
          Form(
            key: _requestForm,
            child: AppTextField(
              key: ValueKey(_channel),
              controller: _login,
              hint: isEmail ? 'Digite seu e-mail cadastrado' : 'Digite seu WhatsApp com DDD',
              icon: isEmail ? Icons.mail_outline_rounded : Icons.phone_outlined,
              keyboardType: isEmail ? TextInputType.emailAddress : TextInputType.phone,
              formatters: isEmail ? null : [phoneMask],
              autofillHints: [isEmail ? AutofillHints.email : AutofillHints.telephoneNumberNational],
              textInputAction: TextInputAction.done,
              validator: isEmail ? Validators.email : Validators.phone,
              onSubmitted: (_) => _request(),
            ),
          ),
          const SizedBox(height: 16),
          AppButton(label: 'Enviar código', icon: Icons.arrow_forward_rounded, loading: _loading, onPressed: _request),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, color: AppColors.roleCustomer),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    isEmail
                        ? 'Você receberá um código por e-mail para criar uma nova senha.'
                        : 'Você receberá um código no WhatsApp para criar uma nova senha.',
                    style: const TextStyle(fontSize: 14, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ] else ...[
          Text('Código enviado para ${_delivery!.target}', style: t.titleSmall),
          const SizedBox(height: 12),
          OtpField(controller: _code, hasError: _error != null),
          if (_delivery!.devCode != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Modo demonstração: use ${_delivery!.devCode}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.warning, fontSize: 13),
              ),
            ),
          const SizedBox(height: 16),
          Form(
            key: _resetForm,
            child: Column(
              children: [
                AppTextField(
                  controller: _password,
                  hint: 'Nova senha',
                  icon: Icons.lock_outline_rounded,
                  obscure: true,
                  autofillHints: const [AutofillHints.newPassword],
                  validator: Validators.newPassword,
                  onChanged: (_) => setState(() {}),
                ),
                PasswordStrength(password: _password.text),
                const SizedBox(height: 12),
                AppTextField(
                  controller: _confirm,
                  hint: 'Confirmar nova senha',
                  icon: Icons.lock_outline_rounded,
                  obscure: true,
                  textInputAction: TextInputAction.done,
                  validator: Validators.confirm(() => _password.text),
                  onSubmitted: (_) => _reset(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ResendTimer(key: ValueKey(_round), seconds: _delivery!.resendIn, sending: _loading, onResend: _request),
          const SizedBox(height: 16),
          AppButton(label: 'Redefinir senha', icon: Icons.check_rounded, loading: _loading, onPressed: _reset),
        ],
        const SizedBox(height: 12),
        TextButton.icon(
          onPressed: () => context.canPop() ? context.pop() : context.go('/entrar'),
          style: TextButton.styleFrom(foregroundColor: AppColors.text),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
          label: const Text('Voltar para o login'),
        ),
      ],
    );
  }
}
