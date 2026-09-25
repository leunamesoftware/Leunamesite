import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../data/models/user.dart';
import '../../l10n/app_localizations.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_logo.dart';
import '../../widgets/role_card.dart';

class RoleSelectScreen extends StatefulWidget {
  const RoleSelectScreen({super.key});

  @override
  State<RoleSelectScreen> createState() => _RoleSelectScreenState();
}

class _RoleSelectScreenState extends State<RoleSelectScreen> {
  UserRole? _loading;

  Future<void> _enter(UserRole role) async {
    setState(() => _loading = role);
    try {
      await context.read<AuthController>().enterDemo(role);
    } finally {
      if (mounted) setState(() => _loading = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final t = Theme.of(context).textTheme;
    final roles = [
      (UserRole.customer, Icons.person_rounded, l.roleCustomer, l.roleCustomerDesc, AppColors.roleCustomer),
      (UserRole.market, Icons.storefront_rounded, l.roleMarket, l.roleMarketDesc, AppColors.roleMarket),
      (UserRole.courier, Icons.delivery_dining_rounded, l.roleCourier, l.roleCourierDesc, AppColors.roleCourier),
      (UserRole.admin, Icons.settings_rounded, l.roleAdmin, l.roleAdminDesc, AppColors.roleAdmin),
    ];

    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF3A0870), AppColors.background],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 32, 20, 24),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      tooltip: 'Voltar',
                      onPressed: () => context.canPop() ? context.pop() : context.go('/entrar'),
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                  ),
                  const Center(child: AppLogo(size: 88, showName: false)),
                  const SizedBox(height: 16),
                  const Center(child: AppLogo(showIcon: false, nameSize: 34)),
                  const SizedBox(height: 6),
                  Text(
                    l.slogan,
                    textAlign: TextAlign.center,
                    style: t.bodyMedium?.copyWith(color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 36),
                  Text(l.roleTitle, style: t.titleLarge),
                  const SizedBox(height: 4),
                  Text(l.roleSubtitle, style: t.bodySmall),
                  const SizedBox(height: 16),
                  for (final (role, icon, title, desc, color) in roles) ...[
                    Stack(
                      alignment: Alignment.centerRight,
                      children: [
                        RoleCard(
                          icon: icon,
                          title: title,
                          description: desc,
                          color: color,
                          onTap: _loading == null ? () => _enter(role) : null,
                        ),
                        if (_loading == role)
                          const Padding(
                            padding: EdgeInsets.only(right: 18),
                            child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  const SizedBox(height: 8),
                  Text(l.demoMode, textAlign: TextAlign.center, style: t.bodySmall),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
