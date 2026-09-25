import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/theme/app_colors.dart';

/// Código de entrega: o entregador só finaliza com ele (QR Code ou 6 dígitos).
class DeliveryCodeCard extends StatelessWidget {
  const DeliveryCodeCard({super.key, required this.code});

  final String code;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppColors.primary, width: 1.5),
    ),
    child: Column(
      children: [
        const Text(
          'Código de entrega',
          style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.ink),
        ),
        const SizedBox(height: 8),
        Semantics(
          label: 'QR Code de entrega',
          child: QrImageView(data: 'econorota:entrega:$code', size: 150, backgroundColor: Colors.white),
        ),
        Text(
          code.split('').join(' '),
          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 4, color: AppColors.primary),
        ),
        const SizedBox(height: 6),
        const Text(
          'Mostre ao entregador só quando receber as compras. Nunca passe este código por telefone ou mensagem.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
        ),
      ],
    ),
  );
}
