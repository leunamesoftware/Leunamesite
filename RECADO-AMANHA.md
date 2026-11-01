# RECADO DE PASSAGEM — LeunaPets (leia ANTES de tudo)


**Estado agora**
- Anúncio Meta (conta 2285209352332107, R$ 40/dia, Portugal, termina 3/11): ATIVO, mas R$ 0 gasto e 0 impressões às 23h. Se amanhã continuar zerado, investigar (entrega, pagamento, pixel). Regra: ~R$ 80 gastos sem carrinho = pausar e avisar. Só o dono clica em Publicar.
- Shopify: 0 vendas reais. Os 2 pedidos (#1001, #1002, €0,65) são testes do dono. Visitas: 335 (30/10), 95 (31/10).
- Google Merchant (5874703190): 210 de 211 aprovados (eram 0 há 7 dias; 61 reprovados caíram para 1: Coleira Prateada, "imagem não processada"). Cliques ainda zero. Revisão "Deturpação" pendente: não mexer em frete, políticas ou endereço. NÃO aceitar "mostrar na Espanha": a loja é só Portugal.
- Tema no ar: "LeunaPets v20 (botão do produto limpo)" (nome interno; cliente não vê). Tem botão "Comprar agora" (blocks/accelerated-checkout.liquid) que vai direto ao checkout. Já publicado pelo dono. A loja está em pt-PT, não em espanhol; o idioma do botão do Google Pay segue o navegador de quem olha.
- Facebook (LeunaPets, id 61596160888107): capa nova salva, 3 posts publicados (bolsa com rótulo de IA, túnel dobrável, luva de banho). Falta site e botão no cabeçalho da página. A página só dá confiança, não vende; não gastar muito tempo.
- PayPal DESATIVADO (precisa de conta com CNPJ; dono vai ver com o contador).

**Fazer amanhã, nesta ordem**
1. Meta: gasto, impressões, cliques, carrinhos. Pausar se ~R$ 80 sem carrinho. Se ainda R$ 0, descobrir o motivo.
2. Shopify: vendas reais, carrinhos iniciados, visitas. Se houver venda real, avisar o dono na hora: ele paga o pedido na CJ (~US$ 20).
3. Merchant Center: reprovados e primeiros cliques.
4. Conferir que a bolsa (Product/11270202556583) continua com inventoryPolicy CONTINUE.
5. Rodapé diz "Cartão, PayPal e carteiras" mas o PayPal está off: corrigir para "Cartão e carteiras digitais" numa CÓPIA do tema (eu não publico tema no ar; o dono publica).

**Pendências menores**
- Checkout mais bonito (logo, cores, menos campos): só com "pode" do dono.
- Testar pagamento com cartão europeu real.
- Conectar mais produtos à CJ (32 sem conexão; Casaco Acolchoado Quentinho e Cama Gruta primeiro).
- Perguntas para o contador (qual CNPJ no PayPal, CNAE de e-commerce).
- Vídeo vertical com foto real (sem IA) para anúncio/TikTok. Descrições genéricas de ~8 produtos e linha de entrega consistente, depois da revisão do Google.

**Técnicas que funcionaram (Chrome)**
- Upload de arquivo no Facebook: `file_upload` no input de arquivo (use `find`); se a página não reagir, mover o input para dentro de `div[role=main]` e disparar `change` com bubbles. Arquivos só de /home/claude. O sandbox não baixa de cdn.shopify.com; post com link do produto gera a prévia com foto sozinha.
- Shopify: usar GraphQL 2026-10 com media/featuredMedia. Tema no ar não é editável por mim; copiar (themeDuplicate) e editar a cópia.

**Nunca**: publicar anúncio, gastar dinheiro, digitar senha/cartão, apagar dados, postar sem "pode" do dono, escrever em pt-BR para clientes de Portugal.
