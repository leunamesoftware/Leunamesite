import 'core/config/env.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'data/models/user.dart';
import 'data/repositories/admin_repository.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/catalog_repository.dart';
import 'data/repositories/compare_repository.dart';
import 'data/repositories/courier_repository.dart';
import 'data/repositories/geo_repository.dart';
import 'data/repositories/market_panel_repository.dart';
import 'data/repositories/notifications_repository.dart';
import 'data/repositories/occurrences_repository.dart';
import 'data/repositories/orders_repository.dart';
import 'data/repositories/privacy_repository.dart';
import 'data/repositories/ratings_repository.dart';
import 'data/repositories/store_repository.dart';
import 'l10n/app_localizations.dart';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import 'services/api_client.dart';
import 'services/google_auth_service.dart';
import 'services/location_service.dart';
import 'services/session_store.dart';
import 'services/update_check.dart';
import 'state/address_controller.dart';
import 'state/auth_controller.dart';
import 'state/cart_controller.dart';
import 'state/checkout_controller.dart';
import 'state/courier_controller.dart';
import 'state/favorites_controller.dart';
import 'state/notifications_controller.dart';
import 'state/search_history.dart';

class EconoRotaApp extends StatefulWidget {
  const EconoRotaApp({super.key, this.store, this.location});

  final SessionStore? store;
  final LocationService? location;

  @override
  State<EconoRotaApp> createState() => _EconoRotaAppState();
}

class _EconoRotaAppState extends State<EconoRotaApp> {
  final _api = ApiClient();
  late final _store = widget.store ?? SessionStore();
  late final _address = AddressController(_store, Env.useMock ? null : _api);
  final _cart = CartController();
  final _checkout = CheckoutController();
  late final AuthController _auth = AuthController(
    Env.useMock ? MockAuthRepository() : ApiAuthRepository(_api),
    _store,
    _api,
    GoogleAuthService(),
  );
  late final CatalogRepository _catalog = Env.useMock ? MockCatalogRepository() : ApiCatalogRepository(_api);
  late final MarketPanelRepository _marketPanel = Env.useMock
      ? MockMarketPanelRepository()
      : ApiMarketPanelRepository(_api);
  late final CourierRepository _courierRepo = Env.useMock ? MockCourierRepository() : ApiCourierRepository(_api);
  late final CourierController _courier = CourierController(_courierRepo, _location);
  late final OccurrencesRepository _occurrences = Env.useMock
      ? MockOccurrencesRepository()
      : ApiOccurrencesRepository(_api);
  late final AdminRepository _admin = Env.useMock ? MockAdminRepository() : ApiAdminRepository(_api);
  late final RatingsRepository _ratings = Env.useMock
      ? MockRatingsRepository(() => _auth.user?.role)
      : ApiRatingsRepository(_api);
  late final NotificationsRepository _notificationsRepo = Env.useMock
      ? MockNotificationsRepository(() => _auth.user?.role)
      : ApiNotificationsRepository(_api);
  late final _notifications = NotificationsController(_notificationsRepo, _auth);
  late final PrivacyRepository _privacy = Env.useMock ? MockPrivacyRepository() : ApiPrivacyRepository(_api);
  late final OrdersRepository _orders = Env.useMock ? MockOrdersRepository() : ApiOrdersRepository(_api);
  late final _history = SearchHistory(_store)..load();
  late final _favorites = FavoritesController(_store)..load();
  late final CompareRepository _compare = Env.useMock ? MockCompareRepository(_catalog) : ApiCompareRepository(_api);
  late final StoreRepository _storeRepo = Env.useMock ? MockStoreRepository(_catalog) : ApiStoreRepository(_api);
  late final GeoRepository _geo = Env.useMock ? MockGeoRepository() : ApiGeoRepository(_api);
  late final LocationService _location = widget.location ?? (Env.useMock ? MockLocationService() : LocationService());
  late final GoRouter _router = buildRouter(_auth);

  /// Link da loja quando esta versão ficou antiga demais (atualização obrigatória).
  String? _updateUrl;

  @override
  void initState() {
    super.initState();
    requiredUpdate(_api).then((url) {
      if (url != null && mounted) setState(() => _updateUrl = url);
    });
    // Sair da conta não deixa rastro no aparelho: endereços e carrinho são apagados.
    _auth.onSignedOut = () {
      _address.clear();
      _cart.clear();
      _checkout.clear();
      _courier.reset();
      _history.clear();
      _favorites.clear();
    };
    _auth.addListener(() {
      if (_auth.status == AuthStatus.signedIn) _address.syncToAccount();
    });
  }

  @override
  void dispose() {
    _notifications.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: _auth),
      ChangeNotifierProvider.value(value: _address),
      ChangeNotifierProvider.value(value: _cart),
      ChangeNotifierProvider.value(value: _checkout),
      ChangeNotifierProvider.value(value: _history),
      ChangeNotifierProvider.value(value: _favorites),
      Provider<StoreRepository>.value(value: _storeRepo),
      Provider<CompareRepository>.value(value: _compare),
      Provider<OrdersRepository>.value(value: _orders),
      Provider<MarketPanelRepository>.value(value: _marketPanel),
      Provider<CourierRepository>.value(value: _courierRepo),
      Provider<OccurrencesRepository>.value(value: _occurrences),
      Provider<RatingsRepository>.value(value: _ratings),
      Provider<AdminRepository>.value(value: _admin),
      Provider<PrivacyRepository>.value(value: _privacy),
      Provider<NotificationsRepository>.value(value: _notificationsRepo),
      ChangeNotifierProvider.value(value: _notifications),
      ChangeNotifierProvider.value(value: _courier),
      Provider<CatalogRepository>.value(value: _catalog),
      Provider<GeoRepository>.value(value: _geo),
      Provider<LocationService>.value(value: _location),
    ],
    child: MaterialApp.router(
      title: 'EconoRota',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: _router,
      // Respeita a fonte maior do sistema, com limite para não quebrar os layouts.
      builder: (context, child) => MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.3,
        child: _updateUrl != null ? _UpdateRequired(url: _updateUrl!) : _WideFrame(child: child!),
      ),
      locale: const Locale('pt'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  );
}

/// Em notebook e computador o app fica centralizado com largura de leitura confortável
/// (nada esticado de ponta a ponta); celular e tablet usam a tela inteira.
class _WideFrame extends StatelessWidget {
  const _WideFrame({required this.child});

  static const maxWidth = 860.0;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    // Painéis de gestão (mercado e administração) usam a tela inteira no computador.
    final role = context.select<AuthController, UserRole?>((a) => a.user?.role);
    if (mq.size.width <= maxWidth + 80 || role == UserRole.market || role == UserRole.admin) return child;
    return ColoredBox(
      color: AppColors.background,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: maxWidth),
          child: MediaQuery(
            data: mq.copyWith(size: Size(maxWidth, mq.size.height)),
            child: ClipRect(child: child),
          ),
        ),
      ),
    );
  }
}

/// Versão antiga demais: pede a atualização na loja.
class _UpdateRequired extends StatelessWidget {
  const _UpdateRequired({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.system_update_rounded, size: 64, color: AppColors.accent),
            const SizedBox(height: 16),
            const Text(
              'Atualize o EconoRota',
              style: TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 22),
            ),
            const SizedBox(height: 8),
            const Text(
              'Esta versão não é mais compatível. A atualização é gratuita e leva menos de um minuto.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
              child: const Text('Atualizar agora'),
            ),
          ],
        ),
      ),
    ),
  );
}
