// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appName => 'EconoRota';

  @override
  String get slogan => 'Mais economia, mais perto de você.';

  @override
  String get roleTitle => 'Como você quer usar o EconoRota?';

  @override
  String get roleSubtitle => 'Escolha seu perfil para continuar.';

  @override
  String get roleCustomer => 'Cliente';

  @override
  String get roleCustomerDesc => 'Compra produtos e acompanha pedidos.';

  @override
  String get roleMarket => 'Mercado';

  @override
  String get roleMarketDesc => 'Gerencia produtos e estoque.';

  @override
  String get roleCourier => 'Entregador';

  @override
  String get roleCourierDesc => 'Recebe e realiza entregas.';

  @override
  String get roleAdmin => 'Administrador';

  @override
  String get roleAdminDesc => 'Gerencia todo o sistema.';

  @override
  String get navHome => 'Início';

  @override
  String get navSearch => 'Busca';

  @override
  String get navCart => 'Carrinho';

  @override
  String get navProfile => 'Perfil';

  @override
  String get menuMarkets => 'Mercados';

  @override
  String get menuCategories => 'Categorias';

  @override
  String get menuOrders => 'Pedidos';

  @override
  String get menuSettings => 'Configurações';

  @override
  String get menuComponents => 'Componentes';

  @override
  String get menuLogout => 'Sair';

  @override
  String get searchHint => 'Buscar produtos...';

  @override
  String get hello => 'Olá!';

  @override
  String get deliverTo => 'Entregar em';

  @override
  String get noAddress => 'Definir endereço';

  @override
  String get categories => 'Categorias';

  @override
  String get nearbyMarkets => 'Mercados próximos';

  @override
  String get offers => 'Ofertas';

  @override
  String get seeAll => 'Ver todos';

  @override
  String added(String name) {
    return '$name adicionado ao carrinho';
  }

  @override
  String get emptyCart => 'Seu carrinho está vazio';

  @override
  String get emptyCartDesc => 'Adicione produtos para comparar preços entre mercados.';

  @override
  String cartItems(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count itens',
      one: '1 item',
      zero: 'Nenhum item',
    );
    return '$_temp0';
  }

  @override
  String get comingSoon => 'Em construção';

  @override
  String comingSoonDesc(String phase) {
    return 'Esta área será liberada na $phase.';
  }

  @override
  String get demoMode => 'Modo demonstração';

  @override
  String get switchProfile => 'Trocar perfil';

  @override
  String get primaryButton => 'Botão principal';

  @override
  String get secondaryButton => 'Botão secundário';

  @override
  String get dashboard => 'Dashboard';

  @override
  String get products => 'Produtos';

  @override
  String get stock => 'Estoque';

  @override
  String get finance => 'Financeiro';

  @override
  String get deliveries => 'Entregas';

  @override
  String get earnings => 'Ganhos';

  @override
  String get history => 'Histórico';

  @override
  String get customers => 'Clientes';

  @override
  String get couriers => 'Entregadores';

  @override
  String get reports => 'Relatórios';

  @override
  String get availableOrders => 'Pedidos disponíveis';

  @override
  String get online => 'Disponível';

  @override
  String get offline => 'Indisponível';

  @override
  String km(String value) {
    return '$value km';
  }

  @override
  String get noResults => 'Nenhum produto encontrado';

  @override
  String get total => 'Total';

  @override
  String get addresses => 'Endereços';

  @override
  String get payments => 'Formas de pagamento';

  @override
  String get help => 'Ajuda';

  @override
  String profileRole(String role) {
    return 'Perfil: $role';
  }

  @override
  String get checkout => 'Continuar';

  @override
  String phaseLabel(int n) {
    return 'Fase $n';
  }

  @override
  String get notifications => 'Notificações';

  @override
  String get todayOrders => 'Pedidos hoje';

  @override
  String get revenue => 'Faturamento';

  @override
  String get lowStock => 'Estoque baixo';

  @override
  String get activeMarkets => 'Mercados ativos';

  @override
  String get activeCouriers => 'Entregadores ativos';

  @override
  String get modules => 'Módulos';
}
