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

---
## PLANO B DO ANÚNCIO (preparado em 01/11, só usar se o dia 2 à noite der 0 carrinho ou ~R$ 80 gastos)
Regra: criar um anúncio NOVO (duplicar), pausar o antigo. Mudar UMA coisa por vez. O dono clica em Publicar.
Textos em português de Portugal. Link: https://leunapets.com/products/bolsa-transporte-quentinha-animais

**Texto A (problema → solução)**
Primeira linha: O seu cão ou gato sente frio nos passeios? 🐾
Corpo: A Bolsa de Transporte Quentinha leva o seu animal aconchegado junto a si, com as mãos livres. Interior macio com enchimento 3D que mantém o calor. Ideal para passeios, veterinário e viagens. Portes grátis para Portugal 🚚 14 dias para devolver.
Título: Quentinho e à vontade
Botão: Comprar agora

**Texto B (curto, preço)**
Primeira linha: Leve o seu animal sempre consigo, quentinho. 🧡
Corpo: Bolsa macia e lavável para cães e gatos pequenos. Portes grátis para todo o Portugal. Só €34,90.
Título: Bolsa Quentinha para Animais
Botão: Comprar agora

**Foto**
1ª tentativa: foto REAL do produto (sem a modelo de IA), pegar nas fotos da CJ/loja. Se usar a modelo de IA, marcar "conteúdo de IA".

## PEDIDOS DO DONO EM 01/11 (12h45), para o próximo Claude
1. **Robô da Meta de 15 em 15 min dentro do app LeunaPets** (leuapps/public/leunapets, repo leuname-softwarea-apps). Precisa de uma chave de leitura da Meta (ads_read, conta act_2285209352332107): o dono gera em Business Settings > Usuários do sistema > gerar token, e põe no GitHub como segredo META_TOKEN (e no Worker). Depois: cron no Worker (a cada 15 min) lê gasto, impressões, cliques, carrinhos e compras pela Graph API e grava no D1 com data/hora; o app mostra gráfico bonito do histórico, "o que mudou desde a última leitura" com setas verde (melhor) e vermelha (pior) e alerta; o painel atualiza sozinho a cada 15 min. Sem a chave isso não existe. O gasto/ROAS do Painel hoje vêm só do que o dono digita (D.camp).
2. **Senha do dono do app LeunaPets**: ele não lembra. O classificador de segurança bloqueou afrouxar a troca de senha e tirar a senha. Só fazer com o dono presente e liberando: apagar dono_acesso no D1 para o app voltar ao "Primeiro acesso: crie a sua senha". A tela "Trocar senha" (Conta) já existe, pede a senha de agora (calculadora/src/dono.js, trocarSenhaDono).
3. Vigia dentro do app: pronto (leunapets/vigia.html em iframe).
