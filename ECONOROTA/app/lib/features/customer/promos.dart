import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../widgets/promo_banner.dart';

List<Promo> homePromos(BuildContext context) => [
  Promo(
    title: 'Compare e',
    highlight: 'economize',
    text: 'O mesmo produto em vários mercados, lado a lado.',
    image: 'assets/images/art/splash_hero.webp',
    colors: const [Color(0xFF6A1FC2), Color(0xFF2A0859)],
    onTap: () => context.go('/cliente/busca'),
  ),
  Promo(
    title: 'Até 3 mercados,',
    highlight: 'uma entrega',
    text: 'Montamos a combinação mais barata para sua lista.',
    image: 'assets/images/art/stores_map.webp',
    colors: const [Color(0xFF3A0870), Color(0xFF1C0640)],
    onTap: () => context.push('/cliente/mercados'),
  ),
  Promo(
    title: 'Ofertas',
    highlight: 'todos os dias',
    text: 'Os maiores descontos dos mercados perto de você.',
    image: 'assets/images/art/onboarding_cart.webp',
    colors: const [Color(0xFF0B5B34), Color(0xFF0A3A2A)],
    onTap: () => context.go('/cliente/ofertas'),
  ),
];
