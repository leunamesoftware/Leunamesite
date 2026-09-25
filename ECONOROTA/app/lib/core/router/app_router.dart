import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/user.dart';
import '../../features/customer/cart_screen.dart';
import '../../features/customer/customer_home_screen.dart';
import '../../features/customer/customer_shell.dart';
import '../../features/customer/profile_screen.dart';
import '../../features/customer/categories_screen.dart';
import '../../features/customer/compare/compare_screen.dart';
import '../../features/customer/compare/select_products_screen.dart';
import '../../features/customer/compare/smart_list_screen.dart';
import '../../features/customer/checkout/checkout_cart_screen.dart';
import '../../features/customer/checkout/checkout_confirm_screen.dart';
import '../../features/customer/checkout/payment_screen.dart';
import '../../features/customer/checkout/tracking_screen.dart';
import '../../features/customer/help/occurrence_new_screen.dart';
import '../../features/customer/help/occurrences_screen.dart';
import '../../data/models/market_panel.dart';
import '../../features/market/market_dashboard_screen.dart';
import '../../features/market/market_finance_screen.dart';
import '../../features/market/market_orders_screen.dart';
import '../../features/market/market_products_screen.dart';
import '../../features/market/market_shell.dart';
import '../../features/courier/courier_delivery_screen.dart';
import '../../features/courier/courier_earnings_screen.dart';
import '../../features/courier/courier_home_screen.dart';
import '../../features/courier/courier_profile_screen.dart';
import '../../features/courier/courier_signup_screen.dart';
import '../../features/market/market_stock_screen.dart';
import '../../features/market/store_data_screen.dart';
import '../../features/customer/location_screen.dart';
import '../../features/customer/markets_screen.dart';
import '../../features/customer/offers_screen.dart';
import '../../features/customer/orders_screen.dart';
import '../../features/customer/search_screen.dart';
import '../../features/customer/store/market_categories_screen.dart';
import '../../features/customer/store/market_reviews_screen.dart';
import '../../features/customer/store/market_store_screen.dart';
import '../../features/customer/store/product_details_screen.dart';
import '../../features/design_system/components_screen.dart';
import '../../features/admin/admin_catalog_screens.dart';
import '../../features/admin/admin_finance_screen.dart';
import '../../features/admin/admin_home_screen.dart';
import '../../features/admin/admin_occurrences_screens.dart';
import '../../features/admin/admin_orders_screens.dart';
import '../../features/admin/admin_people_screens.dart';
import '../../features/admin/admin_system_screens.dart';
import '../../features/ratings/rating_screen.dart';
import '../../features/access/address_screen.dart';
import '../../features/access/legal_screen.dart';
import '../../features/access/location_screen.dart';
import '../../features/access/login_screen.dart';
import '../../features/access/onboarding_screen.dart';
import '../../features/access/recover_screen.dart';
import '../../features/access/register_screen.dart';
import '../../features/access/splash_screen.dart';
import '../../features/access/verify_screen.dart';
import '../../features/role_select/role_select_screen.dart';
import '../../data/models/address.dart';
import '../config/env.dart';
import '../../features/customer/help_screen.dart';
import '../../features/shared/not_found_screen.dart';
import '../../features/shared/notifications_screen.dart';
import '../../features/shared/privacy_data_screen.dart';
import '../../state/auth_controller.dart';

String homeFor(UserRole role) => switch (role) {
  UserRole.customer => '/cliente',
  UserRole.market => '/mercado',
  UserRole.courier => '/entregador',
  UserRole.admin => '/admin',
};

/// Rotas de acesso (usuário sem login).
const _public = {
  '/boas-vindas',
  '/localizacao',
  '/endereco',
  '/entrar',
  '/cadastro',
  '/recuperar-senha',
  '/termos',
  '/privacidade',
  '/demo',
};

/// Rotas liberadas para qualquer usuário logado (além da área do próprio perfil).
const _shared = [
  '/componentes',
  '/endereco',
  '/termos',
  '/privacidade',
  '/avaliar/',
  '/avaliacoes',
  '/notificacoes',
  '/conta/dados',
];

GoRouter buildRouter(AuthController auth) {
  return GoRouter(
    initialLocation: '/',
    errorBuilder: (_, _) => const NotFoundScreen(),
    refreshListenable: auth,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      if (loc == '/') return null; // a abertura decide o destino
      if (auth.status == AuthStatus.unknown) return '/';
      if (loc == '/demo' && !Env.useMock) return '/entrar';

      final user = auth.user;
      if (user == null) {
        if (_public.contains(loc)) return null;
        // Visitante navega pela área do cliente; comprar e pedidos pedem login na própria tela.
        return auth.guest && loc.startsWith('/cliente') ? null : '/entrar';
      }
      if (auth.needsVerification) {
        return const {'/verificar', '/termos', '/privacidade'}.contains(loc) ? null : '/verificar';
      }

      final home = homeFor(user.role);
      // Login pedido no meio da compra: volta para onde o cliente estava.
      final back = state.uri.queryParameters['voltar'];
      if (loc == '/entrar' && back != null && back.startsWith('$home/') && !back.contains('//')) return back;
      final allowed = loc.startsWith(home) || _shared.any(loc.startsWith);
      return allowed ? null : home;
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/boas-vindas', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/localizacao', builder: (_, _) => const LocationScreen()),
      GoRoute(
        path: '/endereco',
        builder: (_, s) => AddressScreen(initial: s.extra is Address ? s.extra as Address : null),
      ),
      GoRoute(path: '/entrar', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/cadastro', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/verificar', builder: (_, _) => const VerifyScreen()),
      GoRoute(
        path: '/recuperar-senha',
        builder: (_, s) => RecoverScreen(initialLogin: s.extra is String ? s.extra as String : null),
      ),
      GoRoute(path: '/termos', builder: (_, _) => const LegalScreen.terms()),
      GoRoute(path: '/privacidade', builder: (_, _) => const LegalScreen.privacy()),
      GoRoute(path: '/demo', builder: (_, _) => const RoleSelectScreen()),
      GoRoute(path: '/componentes', builder: (_, _) => const ComponentsScreen()),
      // Fase 12 — avaliações (todas as áreas).
      GoRoute(
        path: '/avaliar/:id',
        builder: (_, s) => RatingScreen(orderId: s.pathParameters['id']!),
      ),
      GoRoute(path: '/avaliacoes', builder: (_, _) => const MyRatingsScreen()),
      // Fase 16 — notificações.
      GoRoute(path: '/notificacoes', builder: (_, _) => const NotificationsScreen()),
      // Fase 17 — LGPD.
      GoRoute(path: '/conta/dados', builder: (_, _) => const PrivacyDataScreen()),
      GoRoute(path: '/cliente/ajuda', builder: (_, _) => const HelpScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => CustomerShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/cliente', builder: (_, _) => const CustomerHomeScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/cliente/busca', builder: (_, _) => const SearchScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/cliente/ofertas', builder: (_, _) => const OffersScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/cliente/pedidos', builder: (_, _) => const OrdersScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/cliente/perfil', builder: (_, _) => const ProfileScreen())],
          ),
        ],
      ),
      GoRoute(path: '/cliente/carrinho', builder: (_, _) => const CartScreen()),
      GoRoute(path: '/cliente/selecionar', builder: (_, _) => const SelectProductsScreen()),
      GoRoute(
        path: '/cliente/comparar',
        builder: (_, s) => CompareScreen(fromSmartList: s.uri.queryParameters['lista'] == '1'),
      ),
      GoRoute(path: '/cliente/lista-inteligente', builder: (_, _) => const SmartListScreen()),
      GoRoute(path: '/cliente/pedido', builder: (_, _) => const CheckoutCartScreen()),
      GoRoute(path: '/cliente/pedido/confirmar', builder: (_, _) => const CheckoutConfirmScreen()),
      GoRoute(
        path: '/cliente/pedido/:id/problema',
        builder: (_, s) => OccurrenceNewScreen(orderId: s.pathParameters['id']!),
      ),
      GoRoute(path: '/cliente/ocorrencias', builder: (_, _) => const OccurrencesScreen()),
      GoRoute(
        path: '/cliente/ocorrencias/:id',
        builder: (_, s) => OccurrenceDetailScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/cliente/pedido/:id/rastreio',
        builder: (_, s) => TrackingScreen(orderId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/cliente/pedido/:id/pagamento',
        builder: (_, s) =>
            PaymentScreen(orderId: s.pathParameters['id']!, savings: s.extra is int ? s.extra! as int : 0),
      ),
      GoRoute(path: '/cliente/categorias', builder: (_, _) => const CategoriesScreen()),
      GoRoute(
        path: '/cliente/categoria/:id',
        builder: (_, s) => SearchScreen(categoryId: s.pathParameters['id']),
      ),
      GoRoute(path: '/cliente/mercados', builder: (_, _) => const MarketsScreen()),
      GoRoute(path: '/cliente/localizacao', builder: (_, _) => const CustomerLocationScreen()),
      GoRoute(
        path: '/cliente/mercado/:id',
        builder: (_, s) => MarketStoreScreen(marketId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/cliente/mercado/:id/categorias',
        builder: (_, s) =>
            MarketCategoriesScreen(marketId: s.pathParameters['id']!, marketName: s.uri.queryParameters['mercado']),
      ),
      GoRoute(
        path: '/cliente/mercado/:id/produtos',
        builder: (_, s) => SearchScreen(
          marketId: s.pathParameters['id'],
          marketName: s.uri.queryParameters['mercado'],
          categoryId: s.uri.queryParameters['categoria'],
        ),
      ),
      GoRoute(
        path: '/cliente/mercado/:id/avaliacoes',
        builder: (_, s) =>
            MarketReviewsScreen(marketId: s.pathParameters['id']!, marketName: s.uri.queryParameters['mercado']),
      ),
      GoRoute(
        path: '/cliente/mercado/:id/ofertas',
        builder: (_, s) => OffersScreen(marketId: s.pathParameters['id'], marketName: s.uri.queryParameters['mercado']),
      ),
      GoRoute(
        path: '/cliente/produto/:id',
        builder: (_, s) => ProductDetailsScreen(productId: s.pathParameters['id']!),
      ),
      // Fase 8 — painel do supermercado.
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => MarketShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/mercado', builder: (_, _) => const MarketDashboardScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/mercado/pedidos', builder: (_, _) => const MarketOrdersScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/mercado/produtos',
                builder: (_, s) => MarketProductsScreen(
                  filter: s.uri.queryParameters['filtro'],
                  categoryId: s.uri.queryParameters['categoria'],
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/mercado/estoque', builder: (_, _) => const MarketStockScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/mercado/financeiro', builder: (_, _) => const MarketFinanceScreen())],
          ),
        ],
      ),
      GoRoute(
        path: '/mercado/pedidos/:id',
        builder: (_, s) => MarketOrderScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(path: '/mercado/loja', builder: (_, _) => const StoreDataScreen()),
      GoRoute(path: '/mercado/categorias', builder: (_, _) => const PanelCategoriesScreen()),
      GoRoute(path: '/mercado/produto/novo', builder: (_, _) => const MarketProductFormScreen()),
      GoRoute(
        path: '/mercado/produto/:id',
        redirect: (_, s) => s.extra is PanelProduct ? null : '/mercado/produtos',
        builder: (_, s) => MarketProductFormScreen(product: s.extra! as PanelProduct),
      ),
      // Fase 9 — entregador.
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => PanelShell(
          shell: shell,
          icon: Icons.delivery_dining_rounded,
          tabs: const [
            (Icons.home_outlined, Icons.home_rounded, 'Início'),
            (Icons.delivery_dining_outlined, Icons.delivery_dining_rounded, 'Entrega'),
            (Icons.payments_outlined, Icons.payments_rounded, 'Ganhos'),
            (Icons.history_rounded, Icons.history_rounded, 'Histórico'),
            (Icons.person_outline_rounded, Icons.person_rounded, 'Perfil'),
          ],
        ),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/entregador', builder: (_, _) => const CourierHomeScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/entregador/entrega', builder: (_, _) => const CourierDeliveryScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/entregador/ganhos', builder: (_, _) => const CourierEarningsScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/entregador/historico', builder: (_, _) => const CourierHistoryScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/entregador/perfil', builder: (_, _) => const CourierProfileScreen())],
          ),
        ],
      ),
      GoRoute(path: '/entregador/cadastro', builder: (_, _) => const CourierSignupScreen()),
      // Fase 13 — painel administrativo.
      GoRoute(path: '/admin', builder: (_, _) => const AdminHomeScreen()),
      GoRoute(path: '/admin/clientes', builder: (_, _) => const AdminCustomersScreen()),
      GoRoute(path: '/admin/mercados', builder: (_, _) => const AdminMarketsScreen()),
      GoRoute(path: '/admin/entregadores', builder: (_, _) => const AdminCouriersScreen()),
      GoRoute(
        path: '/admin/entregadores/:id',
        builder: (_, s) => AdminCourierScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(path: '/admin/produtos', builder: (_, _) => const AdminProductsScreen()),
      GoRoute(path: '/admin/pedidos', builder: (_, _) => const AdminOrdersScreen()),
      GoRoute(
        path: '/admin/pedidos/:id',
        builder: (_, s) => AdminOrderScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(path: '/admin/entregas', builder: (_, _) => const AdminDeliveriesScreen()),
      GoRoute(path: '/admin/ocorrencias', builder: (_, _) => const AdminOccurrencesScreen()),
      GoRoute(
        path: '/admin/ocorrencias/:id',
        builder: (_, s) => AdminOccurrenceScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(path: '/admin/avaliacoes', builder: (_, _) => const AdminRatingsScreen()),
      GoRoute(path: '/admin/regioes', builder: (_, _) => const AdminRegionsScreen()),
      GoRoute(path: '/admin/pagamentos', builder: (_, _) => const AdminPaymentsScreen()),
      GoRoute(path: '/admin/financeiro', builder: (_, _) => const AdminFinanceScreen()),
      GoRoute(path: '/admin/relatorios', builder: (_, _) => const AdminReportsScreen()),
      GoRoute(path: '/admin/configuracoes', builder: (_, _) => const AdminSettingsScreen()),
      GoRoute(path: '/admin/equipe', builder: (_, _) => const AdminTeamScreen()),
      GoRoute(path: '/admin/auditoria', builder: (_, _) => const AdminAuditScreen()),
    ],
  );
}
