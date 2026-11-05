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

## Robô da Meta pelo Chrome do dono (pedido 01/11 13h07)
O dono deixa o computador ligado 24h com o Chrome aberto. Alternativa SEM chave da Meta: tarefa agendada (create_trigger, requires_local_device=true, a cada 15 min) que abre o Gerenciador de Anúncios (conta act_2285209352332107, período Máximo) no Chrome dele e lê: gasto, impressões, alcance, cliques, carrinhos, compras e REAÇÕES (colunas "Reações no post"). Grava numa tabela D1 (ex.: meta_leituras: quando, gasto, imp, alc, cli, car, com, rp, rn) pelo MCP da Cloudflare (calculadora-receitas, id 7117bdcb-9d07-49ed-88a5-a57502ef1b73) e o Worker da calculadora ganha um GET /api/dono/meta (só dono logado) que devolve a última leitura e o histórico. O Vigia (leuapps/public/leunapets/vigia.html) busca isso a cada 15 min, preenche os campos sozinho e o "robô: o que mudou" (já existe) mostra melhor/pior; o som já existe. Alinhar o layout do Vigia (dono reclamou de desalinhado nos campos/indicadores). A tarefa só LÊ; nunca clicar em Publicar nem alterar anúncio.

**Decisão do dono 02/11:** esquecer contador (não lembrar nem cobrar IVA/OSS/CNPJ do PayPal). Pedidos de teste #1001–#1003 arquivados na Shopify; dono não vai fazer mais testes de compra.

**Combinado com o dono 03/11 (21h):** não mexer na loja nem no anúncio do Ninho até o gasto chegar a ~R$ 80. Nesse ponto: se houver carrinho/venda, continua; se não houver nada, baixar só o Ninho tamanho S para €29,99 (pedir o "pode" ao dono antes). Situação em 03/11 20h46: Ninho R$ 22,64 gastos, 307 de alcance, 381 impressões, 27 cliques no link (~R$ 0,84), 0 carrinho. Custo CJ para Portugal (CJPacket Ordinary, 8–18 dias, só sai da China): S US$ 18,31 (sobra ~€11 após IVA a €34,99), L US$ 28,31 (sobra ~€7 após IVA a €39,99, não baixar). Prazo "8 a 18 dias" fica como está (dono decidiu). Pendente: procurar cama de gato parecida em armazém CJ na Europa (só pesquisar, não trocar). Verificação de anunciante na Meta: concluída em 03/11 (individual, Emanuel Da Silva Antunes Coletto).

**04/11 (21h45) — Anúncio LeuName dentro da conta da LeunaPets (decisão do dono):** a conta de anúncios act_2285209352332107 ("LeunaPets Portugal") agora também roda a campanha **"Sites Prontos BR - Tráfego"** (página do Facebook LeuName Softwares id 61596014321011, Brasil, donos de pequenas empresas, R$ 15/dia, só Facebook, termina 10/11, link categoria.html?slug=sites). O dono NÃO quer pôr dinheiro em conta nova: usa o saldo pré-pago que sobrou (R$ 143,80 em 04/11, Pix de R$ 250 em 31/10). Ninho e Bolsa desligados. **Para não misturar: sempre separar gasto e resultado POR CAMPANHA** (LeunaPets = Ninho/Bolsa; LeuName = Sites Prontos). Regra: R$ 75 gastos sem venda de site → parar e repensar.

**05/11 (01h20) — Alteração da empresa do dono (Trans Antunes → GRUPO LEUNAME LTDA), sem contador:** CNPJ 36.665.546/0001-09, LTDA, endereço comercial "789, Xerém, Duque de Caxias, 25241-390" (o 484 é da Super Misto). Nome escolhido: **GRUPO LEUNAME LTDA** (livre na busca de colidência JUCERJA 05/11; "LEUNAME LTDA" recusado: precisa 2 palavras; reserva: LEUNAME COMERCIO E SERVICOS LTDA). Nome fantasia: **LeuName**. Atividades: principal 6203-1/00; secundárias 6202-3/00, 6201-5/01, 7410-2/02, 4789-0/99, 4789-0/04, 7490-1/04, 4693-1/00; SAEM todas de transporte. Viabilidade REGIN (Duque de Caxias, JUCERJA, "Nome" + "Atividade Econômica", CNPJ preenchido) parou em "Comunicação com a Receita Federal fora do ar" à 01h20: repetir de dia. Depois: DBE na Receita, alteração contratual (precisa do contrato social atual — pedir ao dono), assinatura gov.br do dono, boleto da Junta (dono paga), protocolo, inscrição estadual (Sefaz) e prefeitura. Login gov.br só o dono faz.
- **Decisão do dono 05/11 01h48:** endereço FICA o atual (789, Xerém). Alteração só de NOME + ATIVIDADES. Trocar endereço depois, quando tiver dinheiro (opções: 484 da sogra, inscrição IPTU 4028801, com IPTU atrasado no nome do sogro falecido; ou escritório virtual). Casa do dono não tem inscrição de IPTU (não serve).

## 05/11 (10h20) — ATUALIZAÇÃO da alteração da empresa (substitui as decisões de 01h48)
O dono vai voltar só no **domingo** (limite de uso). Continuar daqui, em português, respostas curtas.

**Decisões novas do dono (05/11 manhã):**
- **Endereço: MUDA para Estrada de Xerém 484**, Xerém, Duque de Caxias, CEP 25241-390, IPTU 4028801 (mesmo endereço da Super Misto, pode). A sogra (herdeira; sogro falecido, IPTU no nome dele) assina depois a autorização/cessão do imóvel — vai junto da alteração contratual, não na viabilidade. Escritório virtual (ex.: CompanyHero R$120/mês no anual) fica para depois, quando houver renda (o dono quer ser nômade no futuro).
- **Área: 20 m²**. **Com inscrição estadual (SIM)** e tipo de unidade **Unidade Produtiva** (o dono quer vender produto na Shopee/drop/licitação; como "escritório" a Sefaz não dá IE).
- **Forma de atuação: Internet** (+ "Atividade desenvolvida fora do estabelecimento", que já vinha marcada).
- **Nome: NÃO é mais "GRUPO LEUNAME"** (o dono achou feio). Ele vai escolher um nome bonito. Sugestões dadas: LEUNAME SOFTWARES LTDA (preferida), LEUNAME TECNOLOGIA LTDA, LEUNAME DIGITAL LTDA. Precisa ≥2 palavras; checar colidência na JUCERJA. Nome fantasia: LeuName.
- **Atividades (lista final proposta, o dono não se opôs; confirmar):** principal **6203-1/00** (licenciamento de software não customizável — Anexo III do Simples, ~6%). Secundárias: 7410-2/99 (design, sites — NÃO usar 7410-2/02, é design de interiores), 4789-0/99 (varejo outros), 4789-0/04 (pet), 4781-4/00 (vestuário), 4772-5/00 (cosméticos), 4751-2/01 (informática), 4753-9/00 (eletro), 4759-8/99 (utilidades), 4763-6/01 (brinquedos), 4763-6/02 (esporte), 4693-1/00 (atacado geral), 7490-1/04 (intermediação). **TIRAR 6201-5/01 e 6202-3/00** (Anexo V, 15,5%; dono não faz software sob encomenda). **Sem alimentos** (Vigilância Sanitária). Abrangência de cada CNAE: EE (valor 3).
- O dono pediu: "não coloca nada de sócio" (não mexer no quadro societário — o evento não altera sócios; a aba vem vazia).

**Como fazer a viabilidade REGIN (JUCERJA) — receita testada:**
1. Dono faz login gov.br na JUCERJA (só ele). A sessão cai se ficar ~1h parada → refazer tudo de uma vez.
2. Abrir https://www.jucerja.rj.gov.br/Servicos/Regin/PedidoViabilidadeRedirect → fechar aviso dos cartórios → drpListaMucinicpios=58335 (Duque de Caxias) → drpListaOpcoes=09280442000103 (Junta) → rdoNaoDocumentoRegistrado → marcar chkNome, chkAtividade, chkFormaAtuacao, chkEndereco → chkMunicipio (endereço no mesmo município) → txtCnpj=36665546000109 → btnEnviar. Eventos ficam 220-244-249-211.
3. Aba Solicitante: drpEnviaSefaz=1; ChkLstFormaAtuacao_1 (Internet); txtIPTU=4028801; txtArea=20. Endereço: o CEP tem várias ruas e "Buscar Endereço" abre popup que não aparece → criar iframe com src `EnderecoBusca3.aspx?Pagina=viabilidadepedidoalteracaov4.aspx&idMunicipio=58335`, nele District=XEREM → StreetType=10 (ESTRADA) → StreetName = opção "DE XEREM - CEP: 25241390" → `iframe.contentWindow.opener=window` → clicar btnRetorna. Depois txtNumero=484. Avançar.
4. Quadro Societário: vazio, Avançar.
5. Nome/Objeto/CNAE: txtOpcao1 = nome que o dono escolher. CNAE: txtCodActiEcon=código → btnBuscarCNAE → drpTipoAtividade (1 principal / 2 secundária) → drpTipoAbrangencia=3 → btnInsertAtividade. Remover linha: botão ListCNAE_DeleteFilial_N. txtObjeto: escrever o objeto social com as atividades finais.
6. Informações Complementares: revisar, mostrar ao dono e **só enviar com o "pode" dele**.
Estado em 05/11 10h20: viabilidade nova aberta (aba 1 preenchida e avançada até a aba de CNAE); estava começando a incluir os CNAEs quando o dono parou. Provavelmente a sessão vai expirar → refazer pelos passos acima.

**Depois da viabilidade aprovada:** DBE na Receita → alteração contratual (pedir ao dono o contrato social atual; incluir nome, atividades, endereço 484) → autorização assinada pela sogra → assinatura gov.br do dono → boleto da Junta (~R$ 500, dono paga) → protocolo → inscrição estadual (Sefaz) → prefeitura/NFS-e → Mercado Pago com o nome novo.

**Super Misto (CNPJ 13.580.397/0001-80, lucro presumido, com dívidas):** o dono quer **dar baixa** depois da LeuName pronta. Baixa é possível com dívidas (passam para os sócios, podem ser parceladas), mas antes precisa das últimas declarações (ECF/ECD) com certificado digital — na prática, contador só para essa parte. Dívidas da Trans Antunes (~R$ 40 mil Simples): ver transação/parcelamento no Regularize (dias úteis 7h–22h).

**05/11 10h23 — IDEIA NOVA DO DONO (decidir no domingo antes de fazer a viabilidade):** em vez de alterar a Trans Antunes, alterar a **Super Misto** (já está no 484, IPTU, tudo assinado): acrescentar as atividades de internet/software, trocar a principal e manter tempero. Ponto-chave: a Super Misto é **lucro presumido** (software/serviço ≈ 14–16% de imposto) e só entra no **Simples em jan/2027 se parcelar as dívidas até 31/01/2027**. Se der, alternativa boa: usar a Super Misto e dar baixa na Trans Antunes (baixa de Simples é mais fácil, sem ECF/ECD). Perguntar ao dono o valor das dívidas da Super Misto e se topa parcelar. Até ele decidir, NÃO enviar a viabilidade da Trans Antunes.

**05/11 10h25 — DECISÃO: fica a TRANS ANTUNES** (não a Super Misto) e o dono quer poder **vender de TUDO** pela internet: caneta/papelaria, pedra (material de construção), esterco/adubo, sementes, plantas, além do que já está na lista. Procurar os códigos certos na busca de CNAE do próprio REGIN (Buscar CNAE) e acrescentar: papelaria (4761-0/03), material de construção/pedras (4744-0/99 e afins), plantas e flores (4789-0/02), adubos/fertilizantes e sementes (conferir códigos de varejo/atacado), e outros que ele pedir. Avisar: semente e adubo podem exigir registro no Ministério da Agricultura (RENASEM) para vender de verdade. Ainda falta o NOME escolhido pelo dono antes de enviar.
- **Correção 10h27:** pedra/esterco/semente foi IRONIA do dono (só exemplo de "vender de tudo"). Não incluir esses. Para "vender de tudo" pela internet usar os CNAEs genéricos: **4713-0/02 lojas de variedades (inclui venda fora de loja/internet; Simples Anexo I, a partir de 4%)**, 4713-0/04 (lojas de departamentos/magazines), 4789-0/99 (varejo outros) e 4693-1/00 (atacado geral), mais os específicos já listados (roupas, cosméticos, eletrônicos, pet, utilidades, brinquedos, esporte).
- **10h40 — agora sério:** o dono quer vender **esterco de codorna (como adubo), farinha de ovo de codorna, plantas e sementes**. Incluir: **4789-0/02** (varejo de plantas, flores, mudas, sementes e adubos para jardinagem — cobre o esterco vendido como adubo de planta). Se ele mesmo cria as codornas/produz: 0155-5/05 (produção de ovos) e, para fabricar a farinha, 1066-0/00 (alimento para animais) ou 1099-6/99 (alimento humano). Avisos a dar: adubo orgânico vendido no comércio precisa de registro no MAPA (estabelecimento + produto); farinha de ovo para gente = Vigilância Sanitária, para bicho = registro de alimento animal no MAPA; semente para lavoura = RENASEM. Para começar pequeno, o mais leve é vender o esterco como "adubo para jardinagem/plantas" e as plantas/mudas.
- **10h42 — CONFIRMADO pelo dono: incluir TUDO de codorna + garden/plantas no mesmo CNPJ** (vai vender na loja dele). Acrescentar (conferir cada código no "Buscar CNAE" do REGIN):
  - 0155-5/05 produção de ovos (criação de codorna);
  - 2013-4/02 fabricação de adubos e fertilizantes (esterco de codorna e farinha de casca de ovo como adubo);
  - 4683-4/00 atacado de adubos/fertilizantes;
  - 4789-0/02 varejo de plantas, flores, mudas, sementes e adubos (garden);
  - 0122-9/00 cultivo de flores e plantas ornamentais;
  - 8130-3/00 atividades paisagísticas (jardinagem);
  - 4724-5/00 varejo de hortifrutigranjeiros (ovos de codorna) — alimento: Vigilância Sanitária;
  - farinha de ovo para consumo: 1099-6/99 (humano) ou 1066-0/00 (animal).
  Avisar: atividade de fábrica/criação no 484 pode ser barrada pelo zoneamento da prefeitura na viabilidade; se barrar, tirar só a que der problema.
- **10h43 — CORREÇÃO FINAL do dono (vale esta, não a de 10h42):** NÃO vender codorna, ovos nem criar nada no CNPJ; NADA de produção/fábrica (não quer problema com prefeitura). Só **VAREJO de jardinagem**: farinha de casca de ovo (adubo p/ planta), húmus, minhoca, larva de mosca-soldado (se puder), plantas, sementes, vasos, ferramentas. Incluir só: **4789-0/02** (plantas, flores, sementes, vasos, adubos de jardinagem), **4789-0/04** (animais vivos e alimento p/ animais de estimação — minhoca, larva de mosca-soldado como alimento de pet/aves/peixes), **4744-0/01** (ferragens e ferramentas — ferramentas de jardim), **4763-6/04** se quiser minhoca/larva como isca de pesca (conferir código), **4683-4/00** (atacado de adubos, opcional). TIRAR 0155-5/05, 2013-4/02, 0122-9/00, 8130-3/00, 4724-5/00, 1099-6/99, 1066-0/00. Aviso honesto (federal, não prefeitura): adubo vendido com marca/rótulo pode exigir registro no MAPA quando crescer.
- **10h49 — VERSÃO FINAL do dono (jardinagem):** ele VAI produzir em pequena escala (minhoca californiana, húmus, larva de mosca-soldado, farinha de casca de ovo, mudas/plantas, esterco de codorna como adubo) e quer emitir nota fiscal ao vender (ex.: planta para a Bahia). Fica de FORA: conserva de ovo de codorna e qualquer alimento humano (Vigilância). Lista final de jardinagem:
  - varejo: 4789-0/02 (plantas, flores, mudas, sementes, vasos, adubos), 4789-0/04 (animais vivos/alimento p/ animais — minhoca e larva), 4744-0/01 (ferramentas), 4683-4/00 (atacado de adubos);
  - produção pequena (para a nota sair certa do que ele mesmo cria): 0122-9/00 (cultivo de flores e plantas ornamentais), 0159-8/99 (criação de outros animais — minhocultura e larva; conferir no REGIN), 2013-4/02 (adubo orgânico — conferir; se a prefeitura barrar, tirar só esta).
  - Nota fiscal: com inscrição estadual + 4789-0/02 ele emite NF-e de planta para qualquer estado. Avisar: algumas plantas/mudas para outro estado pedem permissão de trânsito vegetal (PTV) da Defesa Agropecuária; plantas ornamentais comuns em vaso normalmente passam.
  - Shopee proíbe animais vivos (minhoca viva provavelmente barrada); Mercado Livre o dono diz que aceita. Vender minhoca/larva viva pela loja própria/ML; na Shopee só húmus, adubo, farinha, plantas, vasos, sementes.

**05/11 10h55 — NOVA PROPOSTA (decidir no domingo):** a loja da Shopee que já tem estrelas é da **Super Misto**. A Shopee não costuma deixar trocar o CNPJ de uma loja, então para aproveitar a reputação o caminho é: **alteração na SUPER MISTO** (acrescentar os CNAEs de "vender de tudo" + jardinagem; manter tempero; nome da empresa pode ficar, e o nome de exibição da loja na Shopee se troca no próprio app) e **a Trans Antunes fica com a LeuName (software/sites)** — ou fecha depois. Ponto decisivo: Super Misto é lucro presumido; para revenda, o Simples (Anexo I, ~4%) é bem mais barato que o presumido (ICMS cheio + PIS/Cofins). Para entrar no Simples em jan/2027 precisa **parcelar as dívidas da Super Misto até 31/01/2027**. Perguntar ao dono: valor das dívidas da Super Misto e se topa parcelar. O dono acha que loja de variedades vende mais na Shopee (busca da Shopee é por produto, então variedade funciona; reputação da loja ajuda).
- **10h56 — DECISÃO do dono: fazer a alteração na SUPER MISTO (CNPJ 13.580.397/0001-80, Estrada de Xerém 484):** só ACRESCENTAR CNAEs (vender de tudo: 4713-0/02, 4713-0/04, 4789-0/99, 4693-1/00, vestuário, cosméticos, eletrônicos, informática, utilidades, brinquedos, esporte, pet 4789-0/04; jardinagem: 4789-0/02, 4744-0/01, 4683-4/00, 0122-9/00, 0159-8/99; software 6203-1/00 e design 7410-2/99) e trocar o NOME FANTASIA. MANTER o tempero (não tirar nada que já existe, para não mexer em licenças). Nome empresarial fica. Viabilidade REGIN: eventos "Atividade Econômica" (e nome fantasia vai no DBE da Receita). Endereço não muda. A Trans Antunes fica parada até decidir (LeuName software ou baixa). Lembrar: entrar no Simples em jan/2027 exige dívidas parceladas até 31/01.
- **11h01 — DECISÃO FINAL DO DIA: fica a TRANS ANTUNES** (Simples, sem contador). Super Misto fica como está por enquanto. Fazer a alteração da Trans Antunes (nome a escolher, endereço 484, atividades: software + vender de tudo + jardinagem/produção pequena, sem alimentos) e abrir loja NOVA na Shopee com o CNPJ da Trans Antunes (pode abrir já; a nota fiscal de produto vem depois da inscrição estadual). Parcelar dívidas da Trans Antunes no Regularize para não ser excluída do Simples.
