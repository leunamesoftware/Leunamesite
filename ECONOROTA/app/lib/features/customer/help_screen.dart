import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../widgets/brand_header.dart';

/// Ajuda: perguntas frequentes e atalhos para resolver problemas com pedidos.
class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  static const _faq = [
    (
      'Como o EconoRota escolhe os mercados?',
      'Comparamos os preços da sua lista nos mercados abertos perto de você e montamos a combinação mais barata, '
          'em até 3 mercados. Só dividimos a compra quando a economia paga o adicional da entrega, e cada mercado '
          'precisa ter pelo menos 5 produtos da lista.',
    ),
    (
      'Quanto custa a entrega?',
      'É uma entrega só, mesmo com mais de um mercado: um valor base e um pequeno adicional por mercado extra. '
          'O valor aparece antes de você pagar.',
    ),
    ('Qual o pedido mínimo?', 'O pedido mínimo vale para a soma de todos os mercados, não para cada um.'),
    (
      'E se faltar um produto?',
      'Se o mercado não tiver um item na hora de separar, o valor desse item volta para você automaticamente.',
    ),
    (
      'Para que serve o código de entrega?',
      'É a garantia de que o pedido chegou à pessoa certa. Mostre o QR Code ou diga os 6 números ao entregador '
          'somente quando receber tudo.',
    ),
    (
      'Como cancelo um pedido?',
      'Antes de pagar, pelo próprio pedido. Depois de pago, enquanto o mercado ainda não começou a separar, '
          'o cancelamento devolve o valor integral. Depois disso, relate um problema.',
    ),
    (
      'Como recebo o reembolso?',
      'No mesmo meio de pagamento: Pix volta para a conta de origem; no cartão, o estorno aparece na fatura '
          'conforme o prazo do banco.',
    ),
  ];

  @override
  Widget build(BuildContext context) => BrandScaffold(
    showBack: true,
    title: 'Ajuda',
    subtitle: 'Dúvidas frequentes e suporte',
    slivers: [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FilledButton.icon(
                onPressed: () => context.push('/cliente/pedidos'),
                icon: const Icon(Icons.support_agent_rounded),
                label: const Text('Tive um problema com um pedido'),
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              ),
              const SizedBox(height: 6),
              const Text(
                'Abra o pedido e toque em "Relatar um problema". Você pode enviar fotos.',
                style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => context.push('/cliente/ocorrencias'),
                icon: const Icon(Icons.history_rounded),
                label: const Text('Acompanhar meus problemas relatados'),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              ),
              const SizedBox(height: 16),
              const Text(
                'Perguntas frequentes',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
              ),
              const SizedBox(height: 8),
              for (final (q, a) in _faq)
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  color: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: const BorderSide(color: AppColors.line),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ExpansionTile(
                    title: Text(
                      q,
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
                    ),
                    childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                    children: [Text(a, style: const TextStyle(color: AppColors.inkMuted, height: 1.45))],
                  ),
                ),
            ],
          ),
        ),
      ),
    ],
  );
}
