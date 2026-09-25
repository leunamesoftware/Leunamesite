# EconoRota — Testes

Tudo de uma vez (na pasta `apps/econorota`):

```bash
cd api && npm run dev          # em outro terminal: API local com DEV_MODE=true (.dev.vars)
bash scripts/test-all.sh       # tipos + unitários + integração + carga + app
```

## Suítes

| Suíte | Comando | O que cobre |
|---|---|---|
| API — unitários (31) | `cd api && npm test` | Motor de comparação (até 3 mercados, mínimo de 5 itens por mercado, estoque, pedido mínimo, entrega única), rota e distância (Haversine), refrigerados por último, previsão de entrega, peso e capacidade do veículo, prioridade de entregadores, lista inteligente, CPF, criptografia dos dados pessoais |
| API — integração (~243 verificações) | `cd api && bash scripts/smoke.sh` | Fluxo real contra a API local: cadastro/login/verificação/senha, endereços, catálogo, comparação, pedido (recalculado no servidor), pagamento (simulador), painel do mercado, entregador (cadastro → coleta → entrega com código), rastreio, ocorrências e reembolsos, avaliações, administração e permissões, entrega única configurável, livro-razão e repasses, notificações, segurança (cifra no banco, 413, no-store, cabeçalhos) e LGPD |
| API — carga | `cd api && node scripts/load.mjs 20 20` | Usuários simultâneos em mercados, busca, produto e comparação; mostra p50/p95/máx e erros |
| App — unitários (12) | `cd app && flutter test test/optimizer_test.dart test/unit_test.dart` | Mesmas regras do motor no app (modo demonstração), 3 mercados, rota, lista inteligente, validações |
| App — telas (25) | `cd app && flutter test` | Acesso, cliente (comparar, carrinho, confirmação, pagamento, rastreio, ocorrências, avaliações, notificações, LGPD), mercado, entregador e administração — em tela de celular; falha se algo estourar a tela |
| App — análise | `cd app && flutter analyze` | Erros e boas práticas do código |

Arquivos de teste do app: `app/test/access_test.dart`, `customer_test.dart`, `market_test.dart`, `courier_test.dart`, `admin_test.dart` (telas) e `optimizer_test.dart`, `unit_test.dart` (regras). Ajudantes em `app/test/helpers.dart`.

## Resultado da última execução

- API: tipos ok · 31 unitários ok · 243 verificações de integração ok.
- Carga local (10 usuários, 10 s): ~218 req/s, 0 erros, p95 entre 60 e 80 ms (comparação é a rota mais pesada).
- App: análise sem nenhum aviso · 40 testes ok.

## Conferência manual antes de publicar (distribuidor)

1. Em produção, com Asaas **sandbox**: pedido com Pix e com cartão, recusado, expirado e estorno.
2. Entregador real em celular Android: GPS, mapa (com `MAP_TILES_URL`), QR Code e código de entrega.
3. Três mercados reais no mesmo pedido: ordem de coleta, refrigerados por último, previsão.
4. Painel administrativo: aprovar um mercado e um entregador, gerar e pagar um repasse.
5. LGPD: exportar dados e excluir uma conta de teste.
