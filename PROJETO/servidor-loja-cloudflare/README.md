# Servidor da Loja LeuName Softwares (Cloudflare)

Backend do site `SITE-LEUNAMESOFTWARE/`: serve o catálogo de produtos
(`GET /productos`) e registra pedidos após o checkout (`POST /pedidos`
— sem processar pagamento; isso é feito no front-end quando o Stripe
for integrado). Roda inteiro na Cloudflare (Worker + banco D1).

O site consome este backend de forma **progressiva**: se o Worker não
responder (ainda não implantado, sem rede, etc.), `js/api.js` mantém os
dados estáticos de `js/products.js` — o site nunca fica em branco por
falta de backend.

## Já está pronto

- Banco D1 `leuname_loja` criado e populado com o catálogo inicial
  (mesmo conteúdo de `js/products.js`, incluindo o produto real
  `leuname-gestao` e os produtos de exemplo claramente marcados).
- `wrangler.toml` já aponta para o `database_id` real.
- Workflow `.github/workflows/deploy-loja-cloudflare.yml` publica este
  Worker do mesmo jeito que `deploy-licencas-cloudflare.yml` publica o
  servidor de licenças — reutiliza os mesmos secrets `CF_API_TOKEN` e
  `ADMIN_TOKEN` já configurados no repositório.

## Rotas públicas

- `GET /health` — checagem simples.
- `GET /productos` — lista o catálogo ativo.
- `GET /productos/:id` — detalhe de um produto.
- `POST /pedidos` — cria um pedido a partir do carrinho (`{ cliente:
  {nombre,email,telefono,pais}, items:[{id,qty}] }`). Os preços são
  sempre lidos do banco no servidor, nunca confiados do corpo da
  requisição.

## Rotas administrativas (`Authorization: Bearer <ADMIN_TOKEN>`)

- `GET/POST /admin/productos`, `PUT/DELETE /admin/productos/:id` — CRUD
  do catálogo (usado pelo painel em `admin/productos.html`).
- `GET /admin/pedidos`, `GET /admin/pedidos/:id` — consulta de pedidos.

Usa o **mesmo** `ADMIN_TOKEN` do servidor de licenças (mesmo valor,
mesma convenção de bearer token) — não é preciso gerar um segredo novo.

## Domínio customizado (opcional, ainda não configurado)

O Worker fica disponível em
`https://leuname-loja.<subdominio-da-conta>.workers.dev`. Para ligar um
domínio próprio (ex.: `loja-api.leunamesoftware.com`), repita no
Cloudflare Dashboard o mesmo passo manual já feito uma vez para
`api.leunamesoftware.com`: **Workers & Pages → leuname-loja → Settings
→ Domains & Routes → Add Custom Domain**. Depois, descomente o bloco
`[[routes]]` no final de `wrangler.toml` e rode o workflow de deploy de
novo.

## O que ainda NÃO está pronto

- **Pagamento real (Stripe)** — o ponto de integração já está isolado
  em `SITE-LEUNAMESOFTWARE/js/checkout.js` (`processPayment()`), mas
  não há chamada real de cobrança em lugar nenhum ainda.
- **Autenticação de clientes** — `POST /pedidos` identifica o cliente
  só pelo e-mail informado no checkout; não há login/senha real.
