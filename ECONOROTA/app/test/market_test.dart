/// Mercado: painel, pedidos, produtos, estoque e financeiro.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  testWidgets('fase 8: dashboard do mercado, abrir/fechar loja e alertas', (tester) async {
    await loginMarket(tester);
    expect(find.text('Loja aberta'), findsOneWidget);
    expect(find.text('Pedidos hoje'), findsOneWidget);
    expect(find.text('2 pedidos novos para separar'), findsOneWidget);
    expect(find.text('Estoque baixo'), findsOneWidget);
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(find.text('Loja fechada'), findsOneWidget);
  });

  testWidgets('fase 8: recebimento, separação, conferência e pedido pronto', (tester) async {
    await loginMarket(tester);
    await goTab(tester, 'Pedidos');
    expect(find.text('Pedido A1B2C3'), findsOneWidget);
    await tapText(tester, 'Pedido A1B2C3');
    await tapText(tester, 'Aceitar e começar a separar');
    expect(find.text('Marque todos os itens para concluir.'), findsOneWidget);
    final ok = find.byWidgetPredicate((w) => w is IconButton && (w.tooltip ?? '').startsWith('Separado:'));
    final count = ok.evaluate().length;
    for (var i = 0; i < count - 1; i++) {
      await tester.ensureVisible(ok.at(i));
      await tester.tap(ok.at(i));
      await tester.pump();
    }
    final missing = find.byWidgetPredicate((w) => w is IconButton && (w.tooltip ?? '').startsWith('Em falta:')).last;
    await tester.ensureVisible(missing);
    await tester.tap(missing);
    await tester.pumpAndSettle();
    expect(find.textContaining('1 item em falta'), findsOneWidget);
    await tapText(tester, 'Concluir conferência');
    await tapText(tester, 'Pedido pronto para retirada');
    expect(find.text('Pronto'), findsWidgets);
  });

  testWidgets('fase 8: cadastro de produto, estoque e financeiro', (tester) async {
    await loginMarket(tester);
    await goTab(tester, 'Produtos');
    await tapText(tester, 'Adicionar produto');
    await tester.enterText(find.widgetWithText(TextFormField, 'Nome do produto'), 'Farinha de Trigo');
    await tester.enterText(find.widgetWithText(TextFormField, 'Unidade / tamanho'), '1 kg');
    await tester.pump(const Duration(milliseconds: 400)); // categorias carregando
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mercearia').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Preço'), '6,49');
    await tester.enterText(find.widgetWithText(TextFormField, 'Preço promocional (opcional)'), '7,00');
    await tapText(tester, 'Cadastrar produto');
    expect(find.text('Deve ser menor que o preço.'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextFormField, 'Preço promocional (opcional)'), '');
    await tester.enterText(find.widgetWithText(TextFormField, 'Estoque inicial'), '3');
    await tapText(tester, 'Cadastrar produto');
    expect(find.text('Farinha de Trigo'), findsOneWidget);

    await goTab(tester, 'Estoque');
    await tester.tap(find.text('Movimentar').first);
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Quantidade'), '12');
    await tester.pump();
    expect(find.textContaining('Estoque ficará em'), findsOneWidget);
    await tapText(tester, 'Registrar entrada');
    await tapText(tester, 'Movimentações');
    expect(find.textContaining('Entrada'), findsWidgets);

    await goTab(tester, 'Financeiro');
    expect(find.text('A receber'), findsOneWidget);
    expect(find.textContaining('Comissão EconoRota'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1)); // extrato e chave Pix carregam
    await tester.pumpAndSettle();
    expect(find.text('Saldo e repasses'), findsOneWidget);
  });

  testWidgets('dados da loja: CNPJ validado, CEP preenche endereço e salva', (tester) async {
    await loginMarket(tester);
    await tester.tap(find.byTooltip('Dados da loja'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Salvar dados da loja'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'CNPJ'), '123');
    await tapText(tester, 'Salvar dados da loja');
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(find.text('CNPJ inválido (14 números).'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'CNPJ'), '12.345.678/0001-90');
    await tester.enterText(find.widgetWithText(TextField, 'CEP'), '01310-100');
    await tapText(tester, 'Buscar');
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Chave Pix para repasses'), 'pix@supermais.com.br');
    await tapText(tester, 'Salvar dados da loja');
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(find.text('Dados da loja salvos.'), findsOneWidget);
  });
}
