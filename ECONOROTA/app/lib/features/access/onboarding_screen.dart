import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../state/address_controller.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_button.dart';
import '../../widgets/two_tone_title.dart';
import 'access_flow.dart';

class _Slide {
  const _Slide(this.title, this.highlight, this.text, this.art, this.ratio, [this.features = const []]);

  final String title;
  final String highlight;
  final String text;
  final String art;

  /// Proporção largura/altura da arte (evita cortes e zoom excessivo).
  final double ratio;
  final List<(IconData, String)> features;
}

const _slides = [
  _Slide(
    'Bem-vindo ao\n',
    'EconoRota',
    'Encontre os melhores preços dos supermercados mais próximos de você.',
    'assets/images/art/onboarding_cart.webp',
    1.29,
    [
      (Icons.percent_rounded, 'Compare\npreços'),
      (Icons.location_on_rounded, 'Mercados\npróximos'),
      (Icons.savings_rounded, 'Mais\neconomia'),
    ],
  ),
  _Slide(
    'Compare preços\n',
    'em segundos',
    'Veja o mesmo produto em vários mercados e descubra onde ele está mais barato.',
    'assets/images/art/map_pins.webp',
    1.32,
  ),
  _Slide(
    'Até 3 mercados,\n',
    'uma só entrega',
    'Montamos a melhor combinação de mercados para sua lista. Você economiza e recebe tudo junto.',
    'assets/images/art/stores_map.webp',
    .83,
  ),
  _Slide(
    'Acompanhe tudo\n',
    'em tempo real',
    'Pagamento seguro e rastreio da entrega, do mercado até a sua porta.',
    'assets/images/art/splash_hero.webp',
    1.33,
  ),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _page = PageController();
  int _index = 0;

  bool get _last => _index == _slides.length - 1;

  Future<void> _finish() async {
    final auth = context.read<AuthController>();
    await auth.completeOnboarding();
    if (mounted) context.go(nextAccessRoute(auth, context.read<AddressController>()));
  }

  void _next() =>
      _last ? _finish() : _page.nextPage(duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic);

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: AnimatedOpacity(
                  opacity: _last ? 0 : 1,
                  duration: const Duration(milliseconds: 200),
                  child: TextButton(
                    onPressed: _last ? null : _finish,
                    style: TextButton.styleFrom(foregroundColor: AppColors.text),
                    child: const Text('Pular', style: TextStyle(fontSize: 16)),
                  ),
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _page,
                  itemCount: _slides.length,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemBuilder: (_, i) => _SlideView(slide: _slides[i]),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _slides.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: i == _index ? 26 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: i == _index ? AppColors.accent : AppColors.border,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
                child: AppButton(
                  label: _last ? 'Começar' : 'Próximo',
                  icon: _last ? Icons.check_rounded : Icons.arrow_forward_rounded,
                  onPressed: _next,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24),
    child: Column(
      children: [
        TwoToneTitle(slide.title, slide.highlight, align: TextAlign.center, size: 30),
        const SizedBox(height: 12),
        Text(
          slide.text,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16, color: AppColors.textMuted, height: 1.45),
        ),
        if (slide.features.isNotEmpty) ...[
          const SizedBox(height: 20),
          Row(
            children: [
              for (final (icon, label) in slide.features)
                Expanded(
                  child: Column(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: const BoxDecoration(color: AppColors.accent, shape: BoxShape.circle),
                        child: Icon(icon, color: AppColors.onAccent, size: 26),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        label,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.25),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
        const SizedBox(height: 20),
        Expanded(
          child: Center(
            child: AspectRatio(
              aspectRatio: slide.ratio,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: ExcludeSemantics(child: Image.asset(slide.art, fit: BoxFit.cover)),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
