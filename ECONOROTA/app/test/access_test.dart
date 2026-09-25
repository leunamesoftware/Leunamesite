/// Acesso: apresentação, cadastro, login, recuperação e visitante.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  testWidgets('primeiro acesso: apresentação → localização → endereço → cadastro → verificação → home', (tester) async {
    final store = await startApp(tester);

    expect(find.textContaining('Bem-vindo ao', findRichText: true), findsOneWidget);
    expect(find.text('Próximo'), findsOneWidget);
    await tapText(tester, 'Próximo');
    await tapText(tester, 'Pular');

    expect(find.text('Permitir localização'), findsOneWidget);
    await tapText(tester, 'Permitir localização');

    // GPS preencheu o endereço; falta só o número.
    expect(find.text('Confirme o endereço'), findsOneWidget);
    expect(find.text('Av. Paulista'), findsOneWidget);
    await tapText(tester, 'Continuar');
    expect(find.text('Informe o número.'), findsOneWidget);
    await fill(tester, 'Número', '1000');
    await tapText(tester, 'Continuar');

    expect(find.textContaining('Faça seu', findRichText: true), findsOneWidget);
    expect(find.text('Entrar'), findsOneWidget);
    await tapText(tester, 'Criar conta');

    await fill(tester, 'Nome completo', 'Maria');
    await fill(tester, 'E-mail', 'maria@exemplo.com');
    await fill(tester, 'Telefone (WhatsApp)', '11987654321');
    await fill(tester, 'Senha (mín. 8, letras e números)', 'senha1234');
    await fill(tester, 'Confirmar senha', 'senha1234');
    await tapText(tester, 'Criar conta');
    expect(find.text('Informe nome e sobrenome.'), findsOneWidget);
    expect(find.text('Para continuar, aceite os termos.'), findsOneWidget);
    expect(find.text('(11) 98765-4321'), findsOneWidget);

    await fill(tester, 'Nome completo', 'Maria Silva');
    await tester.tap(find.byType(Checkbox));
    await tester.pumpAndSettle();
    await tapText(tester, 'Criar conta');

    expect(find.textContaining('Verifique seu', findRichText: true), findsOneWidget);
    expect(find.textContaining('Enviamos um código de 6 dígitos'), findsOneWidget);
    await enterCode(tester, '000000');
    expect(find.text('Código incorreto. Confira e tente novamente.'), findsOneWidget);
    await enterCode(tester, '123456');

    expect(find.text('Ofertas para você'), findsOneWidget);
    expect(find.textContaining('Av. Paulista, 1000'), findsOneWidget);
    expect(store.data['econorota.onboarding.done'], '1');
  });

  testWidgets('recuperação de senha entra direto na conta', (tester) async {
    await startApp(tester, store: returningUser());
    expect(find.text('Entrar'), findsOneWidget);

    await fill(tester, 'E-mail ou telefone', 'maria@exemplo.com');
    await tapText(tester, 'Esqueceu sua senha?');
    await tapText(tester, 'Enviar código');
    expect(find.textContaining('Código enviado para'), findsOneWidget);

    await enterCode(tester, '123456');
    await fill(tester, 'Nova senha', 'novaSenha1');
    await fill(tester, 'Confirmar nova senha', 'outraSenha');
    await tapText(tester, 'Redefinir senha');
    expect(find.text('As senhas não conferem.'), findsOneWidget);

    await fill(tester, 'Confirmar nova senha', 'novaSenha1');
    await tapText(tester, 'Redefinir senha');
    expect(find.text('Ofertas para você'), findsOneWidget);
    expect(find.textContaining('Rua das Flores, 123'), findsOneWidget);
  });

  testWidgets('login com erro mostra mensagem; sair apaga dados do aparelho', (tester) async {
    final store = await startApp(tester, store: returningUser());

    await tapText(tester, 'Entrar');
    expect(find.text('Informe seu e-mail ou telefone.'), findsOneWidget);

    await fill(tester, 'E-mail ou telefone', '11987654321');
    await fill(tester, 'Senha', 'senha1234');
    await tapText(tester, 'Entrar');
    expect(find.text('Ofertas para você'), findsOneWidget);

    // Adiciona ao carrinho; o contador do cabeçalho acompanha.
    await tester.drag(find.byType(CustomScrollView).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    await tapA11y(tester, 'Adicionar Banana Prata ao carrinho');
    await tester.fling(find.byType(CustomScrollView).first, const Offset(0, 1500), 4000);
    await tester.pumpAndSettle();
    expect(find.byTooltip('Carrinho, 1 itens'), findsOneWidget);

    await tapText(tester, 'Perfil');
    await tapText(tester, 'Sair da conta');
    await tapText(tester, 'Sair');

    expect(find.text('Entrar'), findsOneWidget);
    expect(store.data.keys.where((k) => k.contains('address') || k.contains('token')), isEmpty);
  });

  testWidgets('visitante navega, busca e compara; login só para comprar e ver pedidos', (tester) async {
    await startApp(tester, store: returningUser());
    await tapText(tester, 'Explorar sem conta');
    expect(find.text('Ofertas para você'), findsOneWidget);
    await tester.drag(find.byType(CustomScrollView).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(find.text('SuperMais'), findsWidgets);

    // Busca com sugestões e resultados de vários mercados.
    await tapText(tester, 'Buscar');
    await tester.enterText(find.byType(TextField).first, 'arroz');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Resultados para “arroz”'), findsOneWidget);
    expect(find.text('Arroz Integral'), findsOneWidget);
    expect(find.text('arroz tipo 1'), findsOneWidget);

    // Ordenar por menor preço.
    await tapText(tester, 'Relevância');
    await tapText(tester, 'Menor preço');
    expect(find.text('Menor preço'), findsOneWidget);

    await tapA11y(tester, 'Adicionar Arroz Integral ao carrinho');

    await tapText(tester, 'Ofertas');
    expect(find.text('Ofertas em destaque'), findsOneWidget);

    await tapText(tester, 'Pedidos');
    expect(find.text('Entre para ver seus pedidos'), findsOneWidget);

    await tapText(tester, 'Perfil');
    expect(find.text('Faça seu login'), findsOneWidget);

    await tester.tap(find.byTooltip('Carrinho, 1 itens').first);
    await tester.pumpAndSettle();
    expect(find.text('Minha lista'), findsOneWidget);
    expect(find.text('Arroz Integral'), findsOneWidget);
    // Visitante compara sem conta; o login é pedido só ao continuar para o pedido.
    // O único mercado que vende Arroz Integral está fechado: a comparação avisa em vez de falhar.
    await tapText(tester, 'Comparar mercados');
    expect(find.text('Nenhum mercado aberto atende sua lista agora'), findsOneWidget);
  });
}
