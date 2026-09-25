import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../services/google_auth_service.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/auth_scaffold.dart';
import '../../widgets/google_button.dart';
import '../../widgets/password_strength.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  late final _termsTap = TapGestureRecognizer()..onTap = () => context.push('/termos');
  late final _privacyTap = TapGestureRecognizer()..onTap = () => context.push('/privacidade');

  bool _accepted = false;
  bool _termsError = false;
  bool _loading = false;
  bool _googleLoading = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _password, _confirm]) {
      c.dispose();
    }
    _termsTap.dispose();
    _privacyTap.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final valid = _form.currentState!.validate();
    setState(() => _termsError = !_accepted);
    if (!valid || !_accepted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthController>().register(
        name: _name.text,
        email: _email.text,
        phone: digitsOnly(_phone.text),
        password: _password.text,
      );
      TextInput.finishAutofillContext();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _google() async {
    setState(() {
      _googleLoading = true;
      _error = null;
    });
    try {
      await context.read<AuthController>().signInWithGoogle();
    } on GoogleAuthCancelled {
      // Janela fechada pelo usuário.
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final googleAvailable = context.select<AuthController, bool>((a) => a.googleAvailable);
    const link = TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600, decoration: TextDecoration.underline);

    return AuthScaffold(
      title: 'Crie sua ',
      highlight: 'conta',
      subtitle: 'É rápido e gratuito para começar a economizar nas suas compras.',
      art: 'assets/images/art/shopper.webp',
      artAlignment: Alignment.center,
      onBack: () => context.canPop() ? context.pop() : context.go('/entrar'),
      children: [
        FormErrorBanner(_error),
        AutofillGroup(
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppTextField(
                  controller: _name,
                  hint: 'Nome completo',
                  icon: Icons.person_outline_rounded,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  validator: Validators.name,
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: _email,
                  hint: 'E-mail',
                  icon: Icons.mail_outline_rounded,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  validator: Validators.email,
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: _phone,
                  hint: 'Telefone (WhatsApp)',
                  icon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                  formatters: [phoneMask],
                  autofillHints: const [AutofillHints.telephoneNumberNational],
                  validator: Validators.phone,
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: _password,
                  hint: 'Senha (mín. 8, letras e números)',
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
                  hint: 'Confirmar senha',
                  icon: Icons.lock_outline_rounded,
                  obscure: true,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.newPassword],
                  validator: Validators.confirm(() => _password.text),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () => setState(() {
            _accepted = !_accepted;
            if (_accepted) _termsError = false;
          }),
          child: Row(
            children: [
              Checkbox(
                value: _accepted,
                isError: _termsError,
                activeColor: AppColors.accent,
                checkColor: AppColors.onAccent,
                onChanged: (v) => setState(() {
                  _accepted = v ?? false;
                  if (_accepted) _termsError = false;
                }),
              ),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    style: const TextStyle(fontSize: 14, height: 1.4),
                    children: [
                      const TextSpan(text: 'Li e concordo com os '),
                      TextSpan(text: 'Termos de Uso', style: link, recognizer: _termsTap),
                      const TextSpan(text: ' e a '),
                      TextSpan(text: 'Política de Privacidade', style: link, recognizer: _privacyTap),
                      const TextSpan(text: '.'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_termsError)
          const Padding(
            padding: EdgeInsets.only(left: 14, top: 2),
            child: Text('Para continuar, aceite os termos.', style: TextStyle(color: AppColors.error, fontSize: 12)),
          ),
        const SizedBox(height: 16),
        AppButton(label: 'Criar conta', icon: Icons.arrow_forward_rounded, loading: _loading, onPressed: _submit),
        if (googleAvailable) ...[const OrDivider(), GoogleButton(loading: _googleLoading, onPressed: _google)],
        const SizedBox(height: 20),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            const Text('Já tem uma conta?'),
            TextButton(
              onPressed: () => context.canPop() ? context.pop() : context.go('/entrar'),
              style: TextButton.styleFrom(foregroundColor: AppColors.accent),
              child: const Text('Fazer login', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ],
    );
  }
}
