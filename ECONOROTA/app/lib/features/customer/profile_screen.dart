import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../state/auth_controller.dart';
import '../../widgets/brand_header.dart';
import '../../widgets/promo_banner.dart';

class _Item {
  const _Item(this.icon, this.color, this.title, this.subtitle, this.onTap, {this.needsLogin = false});

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final void Function(BuildContext) onTap;
  final bool needsLogin;
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final user = auth.user;

    final items = [
      _Item(
        Icons.location_on_rounded,
        const Color(0xFF16A34A),
        'Meus endereços',
        'Endereços de entrega',
        (c) => c.push('/endereco'),
      ),
      _Item(
        Icons.support_agent_rounded,
        const Color(0xFF2563EB),
        'Minhas ocorrências',
        'Problemas e reembolsos',
        (c) => c.push('/cliente/ocorrencias'),
        needsLogin: true,
      ),
      _Item(
        Icons.shopping_bag_rounded,
        const Color(0xFFF97316),
        'Meus pedidos',
        'Acompanhe e veja o histórico',
        (c) => c.go('/cliente/pedidos'),
      ),
      _Item(
        Icons.star_rounded,
        const Color(0xFFE5294D),
        'Avaliações',
        'Mercados e entregadores',
        (c) => c.push('/avaliacoes'),
        needsLogin: true,
      ),
      _Item(
        Icons.notifications_rounded,
        const Color(0xFF7C3AED),
        'Notificações',
        'Ofertas e status do pedido',
        (c) => c.push('/notificacoes'),
        needsLogin: true,
      ),
      _Item(Icons.help_rounded, const Color(0xFFEAB308), 'Ajuda', 'Dúvidas e suporte', (c) => c.push('/cliente/ajuda')),
      _Item(
        Icons.shield_rounded,
        const Color(0xFF64748B),
        'Meus dados e privacidade',
        'LGPD: exportar ou excluir',
        (c) => c.push('/conta/dados'),
        needsLogin: true,
      ),
      _Item(
        Icons.description_rounded,
        const Color(0xFF64748B),
        'Termos de uso',
        'Regras do serviço',
        (c) => c.push('/termos'),
      ),
    ];

    return BrandScaffold(
      title: 'Meu perfil',
      subtitle: 'Seus dados, pedidos e preferências.',
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: user == null
                ? const _LoginCard()
                : _UserCard(name: user.name, email: user.email, verified: user.verified),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 260,
              mainAxisExtent: 76,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            delegate: SliverChildListDelegate([
              for (final it in items)
                _Tile(
                  item: it,
                  onTap: () => it.needsLogin && user == null ? context.push('/entrar') : it.onTap(context),
                ),
            ]),
          ),
        ),
        if (user != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: OutlinedButton.icon(
                onPressed: () => _confirmLogout(context),
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Sair da conta'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.discount,
                  side: const BorderSide(color: AppColors.dangerSoft, width: 1.5),
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ),
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 20, 16, 0),
            child: PromoBanner(
              height: 150,
              promo: Promo(
                title: 'Mais economia',
                highlight: 'sempre com você!',
                text: 'Ofertas exclusivas dos mercados da sua região.',
                image: 'assets/images/art/splash_hero.webp',
                colors: [Color(0xFF5A0FA0), Color(0xFF2A0859)],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Sair da conta?', style: TextStyle(color: AppColors.ink)),
        content: const Text(
          'Seu endereço, buscas e carrinho serão apagados deste aparelho.',
          style: TextStyle(color: AppColors.inkMuted),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.discount),
            child: const Text('Sair'),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) await context.read<AuthController>().logout();
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard();

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 30,
            backgroundColor: AppColors.primary,
            child: Icon(Icons.person_rounded, color: Colors.white, size: 34),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Faça seu login',
                  style: TextStyle(
                    fontFamily: 'Montserrat',
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                    color: AppColors.ink,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Para comprar, ver pedidos e salvar endereços.',
                  style: TextStyle(color: AppColors.inkMuted, height: 1.3),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: () => context.push('/entrar'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Entrar'),
          ),
        ],
      ),
    ),
  );
}

class _UserCard extends StatelessWidget {
  const _UserCard({required this.name, required this.email, required this.verified});

  final String name;
  final String email;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().split(RegExp(r'\s+')).take(2).map((p) => p.isEmpty ? '' : p[0].toUpperCase()).join();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: AppColors.primary,
              child: Text(
                initials,
                style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w800, fontSize: 20),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                      color: AppColors.ink,
                    ),
                  ),
                  Text(
                    email,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.inkMuted),
                  ),
                  if (verified)
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Row(
                        children: [
                          Icon(Icons.verified_rounded, size: 16, color: AppColors.success),
                          SizedBox(width: 4),
                          Text(
                            'Conta verificada',
                            style: TextStyle(color: AppColors.success, fontSize: 12.5, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.item, required this.onTap});

  final _Item item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(color: item.color, borderRadius: BorderRadius.circular(12)),
              child: Icon(item.icon, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.ink),
                  ),
                  Text(
                    item.subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: AppColors.inkMuted, height: 1.2),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
