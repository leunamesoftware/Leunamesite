/// Administração: aprovações, configurações, ocorrências, áreas e repasses.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  testWidgets('fase 13: painel administrativo — aprovações, configurações e ocorrências', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', 'admin@demo.app');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(find.text('Administração'), findsOneWidget);
    expect(find.text('Usuários e permissões'), findsOneWidget);

    // Mercado aguardando aprovação.
    await tapText(tester, '1 mercado(s) aguardando aprovação');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    await tapText(tester, 'Aguardando');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    await tapText(tester, 'Aprovar');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Mercadinho Bairro Bom está ativo.'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    // Entregador em análise: ficha e aprovação.
    await tapText(tester, 'Entregadores');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    await tapText(tester, 'Rafael Souza');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Documento do veículo (CRLV)'), findsOneWidget);
    await tapText(tester, 'Aprovar cadastro');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Entregador aprovado.'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    // Configurações: comissão fora do limite é recusada; dentro do limite, salva.
    await tapText(tester, 'Configurações');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    final commission = find.widgetWithText(TextField, 'Comissão sobre vendas do mercado (%)');
    await tester.enterText(commission, '90');
    await tapText(tester, 'Salvar alterações');
    expect(find.textContaining('use de 0 a 50'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
    await tester.enterText(commission, '12');
    await tapText(tester, 'Salvar alterações');
    await tapText(tester, 'Aplicar');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(find.text('Configurações salvas.'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    // Ocorrência: assumir e decidir com reembolso parcial.
    await tapText(tester, 'Ocorrências');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    await tapText(tester, 'Produto errado');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    await tapText(tester, 'Assumir análise');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 5));
    await tapText(tester, 'Decidir');
    await tester.enterText(
      find.widgetWithText(TextField, 'Nota para o cliente (obrigatória)'),
      'Reembolso do item trocado.',
    );
    await tester.pump();
    await tapText(tester, 'Confirmar');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(find.text('Decisão registrada. O cliente será avisado.'), findsOneWidget);
    expect(find.textContaining('Resolvida'), findsWidgets);
    expect(find.text('Decidir'), findsNothing);
  });

  testWidgets('fase 13: todas as áreas do painel abrem sem erro (celular)', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', 'admin@demo.app');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    for (final (area, expected) in const [
      ('Pedidos', 'Em andamento'),
      ('Entregas', 'Carlos Lima'),
      ('Clientes', 'Maria Silva'),
      ('Produtos e estoque', 'Sem estoque'),
      ('Avaliações', 'Até 2 estrelas'),
      ('Regiões', 'Centro expandido'),
      ('Pagamentos', 'Recebido (30 dias)'),
      ('Financeiro e repasses', 'Receita líquida da plataforma'),
      ('Relatórios', 'Receita da plataforma'),
      ('Usuários e permissões', 'admin@demo.app'),
      ('Logs e auditoria', 'courier.aprovar'),
    ]) {
      await tapText(tester, area);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      expect(find.textContaining(expected), findsWidgets, reason: area);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
    }
    // Detalhe do pedido.
    await tapText(tester, 'Pedidos');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    await tapText(tester, 'Todos');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Pedido ').at(1));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Cliente e entrega'), findsOneWidget);
  });

  testWidgets('fase 15: repasses — gerar, pagar com referência e extrato do mercado', (tester) async {
    await startApp(tester, store: returningUser());
    await fill(tester, 'E-mail ou telefone', 'admin@demo.app');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    await tapText(tester, 'Financeiro e repasses');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Nenhum repasse nesta lista'), findsOneWidget);
    await tapText(tester, 'Gerar repasses do saldo liberado');
    await tapText(tester, 'Gerar');
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(find.text('SuperMais'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5)); // aviso some
    await tester.pumpAndSettle();
    final pay = find.text('Marcar como pago').first; // SuperMais
    await tester.ensureVisible(pay);
    await tester.pumpAndSettle();
    await tester.tap(pay);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'PIX E2E123');
    await tester.pump();
    await tapText(tester, 'Confirmar pagamento');
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(find.text('Repasse marcado como pago.'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Sair'));
    await tester.pumpAndSettle();

    // Mercado vê saldo, chave Pix e extrato.
    await fill(tester, 'E-mail ou telefone', 'mercado@demo.app');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Financeiro')));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Saldo e repasses'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('Disponível para o próximo repasse'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Chave Pix para repasses'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tapText(tester, 'Chave Pix para repasses');
    await tester.enterText(find.byType(TextField).last, 'financeiro@mercado.com.br');
    await tapText(tester, 'Salvar');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(find.text('financeiro@mercado.com.br'), findsOneWidget);
  });
}
