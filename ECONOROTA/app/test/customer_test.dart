/// Cliente: compras, comparação, carrinho, pagamento, rastreio, ocorrências, avaliações, notificações e LGPD.
library;

import 'package:econorota/widgets/market_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  testWidgets('cliente vê histórico com filtros, categorias e mercados', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', 'maria@exemplo.com');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');

    await tapText(tester, 'Pedidos');
    expect(find.text('A caminho'), findsOneWidget);
    expect(find.text('Entregue'), findsNWidgets(2));
    await tapText(tester, 'Cancelados');
    expect(find.text('Cancelado'), findsOneWidget);
    expect(find.text('Entregue'), findsNothing);

    await tapText(tester, 'Início');
    await tapA11y(tester, 'Ver todas');
    expect(find.text('Categorias'), findsOneWidget);
    await tapText(tester, 'Açougue');
    expect(find.text('Alcatra Bovina'), findsWidgets);

    await tester.tap(find.byTooltip('Voltar'));
    await tester.pumpAndSettle();
    expect(find.text('Pet'), findsOneWidget); // voltou para Categorias
    await tester.fling(find.byType(CustomScrollView).last, const Offset(0, 800), 3000);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Voltar'));
    await tester.pumpAndSettle();

    await tapText(tester, 'Ver todos');
    expect(find.text('Mercados próximos'), findsOneWidget);
    final list = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).last;
    await tester.scrollUntilVisible(find.text('Fechado'), 300, scrollable: list);
    expect(find.text('Fechado'), findsOneWidget);
    await tester.fling(list, const Offset(0, 2000), 4000);
    await tester.pumpAndSettle();
    await tapText(tester, 'Abertos agora');
    expect(find.text('Fechado'), findsNothing);
  });

  testWidgets('loja do mercado, subcategorias, detalhe com comparação e avaliações', (tester) async {
    await startApp(tester, store: returningUser());
    await tapText(tester, 'Explorar sem conta');

    // Abre a loja pelo card de mercado da home.
    final list = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;
    final market = find.descendant(of: find.byType(MarketCard), matching: find.text('SuperMais'));
    await tester.scrollUntilVisible(market, 300, scrollable: list);
    await tester.tap(market);
    await tester.pumpAndSettle();
    expect(find.text('Ofertas desta loja'), findsOneWidget);
    expect(find.text(' (1230)'), findsOneWidget);

    // Hortifrúti da loja com subcategorias.
    await tapA11y(tester, 'Hortifrúti');
    expect(find.text('Frutas'), findsOneWidget);
    await tapText(tester, 'Temperos');
    expect(find.text('Alho'), findsOneWidget);
    expect(find.text('Maçã Gala'), findsNothing);
    await tapText(tester, 'Frutas');

    // Detalhe do produto: preço por kg, estoque e comparação entre mercados.
    await tester.tap(find.text('Banana Prata').first);
    await tester.pumpAndSettle();
    expect(find.text('Compare nos mercados'), findsOneWidget);
    expect(find.text('Menor preço'), findsOneWidget);
    expect(find.textContaining('/kg'), findsWidgets);
    expect(find.text('Em estoque'), findsOneWidget);
    expect(find.textContaining('Hortifrúti'), findsWidgets);

    await tester.tap(find.byTooltip('Adicionar aos favoritos'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Remover dos favoritos'), findsOneWidget);

    await tester.tap(find.byTooltip('Aumentar quantidade'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Adicionar ·'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Carrinho, 2 itens'), findsOneWidget);
  });

  testWidgets('monta lista, compara e respeita regra de até 3 mercados com 5 itens', (tester) async {
    await startApp(tester, store: returningUser());
    await tapText(tester, 'Explorar sem conta');
    await tapText(tester, 'Monte sua lista e economize');
    expect(find.text('Monte sua lista'), findsOneWidget);

    for (final name in [
      'Arroz Tipo 1',
      'Feijão Carioca',
      'Tomate',
      'Batata Inglesa',
      'Leite Integral',
      'Alface Crespa',
      'Café Torrado',
      'Cebola',
      'Óleo de Soja',
      'Banana Prata',
    ]) {
      await tester.enterText(find.byType(TextField).first, name);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      await tapA11y(tester, byA11yPrefix(tester, name));
    }
    expect(find.text('10 produtos selecionados'), findsOneWidget);
    await tapText(tester, 'Comparar preços');

    expect(find.text('Melhor combinação'), findsOneWidget);
    expect(find.textContaining('Total com entrega'), findsOneWidget);
    // Com os preços de exemplo, dividir em 2 mercados sai mais barato que comprar tudo em um só.
    expect(find.text('Melhor combinação: 2 mercados'), findsOneWidget);
    expect(find.textContaining('vs. um só mercado'), findsOneWidget);
    final vertical = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).last;
    await tester.scrollUntilVisible(find.text('Rota da entrega'), 250, scrollable: vertical);
    expect(find.text('Rota da entrega'), findsOneWidget);
    await tester.drag(vertical, const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(find.textContaining('mínimo de 5 atendido'), findsWidgets);
    await tester.scrollUntilVisible(find.text('Tudo em um só mercado'), 250, scrollable: vertical);
    expect(find.textContaining('de economia'), findsOneWidget);
    await tester.fling(vertical, const Offset(0, 3000), 5000);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.textContaining('Dica do EconoRota'),
      300,
      scrollable: find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).last,
    );
    expect(find.textContaining('Dica do EconoRota'), findsOneWidget);

    // O cliente pode escolher os mercados: só o Bom Preço → tudo em 1 mercado.
    await tester.tap(find.byTooltip('Escolher mercados'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bom Preço').last);
    await tester.pumpAndSettle();
    await tapText(tester, 'Comparar');
    expect(find.text('Tudo em Bom Preço'), findsOneWidget);
    expect(find.text('Você escolheu 1 de 3 mercados'), findsOneWidget);
    await tester.tap(find.byTooltip('Escolher mercados'));
    await tester.pumpAndSettle();
    await tapText(tester, 'Automático');
    expect(find.text('Melhor combinação: 2 mercados'), findsOneWidget);

    // Abaixo de R$ 100 (pedido mínimo) o botão fica travado e o app mostra quanto falta.
    await tester.fling(
      find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).last,
      const Offset(0, 3000),
      5000,
    );
    await tester.pumpAndSettle();
    expect(find.textContaining(RegExp(r'para o pedido mínimo de R\$\s100,00')), findsOneWidget);
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();
    expect(find.text('Seu carrinho'), findsNothing);

    // Aumenta a lista e compara de novo.
    await tester.tap(find.byTooltip('Editar lista'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Aumentar Arroz Tipo 1'));
    await tester.tap(find.byTooltip('Aumentar Arroz Tipo 1'));
    await tester.pumpAndSettle();
    await tapText(tester, 'Comparar mercados');
    expect(find.textContaining('para o pedido mínimo'), findsNothing);

    // Segue para o carrinho separado por mercado (visitante só entra na confirmação).
    await tapText(tester, 'Continuar');
    expect(find.text('Seu carrinho'), findsOneWidget);
    await tester.tap(find.byTooltip('Voltar').first);
    await tester.pumpAndSettle();

    await tapText(tester, 'Economia');
    expect(find.text('Você economiza'), findsOneWidget);
    expect(find.textContaining('abaixo do preço médio da região'), findsOneWidget);
    expect(find.text('Por produto'), findsOneWidget);

    await tapText(tester, 'Tabela de preços');
    expect(find.text('Menor preço'), findsWidgets);
    expect(find.text('Produto'), findsOneWidget);
  });

  testWidgets('lista inteligente: interpreta, respeita a marca e monta o carrinho', (tester) async {
    await startApp(tester, store: returningUser());
    await tapText(tester, 'Explorar sem conta');
    await tapText(tester, 'Lista inteligente: digite ou cole sua lista');
    await tester.enterText(
      find.byType(TextField).first,
      'Manteiga Qualy\nAçúcar\nArroz 5 kg\nÓleo de soja — 2\nÓleo de soja Camil\nDetergente xyz',
    );
    await tapText(tester, 'Entender minha lista');

    expect(find.text('Somente Qualy — sua marca será respeitada.'), findsOneWidget);
    // Marca inexistente: nunca troca sozinho, nem no "mais barato para todos".
    await tapText(tester, 'Quero o mais barato nos 2 itens sem marca');
    expect(find.text('1 item precisa da sua escolha'), findsOneWidget);
    final vertical = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).last;
    await tester.scrollUntilVisible(find.textContaining('Não encontramos a marca Camil'), 250, scrollable: vertical);
    await tester.drag(vertical, const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(find.textContaining('Detergente xyz'), findsOneWidget);
    await tester.tap(find.text('Quero o mais barato').last);
    await tester.pumpAndSettle();
    expect(find.text('5 itens prontos para comparar'), findsOneWidget);

    await tapText(tester, 'Montar carrinho');
    expect(find.text('Encontramos a melhor combinação para sua compra.'), findsOneWidget);
    await tapText(tester, 'Tabela de preços');
    expect(find.text('Manteiga Qualy'), findsOneWidget);
  });

  testWidgets('fase 6: carrinho por mercado, quantidades, mínimo, confirmação e pedido', (tester) async {
    final store = returningUser()
      ..data['econorota.address.current'] =
          '{"street":"Rua das Flores","number":"123","district":"Centro","city":"São Paulo","state":"SP",'
          '"zip":"01001000","lat":-23.5575,"lng":-46.656}';
    await startApp(tester, store: store);
    await fill(tester, 'E-mail ou telefone', '11987654321');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');

    await tapText(tester, 'Lista inteligente: digite ou cole sua lista');
    await tapText(tester, 'Usar uma lista de exemplo');
    await tapText(tester, 'Entender minha lista');
    await tapText(tester, 'Quero o mais barato nos 2 itens sem marca');
    await tapText(tester, 'Montar carrinho');
    await tapText(tester, 'Continuar');

    expect(find.text('Seu carrinho'), findsOneWidget);
    expect(find.text('Subtotal deste mercado'), findsWidgets);
    expect(find.text('Entrega (única)'), findsOneWidget);
    expect(find.text('menor preço'), findsWidgets);

    // Alterar quantidade.
    await tester.ensureVisible(find.byTooltip('Aumentar Manteiga Qualy'));
    await tester.tap(find.byTooltip('Aumentar Manteiga Qualy'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(find.text('2'), findsWidgets);

    // Remover fica abaixo do mínimo (botão travado) e "Desfazer" devolve o produto.
    final remove = find.byTooltip('Remover Café Torrado Pilão');
    await tester.ensureVisible(remove);
    await tester.tap(remove);
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(find.textContaining('Faltam'), findsOneWidget);
    await tester.tap(find.text('Desfazer'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(find.textContaining('Faltam'), findsNothing);

    await tapText(tester, 'Continuar');
    expect(find.text('Confirmação do pedido'), findsOneWidget);
    expect(find.text('Rua das Flores, 123'), findsOneWidget);
    await tapText(tester, 'Confirmar pedido');

    // Fase 7 — pagamento: CPF pedido uma vez, Pix, recusado, aprovado e cancelamento com reembolso.
    expect(find.textContaining('Pedido nº'), findsOneWidget);
    await tapText(tester, 'Pix');
    await tester.tap(find.textContaining('Gerar Pix de'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'CPF'), '52998224725');
    // Com o Pix na tela há um indicador girando: avança o tempo em vez de esperar parar.
    Future<void> tapAndWait(Finder f) async {
      await tester.ensureVisible(f);
      await tester.pump();
      await tester.tap(f);
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 300));
      }
    }

    await tapAndWait(find.textContaining('Gerar Pix de'));
    expect(find.text('Copiar código Pix'), findsOneWidget);
    expect(find.textContaining('O código expira em'), findsOneWidget);

    await tapAndWait(find.text('Simular recusado'));
    expect(find.textContaining('Pagamento recusado'), findsOneWidget);
    await tapAndWait(find.textContaining('Gerar Pix de'));
    await tapAndWait(find.text('Simular aprovado'));
    expect(find.text('Pagamento aprovado!'), findsOneWidget);

    await tapText(tester, 'Cancelar pedido e receber o reembolso');
    await tapAndWait(find.text('Cancelar pedido'));
    await tester.pumpAndSettle();
    expect(find.text('Pedido cancelado'), findsOneWidget);
    expect(find.textContaining('Reembolso de'), findsOneWidget);
    await tapText(tester, 'Ver meus pedidos');
    expect(find.text('Cancelado'), findsWidgets);
  });

  testWidgets('avaliações do mercado mostram resumo e comentários', (tester) async {
    await startApp(tester, store: returningUser());
    await tapText(tester, 'Explorar sem conta');
    final list = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;
    final market = find.descendant(of: find.byType(MarketCard), matching: find.text('SuperMais'));
    await tester.scrollUntilVisible(market, 300, scrollable: list);
    await tester.tap(market);
    await tester.pumpAndSettle();
    await tester.tap(find.text(' (1230)'));
    await tester.pumpAndSettle();
    expect(find.text('Avaliações'), findsOneWidget);
    expect(find.text('Ana S.'), findsOneWidget);
    expect(find.text('Baseado em 4 avaliações'), findsOneWidget);
    await tapText(tester, '3 estrelas (1)');
    expect(find.text('Ana S.'), findsNothing);
    expect(find.text('Diego M.'), findsOneWidget);
  });

  testWidgets('fase 10: rastreamento com mapa, mercados, farol, previsão e código de entrega', (tester) async {
    final store = returningUser()
      ..data['econorota.address.current'] =
          '{"street":"Rua das Flores","number":"123","district":"Centro","city":"São Paulo","state":"SP",'
          '"zip":"01001000","lat":-23.5575,"lng":-46.656}';
    await startApp(tester, store: store);
    await fill(tester, 'E-mail ou telefone', '11987654321');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tapText(tester, 'Lista inteligente: digite ou cole sua lista');
    await tapText(tester, 'Usar uma lista de exemplo');
    await tapText(tester, 'Entender minha lista');
    await tapText(tester, 'Quero o mais barato nos 2 itens sem marca');
    await tapText(tester, 'Montar carrinho');
    await tapText(tester, 'Continuar');
    await tapText(tester, 'Continuar');
    await tapText(tester, 'Confirmar pedido');

    Future<void> tapAndWait(Finder f) async {
      await tester.ensureVisible(f);
      await tester.pump();
      await tester.tap(f);
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 300));
      }
    }

    await tapAndWait(find.textContaining('Gerar Pix de'));
    if (find.widgetWithText(TextFormField, 'CPF').evaluate().isNotEmpty) {
      await tester.enterText(find.widgetWithText(TextFormField, 'CPF'), '52998224725');
      await tapAndWait(find.textContaining('Gerar Pix de'));
    }
    await tapAndWait(find.text('Simular aprovado'));
    expect(find.text('Código de entrega'), findsOneWidget);
    await tapAndWait(find.text('Acompanhar pedido'));

    expect(find.textContaining('Chega em'), findsOneWidget);
    expect(find.text('Mercado 1'), findsOneWidget);
    expect(find.text('Sua casa'), findsOneWidget);
    expect(find.textContaining('No prazo'), findsOneWidget);
    expect(find.text('Código de entrega'), findsOneWidget);
    await tester.tap(find.byTooltip('Voltar').first);
    await tester.pumpAndSettle();
  });

  testWidgets('fase 11: ocorrências — histórico, reembolso automático e nova ocorrência com produto', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', '11987654321');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Perfil')));
    await tester.pumpAndSettle();
    await tapText(tester, 'Minhas ocorrências');
    expect(find.text('Produto com problema'), findsOneWidget);
    expect(find.text('Resolvida'), findsOneWidget);
    await tapText(tester, 'Produto com problema');
    expect(find.textContaining('Reembolso de'), findsOneWidget);
    await tester.tap(find.byTooltip('Voltar').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Voltar').first);
    await tester.pumpAndSettle();

    // Pedido entregue → rastreio → relatar problema.
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Pedidos')));
    await tester.pumpAndSettle();
    await tapText(tester, 'Entregues');
    await tapText(tester, 'Ver detalhes');
    await tapText(tester, 'Relatar um problema');
    await tapText(tester, 'Produto errado');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    await tapText(tester, 'Enviar ocorrência');
    expect(find.text('Escolha os produtos com problema.'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5)); // aviso some
    await tester.ensureVisible(find.byType(CheckboxListTile).first);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(CheckboxListTile).first);
    await tester.pumpAndSettle();
    await tapText(tester, 'Enviar ocorrência');
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('Aberta'), findsOneWidget);
    expect(find.text('Ocorrência aberta'), findsOneWidget);
  });

  testWidgets('fase 12: avaliar mercado e entregador depois da entrega', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', '11987654321');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Pedidos')));
    await tester.pumpAndSettle();
    await tapText(tester, 'Entregues');
    await tapText(tester, 'Ver detalhes');
    await tapText(tester, 'Avaliar mercado e entregador');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('SuperMais'), findsOneWidget);
    expect(find.text('Carlos'), findsOneWidget);
    expect(find.text('Enviar avaliação'), findsNothing); // só aparece depois das estrelas
    await tester.tap(find.byTooltip('5 estrelas').first);
    await tester.pumpAndSettle();
    await tapText(tester, 'Bem embalado');
    await tapText(tester, 'Enviar avaliação');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Avaliado'), findsOneWidget);
    await tester.tap(find.byTooltip('4 estrelas').first);
    await tester.pumpAndSettle();
    await tapText(tester, 'Enviar avaliação');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Avaliado'), findsNWidgets(2));
    await tapText(tester, 'Concluir');
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(find.text('Avaliar mercado e entregador'), findsOneWidget); // voltou ao rastreio
    await tester.binding.handlePopRoute(); // botão voltar do sistema
    await tester.pumpAndSettle();

    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Perfil')));
    await tester.pumpAndSettle();
    await tapText(tester, 'Avaliações');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('SuperMais · Mercado'), findsOneWidget);
    expect(find.text('Carlos · Entregador'), findsOneWidget);
  });

  testWidgets('fase 16: central de notificações com contador e marcar como lidas', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', '11987654321');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Notificações, 3 novas'), findsOneWidget);
    await tester.tap(find.byTooltip('Notificações, 3 novas'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Seu pedido saiu para entrega'), findsOneWidget);
    await tapText(tester, 'Marcar todas como lidas');
    expect(find.text('Marcar todas como lidas'), findsNothing);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byTooltip('Notificações'), findsOneWidget);
  });

  testWidgets('fase 17: meus dados — exportar e excluir conta (LGPD)', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', '11987654321');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Perfil')));
    await tester.pumpAndSettle();
    await tapText(tester, 'Meus dados e privacidade');
    await tapText(tester, 'Exportar meus dados');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.textContaining('"pedidos"'), findsOneWidget);
    await tapText(tester, 'Fechar');
    await tapText(tester, 'Excluir minha conta');
    await tester.enterText(find.widgetWithText(TextField, 'Confirme sua senha'), '123');
    await tapText(tester, 'Excluir conta');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Senha incorreta.'), findsOneWidget);
    await tapText(tester, 'Excluir minha conta');
    await tester.enterText(find.widgetWithText(TextField, 'Confirme sua senha'), 'senha1234');
    await tapText(tester, 'Excluir conta');
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(find.text('Entrar'), findsWidgets); // voltou para o login
  });

  testWidgets('ajuda: perguntas frequentes e atalho para relatar problema', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', '11987654321');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Perfil')));
    await tester.pumpAndSettle();
    await tapText(tester, 'Ajuda');
    expect(find.text('Perguntas frequentes'), findsOneWidget);
    await tapText(tester, 'Quanto custa a entrega?');
    expect(find.textContaining('É uma entrega só'), findsOneWidget);
  });
}
