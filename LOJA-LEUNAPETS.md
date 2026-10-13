# LeunaPets — loja de dropshipping para a Europa (leia antes de mexer)

Loja só de **cães e gatos**, em **espanhol** (inglês opcional; o português foi tirado de propósito),
para **9 países da UE**: DE, FR, ES, IT, NL, BE, AT, PT, IE. Preços em **euro**, IVA incluído.
Fornecedor: **CJ Dropshipping** (envio da China com rastreio, 7–15 dias, IVA via IOSS da CJ).
Endereço hoje: **https://leunamesoftware.com** (Worker `leuname-site`). Domínio próprio planejado: **leunapets.com**
(o dono ainda não comprou; quando comprar na Cloudflare, adicionar as rotas em `SITE-LEUNAMESOFTWARE/wrangler.toml`).

O dono fala português do Brasil, quer respostas curtas e diretas. Ele está sem dinheiro: não sugerir gastos sem necessidade.

## Onde está cada coisa (repositório leunamesoftware/Leunamesite, branch `claude/leuname-github-setup-qwkedw`)
| Arquivo | O que é |
|---|---|
| `ferramentas-loja/gerar_paginas.py` | **Gera todas as páginas HTML** (topo, banner, categorias, rodapé, políticas). Edite aqui e rode `python3 ferramentas-loja/gerar_paginas.py`. Não edite os .html à mão. Texto em 3 idiomas: `t(es, pt, en)` (pt fica escondido). |
| `SITE-LEUNAMESOFTWARE/loja.css` / `loja.js` | Visual e lógica (carrinho em localStorage, busca, filtros `?animal=perro|gato`, `?cat=`, `?q=`, PayPal JS SDK, botão Stripe). |
| `SITE-LEUNAMESOFTWARE/worker.js` | Worker: `/api/config` e `/api/pagar` (Stripe Checkout; o preço vem SEMPRE de `produtos.json`, nunca do navegador). O resto é site estático. |
| `SITE-LEUNAMESOFTWARE/config.js` | `paypalClientId` (público), `email`, `titular` (dados legais do vendedor — ainda vazio). |
| `SITE-LEUNAMESOFTWARE/img/` | Logo (`logo.webp`, `favicon.png`, `emblema-192.png`), banner fixo `banner-casa(-m).webp`, cartões `card-perros/gatos.webp`, `familia(-m).webp`. |
| `ferramentas-loja/cj_sync.py` | **Robô da CJ.** Busca os mais populares de cada categoria de pet da CJ (`CATEGORIAS_CJ`), calcula frete+IVA (origem CN, testa 5 países e usa o mais caro), sugere preço (`preco_venda`: 2× custo, mínimo +8 €, termina em ,99). Gera `catalogo-cj.json` (todos) e `produtos.json` (só os aprovados). |
| `ferramentas-loja/aprovados.json` | **O que está à venda.** `{ "<pid CJ>": { "es": {...}, "pt": {...}, "en": {...}, "categoria": "camas|comer|juguetes|paseo|higiene|rascadores", "animal": "perro|gato|ambos", "destaque": bool, "nuevo": bool, "precio": opcional } }`. Cada idioma: `nombre`, `gancho` (frase curta), `descripcion`, `puntos` (lista). |
| `SITE-LEUNAMESOFTWARE/novidades.html` | Página do dono (noindex) com o catálogo do robô: custo, frete, preço sugerido, lucro, vídeo, botão "Quero vender". |
| `.github/workflows/deploy-site-cloudflare.yml` | Publica o site. **push** = só remonta `produtos.json` com o catálogo salvo no branch `dados-cj` (não gasta a CJ). **agenda diária / manual** = roda o robô inteiro (~15 min) e salva o catálogo no branch `dados-cj`. |
| `.github/workflows/cj-debug.yml` + `ferramentas-loja/cj_debug.py` | Diagnóstico da API da CJ; grava `debug.json` no branch `dados-cj-debug`. |

## Segredos (GitHub → Settings → Secrets → Actions). Nunca pedir ao dono para colar chave na conversa.
- `CJ_API_KEY` — **já está** (loja "LeunaPets" criada na CJ: Authorization → API → Chave de API).
- `STRIPE_SECRET_KEY` — o dono disse que colocou; o workflow passa para o Worker com `wrangler secret put`. Conferir com `/api/config` (`{"stripe":true}`).
- PayPal: falta o **Client ID** (público) → colocar em `config.js`.
- `CF_API_TOKEN` — deploy Cloudflare (já existia).

## Como ler o catálogo do robô (a rede do Claude não baixa artifacts nem logs do Actions)
```
git fetch origin dados-cj:refs/remotes/origin/dados-cj && git show origin/dados-cj:catalogo-cj.json > /tmp/catalogo.json
```
Disparar o robô: `gh api -X POST repos/leunamesoftware/Leunamesite/actions/workflows/deploy-site-cloudflare.yml/dispatches -f ref=claude/leuname-github-setup-qwkedw`
(`gh workflow run` não funciona aqui.)

## O que aprendemos com a CJ
- Quase não há produto de pet em armazém europeu, e os que há só entregam no próprio país. Por isso origem = **CN**.
- `listV2` aceita `categoryId` (3º nível) e `keyWord`; `listedNum` = quantas lojas já listaram (sinal de popularidade).
- `freightCalculate` devolve `logisticPrice` e às vezes `taxesFee`/`totalPostageFee` (IVA IOSS) — o robô soma.
- Limite: 1 chamada/s; 50 000 pontos/dia.

## Regras que o dono já aprovou / não mudar
- Banner do topo **fixo** (casinha rosa), sem carrossel. Logo horizontal LeunaPets. Cores: azul-marinho `#0F1E44` + rosa `#E62E73`.
- **Sem avaliações falsas, sem "mais vendido" inventado, sem preço riscado inventado** (lei da UE).
- Políticas da UE: desistimiento 14 dias, garantia legal padrão da UE (não "3 anos"), RGPD, cookies técnicas. Sem endereço de Xerém/Brasil na loja.
- Não prometer "armazém na Europa" nem "sem alfândega" além do que está nas políticas (IOSS).

## Pendências (ordem combinada com o dono)
1. Escolher ~20–30 produtos do catálogo, traduzir (es/pt/en), conferir preço na Amazon.es e preencher `aprovados.json` → push.
2. PayPal Client ID em `config.js`; confirmar Stripe ligado. Preencher `titular` (nome, endereço, NIF/CPF/CNPJ) quando o dono mandar.
3. **Pedido automático na CJ:** webhook do Stripe/PayPal → Worker cria pedido (`/shopping/order/createOrderV2`) com o endereço e paga com saldo CJ; manda rastreio por e-mail.
4. **Painel do dono:** vendas por dia/mês com gráfico, quanto entrou no Stripe/PayPal, custo CJ, lucro, status dos pedidos. (Precisa de D1 para guardar pedidos.)
5. Robô de novidades com tradução automática (precisa de uma API de tradução paga; hoje o dono aprova pela página novidades e o Claude traduz).
6. Feed para Google Merchant Center (anúncios grátis no Google Shopping) e depois tráfego pago pequeno.
7. Irmão do dono (brasileiro, na Europa sem documentos): loja separada no nome dele (CPF, PayPal/Stripe dele), outro nicho, mesmo sistema — ele não deve manusear produto (só dropshipping).

## Dinheiro (o dono perguntou)
- Exemplo: venda 19,99 € − CJ ~9 € − taxas ~1,50 € = ~9,50 € de lucro.
- PayPal conta nova segura cada venda até 21 dias (libera ~3 dias após a entrega se tiver rastreio), até ~25 vendas/90 dias. Stripe: 1º repasse 7–14 dias (conta BR pode ser mais). Sugestão: pagar a CJ com cartão de crédito.
