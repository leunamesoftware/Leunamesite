# EconoRota

Marketplace de compras em supermercados com comparação de preços e entrega.
Perfis: **Cliente**, **Mercado**, **Entregador** e **Administrador**.

| Pasta | Conteúdo | Tecnologia |
|---|---|---|
| `app/` | App (Android, iOS e Web — inclui painéis) | Flutter |
| `api/` | Servidor, banco e autenticação | Cloudflare Workers + D1 |


## Decisões do cliente (não alterar sem pedido)
- Pedido mínimo: **R$ 100 no pedido todo** (soma dos mercados), não por mercado — ajustável no painel (Configurações) ou em `MIN_ORDER_CENTS`.
- Pagamento: **Asaas** (Pix e cartão). Não usar Mercado Pago.
- Frete e comissão das lojas: definidos no final; ficam configuráveis (hoje: soma das taxas dos mercados).

## Status
- ✅ **Fase 1 — Fundação**: estrutura, identidade visual, componentes, navegação, banco inicial, API inicial e sistema de usuários.
- ✅ **Fase 5 — Comparação inteligente**: lista de compras por produto (sem escolher mercado), catálogo "a partir de", motor de comparação (até 3 mercados, mínimo 5 produtos por mercado, estoque, pedido mínimo do mercado, taxa de entrega de cada um, previsão), plano "mais barato" × "um só mercado", economia, tabela de preços × mercados com menor preço e "sem estoque", pedido mínimo do EconoRota de R$ 100 (configurável em `MIN_ORDER_CENTS`).
  - ✅ **Lista inteligente** (melhoria da Fase 5): o cliente digita ou cola a lista ("Manteiga Qualy", "Açúcar", "Óleo de soja — 2"); o app identifica produto, marca, tamanho e quantidade, pergunta "mais barato" ou "marca de preferência" nos itens genéricos, **nunca troca a marca pedida** (se não existir, o cliente decide) e monta o carrinho já na melhor combinação.
  - ✅ **Entrega única e "Sem sair de casa"**: o cliente vê um só valor de entrega (detalhe por coleta em "ⓘ", por transparência) e uma estimativa honesta de tempo e deslocamento se fosse ao mercado. Parâmetros em `app/lib/core/compare/rules.dart`.
  - ✅ **Responsivo**: celular, tablet, notebook e computador (em telas largas o app fica centralizado, sem esticar).
- ✅ **Fase 6 — Carrinho**: carrinho separado por mercado (parada numerada), alterar quantidade, remover com "Desfazer", conferir preços ("menor preço" da região), economia real vs. um só mercado, entrega única com detalhe em ⓘ, total, pedido mínimo, confirmação (endereço, itens por mercado, forma de pagamento Pix/Cartão) e pedido criado. O servidor recalcula preços, estoque e total; se algo mudou, pede revisão (409). Login no meio da compra volta para a confirmação.
- ✅ **Fase 7 — Pagamento (Asaas)**: escolha Pix/cartão, CPF pedido uma vez (validado), Pix com QR Code, "copia e cola" e prazo, cartão na página segura do Asaas (o EconoRota nunca recebe dados de cartão), processamento automático (webhook + consulta), aprovado (baixa o estoque), recusado (tenta de novo ou troca a forma), Pix expirado, cancelamento antes de pagar e reembolso depois de pago. Se um produto esgotar durante o pagamento, o valor é devolvido automaticamente.
- ✅ **Fase 8 — Painel do supermercado**: login do mercado, dashboard (loja aberta/fechada, pedidos e vendas do dia, alertas), cadastro/edição de produtos, categorias com contagem, preços e promoções, estoque (entrada, saída, ajuste, histórico), estoque baixo, indisponível e validade, recebimento do pedido pago, separação, conferência item a item (ok/em falta), pedido pronto, histórico e financeiro (vendas, comissão configurável em `COMMISSION_PCT`, valor a receber). Cada mercado só acessa os próprios dados. Demo local: `m1@demo.local` / `demo1234`.
- ✅ **Fase 9 — Entregador**: cadastro (dados, chave Pix, veículo moto/bicicleta/carro com placa e CNH quando exigido), CNH e documento do veículo (CRLV) para moto/carro — bicicleta só documento com foto (R2, privados; sem foto do veículo), envio para análise, disponível/indisponível, região atual (GPS a cada 15 s com o app aberto) e raio de atuação, pedidos disponíveis com ganho estimado (endereço completo só após aceitar), aceitar entrega, ir ao mercado (Google Maps/Waze), chegada, conferência da quantidade e retirada em cada mercado na ordem da rota, rota até o cliente, chegada, entrega confirmada por QR Code ou código de 6 dígitos do cliente (5 tentativas), finalização, ganhos (`COURIER_SHARE_PCT`) e histórico. Demo local: aprovado na hora com `DEV_MODE`; em produção a aprovação é da administração (Fase 13).
- ✅ **Fase 10 — Rastreamento**: mapa (flutter_map; provedor de mapas em `MAP_TILES_URL`), localização do entregador (só enquanto está com o pedido), rota (entregador → mercados na ordem → cliente), status da entrega, farol (no prazo / atrasando / atrasado ou sem sinal do GPS), previsão de chegada e prazo prometido, cartões de Mercado 1, 2, 3 e Cliente, e código de entrega. Mapa também na tela do entregador.
- ✅ **Fase 11 — Ocorrências**: produto errado, faltando, com problema (indisponível/vencido), substituição não autorizada, entrega atrasada (após o prazo prometido), pedido não entregue e reclamação; evidências (até 5 fotos, privadas no R2), mensagens, análise administrativa (assumir, decidir reembolso total/parcial/sem reembolso, com nota) e histórico. Itens marcados "em falta" na conferência do mercado geram ocorrência automática com reembolso parcial na hora. Prazos: produto 48 h após a entrega; reclamação 7 dias.
- ✅ **Fase 12 — Avaliações**: depois da entrega (até 7 dias), cada participante avalia os outros uma vez: cliente → mercado (pública na loja, atualiza a nota) e entregador; entregador → cliente e mercado; mercado → cliente e entregador. Estrelas (1–5), etiquetas rápidas por tipo ("Bem embalado", "Pontual"…) e comentário opcional. Médias de entregador e cliente guardadas para uso interno (seleção de entregador, Fase 14). Avaliações ocultadas pela administração deixam de contar. Pessoas aparecem só pelo primeiro nome.
- ✅ **Fase 13 — Painel administrativo**: dashboard (vendas do dia, pedidos em andamento, entregadores disponíveis, alertas de aprovação e ocorrências, gráfico de 7 dias), clientes (busca, histórico, bloquear/desbloquear encerrando sessões), mercados (aprovar, suspender com motivo — some das buscas), entregadores (fila de análise, ficha com CNH/CRLV, aprovar, pedir correção, bloquear), produtos e estoque de todos os mercados (sem estoque, baixo, vencendo, tirar do ar), pedidos (busca, detalhe completo, cancelamento com estorno integral), entregas em andamento (atraso e GPS sem sinal), regiões atendidas (centro + raio, cobertura), avaliações (moderar/ocultar com recálculo da nota), ocorrências (assumir e decidir), pagamentos, relatórios (GMV, ticket médio, receita da plataforma, comissão, economia gerada, mercados e produtos que mais vendem, entregas no prazo), **configurações sem novo deploy** (pedido mínimo, comissão, parte do entregador, entrega única), usuários e permissões por área (Operação, Financeiro, Sistema) e logs/auditoria. Demo local: `admin@demo.local` / `demo1234`.
- ✅ **Fase 14 — Inteligência operacional**: **entrega única** (base + adicional por mercado extra; padrão R$ 7,90 / 10,90 / 13,90 para 1 / 2 / 3 mercados, ajustável no painel) — o otimizador só divide a compra quando a economia paga o adicional; **previsão de entrega** (separação do mercado mais lento, enquanto o entregador chega + rota com coletas + acréscimo quando há poucos entregadores para os pedidos em andamento); **peso estimado** do pedido pela unidade dos produtos (kg, g, L, ml, dz, un) e **capacidade do veículo** (bicicleta até 12 kg e 2 mercados; moto 25 kg; carro 150 kg); **seleção automática de entregador**: nos primeiros 90 s após o pagamento o pedido aparece só para os 3 melhores (perto do 1º mercado, bem avaliados — novatos não são punidos — e com veículo compatível), depois abre para todos da região; **perecíveis**: rota deixa o mercado com refrigerados por último (se a volta for até 15% maior), o mercado separa refrigerados por último e o entregador é avisado para levar a bolsa térmica. Regras em `api/src/lib/dispatch.ts` e `api/src/lib/optimizer.ts` (espelho no app: `app/lib/core/compare/`).
- ✅ **Fase 15 — Financeiro**: livro-razão por pedido gerado na entrega (mercado: + produtos entregues − comissão; entregador: + parte da entrega; plataforma: + comissão + restante da entrega), valor do mercado liberado após o prazo de reclamação (`market_hold_days`, padrão 2 dias), reembolsos depois da entrega debitados de quem causou (produto → mercado; entrega/reclamação → plataforma), **repasses** (gera um por mercado/entregador com saldo liberado, Pix manual com referência/comprovante, cancelar devolve ao saldo, nunca repassa o mesmo valor duas vezes), extrato e saldo (disponível, a liberar, já repassado) para mercado e entregador, chave Pix do mercado, e visão financeira da plataforma (receita líquida, comissões, entregas, reembolsos, a repassar).
- ✅ **Fase 16 — Notificações**: central no app para todos os perfis (sino com contador, atualiza a cada minuto, marcar como lidas, toque leva à tela certa). Cliente: pagamento aprovado, separação, entregador a caminho, saiu para entrega, entregador chegou, entregue (leva à avaliação), item em falta reembolsado, ocorrência resolvida, estornos e cancelamentos. Mercado: novo pedido pago, entregue, ocorrência, repasse enviado, aprovação/suspensão. Entregador: pedido pronto para retirada, cadastro aprovado/ajustar/bloqueado, repasse. Administração: nova ocorrência e novo cadastro de entregador. **E-mail** (Resend) nos eventos importantes quando `RESEND_API_KEY` está configurada. **Push no celular** (Firebase Cloud Messaging) já implementado no servidor: ativa com `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` e `FCM_PRIVATE_KEY` + registro do aparelho em `POST /me/dispositivos` (ver ENTREGA.md).
- ✅ **Fase 17 — Segurança e LGPD**: CPF, CNH e chaves Pix **cifrados no banco** (AES-256-GCM, segredo `DATA_KEY`); limite de tentativas por IP em cadastro, login, senha, códigos, pedidos, pagamentos, ocorrências e comparação (D1, sem serviço extra; resposta 429 com `Retry-After`); corpo máximo de 6 MB; respostas com dados da conta sem cache (`no-store`); cabeçalhos de segurança; permissões por perfil e por área da equipe; auditoria de acessos e alterações; **LGPD**: exportar meus dados (JSON) e excluir conta (cliente/entregador, com senha; apaga dados pessoais, documentos e endereços; pedidos ficam anonimizados pelo prazo legal; bloqueia se houver pedido em andamento ou saldo a receber).
- ✅ **Fase 18 — Testes**: suítes organizadas (API: 31 unitários + ~243 verificações de integração + teste de carga; app: 40 testes de regras e de telas por perfil), casos de 3 mercados e distância, `scripts/test-all.sh` roda tudo. Detalhes em [TESTES.md](TESTES.md).
- ✅ **Fase 19 — Finalização**: revisão visual (celular e computador) e correções, **dados da loja** no painel do mercado (CNPJ, contato, endereço pelo CEP, localização, horário, tempo de separação, Pix) com aprovação só com cadastro completo, aviso à administração de mercado novo, versão mínima do app (`/app/versao` → tela "Atualize"), assinatura Android por `key.properties`, abertura com as cores da marca, logs/observabilidade, recusa de gravar documentos sem `DATA_KEY` em produção, e **[ENTREGA.md](ENTREGA.md)** com tudo para publicar.
- ✅ **Fase 4 — Produtos e mercados**: loja do mercado (capa, entrega, taxa, mínimo, horário), categorias da loja, lista de produtos com subcategorias, detalhe do produto (preço por kg, estoque, oferta, favoritos, comparação de preço entre mercados), promoções da loja e avaliações com filtro por estrelas.
- ✅ **Fase 3 — Home do cliente**: início (banners, categorias, ofertas, mercados), localização com radar de proximidade, busca com sugestões/ordenação/paginação, categorias, mercados próximos (filtros, taxa, pedido mínimo, horário), ofertas, perfil (visitante e logado) e histórico de pedidos. Modo visitante: navega sem conta; login só para comprar.
- ✅ **Fase 2 — Acesso do cliente**: abertura, apresentação (4 telas), permissão de localização, endereço (CEP/GPS/recentes), login (e-mail ou telefone), cadastro, verificação por código, recuperação de senha, Termos e Privacidade (modelos).

## App (Flutter)

Requisitos: Flutter 3.47+.

```bash
cd app
flutter pub get
flutter run -d chrome                  # prévia com dados de demonstração
flutter test                           # testes
```

Modo demonstração: código de verificação/recuperação `123456`; entrar com `mercado@demo.app`, `entregador@demo.app` ou `admin@demo.app` (qualquer senha com 8+ caracteres) abre os painéis.

Conectar ao servidor real (desliga os dados de demonstração):

```bash
flutter run --dart-define=USE_MOCK=false --dart-define=API_URL=https://SUA-API.workers.dev \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=SEU_ID_WEB.apps.googleusercontent.com   # opcional
flutter build appbundle --release --dart-define=USE_MOCK=false --dart-define=API_URL=https://SUA-API.workers.dev
flutter build web --release --dart-define=USE_MOCK=false --dart-define=API_URL=https://SUA-API.workers.dev
```

Estrutura de `app/lib`:

```
core/       tema, cores, rotas, configuração, utilitários
data/       modelos, repositórios (API e demonstração), dados de exemplo
services/   cliente HTTP e armazenamento seguro da sessão
state/      controladores (sessão, carrinho)
widgets/    componentes padrão reutilizáveis
features/   telas por área (cliente, painéis, componentes)
l10n/       textos do app (pt-BR; novos idiomas = novo arquivo .arb)
```

## API (Cloudflare Workers + D1)

Requisitos: Node 20+ e conta Cloudflare (plano Workers Paid recomendado).

```bash
cd api
npm install
cp .dev.vars.example .dev.vars          # defina JWT_SECRET
npm run db:migrate:local && npm run db:seed:local
npm run dev                             # http://localhost:8787
npm test                                # testes do motor de comparação
npm run smoke                           # testes da API (com o dev rodando)
```

Produção:

```bash
npx wrangler d1 create econorota        # copie o database_id para wrangler.toml
npx wrangler secret put JWT_SECRET      # valor aleatório longo (ex.: openssl rand -hex 32)
npm run db:migrate:remote
npm run deploy
npm run create-admin -- "Nome" email@dominio.com   # cria o primeiro administrador
```

Em produção, troque `ALLOWED_ORIGINS` em `wrangler.toml` pelos domínios reais dos painéis.

### Serviços opcionais (ativados só por configuração, sem mudar código)

| Recurso | Segredos (`npx wrangler secret put …`) | Custo |
|---|---|---|
| Código por e-mail | `RESEND_API_KEY`, `EMAIL_FROM` (domínio verificado no Resend) | grátis até 3.000/mês |
| Código por WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` (Meta Cloud API, modelo de autenticação aprovado) | ~R$ 0,15–0,20 por mensagem |
| Login com Google | `GOOGLE_CLIENT_IDS` (IDs OAuth Android/Web separados por vírgula) | grátis |
| Endereço pelo GPS | `GEOCODER_USER_AGENT` (contato para o OpenStreetMap) | grátis, baixo volume* |

Sem e-mail configurado, a verificação fica indisponível em produção (a API responde 503). O app consulta `/auth/config` e mostra só os canais ativos.
\* Para alto volume, trocar `/geo/reverse` por um provedor pago (LocationIQ/Mapbox) em `src/routes/geo.ts`.

### Endpoints

| Método | Rota | Acesso |
|---|---|---|
| GET | `/health`, `/auth/config` | público |
| POST | `/auth/register`, `/auth/login` (e-mail ou telefone), `/auth/google` | público |
| POST | `/auth/password/forgot`, `/auth/password/reset` | público |
| GET | `/auth/me` | autenticado |
| POST | `/auth/verify/send`, `/auth/verify/confirm`, `/auth/logout-all` | autenticado |
| GET/POST/DELETE | `/me/addresses` | autenticado (só os próprios) |
| GET | `/geo/cep/:cep`, `/geo/reverse?lat=&lng=` | público |
| GET | `/categories`, `/markets?lat=&lng=&q=&open=1&sort=distance\|rating\|fee` | público |
| GET | `/products?q=&category_id=&market_id=&on_sale=1&sort=relevance\|price\|discount&limit=&offset=`, `/search/suggest?q=` | público |
| GET | `/markets/:id`, `/markets/:id/reviews?stars=`, `/products/:id` (com comparação), `/categories/:id/subcategories?market_id=` | público |
| GET | `/catalog/items?q=&category_id=` | público |
| POST | `/compare` `{lat, lng, items:[{key, qty}]}` — `key` = `nome|unidade` ou `nome|unidade#marca` (só aquela marca) | público |
| POST | `/list/resolve` `{text}` — lista inteligente | público |
| POST | `/me/orders` `{items, market_ids, expected_total_cents, payment_method, address}` — confirma o pedido (recalculado no servidor) | cliente verificado |
| GET | `/me/orders/:id` — detalhe (mercados, itens, pagamento) | dono do pedido |
| POST | `/me/orders/:id/pay` `{method, cpf?}` — gera Pix/cartão (sem cobrança duplicada) | cliente |
| GET | `/me/orders/:id/payment` — situação do pagamento | dono do pedido |
| POST | `/me/orders/:id/cancel` — cancela (antes de pagar) ou estorna (pago, antes da separação) | cliente |
| POST | `/webhooks/asaas` — eventos do Asaas (header `asaas-access-token`) | Asaas |
| GET/PATCH | `/painel/loja` · GET `/painel/resumo` · `/painel/categorias` | mercado |
| GET/POST/PATCH | `/painel/produtos` · POST `/painel/produtos/:id/estoque` · GET `/painel/estoque/movimentos` | mercado |
| GET/POST | `/painel/pedidos` · `/painel/pedidos/:id` · `/aceitar` · `/conferencia` · `/pronto` · GET `/painel/financeiro` | mercado |
| GET | `/me/orders/:id/rastreio` — rastreamento | dono do pedido |
| POST | `/me/orders/:id/ocorrencias` · PUT `/me/ocorrencias/:id/evidencias` · POST `/mensagens` · GET `/me/ocorrencias(/:id)` | cliente |
| GET/POST | `/admin/ocorrencias` · `/:id` · `/:id/analisar` · `/:id/decidir` · GET `/painel/ocorrencias` | admin · mercado |
| GET | `/admin/eu` · `/admin/resumo` | admin |
| GET/POST | `/admin/clientes` · `/admin/usuarios-status/:id` · `/admin/mercados` · `/admin/mercados/:id/status` · `/admin/entregadores(/:id)` · `/:id/arquivos/:tipo` · `/:id/decidir` | admin (Operação) |
| GET/POST/PATCH | `/admin/produtos` · `/:id/ativo` · `/admin/pedidos(/:id)` · `/:id/cancelar` · `/admin/entregas` · `/admin/regioes(/:id)` · `/admin/avaliacoes` · `/:fonte/:id/ocultar` | admin (Operação) |
| GET | `/admin/pagamentos?status=` · `/admin/relatorios?dias=` | admin (Financeiro) |
| GET/POST | `/admin/financeiro?dias=` · `/admin/repasses?status=` · `/repasses/gerar` · `/repasses/:id/pagar` · `/repasses/:id/cancelar` · `/admin/extrato/:tipo/:id` | admin (Financeiro) |
| GET | `/painel/extrato` · `/entregador/extrato` (saldo, lançamentos e repasses) · PATCH `/painel/loja` `{pix_key}` | mercado · entregador |
| GET/POST/DELETE | `/me/notificacoes` · `/me/notificacoes/nao-lidas` · `/me/notificacoes/lidas` · `/me/dispositivos(/:token)` | autenticado |
| GET | `/app/versao` (versão mínima do app) | público |
| GET/POST | `/me/dados` (exportar, LGPD) · `/me/conta/excluir` `{password}` | cliente · entregador |
| GET/PUT/POST/PATCH | `/admin/configuracoes` · `/admin/equipe(/:id)` · GET `/admin/auditoria?acao=&entidade=&id=` | admin (Sistema) |
| GET/PUT | `/entregador/perfil` · PUT/GET `/entregador/arquivos/:tipo` (`documento`, `crlv`) · POST `/entregador/enviar` | entregador |
| POST | `/entregador/disponibilidade` · `/entregador/localizacao` · GET `/entregador/pedidos-disponiveis` · POST `/entregador/pedidos/:id/aceitar` | entregador aprovado |
| GET/POST | `/entregador/entrega-atual` · `/pedidos/:id/mercados/:om/chegada` · `/retirada` · `/chegada-cliente` · `/entregar` · GET `/ganhos` · `/historico` | entregador aprovado |
| GET | `/me/orders?status=andamento\|entregues\|cancelados` | autenticado (só os próprios) |
| GET/POST | `/avaliacoes/pedidos/:id` (o que falta avaliar) · POST `/avaliacoes` `{pedido, alvo_tipo, alvo_id, estrelas, tags, comentario}` · GET `/avaliacoes/minhas` | participantes do pedido |

### Segurança
- Senhas com PBKDF2-SHA256 (100 mil iterações); token JWT assinado; nova senha encerra todas as sessões.
- Códigos de 6 dígitos guardados só como hash, válidos por 10 min, 5 tentativas, reenvio após 60 s, máx. 5 por hora.
- Bloqueio de 15 min após 8 senhas erradas; login e recuperação não revelam se a conta existe.
- Destinos mascarados (`ma***@…`, `+5511 ***** 4321`); coordenadas de GPS arredondadas.
- Admin não se cadastra pelo app; mercados e entregadores entram como "pendente"; cada usuário só acessa os próprios dados.
- No app: sessão no Keystore/Keychain; ao sair, endereço, carrinho e token são apagados do aparelho.


## Pagamentos (Asaas)
1. Crie a conta em asaas.com (use o **sandbox** para testes) e gere a chave de API.
2. `npx wrangler secret put ASAAS_API_KEY` e `npx wrangler secret put ASAAS_WEBHOOK_TOKEN` (invente um token longo).
3. No painel do Asaas → Integrações → Webhooks: URL `https://SUA-API/webhooks/asaas`, token = o mesmo do passo 2,
   eventos de **cobranças** (PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED,
   PAYMENT_CREDIT_CARD_CAPTURE_REFUSED, PAYMENT_REPROVED_BY_RISK_ANALYSIS).
4. Produção: troque `ASAAS_BASE_URL` para `https://api.asaas.com/v3` no `wrangler.toml`.
Sem chave configurada: em desenvolvimento (`DEV_MODE=true`) funciona o simulador; em produção os pagamentos ficam indisponíveis (nunca aprova sozinho).
