import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/errors.dart';
import '../../data/models/user.dart';
import '../../data/repositories/privacy_repository.dart';
import '../../state/auth_controller.dart';
import '../market/market_widgets.dart';

/// Meus dados e privacidade (LGPD): políticas, exportação e exclusão da conta.
class PrivacyDataScreen extends StatefulWidget {
  const PrivacyDataScreen({super.key});

  @override
  State<PrivacyDataScreen> createState() => _PrivacyDataScreenState();
}

class _PrivacyDataScreenState extends State<PrivacyDataScreen> {
  var _busy = false;

  void _say(String t) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(t)));

  Future<void> _export() async {
    setState(() => _busy = true);
    final String json;
    try {
      json = await context.read<PrivacyRepository>().export();
    } catch (e) {
      _say(friendlyError(e));
      return;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Seus dados'),
        content: SizedBox(
          width: 520,
          height: 360,
          child: SingleChildScrollView(
            child: SelectableText(json, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Fechar')),
          FilledButton.icon(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: json));
              Navigator.pop(c);
              _say('Dados copiados. Cole em um e-mail ou arquivo para guardar.');
            },
            icon: const Icon(Icons.copy_rounded),
            label: const Text('Copiar'),
          ),
        ],
      ),
    );
  }

  Future<void> _delete() async {
    final pass = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Excluir minha conta?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Seus dados pessoais (nome, contato, endereços, documentos) serão apagados e não será possível desfazer. '
              'Pedidos e pagamentos ficam guardados sem identificação, pelo prazo exigido por lei.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: pass,
              obscureText: true,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Confirme sua senha'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Voltar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.discount),
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Excluir conta'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await context.read<PrivacyRepository>().deleteAccount(pass.text);
      if (!mounted) return;
      _say('Conta excluída. Obrigado por usar o EconoRota.');
      await context.read<AuthController>().logout();
    } catch (e) {
      _say(friendlyError(e));
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthController>().user?.role;
    final canDelete = role == UserRole.customer || role == UserRole.courier;
    Widget tile(IconData icon, String title, String sub, VoidCallback? onTap, {Color? color}) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: PanelCard(
        onTap: _busy ? null : onTap,
        child: Row(
          children: [
            Icon(icon, color: color ?? AppColors.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(fontWeight: FontWeight.w700, color: color ?? AppColors.ink),
                  ),
                  Text(sub, style: const TextStyle(color: AppColors.inkMuted, fontSize: 12.5)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted),
          ],
        ),
      ),
    );
    return PanelPage(
      title: 'Meus dados e privacidade',
      subtitle: 'Seus direitos pela LGPD',
      showBack: true,
      maxWidth: 720,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Text(
            'CPF, CNH e chave Pix ficam cifrados. Só você e, quando necessário, a equipe do EconoRota têm acesso.',
            style: TextStyle(color: AppColors.inkMuted),
          ),
        ),
        tile(
          Icons.shield_rounded,
          'Política de privacidade',
          'Como usamos e protegemos seus dados',
          () => context.push('/privacidade'),
        ),
        tile(Icons.description_rounded, 'Termos de uso', 'Regras do serviço', () => context.push('/termos')),
        tile(Icons.download_rounded, 'Exportar meus dados', 'Cópia de tudo o que guardamos sobre você', _export),
        if (canDelete)
          tile(
            Icons.delete_forever_rounded,
            'Excluir minha conta',
            'Apaga seus dados pessoais',
            _delete,
            color: AppColors.discount,
          )
        else
          const Text(
            'Para encerrar a conta de um mercado ou da equipe, fale com o suporte do EconoRota.',
            style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
          ),
        if (_busy)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          ),
      ],
    );
  }
}
