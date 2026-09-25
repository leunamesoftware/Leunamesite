import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../widgets/empty_state.dart';

/// Link inválido ou página que não existe mais.
class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Página não encontrada')),
    body: EmptyState(
      icon: Icons.explore_off_rounded,
      title: 'Não encontramos esta página',
      message: 'O link pode estar errado ou o conteúdo não existe mais.',
      action: FilledButton(onPressed: () => context.go('/'), child: const Text('Voltar ao início')),
    ),
  );
}
