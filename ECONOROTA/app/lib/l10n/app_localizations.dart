import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_pt.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('pt')];

  /// No description provided for @appName.
  ///
  /// In pt, this message translates to:
  /// **'EconoRota'**
  String get appName;

  /// No description provided for @slogan.
  ///
  /// In pt, this message translates to:
  /// **'Mais economia, mais perto de você.'**
  String get slogan;

  /// No description provided for @roleTitle.
  ///
  /// In pt, this message translates to:
  /// **'Como você quer usar o EconoRota?'**
  String get roleTitle;

  /// No description provided for @roleSubtitle.
  ///
  /// In pt, this message translates to:
  /// **'Escolha seu perfil para continuar.'**
  String get roleSubtitle;

  /// No description provided for @roleCustomer.
  ///
  /// In pt, this message translates to:
  /// **'Cliente'**
  String get roleCustomer;

  /// No description provided for @roleCustomerDesc.
  ///
  /// In pt, this message translates to:
  /// **'Compra produtos e acompanha pedidos.'**
  String get roleCustomerDesc;

  /// No description provided for @roleMarket.
  ///
  /// In pt, this message translates to:
  /// **'Mercado'**
  String get roleMarket;

  /// No description provided for @roleMarketDesc.
  ///
  /// In pt, this message translates to:
  /// **'Gerencia produtos e estoque.'**
  String get roleMarketDesc;

  /// No description provided for @roleCourier.
  ///
  /// In pt, this message translates to:
  /// **'Entregador'**
  String get roleCourier;

  /// No description provided for @roleCourierDesc.
  ///
  /// In pt, this message translates to:
  /// **'Recebe e realiza entregas.'**
  String get roleCourierDesc;

  /// No description provided for @roleAdmin.
  ///
  /// In pt, this message translates to:
  /// **'Administrador'**
  String get roleAdmin;

  /// No description provided for @roleAdminDesc.
  ///
  /// In pt, this message translates to:
  /// **'Gerencia todo o sistema.'**
  String get roleAdminDesc;

  /// No description provided for @navHome.
  ///
  /// In pt, this message translates to:
  /// **'Início'**
  String get navHome;

  /// No description provided for @navSearch.
  ///
  /// In pt, this message translates to:
  /// **'Busca'**
  String get navSearch;

  /// No description provided for @navCart.
  ///
  /// In pt, this message translates to:
  /// **'Carrinho'**
  String get navCart;

  /// No description provided for @navProfile.
  ///
  /// In pt, this message translates to:
  /// **'Perfil'**
  String get navProfile;

  /// No description provided for @menuMarkets.
  ///
  /// In pt, this message translates to:
  /// **'Mercados'**
  String get menuMarkets;

  /// No description provided for @menuCategories.
  ///
  /// In pt, this message translates to:
  /// **'Categorias'**
  String get menuCategories;

  /// No description provided for @menuOrders.
  ///
  /// In pt, this message translates to:
  /// **'Pedidos'**
  String get menuOrders;

  /// No description provided for @menuSettings.
  ///
  /// In pt, this message translates to:
  /// **'Configurações'**
  String get menuSettings;

  /// No description provided for @menuComponents.
  ///
  /// In pt, this message translates to:
  /// **'Componentes'**
  String get menuComponents;

  /// No description provided for @menuLogout.
  ///
  /// In pt, this message translates to:
  /// **'Sair'**
  String get menuLogout;

  /// No description provided for @searchHint.
  ///
  /// In pt, this message translates to:
  /// **'Buscar produtos...'**
  String get searchHint;

  /// No description provided for @hello.
  ///
  /// In pt, this message translates to:
  /// **'Olá!'**
  String get hello;

  /// No description provided for @deliverTo.
  ///
  /// In pt, this message translates to:
  /// **'Entregar em'**
  String get deliverTo;

  /// No description provided for @noAddress.
  ///
  /// In pt, this message translates to:
  /// **'Definir endereço'**
  String get noAddress;

  /// No description provided for @categories.
  ///
  /// In pt, this message translates to:
  /// **'Categorias'**
  String get categories;

  /// No description provided for @nearbyMarkets.
  ///
  /// In pt, this message translates to:
  /// **'Mercados próximos'**
  String get nearbyMarkets;

  /// No description provided for @offers.
  ///
  /// In pt, this message translates to:
  /// **'Ofertas'**
  String get offers;

  /// No description provided for @seeAll.
  ///
  /// In pt, this message translates to:
  /// **'Ver todos'**
  String get seeAll;

  /// No description provided for @added.
  ///
  /// In pt, this message translates to:
  /// **'{name} adicionado ao carrinho'**
  String added(String name);

  /// No description provided for @emptyCart.
  ///
  /// In pt, this message translates to:
  /// **'Seu carrinho está vazio'**
  String get emptyCart;

  /// No description provided for @emptyCartDesc.
  ///
  /// In pt, this message translates to:
  /// **'Adicione produtos para comparar preços entre mercados.'**
  String get emptyCartDesc;

  /// No description provided for @cartItems.
  ///
  /// In pt, this message translates to:
  /// **'{count, plural, =0{Nenhum item} =1{1 item} other{{count} itens}}'**
  String cartItems(int count);

  /// No description provided for @comingSoon.
  ///
  /// In pt, this message translates to:
  /// **'Em construção'**
  String get comingSoon;

  /// No description provided for @comingSoonDesc.
  ///
  /// In pt, this message translates to:
  /// **'Esta área será liberada na {phase}.'**
  String comingSoonDesc(String phase);

  /// No description provided for @demoMode.
  ///
  /// In pt, this message translates to:
  /// **'Modo demonstração'**
  String get demoMode;

  /// No description provided for @switchProfile.
  ///
  /// In pt, this message translates to:
  /// **'Trocar perfil'**
  String get switchProfile;

  /// No description provided for @primaryButton.
  ///
  /// In pt, this message translates to:
  /// **'Botão principal'**
  String get primaryButton;

  /// No description provided for @secondaryButton.
  ///
  /// In pt, this message translates to:
  /// **'Botão secundário'**
  String get secondaryButton;

  /// No description provided for @dashboard.
  ///
  /// In pt, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// No description provided for @products.
  ///
  /// In pt, this message translates to:
  /// **'Produtos'**
  String get products;

  /// No description provided for @stock.
  ///
  /// In pt, this message translates to:
  /// **'Estoque'**
  String get stock;

  /// No description provided for @finance.
  ///
  /// In pt, this message translates to:
  /// **'Financeiro'**
  String get finance;

  /// No description provided for @deliveries.
  ///
  /// In pt, this message translates to:
  /// **'Entregas'**
  String get deliveries;

  /// No description provided for @earnings.
  ///
  /// In pt, this message translates to:
  /// **'Ganhos'**
  String get earnings;

  /// No description provided for @history.
  ///
  /// In pt, this message translates to:
  /// **'Histórico'**
  String get history;

  /// No description provided for @customers.
  ///
  /// In pt, this message translates to:
  /// **'Clientes'**
  String get customers;

  /// No description provided for @couriers.
  ///
  /// In pt, this message translates to:
  /// **'Entregadores'**
  String get couriers;

  /// No description provided for @reports.
  ///
  /// In pt, this message translates to:
  /// **'Relatórios'**
  String get reports;

  /// No description provided for @availableOrders.
  ///
  /// In pt, this message translates to:
  /// **'Pedidos disponíveis'**
  String get availableOrders;

  /// No description provided for @online.
  ///
  /// In pt, this message translates to:
  /// **'Disponível'**
  String get online;

  /// No description provided for @offline.
  ///
  /// In pt, this message translates to:
  /// **'Indisponível'**
  String get offline;

  /// No description provided for @km.
  ///
  /// In pt, this message translates to:
  /// **'{value} km'**
  String km(String value);

  /// No description provided for @noResults.
  ///
  /// In pt, this message translates to:
  /// **'Nenhum produto encontrado'**
  String get noResults;

  /// No description provided for @total.
  ///
  /// In pt, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @addresses.
  ///
  /// In pt, this message translates to:
  /// **'Endereços'**
  String get addresses;

  /// No description provided for @payments.
  ///
  /// In pt, this message translates to:
  /// **'Formas de pagamento'**
  String get payments;

  /// No description provided for @help.
  ///
  /// In pt, this message translates to:
  /// **'Ajuda'**
  String get help;

  /// No description provided for @profileRole.
  ///
  /// In pt, this message translates to:
  /// **'Perfil: {role}'**
  String profileRole(String role);

  /// No description provided for @checkout.
  ///
  /// In pt, this message translates to:
  /// **'Continuar'**
  String get checkout;

  /// No description provided for @phaseLabel.
  ///
  /// In pt, this message translates to:
  /// **'Fase {n}'**
  String phaseLabel(int n);

  /// No description provided for @notifications.
  ///
  /// In pt, this message translates to:
  /// **'Notificações'**
  String get notifications;

  /// No description provided for @todayOrders.
  ///
  /// In pt, this message translates to:
  /// **'Pedidos hoje'**
  String get todayOrders;

  /// No description provided for @revenue.
  ///
  /// In pt, this message translates to:
  /// **'Faturamento'**
  String get revenue;

  /// No description provided for @lowStock.
  ///
  /// In pt, this message translates to:
  /// **'Estoque baixo'**
  String get lowStock;

  /// No description provided for @activeMarkets.
  ///
  /// In pt, this message translates to:
  /// **'Mercados ativos'**
  String get activeMarkets;

  /// No description provided for @activeCouriers.
  ///
  /// In pt, this message translates to:
  /// **'Entregadores ativos'**
  String get activeCouriers;

  /// No description provided for @modules.
  ///
  /// In pt, this message translates to:
  /// **'Módulos'**
  String get modules;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['pt'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'pt':
      return AppLocalizationsPt();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
