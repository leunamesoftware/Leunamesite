import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/config/env.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../core/utils/validators.dart';
import '../../services/google_auth_service.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/auth_scaffold.dart';
import '../../widgets/google_button.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _login = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _googleLoading = false;
  String? _error;

  @override
  void dispose() {
    _login.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthController>().login(_login.text, _password.text);
      TextInput.finishAutofillContext();
      _afterLogin();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Login aberto no meio da compra: volta para onde o cliente estava (ex.: confirmação do pedido).
  void _afterLogin() {
    if (!mounted || context.read<AuthController>().user == null) return;
    final back = GoRouterState.of(context).uri.queryParameters['voltar'];
    if (back != null && back.startsWith('/cliente/') && !back.contains('//')) {
      context.go(back);
    } else if (context.canPop()) {
      context.pop();
    }
  }

  Future<void> _google() async {
    setState(() {
      _googleLoading = true;
      _error = null;
    });
    try {
      await context.read<AuthController>().signInWithGoogle();
      _afterLogin();
    } on GoogleAuthCancelled {
      // Usuário fechou a janela do Google: nada a fazer.
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final googleAvailable = context.select<AuthController, bool>((a) => a.googleAvailable);
    return AuthScaffold(
      title: 'Faça seu ',
      highlight: 'login',
      subtitle: 'Acesse sua conta e aproveite as melhores ofertas da sua região.',
      art: 'assets/images/art/storefront.webp',
      // Aberto de dentro do app (ex.: visitante ao finalizar): permite voltar sem perder o que estava fazendo.
      onBack: context.canPop() ? () => context.pop() : null,
      children: [
        FormErrorBanner(_error),
        AutofillGroup(
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppTextField(
                  controller: _login,
                  hint: 'E-mail ou telefone',
                  icon: Icons.person_outline_rounded,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email, AutofillHints.username],
                  validator: Validators.login,
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: _password,
                  hint: 'Senha',
                  icon: Icons.lock_outline_rounded,
                  obscure: true,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.password],
                  validator: Validators.password,
                  onSubmitted: (_) => _submit(),
                ),
              ],
            ),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => context.push('/recuperar-senha', extra: _login.text.trim()),
            style: TextButton.styleFrom(foregroundColor: AppColors.accent),
            child: const Text('Esqueceu sua senha?', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(height: 4),
        AppButton(label: 'Entrar', icon: Icons.arrow_forward_rounded, loading: _loading, onPressed: _submit),
        if (googleAvailable) ...[const OrDivider(), GoogleButton(loading: _googleLoading, onPressed: _google)],
        const SizedBox(height: 28),
        Center(child: Text('Ainda não tem uma conta?', style: Theme.of(context).textTheme.bodyMedium)),
        TextButton(
          onPressed: () => context.push('/cadastro'),
          style: TextButton.styleFrom(foregroundColor: AppColors.accent),
          child: const Text('Criar conta', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        ),
        if (!context.select<AuthController, bool>((a) => a.guest))
          AppButton.secondary(
            label: 'Explorar sem conta',
            icon: Icons.storefront_outlined,
            onPressed: () async {
              await context.read<AuthController>().continueAsGuest();
              if (context.mounted) context.go('/cliente');
            },
          ),
        if (Env.useMock) ...[
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: () => context.push('/demo'),
            style: TextButton.styleFrom(foregroundColor: AppColors.textMuted),
            icon: const Icon(Icons.visibility_outlined, size: 18),
            label: const Text('Explorar perfis de demonstração'),
          ),
        ],
      ],
    );
  }
}
