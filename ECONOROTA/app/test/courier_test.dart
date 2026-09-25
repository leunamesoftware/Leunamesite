/// Entregador: cadastro, disponibilidade, coleta e entrega.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';

import 'helpers.dart';

void main() {
  testWidgets('fase 9: cadastro do entregador, disponibilidade, coleta nos mercados e entrega com código', (
    tester,
  ) async {
    ImagePickerPlatform.instance = FakePicker();
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', 'entregador@demo.app');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');

    // Cadastro: dados pessoais, veículo e fotos.
    expect(find.text('Complete seu cadastro para começar a entregar'), findsOneWidget);
    await tapText(tester, 'Continuar cadastro');
    await tester.enterText(find.widgetWithText(TextFormField, 'CPF'), '52998224725');
    await tapText(tester, 'Toque para escolher');
    await tapText(tester, 'OK');
    await tester.enterText(find.widgetWithText(TextFormField, 'Chave Pix para receber'), 'carlos@pix.com');
    await tapText(tester, 'Moto');
    await tester.enterText(find.widgetWithText(TextFormField, 'Placa'), 'ABC1D23');
    await tester.enterText(find.widgetWithText(TextFormField, 'Número da CNH'), '12345678901');
    await tapText(tester, 'Enviar cadastro');
    expect(find.text('Envie a foto da CNH e do documento do veículo (CRLV).'), findsOneWidget);
    await tapText(tester, 'CNH (habilitação)');
    await tapText(tester, 'Escolher da galeria');
    await tapText(tester, 'Documento do veículo (CRLV)');
    await tapText(tester, 'Escolher da galeria');
    expect(find.text('Pronta para enviar'), findsNWidgets(2));
    await tapText(tester, 'Enviar cadastro');
    await tester.pump(const Duration(seconds: 2)); // envio dos dados e das fotos
    await tester.pumpAndSettle();

    // Disponível → pedido na região → aceitar.
    expect(find.text('Indisponível'), findsOneWidget);
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(find.text('Disponível'), findsOneWidget);
    expect(find.text('Aceitar entrega'), findsOneWidget);
    await tapText(tester, 'Aceitar entrega');

    // Mercado 1: chegada → conferência (conta os itens) → retirada.
    Future<void> pickUp(int items) async {
      await tapText(tester, 'Cheguei no mercado');
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      await tapText(tester, 'Conferir e retirar');
      for (var i = 0; i < items; i++) {
        await tester.tap(find.byTooltip('Mais um item'));
        await tester.pump();
      }
      await tapText(tester, 'Confirmar retirada');
      await tester.pump(const Duration(seconds: 1));
    }

    await pickUp(6);
    expect(find.textContaining('Retirada confirmada em SuperMais'), findsOneWidget);
    await pickUp(5);
    await tapText(tester, 'Cheguei no cliente');
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    await tapText(tester, 'Confirmar entrega');
    await tester.enterText(find.widgetWithText(TextField, 'Código de entrega'), '111111');
    await tapText(tester, 'Finalizar entrega');
    await tester.pump(const Duration(seconds: 1));
    expect(find.textContaining('Código incorreto'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Código de entrega'), '482913');
    await tapText(tester, 'Finalizar entrega');
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('Entrega finalizada!'), findsOneWidget);
    await tapText(tester, 'Continuar');

    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Ganhos')));
    await tester.pumpAndSettle();
    expect(find.textContaining('17,44'), findsNWidgets(2)); // 2 entregas de R\$ 8,72: ganhos e saldo a receber
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Perfil')));
    await tester.pumpAndSettle();
    await tapText(tester, 'Sair');
  });
}
