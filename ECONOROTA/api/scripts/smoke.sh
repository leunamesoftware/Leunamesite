#!/usr/bin/env bash
# Teste da API. Requer o servidor local com DEV_MODE=true.  Uso: API=http://localhost:8787 bash scripts/smoke.sh
set -euo pipefail
API="${API:-http://localhost:8787}"
S=$(date +%s)
EMAIL="teste$S@econorota.dev"; PHONE="(11) 9$(printf '%08d' $((S % 100000000)))"
J='Content-Type: application/json'
ok() { echo "✔ $1"; }
fail() { echo "✘ $1"; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
post() { curl -s -X POST "$API$1" -H "$J" ${3:+-H "Authorization: Bearer $3"} -d "$2"; }
field() { sed -n "s/.*\"$1\":\"\\{0,1\\}\\([^\",}]*\\).*/\\1/p"; }

[ "$(code "$API/health")" = 200 ] && ok health || fail health
curl -s "$API/auth/config" | grep -q '"channels"' && ok "config pública" || fail config

[ "$(code -X POST "$API/auth/register" -H "$J" -d "{\"name\":\"Cliente Teste\",\"email\":\"$EMAIL\",\"password\":\"senha1234\",\"role\":\"cliente\"}")" = 400 ] \
  && ok "cadastro sem aceitar termos recusado" || fail termos

REG=$(post /auth/register "{\"name\":\"Cliente Teste\",\"email\":\"$EMAIL\",\"phone\":\"$PHONE\",\"password\":\"senha1234\",\"role\":\"cliente\",\"accept_terms\":true}")
TOKEN=$(echo "$REG" | field token)
[ -n "$TOKEN" ] && echo "$REG" | grep -q '"verified":false' && ok "cadastro (não verificado)" || fail "cadastro: $REG"

[ "$(code -X POST "$API/auth/register" -H "$J" -d "{\"name\":\"Outro Nome\",\"email\":\"x$EMAIL\",\"phone\":\"$PHONE\",\"password\":\"senha1234\",\"role\":\"cliente\",\"accept_terms\":true}")" = 409 ] \
  && ok "telefone duplicado bloqueado" || fail "telefone duplicado"
[ "$(code -X POST "$API/auth/register" -H "$J" -d '{"name":"Hacker X","email":"h@x.com","password":"senha1234","role":"admin","accept_terms":true}')" = 400 ] \
  && ok "cadastro de admin bloqueado" || fail admin

SENT=$(post /auth/verify/send '{"channel":"email"}' "$TOKEN")
DEV=$(echo "$SENT" | field dev_code)
echo "$SENT" | grep -q '"target":"te\*' && [ -n "$DEV" ] && ok "código enviado (destino mascarado)" || fail "verify/send: $SENT"
[ "$(code -X POST "$API/auth/verify/send" -H "$J" -H "Authorization: Bearer $TOKEN" -d '{}')" = 429 ] && ok "reenvio antes de 60s bloqueado" || fail reenvio
[ "$(code -X POST "$API/auth/verify/confirm" -H "$J" -H "Authorization: Bearer $TOKEN" -d '{"code":"000000"}')" = 400 ] && ok "código errado recusado" || fail "codigo errado"
post /auth/verify/confirm "{\"code\":\"$DEV\"}" "$TOKEN" | grep -q '"verified":true' && ok "conta verificada" || fail verificar

[ "$(code -X POST "$API/auth/login" -H "$J" -d "{\"login\":\"$EMAIL\",\"password\":\"errada123\"}")" = 401 ] && ok "senha errada recusada" || fail "senha errada"
post /auth/login "{\"login\":\"$PHONE\",\"password\":\"senha1234\"}" | grep -q token && ok "login por telefone" || fail "login telefone"
TOKEN=$(post /auth/login "{\"login\":\"$EMAIL\",\"password\":\"senha1234\"}" | field token)
[ -n "$TOKEN" ] && ok "login por e-mail" || fail login

# Fase 6: confirmação do pedido (servidor recalcula preços e total).
ITEMS='[{"key":"arroz tipo 1|5kg","qty":2},{"key":"feijao carioca|1kg","qty":2},{"key":"oleo de soja|900ml","qty":2},{"key":"leite integral|1l","qty":6},{"key":"cafe torrado|500g","qty":1},{"key":"tomate|1kg","qty":1}]'
ADDR='{"street":"Av. Paulista","number":"1000","district":"Bela Vista","city":"São Paulo","state":"SP","zip":"01310-100","lat":-23.5575,"lng":-46.6560}'
PLAN=$(curl -s -X POST "$API/compare" -H "$J" -d "{\"lat\":-23.5575,\"lng\":-46.6560,\"items\":$ITEMS}" | jq -c '.plans[0]')
MIDS=$(echo "$PLAN" | jq -c .market_ids); TOT=$(echo "$PLAN" | jq .total_cents)
ORDER="{\"items\":$ITEMS,\"market_ids\":$MIDS,\"expected_total_cents\":$TOT,\"payment_method\":\"pix\",\"address\":$ADDR}"
[ "$(code -X POST "$API/me/orders" -H "$J" -d "$ORDER")" = 401 ] && ok "pedido exige login" || fail "pedido sem login"
[ "$(code -X POST "$API/me/orders" -H "$J" -H "Authorization: Bearer $TOKEN" -d "$(echo "$ORDER" | jq -c ".expected_total_cents=$((TOT-100))")")" = 409 ] \
  && ok "total adulterado/desatualizado recusado" || fail "total adulterado"
[ "$(code -X POST "$API/me/orders" -H "$J" -H "Authorization: Bearer $TOKEN" -d "$(echo "$ORDER" | jq -c '.payment_method="boleto"')")" = 400 ] \
  && ok "forma de pagamento inválida recusada" || fail "pagamento invalido"
SMALL=$(curl -s -X POST "$API/compare" -H "$J" -d '{"lat":-23.5575,"lng":-46.6560,"items":[{"key":"tomate|1kg","qty":1}]}' | jq -c '.plans[0]')
[ "$(code -X POST "$API/me/orders" -H "$J" -H "Authorization: Bearer $TOKEN" -d "{\"items\":[{\"key\":\"tomate|1kg\",\"qty\":1}],\"market_ids\":$(echo "$SMALL" | jq -c .market_ids),\"expected_total_cents\":$(echo "$SMALL" | jq .total_cents),\"payment_method\":\"pix\",\"address\":$ADDR}")" = 400 ] \
  && ok "pedido abaixo de R$ 100 recusado" || fail "minimo pedido"
NEW=$(post /me/orders "$ORDER" "$TOKEN")
echo "$NEW" | jq -e ".order.total_cents==$TOT and .order.status==\"aguardando_pagamento\"" >/dev/null && ok "pedido criado com total do servidor" || fail "pedido: $NEW"
curl -s "$API/me/orders" -H "Authorization: Bearer $TOKEN" | jq -e ".items[0].id==$(echo "$NEW" | jq .order.id) and .items[0].item_count==14" >/dev/null \
  && ok "pedido aparece no histórico" || fail "historico pedido"

# Fase 7: pagamento (simulador local; em produção é o Asaas).
OID=$(echo "$NEW" | jq -r .order.id); AUTH="Authorization: Bearer $TOKEN"
curl -s "$API/me/orders/$OID" -H "$AUTH" | jq -e '.order.status=="aguardando_pagamento" and (.order.markets|length)>=1 and (.order.markets[0].items|length)>=1' >/dev/null \
  && ok "detalhe do pedido" || fail "detalhe pedido"
[ "$(code -X POST "$API/me/orders/$OID/pay" -H "$J" -H "$AUTH" -d '{"method":"pix","cpf":"111.111.111-11"}')" = 400 ] && ok "CPF inválido recusado" || fail "cpf invalido"
PAY=$(post "/me/orders/$OID/pay" '{"method":"pix","cpf":"529.982.247-25"}' "$TOKEN")
echo "$PAY" | jq -e '.payment.status=="pendente" and (.payment.pix.payload|length)>10 and .cpf=="***.982.247-**"' >/dev/null && ok "Pix gerado (CPF mascarado)" || fail "pix: $PAY"
PAY2=$(post "/me/orders/$OID/pay" '{"method":"pix"}' "$TOKEN")
[ "$(echo "$PAY" | jq -r .payment.id)" = "$(echo "$PAY2" | jq -r .payment.id)" ] && ok "sem cobrança duplicada" || fail "duplicada"
post "/me/orders/$OID/pay/simulate" '{"result":"aprovado"}' "$TOKEN" >/dev/null
curl -s "$API/me/orders/$OID/payment" -H "$AUTH" | jq -e '.order_status=="pago" and .payment.status=="aprovado"' >/dev/null && ok "pagamento aprovado → pedido pago" || fail aprovado
[ "$(code -X POST "$API/me/orders/$OID/pay" -H "$J" -H "$AUTH" -d '{"method":"pix"}')" = 409 ] && ok "pedido pago não gera nova cobrança" || fail "repagar"
post "/me/orders/$OID/cancel" '{}' "$TOKEN" | jq -e '.refunded==true' >/dev/null && ok "cancelamento com estorno" || fail estorno
curl -s "$API/me/orders/$OID/payment" -H "$AUTH" | jq -e '.order_status=="cancelado" and .payment.status=="estornado"' >/dev/null && ok "pedido cancelado e estornado" || fail "estornado"
OID2=$(post /me/orders "$ORDER" "$TOKEN" | jq -r .order.id)
post "/me/orders/$OID2/pay" '{"method":"cartao"}' "$TOKEN" | jq -e '.payment.invoice_url|startswith("https://")' >/dev/null && ok "cartão na página segura do provedor" || fail cartao
post "/me/orders/$OID2/pay/simulate" '{"result":"recusado"}' "$TOKEN" >/dev/null
curl -s "$API/me/orders/$OID2/payment" -H "$AUTH" | jq -e '.order_status=="aguardando_pagamento" and .payment.status=="recusado"' >/dev/null && ok "cartão recusado (pode tentar de novo)" || fail recusado
post "/me/orders/$OID2/cancel" '{}' "$TOKEN" | jq -e '.order_status=="cancelado" and .refunded==false' >/dev/null && ok "cancelamento antes de pagar" || fail "cancelar"
[ "$(code -X POST "$API/webhooks/asaas" -H "$J" -d '{"event":"PAYMENT_RECEIVED","payment":{"id":"x"}}')" = 401 ] && ok "webhook sem token recusado" || fail webhook

# Fase 8: painel do supermercado (dono do SuperMais, seed de desenvolvimento).
MT=$(post /auth/login '{"login":"m1@demo.local","password":"demo1234"}' | field token); MA="Authorization: Bearer $MT"
[ -n "$MT" ] && ok "login do mercado" || fail "login mercado"
[ "$(code "$API/painel/resumo" -H "$AUTH")" = 403 ] && ok "cliente não acessa o painel" || fail "painel cliente"
curl -s "$API/painel/resumo" -H "$MA" | jq -e '.market.id=="m1" and .kpis.low_stock>=1' >/dev/null && ok "dashboard do mercado" || fail dashboard
curl -s "$API/painel/categorias" -H "$MA" | jq -e '(.items|map(select(.products>0))|length)>=3' >/dev/null && ok "categorias com contagem" || fail categorias
NP=$(curl -s -X POST "$API/painel/produtos" -H "$J" -H "$MA" -d '{"name":"Açúcar Cristal","brand":"Teste","unit":"1 kg","category_id":"mercearia","price_cents":499,"stock":10,"min_stock":5,"expires_on":"2030-01-01"}')
PID=$(echo "$NP" | jq -r .product.id)
echo "$NP" | jq -e '.product.stock==10 and .product.price_cents==499' >/dev/null && ok "cadastro de produto" || fail "produto: $NP"
[ "$(code -X POST "$API/painel/produtos" -H "$J" -H "$MA" -d '{"name":"X","unit":"1 kg","category_id":"mercearia","price_cents":499}')" = 400 ] && ok "cadastro inválido recusado" || fail "produto invalido"
curl -s -X PATCH "$API/painel/produtos/$PID" -H "$J" -H "$MA" -d '{"price_cents":459,"promo_price_cents":399}' | jq -e '.product.price_cents==459 and .product.promo_price_cents==399' >/dev/null && ok "alterar preço e promoção" || fail preco
[ "$(code -X PATCH "$API/painel/produtos/$PID" -H "$J" -H "$MA" -d '{"promo_price_cents":999}')" = 400 ] && ok "promoção maior que o preço recusada" || fail promo
curl -s -X POST "$API/painel/produtos/$PID/estoque" -H "$J" -H "$MA" -d '{"tipo":"entrada","quantidade":5,"motivo":"Nota 123"}' | jq -e '.stock==15' >/dev/null && ok "entrada de estoque" || fail entrada
curl -s -X POST "$API/painel/produtos/$PID/estoque" -H "$J" -H "$MA" -d '{"tipo":"saida","quantidade":3,"motivo":"Avaria"}' | jq -e '.stock==12' >/dev/null && ok "saída de estoque" || fail saida
[ "$(code -X POST "$API/painel/produtos/$PID/estoque" -H "$J" -H "$MA" -d '{"tipo":"saida","quantidade":99}')" = 400 ] && ok "saída maior que o estoque recusada" || fail "saida negativa"
curl -s "$API/painel/estoque/movimentos?produto=$PID" -H "$MA" | jq -e '(.items|map(.type))==["saida","entrada","entrada"]' >/dev/null && ok "histórico de movimentos" || fail movimentos
curl -s -X POST "$API/painel/produtos/$PID/estoque" -H "$J" -H "$MA" -d '{"tipo":"ajuste","quantidade":0}' >/dev/null
curl -s "$API/painel/produtos?filtro=indisponivel" -H "$MA" | jq -e "(.items|map(.id)|index(\"$PID\"))!=null" >/dev/null && ok "produto indisponível (estoque zero)" || fail indisponivel
[ "$(code -X PATCH "$API/painel/produtos/p2" -H "$J" -H "$MA" -d '{"price_cents":1}')" = 404 ] && ok "mercado não altera produto de outro mercado" || fail isolamento
# Cliente compra no SuperMais e paga → o mercado recebe, aceita, confere e marca pronto.
MI='[{"key":"alcatra bovina|1kg","qty":3}]'
curl -s -X POST "$API/painel/produtos/p5/estoque" -H "$J" -H "$MA" -d '{"tipo":"entrada","quantidade":3,"motivo":"Reposição (teste)"}' >/dev/null
MP=$(curl -s -X POST "$API/compare" -H "$J" -d "{\"lat\":-23.5575,\"lng\":-46.6560,\"market_ids\":[\"m1\"],\"items\":$MI}" | jq -c '.plans[0]')
MO=$(post /me/orders "{\"items\":$MI,\"market_ids\":[\"m1\"],\"expected_total_cents\":$(echo "$MP" | jq .total_cents),\"payment_method\":\"pix\",\"address\":$ADDR}" "$TOKEN" | jq -r .order.id)
post "/me/orders/$MO/pay" '{"method":"pix"}' "$TOKEN" >/dev/null; post "/me/orders/$MO/pay/simulate" '{"result":"aprovado"}' "$TOKEN" >/dev/null
OM=$(curl -s "$API/painel/pedidos?grupo=novos" -H "$MA" | jq -r "[.items[]|select(.order_id==\"$MO\")][0].id")
[ -n "$OM" ] && [ "$OM" != null ] && ok "recebimento do pedido pago" || fail "recebimento"
[ "$(code -X POST "$API/painel/pedidos/$OM/pronto" -H "$J" -H "$MA" -d '{}')" = 409 ] && ok "não pula etapas (pronto antes de conferir)" || fail "pular etapa"
curl -s -X POST "$API/painel/pedidos/$OM/aceitar" -H "$J" -H "$MA" -d '{}' | jq -e '.status=="em_separacao"' >/dev/null && ok "separação iniciada" || fail separacao
curl -s "$API/me/orders/$MO/payment" -H "$AUTH" | jq -e '.order_status=="em_separacao"' >/dev/null && ok "cliente vê o pedido em separação" || fail "status cliente"
[ "$(code -X POST "$API/me/orders/$MO/cancel" -H "$J" -H "$AUTH" -d '{}')" = 409 ] && ok "cliente não cancela pedido em separação" || fail "cancelar separacao"
ITEMS_OM=$(curl -s "$API/painel/pedidos/$OM" -H "$MA" | jq -c '[.order.items[]|{id, ok:true}]')
curl -s -X POST "$API/painel/pedidos/$OM/conferencia" -H "$J" -H "$MA" -d "{\"itens\":$ITEMS_OM}" | jq -e '.missing==0' >/dev/null && ok "conferência" || fail conferencia
curl -s -X POST "$API/painel/pedidos/$OM/pronto" -H "$J" -H "$MA" -d '{}' | jq -e '.status=="pronto"' >/dev/null && ok "pedido pronto" || fail pronto
curl -s "$API/me/orders/$MO/payment" -H "$AUTH" | jq -e '.order_status=="pronto_coleta"' >/dev/null && ok "pedido pronto para coleta" || fail coleta
curl -s "$API/painel/pedidos?grupo=historico" -H "$MA" | jq -e "(.items|map(.order_id)|index(\"$MO\"))!=null" >/dev/null && ok "histórico do mercado" || fail historico
curl -s "$API/painel/financeiro?dias=7" -H "$MA" | jq -e '.gross_cents>0 and .net_cents==(.gross_cents-.commission_cents)' >/dev/null && ok "financeiro (vendas, comissão, líquido)" || fail financeiro
curl -s -X PATCH "$API/painel/loja" -H "$J" -H "$MA" -d '{"is_open":true,"closes_at":"23:30"}' | jq -e '.market.closes_at=="23:30"' >/dev/null && ok "abrir/fechar e horário da loja" || fail loja

# Fase 9: entregador (cadastro → aprovação em DEV → disponível → aceita → retira → entrega com código).
# Repasse do mercado liberado na hora neste teste (padrão: 2 dias, prazo de reclamação de produto).
AT=$(post /auth/login '{"login":"admin@demo.local","password":"demo1234"}' | field token); AA="Authorization: Bearer $AT"
curl -s -X PUT "$API/admin/configuracoes" -H "$J" -H "$AA" -d '{"market_hold_days":0}' >/dev/null
CE="entregador$S@econorota.dev"
CT=$(post /auth/register "{\"name\":\"Carlos Entregador\",\"email\":\"$CE\",\"password\":\"senha1234\",\"role\":\"entregador\",\"accept_terms\":true}" | field token); CA="Authorization: Bearer $CT"
[ -n "$CT" ] && ok "cadastro do entregador" || fail "cadastro entregador"
[ "$(code "$API/entregador/perfil" -H "$AUTH")" = 403 ] && ok "cliente não acessa área do entregador" || fail "area entregador"
curl -s -X PUT "$API/entregador/perfil" -H "$J" -H "$CA" -d '{"cpf":"529.982.247-25","birth_date":"1995-04-10","pix_key":"carlos@pix.com","vehicle_type":"moto"}' | jq -e '(.courier.missing|index("vehicle_plate"))!=null' >/dev/null \
  && ok "moto exige placa e CNH" || fail "moto placa"
[ "$(code -X PUT "$API/entregador/perfil" -H "$J" -H "$CA" -d '{"birth_date":"2015-01-01"}')" = 400 ] && ok "menor de 18 recusado" || fail "idade"
curl -s -X PUT "$API/entregador/perfil" -H "$J" -H "$CA" -d '{"vehicle_plate":"ABC1D23","cnh_number":"12345678901","vehicle_model":"CG 160","vehicle_color":"Preta"}' >/dev/null
IMG=$(mktemp); printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9' > "$IMG"; TXT=$(mktemp); echo "nao sou imagem" > "$TXT"
[ "$(code -X PUT "$API/entregador/arquivos/documento" -H "$CA" -H 'Content-Type: image/jpeg' --data-binary @"$TXT")" = 400 ] && ok "arquivo que não é imagem recusado" || fail "nao imagem"
[ "$(code -X POST "$API/entregador/enviar" -H "$J" -H "$CA" -d '{}')" = 400 ] && ok "não envia sem as fotos" || fail "sem fotos"
curl -s -X PUT "$API/entregador/arquivos/documento" -H "$CA" -H 'Content-Type: image/jpeg' --data-binary @"$IMG" >/dev/null
curl -s -X PUT "$API/entregador/arquivos/crlv" -H "$CA" -H 'Content-Type: image/jpeg' --data-binary @"$IMG" >/dev/null
[ "$(code "$API/entregador/arquivos/crlv" -H "$CA")" = 200 ] && ok "CNH e documento do veículo (CRLV)" || fail documentos
curl -s -X POST "$API/entregador/enviar" -H "$J" -H "$CA" -d '{}' | jq -e '.courier.status=="aprovado" and (.courier.missing|length)==0' >/dev/null && ok "cadastro enviado e aprovado (DEV)" || fail aprovado
[ "$(code "$API/entregador/pedidos-disponiveis" -H "$CA")" = 200 ] && curl -s "$API/entregador/pedidos-disponiveis" -H "$CA" | jq -e '.reason=="offline"' >/dev/null && ok "indisponível não recebe pedidos" || fail offline
curl -s -X POST "$API/entregador/disponibilidade" -H "$J" -H "$CA" -d '{"online":true,"lat":-23.5540,"lng":-46.6580}' | jq -e '.is_online' >/dev/null && ok "disponível com localização" || fail online
curl -s "$API/entregador/pedidos-disponiveis" -H "$CA" | jq -e "(.items|map(.id)|index(\"$MO\"))!=null and (.items[0].earning_cents>0) and (.items[0]|has(\"customer_district\"))" >/dev/null \
  && ok "pedidos disponíveis na região (sem endereço completo)" || fail disponiveis
curl -s "$API/entregador/pedidos-disponiveis" -H "$CA" | jq -e "[.items[]|select(.id==\"$MO\")][0] | .weight_kg==3 and .cold_items==3" >/dev/null && ok "peso estimado e itens refrigerados do pedido" || fail "peso"
curl -s -X POST "$API/entregador/pedidos/$MO/aceitar" -H "$J" -H "$CA" -d '{}' | jq -e '.ok' >/dev/null && ok "aceitar entrega" || fail aceitar
[ "$(code -X POST "$API/entregador/pedidos/$MO/aceitar" -H "$J" -H "$CA" -d '{}')" = 409 ] && ok "não aceita duas vezes" || fail "aceitar 2x"
[ "$(code -X POST "$API/entregador/disponibilidade" -H "$J" -H "$CA" -d '{"online":false}')" = 409 ] && ok "não fica indisponível com entrega em andamento" || fail "offline ativo"
CUR=$(curl -s "$API/entregador/entrega-atual" -H "$CA"); STOP=$(echo "$CUR" | jq -r '.delivery.stops[0].id'); NIT=$(echo "$CUR" | jq '.delivery.stops[0].item_count')
echo "$CUR" | jq -e '.delivery.customer.address.street=="Av. Paulista" and (.delivery.stops|length)==1' >/dev/null && ok "entrega atual com rota e endereço" || fail "entrega atual"
curl -s -X POST "$API/entregador/localizacao" -H "$J" -H "$CA" -d '{"lat":-23.5545,"lng":-46.6581}' | jq -e '.ok' >/dev/null && ok "GPS atualizado" || fail gps
TR=$(curl -s "$API/me/orders/$MO/rastreio" -H "$AUTH")
echo "$TR" | jq -e '.tracking.courier.lat==-23.5545 and (.tracking.stops|length)==1 and .tracking.eta_min>0 and (.tracking.light|IN("verde","amarelo","vermelho")) and .tracking.total_km>0' >/dev/null \
  && ok "rastreio: entregador no mapa, rota, farol e previsão" || fail "rastreio: $TR"
[ "$(code "$API/me/orders/$MO/rastreio" -H "$CA")" = 404 ] && ok "rastreio só para o dono do pedido" || fail "rastreio dono"
curl -s -X POST "$API/entregador/pedidos/$MO/mercados/$STOP/chegada" -H "$J" -H "$CA" -d '{}' | jq -e '.market_ready==true' >/dev/null && ok "chegada ao mercado" || fail "chegada mercado"
[ "$(code -X POST "$API/entregador/pedidos/$MO/mercados/$STOP/retirada" -H "$J" -H "$CA" -d '{"itens_conferidos":1}')" = 400 ] && ok "conferência com quantidade errada recusada" || fail "conf errada"
curl -s -X POST "$API/entregador/pedidos/$MO/mercados/$STOP/retirada" -H "$J" -H "$CA" -d "{\"itens_conferidos\":$NIT}" | jq -e '.remaining_stops==0' >/dev/null && ok "retirada no mercado" || fail retirada
curl -s "$API/me/orders/$MO/payment" -H "$AUTH" | jq -e '.order_status=="em_rota"' >/dev/null && ok "cliente vê o pedido a caminho" || fail "a caminho"
curl -s -X POST "$API/entregador/pedidos/$MO/chegada-cliente" -H "$J" -H "$CA" -d '{}' | jq -e '.ok' >/dev/null && ok "chegada ao cliente" || fail "chegada cliente"
[ "$(code -X POST "$API/entregador/pedidos/$MO/entregar" -H "$J" -H "$CA" -d '{"codigo":"000000"}')" = 400 ] && ok "código de entrega errado recusado" || fail "codigo errado"
DCODE=$(curl -s "$API/me/orders/$MO" -H "$AUTH" | jq -r .order.delivery_code)
[ ${#DCODE} = 6 ] && ok "cliente tem o código de entrega (QR)" || fail "codigo cliente"
curl -s -X POST "$API/entregador/pedidos/$MO/entregar" -H "$J" -H "$CA" -d "{\"codigo\":\"$DCODE\"}" | jq -e '.earning_cents>0' >/dev/null && ok "entrega finalizada com o código" || fail entregar
curl -s "$API/me/orders/$MO" -H "$AUTH" | jq -e '.order.status=="entregue" and .order.delivery_code==null' >/dev/null && ok "pedido entregue (código deixa de aparecer)" || fail entregue
curl -s "$API/entregador/ganhos?dias=7" -H "$CA" | jq -e '.deliveries==1 and .earning_cents>0' >/dev/null && ok "ganhos do entregador" || fail ganhos
curl -s "$API/me/orders/$MO/rastreio" -H "$AUTH" | jq -e '.tracking.status=="entregue" and .tracking.eta_min==0 and .tracking.courier.lat==null' >/dev/null \
  && ok "rastreio encerrado após a entrega (posição some)" || fail "rastreio fim"

# Fase 11: ocorrências (cliente abre, com fotos; administração analisa e decide; falta na separação reembolsa sozinho).
ITEM=$(curl -s "$API/me/orders/$MO" -H "$AUTH" | jq -r '.order.markets[0].items[0].id // empty')
[ -n "$ITEM" ] && ok "detalhe do pedido traz os itens (para ocorrências)" || fail "itens detalhe"
[ "$(code -X POST "$API/me/orders/$MO/ocorrencias" -H "$J" -H "$AUTH" -d '{"tipo":"produto_errado"}')" = 400 ] && ok "ocorrência de produto exige os itens" || fail "occ itens"
OCC=$(post "/me/orders/$MO/ocorrencias" "{\"tipo\":\"produto_errado\",\"descricao\":\"Veio outra marca\",\"itens\":[{\"id\":\"$ITEM\",\"quantidade\":1}]}" "$TOKEN")
OCCID=$(echo "$OCC" | jq -r .occurrence.id)
echo "$OCC" | jq -e '.occurrence.status=="aberta" and .occurrence.requested_cents>0 and (.occurrence.items|length)==1' >/dev/null && ok "ocorrência: produto errado" || fail "occ: $OCC"
[ "$(code -X POST "$API/me/orders/$MO/ocorrencias" -H "$J" -H "$AUTH" -d "{\"tipo\":\"produto_errado\",\"itens\":[{\"id\":\"$ITEM\"}]}")" = 409 ] && ok "não duplica ocorrência em análise" || fail "occ dup"
[ "$(code -X POST "$API/me/orders/$MO/ocorrencias" -H "$J" -H "$AUTH" -d '{"tipo":"entrega_atrasada"}')" = 409 ] && ok "atraso só depois do prazo prometido" || fail "occ atraso"
[ "$(code -X PUT "$API/me/ocorrencias/$OCCID/evidencias" -H "$AUTH" -H 'Content-Type: image/jpeg' --data-binary @"$IMG")" = 201 ] && ok "evidência (foto) anexada" || fail evidencia
curl -s "$API/me/ocorrencias" -H "$AUTH" | jq -e ".items|map(.id)|index(\"$OCCID\")!=null" >/dev/null && ok "histórico de ocorrências do cliente" || fail "occ historico"
[ "$(code "$API/me/ocorrencias/$OCCID" -H "$CA")" = 404 ] && ok "ocorrência só para o dono" || fail "occ dono"
AT=$(post /auth/login '{"login":"admin@demo.local","password":"demo1234"}' | field token); AA="Authorization: Bearer $AT"
[ "$(code "$API/admin/ocorrencias" -H "$AUTH")" = 403 ] && ok "cliente não acessa a administração" || fail "admin cliente"
curl -s "$API/admin/ocorrencias?status=aberta" -H "$AA" | jq -e ".items|map(.id)|index(\"$OCCID\")!=null" >/dev/null && ok "fila de ocorrências (admin)" || fail "fila occ"
curl -s -X POST "$API/admin/ocorrencias/$OCCID/analisar" -H "$J" -H "$AA" -d '{}' | jq -e .ok >/dev/null && ok "análise administrativa" || fail analisar
DEC=$(curl -s -X POST "$API/admin/ocorrencias/$OCCID/decidir" -H "$J" -H "$AA" -d '{"resolucao":"reembolso_parcial","nota":"Produto trocado pelo mercado. Reembolso do item."}')
echo "$DEC" | jq -e '.occurrence.status=="resolvida" and .occurrence.refund_cents>0 and (.occurrence.events|map(.kind)|index("reembolso_parcial"))!=null' >/dev/null && ok "decisão com reembolso parcial" || fail "decidir: $DEC"
# Falta na separação → ocorrência automática com reembolso.
curl -s -X POST "$API/painel/produtos/p5/estoque" -H "$J" -H "$MA" -d '{"tipo":"entrada","quantidade":3}' >/dev/null
MO2=$(post /me/orders "{\"items\":$MI,\"market_ids\":[\"m1\"],\"expected_total_cents\":$(echo "$MP" | jq .total_cents),\"payment_method\":\"pix\",\"address\":$ADDR}" "$TOKEN" | jq -r .order.id)
post "/me/orders/$MO2/pay" '{"method":"pix"}' "$TOKEN" >/dev/null; post "/me/orders/$MO2/pay/simulate" '{"result":"aprovado"}' "$TOKEN" >/dev/null
OM2=$(curl -s "$API/painel/pedidos?grupo=novos" -H "$MA" | jq -r "[.items[]|select(.order_id==\"$MO2\")][0].id")
curl -s -X POST "$API/painel/pedidos/$OM2/aceitar" -H "$J" -H "$MA" -d '{}' >/dev/null
MISS=$(curl -s "$API/painel/pedidos/$OM2" -H "$MA" | jq -c '[.order.items[]|{id, ok:false}]')
curl -s -X POST "$API/painel/pedidos/$OM2/conferencia" -H "$J" -H "$MA" -d "{\"itens\":$MISS}" | jq -e '.missing==1 and .refunded_cents>0' >/dev/null && ok "falta na separação: reembolso automático" || fail "falta auto"
curl -s "$API/me/ocorrencias" -H "$AUTH" | jq -e "[.items[]|select(.order_id==\"$MO2\" and .auto==1 and .status==\"resolvida\")]|length==1" >/dev/null && ok "ocorrência automática no histórico do cliente" || fail "occ auto"
curl -s "$API/painel/ocorrencias" -H "$MA" | jq -e '(.items|length)>=1' >/dev/null && ok "mercado vê as ocorrências dele" || fail "occ mercado"
curl -s "$API/entregador/historico" -H "$CA" | jq -e ".items[0].id==\"$MO\"" >/dev/null && ok "histórico de entregas" || fail "historico entregas"

# Fase 12: avaliações (depois da entrega; cada participante avalia os outros uma vez).
[ "$(code "$API/avaliacoes/pedidos/$MO" -H "$MA")" = 200 ] || fail "avaliar mercado"
RV=$(curl -s "$API/avaliacoes/pedidos/$MO" -H "$AUTH")
echo "$RV" | jq -e '.open and (.targets|map(.type))==["mercado","entregador"] and (.targets[0].tags|length)>=3' >/dev/null && ok "cliente vê o que avaliar (mercado e entregador)" || fail "alvos: $RV"
CID=$(echo "$RV" | jq -r '.targets[1].id')
post /avaliacoes "{\"pedido\":\"$MO\",\"alvo_tipo\":\"mercado\",\"alvo_id\":\"m1\",\"estrelas\":5,\"tags\":[\"Bem embalado\"],\"comentario\":\"Tudo certo\"}" "$TOKEN" | jq -e .ok >/dev/null && ok "cliente avalia o mercado" || fail "avaliar mercado"
[ "$(code -X POST "$API/avaliacoes" -H "$J" -H "$AUTH" -d "{\"pedido\":\"$MO\",\"alvo_tipo\":\"mercado\",\"alvo_id\":\"m1\",\"estrelas\":4}")" = 409 ] && ok "não avalia duas vezes" || fail "avaliacao dup"
[ "$(code -X POST "$API/avaliacoes" -H "$J" -H "$AUTH" -d "{\"pedido\":\"$MO\",\"alvo_tipo\":\"entregador\",\"alvo_id\":\"$CID\",\"estrelas\":5,\"tags\":[\"Hackeado\"]}")" = 400 ] && ok "etiqueta inválida recusada" || fail "tag invalida"
[ "$(code -X POST "$API/avaliacoes" -H "$J" -H "$AUTH" -d "{\"pedido\":\"$MO\",\"alvo_tipo\":\"entregador\",\"alvo_id\":\"$CID\",\"estrelas\":9}")" = 400 ] && ok "estrelas fora de 1-5 recusadas" || fail "estrelas"
post /avaliacoes "{\"pedido\":\"$MO\",\"alvo_tipo\":\"entregador\",\"alvo_id\":\"$CID\",\"estrelas\":4,\"tags\":[\"Pontual\"]}" "$TOKEN" | jq -e .ok >/dev/null && ok "cliente avalia o entregador" || fail "avaliar entregador"
CUID=$(curl -s "$API/avaliacoes/pedidos/$MO" -H "$CA" | jq -r '.targets[0].id')
post /avaliacoes "{\"pedido\":\"$MO\",\"alvo_tipo\":\"cliente\",\"alvo_id\":\"$CUID\",\"estrelas\":5,\"tags\":[\"Educado\"]}" "$CT" | jq -e .ok >/dev/null && ok "entregador avalia o cliente" || fail "entregador avalia"
post /avaliacoes "{\"pedido\":\"$MO\",\"alvo_tipo\":\"entregador\",\"alvo_id\":\"$CID\",\"estrelas\":5}" "$MT" | jq -e .ok >/dev/null && ok "mercado avalia o entregador" || fail "mercado avalia"
curl -s "$API/avaliacoes/pedidos/$MO" -H "$AUTH" | jq -e '.targets|all(.done)' >/dev/null && ok "avaliações marcadas como feitas" || fail "done"
curl -s "$API/avaliacoes/minhas" -H "$AUTH" | jq -e '(.items|length)==2' >/dev/null && ok "minhas avaliações" || fail minhas
curl -s "$API/entregador/perfil" -H "$CA" | jq -e '.courier.rating==4.5 and .courier.rating_count==2' >/dev/null && ok "nota média do entregador" || fail "nota entregador: $(curl -s "$API/entregador/perfil" -H "$CA" | jq -c '.courier|{rating,rating_count}')"
OUTSIDER=$(post /auth/register "{\"name\":\"Pessoa Fora\",\"email\":\"f$EMAIL\",\"password\":\"senha1234\",\"role\":\"cliente\",\"accept_terms\":true}" | field token)
[ "$(code "$API/avaliacoes/pedidos/$MO" -H "Authorization: Bearer $OUTSIDER")" = 404 ] && ok "quem não participou não avalia" || fail "avaliar estranho"
[ "$(code -X POST "$API/avaliacoes" -H "$J" -H "$AUTH" -d "{\"pedido\":\"$MO2\",\"alvo_tipo\":\"mercado\",\"alvo_id\":\"m1\",\"estrelas\":5}")" = 409 ] && ok "só avalia depois da entrega" || fail "nao entregue"

# Fase 13: painel administrativo.
[ "$(code "$API/admin/resumo" -H "$MA")" = 403 ] && ok "mercado não acessa a administração" || fail "admin mercado"
curl -s "$API/admin/resumo" -H "$AA" | jq -e '.kpis.customers>=1 and .kpis.markets_active>=5 and (.by_day|type)=="array"' >/dev/null && ok "dashboard administrativo" || fail "admin resumo"
curl -s "$API/admin/configuracoes" -H "$AA" | jq -e '.settings.min_order_cents>0 and .limits.commission_pct.max==50' >/dev/null && ok "configurações atuais" || fail "config get"
[ "$(code -X PUT "$API/admin/configuracoes" -H "$J" -H "$AA" -d '{"commission_pct":90}')" = 400 ] && ok "configuração fora do limite recusada" || fail "config limite"
curl -s -X PUT "$API/admin/configuracoes" -H "$J" -H "$AA" -d '{"min_order_cents":12000}' | jq -e '.settings.min_order_cents==12000' >/dev/null && ok "pedido mínimo alterado pelo painel" || fail "config put"
curl -s -X POST "$API/compare" -H "$J" -d '{"items":[{"key":"tomate|1kg","qty":1}]}' | jq -e '.rules.min_order_cents==12000' >/dev/null && ok "nova regra vale na hora (sem deploy)" || fail "config aplicada"
curl -s -X PUT "$API/admin/configuracoes" -H "$J" -H "$AA" -d '{"min_order_cents":10000}' >/dev/null
curl -s -X POST "$API/admin/mercados/m9/status" -H "$J" -H "$AA" -d '{"status":"ativo"}' | jq -e '.status=="ativo"' >/dev/null && [ "$(code "$API/markets/m9")" = 200 ] && ok "mercado aprovado aparece para os clientes" || fail "aprovar mercado"
[ "$(code -X POST "$API/admin/mercados/m9/status" -H "$J" -H "$AA" -d '{"status":"suspenso"}')" = 400 ] && ok "suspensão exige motivo" || fail "suspender motivo"
curl -s -X POST "$API/admin/mercados/m9/status" -H "$J" -H "$AA" -d '{"status":"suspenso","motivo":"Documentação vencida"}' >/dev/null
[ "$(code "$API/markets/m9")" = 404 ] && curl -s "$API/admin/mercados?status=suspenso" -H "$AA" | jq -e '.items|map(.id)|index("m9")!=null' >/dev/null && ok "mercado suspenso sai das buscas" || fail "suspender"
CID13=$(curl -s "$API/admin/entregadores?status=aprovado" -H "$AA" | jq -r "[.items[]|select(.email==\"$CE\")][0].id")
curl -s "$API/admin/entregadores/$CID13" -H "$AA" | jq -e '.courier.has_document==1 and .courier.has_vehicle_doc==1 and .courier.cpf=="529.982.247-25" and .courier.deliveries>=1' >/dev/null && ok "ficha do entregador com documentos" || fail "ficha entregador"
[ "$(code "$API/admin/entregadores/$CID13/arquivos/crlv" -H "$AA")" = 200 ] && ok "administração vê a CNH/CRLV" || fail "doc admin"
[ "$(code -X POST "$API/admin/entregadores/$CID13/decidir" -H "$J" -H "$AA" -d '{"decisao":"bloquear"}')" = 400 ] && ok "bloqueio exige motivo" || fail "bloq motivo"
curl -s -X POST "$API/admin/entregadores/$CID13/decidir" -H "$J" -H "$AA" -d '{"decisao":"bloquear","nota":"Teste de bloqueio"}' >/dev/null
[ "$(code -X POST "$API/entregador/disponibilidade" -H "$J" -H "$CA" -d '{"online":true}')" = 403 ] && ok "entregador bloqueado não fica disponível" || fail "entregador bloqueado"
curl -s -X POST "$API/admin/entregadores/$CID13/decidir" -H "$J" -H "$AA" -d '{"decisao":"desbloquear"}' | jq -e .ok >/dev/null && ok "entregador desbloqueado" || fail desbloquear
curl -s "$API/admin/clientes?q=$EMAIL" -H "$AA" | jq -e "[.items[]|select(.email==\"$EMAIL\")][0].orders>=2" >/dev/null && ok "busca de clientes com histórico" || fail "clientes"
OUID=$(curl -s "$API/admin/clientes?q=f$EMAIL" -H "$AA" | jq -r '.items[0].id')
curl -s -X POST "$API/admin/usuarios-status/$OUID" -H "$J" -H "$AA" -d '{"status":"bloqueado","motivo":"Teste"}' >/dev/null
[ "$(code "$API/auth/me" -H "Authorization: Bearer $OUTSIDER")" = 401 ] && ok "bloqueio encerra a sessão do usuário" || fail "bloquear usuario"
curl -s -X POST "$API/admin/usuarios-status/$OUID" -H "$J" -H "$AA" -d '{"status":"ativo"}' | jq -e '.status=="ativo"' >/dev/null && ok "usuário desbloqueado" || fail "desbloquear usuario"
[ "$(code -X POST "$API/admin/usuarios-status/u-admin" -H "$J" -H "$AA" -d '{"status":"bloqueado"}')" = 400 ] && ok "admin não bloqueia a si mesmo" || fail "auto bloqueio"
curl -s "$API/admin/produtos?filtro=indisponivel" -H "$AA" | jq -e '(.items|length)>=1 and (.items|all(.stock==0))' >/dev/null && ok "produtos indisponíveis (todos os mercados)" || fail "produtos admin"
[ "$(code -X POST "$API/admin/produtos/$PID/ativo" -H "$J" -H "$AA" -d '{"ativo":false}')" = 400 ] && ok "tirar produto do ar exige motivo" || fail "produto motivo"
curl -s "$API/admin/pedidos?grupo=entregues" -H "$AA" | jq -e "(.items|map(.id)|index(\"$MO\"))!=null" >/dev/null && ok "pedidos por situação" || fail "pedidos admin"
curl -s "$API/admin/pedidos/$MO" -H "$AA" | jq -e '(.order.markets|length)==1 and (.order.payments|length)>=1 and (.order.occurrences|length)>=1' >/dev/null && ok "detalhe completo do pedido" || fail "pedido admin detalhe"
[ "$(code -X POST "$API/admin/pedidos/$MO/cancelar" -H "$J" -H "$AA" -d '{"motivo":"teste"}')" = 409 ] && ok "pedido entregue não é cancelado" || fail "cancelar entregue"
curl -s -X POST "$API/painel/produtos/p5/estoque" -H "$J" -H "$MA" -d '{"tipo":"entrada","quantidade":3}' >/dev/null
MO3=$(post /me/orders "{\"items\":$MI,\"market_ids\":[\"m1\"],\"expected_total_cents\":$(echo "$MP" | jq .total_cents),\"payment_method\":\"pix\",\"address\":$ADDR}" "$TOKEN" | jq -r .order.id)
post "/me/orders/$MO3/pay" '{"method":"pix"}' "$TOKEN" >/dev/null; post "/me/orders/$MO3/pay/simulate" '{"result":"aprovado"}' "$TOKEN" >/dev/null
curl -s -X POST "$API/admin/pedidos/$MO3/cancelar" -H "$J" -H "$AA" -d '{"motivo":"Mercado sem energia"}' | jq -e .ok >/dev/null && \
  curl -s "$API/me/orders/$MO3/payment" -H "$AUTH" | jq -e '.order_status=="cancelado" and .payment.status=="estornado"' >/dev/null && ok "cancelamento pela administração com estorno" || fail "cancelar admin"
curl -s "$API/admin/entregas" -H "$AA" | jq -e '.items|type=="array"' >/dev/null && ok "entregas em andamento" || fail entregas
curl -s "$API/admin/regioes" -H "$AA" | jq -e '[.items[]|select(.id=="r-sp-centro")][0].markets>=4' >/dev/null && ok "regiões com cobertura de mercados" || fail regioes
[ "$(code -X POST "$API/admin/regioes" -H "$J" -H "$AA" -d '{"name":"X","city":"Santos","state":"SP","lat":200,"lng":-46}')" = 400 ] && ok "região inválida recusada" || fail "regiao invalida"
RG=$(curl -s -X POST "$API/admin/regioes" -H "$J" -H "$AA" -d '{"name":"Gonzaga","city":"Santos","state":"sp","lat":-23.965,"lng":-46.333,"radius_km":5}' | jq -r .region.id)
curl -s -X PATCH "$API/admin/regioes/$RG" -H "$J" -H "$AA" -d '{"is_active":false}' | jq -e '.region.is_active==0 and .region.state=="SP"' >/dev/null && ok "cadastrar e pausar região" || fail "regiao crud"
RVID=$(curl -s "$API/admin/avaliacoes" -H "$AA" | jq -r "[.items[]|select(.order_id==\"$MO\" and .source==\"loja\")][0].id")
curl -s -X POST "$API/admin/avaliacoes/loja/$RVID/ocultar" -H "$J" -H "$AA" -d '{"oculta":true}' | jq -e .ok >/dev/null && \
  curl -s "$API/admin/avaliacoes?ocultas=1" -H "$AA" | jq -e "(.items|map(.id)|index(\"$RVID\"))!=null" >/dev/null && ok "moderação: avaliação ocultada" || fail "ocultar"
curl -s -X POST "$API/admin/avaliacoes/loja/$RVID/ocultar" -H "$J" -H "$AA" -d '{"oculta":false}' >/dev/null
curl -s "$API/admin/pagamentos?status=estornado" -H "$AA" | jq -e '(.items|length)>=1 and .totals_30d.received_cents>0' >/dev/null && ok "pagamentos e estornos" || fail pagamentos
curl -s "$API/admin/relatorios?dias=30" -H "$AA" | jq -e '.summary.orders>=1 and .summary.platform_revenue_cents>0 and (.by_market|length)>=1 and (.top_products|length)>=1 and .delivery.delivered>=1' >/dev/null && ok "relatórios (vendas, mercados, produtos, entregas)" || fail relatorios
FIN="fin$S@econorota.dev"
curl -s -X POST "$API/admin/equipe" -H "$J" -H "$AA" -d "{\"name\":\"Financeiro Teste\",\"email\":\"$FIN\",\"password\":\"senha1234\",\"permissoes\":[\"financeiro\"]}" | jq -e .id >/dev/null && ok "novo membro da equipe" || fail "equipe"
FT=$(post /auth/login "{\"login\":\"$FIN\",\"password\":\"senha1234\"}" | field token)
[ "$(code "$API/admin/relatorios" -H "Authorization: Bearer $FT")" = 200 ] && [ "$(code "$API/admin/clientes" -H "Authorization: Bearer $FT")" = 403 ] && [ "$(code "$API/admin/configuracoes" -H "Authorization: Bearer $FT")" = 403 ] \
  && ok "permissões por área (financeiro)" || fail "permissoes"
curl -s "$API/admin/eu" -H "Authorization: Bearer $FT" | jq -e '.perms==["financeiro"]' >/dev/null && ok "áreas liberadas do usuário" || fail "admin eu"
[ "$(code -X PATCH "$API/admin/equipe/u-admin" -H "$J" -H "$AA" -d '{"permissoes":["financeiro"]}')" = 400 ] && ok "não altera o próprio acesso" || fail "equipe proprio"
curl -s "$API/admin/auditoria?acao=settings" -H "$AA" | jq -e '(.items|length)>=1 and .items[0].data.min_order_cents.para!=null' >/dev/null && ok "auditoria de alterações" || fail auditoria
curl -s -X POST "$API/admin/pedidos/$MO2/cancelar" -H "$J" -H "$AA" -d '{"motivo":"Limpeza do teste"}' | jq -e .ok >/dev/null && ok "pedido em separação cancelado pela administração" || fail "cancelar MO2"


GHOST=$(post /auth/password/forgot '{"login":"ninguem@nada.com","channel":"email"}')
echo "$GHOST" | grep -q '"ok":true' && ! echo "$GHOST" | grep -q dev_code && ok "recuperação não revela contas inexistentes" || fail "forgot fantasma"
RESET=$(post /auth/password/forgot "{\"login\":\"$EMAIL\",\"channel\":\"email\"}" | field dev_code)
[ -n "$RESET" ] || fail "forgot"
post /auth/password/reset "{\"login\":\"$EMAIL\",\"code\":\"$RESET\",\"password\":\"novaSenha99\"}" | grep -q token && ok "senha redefinida" || fail reset
[ "$(code "$API/auth/me" -H "Authorization: Bearer $TOKEN")" = 401 ] && ok "sessões antigas encerradas após nova senha" || fail "sessao antiga"
TOKEN=$(post /auth/login "{\"login\":\"$EMAIL\",\"password\":\"novaSenha99\"}" | field token)
[ -n "$TOKEN" ] && ok "login com nova senha" || fail "login nova senha"

ADDR=$(post /me/addresses '{"street":"Rua das Flores","number":"123","district":"Centro","city":"São Paulo","state":"sp","zip":"01001-000"}' "$TOKEN")
AID=$(echo "$ADDR" | field id)
echo "$ADDR" | grep -q '"is_default":1' && ok "endereço salvo (padrão)" || fail "endereco: $ADDR"
OTHER=$(post /auth/register "{\"name\":\"Outra Pessoa\",\"email\":\"o$EMAIL\",\"password\":\"senha1234\",\"role\":\"cliente\",\"accept_terms\":true}" | field token)
[ "$(code -X DELETE "$API/me/addresses/$AID" -H "Authorization: Bearer $OTHER")" = 404 ] && ok "endereço de outro usuário protegido" || fail isolamento
curl -s "$API/me/addresses" -H "Authorization: Bearer $OTHER" | grep -q '"items":\[\]' && ok "lista só os próprios endereços" || fail lista
[ "$(code -X DELETE "$API/me/addresses/$AID" -H "Authorization: Bearer $TOKEN")" = 200 ] && ok "endereço removido pelo dono" || fail remover

[ "$(code "$API/auth/me" -H "Authorization: Bearer ${TOKEN}x")" = 401 ] && ok "token adulterado = 401" || fail adulterado
curl -s "$API/products?q=leite" | grep -q '"items"' && ok "busca de produtos" || fail produtos
MK=$(curl -s "$API/markets?lat=-23.5560&lng=-46.6580&sort=distance")
echo "$MK" | jq -e '.items | length >= 4 and (.[0].distance_km != null) and (.[0].distance_km <= .[1].distance_km or (.[0].is_open and (.[1].is_open|not)))' >/dev/null && ok "mercados por distância" || fail "mercados: $MK"
curl -s "$API/markets?lat=10&lng=10" | jq -e '.items == []' >/dev/null && ok "fora do raio de entrega: nenhum mercado" || fail raio
OF=$(curl -s "$API/products?on_sale=1&sort=discount&limit=3")
echo "$OF" | jq -e '(.items|length)==3 and (.next_offset==3) and (.items|all(.promo_price_cents < .price_cents)) and (.items[0].market_name != null)' >/dev/null && ok "ofertas com paginação" || fail "ofertas: $OF"
curl -s "$API/products?q=arroz&sort=price" | jq -e '[.items[] | (.promo_price_cents // .price_cents)] as $p | $p == ($p|sort)' >/dev/null && ok "ordenar por menor preço" || fail "ordem preço"
[ "$(code "$API/products?sort=hack")" = 400 ] && ok "ordenação inválida recusada" || fail "sort invalido"
curl -s "$API/products?q=%25" | jq -e '.items == []' >/dev/null && ok "curinga % tratado como texto" || fail curinga
curl -s "$API/search/suggest?q=arr" | jq -e '(.suggestions|index("arroz tipo 1")) != null and (.categories|length) >= 1' >/dev/null && ok "sugestões de busca" || fail sugestoes
[ "$(code "$API/me/orders")" = 401 ] && ok "pedidos exigem login" || fail "pedidos sem login"
curl -s "$API/me/orders?status=entregues" -H "Authorization: Bearer $TOKEN" | jq -e '(.items|length)>=1 and (.items|map(.status)|all(.=="entregue"))' >/dev/null && ok "filtro de pedidos entregues" || fail "filtro entregues"
[ "$(code "$API/me/orders?status=xpto" -H "Authorization: Bearer $TOKEN")" = 400 ] && ok "filtro de pedido inválido recusado" || fail "filtro"
curl -s "$API/markets/m1?lat=-23.5560&lng=-46.6580" | jq -e '.market.name=="SuperMais" and (.market.distance_km!=null) and (.categories|length)>=2 and (.categories[0].count>=1)' >/dev/null && ok "loja do mercado com categorias" || fail "loja"
[ "$(code "$API/markets/nao-existe")" = 404 ] && ok "mercado inexistente = 404" || fail "mercado 404"
curl -s "$API/markets/m1/reviews" | jq -e '.summary.count>=3 and .summary.average>=4.6 and .summary.by_star["5"]>=2 and (.items|all(.author|test("^[^ ]+( [A-Z][.])?$")))' >/dev/null && ok "avaliações com resumo e nome abreviado" || fail avaliacoes
curl -s "$API/products/p3" | jq -e '.product.name=="Arroz Tipo 1" and .product.description!=null and (.compare|map(.id)|index("p9"))!=null' >/dev/null && ok "detalhe do produto com comparação entre mercados" || fail "detalhe produto"
[ "$(code "$API/products/..%2F..")" != 200 ] && ok "id de produto malicioso recusado" || fail "id malicioso"
curl -s "$API/categories/hortifruti/subcategories?market_id=m1" | jq -e '(.items|map(.name)|index("Frutas"))!=null and (.items|map(.name)|index("Temperos"))!=null' >/dev/null && ok "subcategorias da loja" || fail subcategorias
curl -s "$API/products?category_id=hortifruti&market_id=m1&sub=Frutas" | jq -e '(.items|length)>=3 and (.items|all(.subcategory=="Frutas"))' >/dev/null && ok "filtro por subcategoria" || fail "filtro sub"
curl -s "$API/products/p1" | jq -e '.product.category_name=="Hortifrúti" and .product.subcategory=="Frutas"' >/dev/null && ok "caminho categoria > subcategoria no produto" || fail "breadcrumb"
curl -s "$API/markets/m1/reviews?stars=4" | jq -e '(.items|length)==1 and .items[0].rating==4 and .summary.count>=3' >/dev/null && ok "filtro de avaliações por estrelas" || fail "filtro estrelas"
curl -s "$API/catalog/items?category_id=mercearia" | jq -e '(.items|length)>=3 and (.items[0].markets>=2) and (.items[0].min_price_cents>0)' >/dev/null && ok "catálogo por produto (menor preço e nº de mercados)" || fail catalogo
CMP=$(curl -s -X POST "$API/compare" -H "$J" -d '{"lat":-23.5575,"lng":-46.6560,"items":[{"key":"banana prata|1kg","qty":2},{"key":"tomate|1kg","qty":1},{"key":"arroz tipo 1|5kg","qty":1},{"key":"feijao carioca|1kg","qty":1},{"key":"oleo de soja|900ml","qty":1},{"key":"leite integral|1l","qty":2},{"key":"batata inglesa|1kg","qty":1},{"key":"alface crespa|1un","qty":1},{"key":"cafe torrado|500g","qty":1},{"key":"cebola|1kg","qty":1}]}')
echo "$CMP" | jq -e '(.markets|length)>=3 and (.rows|length)==10 and (.plans[0].label=="cheapest") and (.plans[0].market_ids|length)<=3' >/dev/null && ok "comparação com plano mais barato" || fail "compare: $(echo $CMP | head -c 300)"
echo "$CMP" | jq -e '.plans[0] as $p | [$p.market_ids[] as $m | ($p.lines|map(select(.market_id==$m))|length)] | (length==1) or all(.>=5)' >/dev/null && ok "regra: mínimo 5 itens por mercado" || fail "regra 5 itens"
echo "$CMP" | jq -e '.plans[0].missing==[]' >/dev/null && ok "todos os itens encontrados (acentos normalizados)" || fail "missing: $(echo $CMP | jq -c .plans[0].missing)"
echo "$CMP" | jq -e '.rules.min_order_cents==10000' >/dev/null && ok "pedido mínimo de R$ 100 informado" || fail "min order"
echo "$CMP" | jq -e '.plans[0].total_cents == (.plans[0].items_cents + .plans[0].delivery_cents)' >/dev/null && ok "total = itens + entregas" || fail total
[ "$(code -X POST "$API/compare" -H "$J" -d '{"items":[{"key":"x|1","qty":0}]}')" = 400 ] && ok "item inválido recusado" || fail "item invalido"
echo "$CMP" | jq -e '.plans[0].route.order|length>=1' >/dev/null && echo "$CMP" | jq -e '.plans[0].route.total_km>0 and .plans[0].route.minutes>0' >/dev/null && ok "rota de entrega calculada" || fail rota
ONE=$(curl -s -X POST "$API/compare" -H "$J" -d '{"lat":-23.5575,"lng":-46.6560,"market_ids":["m4"],"items":[{"key":"tomate|1kg","qty":1},{"key":"arroz tipo 1|5kg","qty":1}]}')
echo "$ONE" | jq -e '(.markets|map(.id))==["m4"] and .plans[0].market_ids==["m4"]' >/dev/null && ok "cliente escolhe os mercados" || fail "escolha: $ONE"
[ "$(code -X POST "$API/compare" -H "$J" -d '{"market_ids":["m1","m2","m3","m4"],"items":[{"key":"tomate|1kg","qty":1}]}')" = 400 ] && ok "mais de 3 mercados recusado" || fail "4 mercados"
[ "$(code -X POST "$API/compare" -H "$J" -d '{"items":[]}')" = 400 ] && ok "lista vazia recusada" || fail "lista vazia"
LST=$(post /list/resolve '{"text":"Manteiga Qualy\nAçúcar\nÓleo de soja — 2\nÓleo de soja Camil\nDetergente xyz"}')
echo "$LST" | jq -e '(.items|length)==5 and .items[0].brand=="Qualy" and .items[0].brand_found and .items[0].options[0].key=="manteiga|200g"' >/dev/null && ok "lista inteligente: marca identificada" || fail "lista: $LST"
echo "$LST" | jq -e '.items[1].brand==null and (.items[1].options|map(.key)|index("acucar refinado|1kg"))!=null and .items[2].qty==2' >/dev/null && ok "lista inteligente: genérico e quantidade" || fail "lista generico"
echo "$LST" | jq -e '.items[3].brand_found==false and (.items[4].options|length)==0' >/dev/null && ok "lista inteligente: marca inexistente não é trocada" || fail "lista marca"
[ "$(code -X POST "$API/list/resolve" -H "$J" -d '{"text":""}')" = 400 ] && ok "lista vazia recusada (lista inteligente)" || fail "lista vazia li"
BR=$(curl -s -X POST "$API/compare" -H "$J" -d '{"items":[{"key":"manteiga|200g#qualy","qty":1},{"key":"manteiga|200g","qty":1}]}')
echo "$BR" | jq -e '.rows[0].name=="Manteiga Qualy" and (.rows[0].prices|has("m3")|not) and (.rows[1].prices|has("m3"))' >/dev/null && ok "comparação respeita a marca pedida" || fail "marca: $(echo $BR | head -c 300)"
# Fase 14: inteligência operacional.
echo "$CMP" | jq -e '.plans[0] as $p | .rules as $r | $p.delivery_cents == $r.delivery_base_cents + $r.delivery_extra_market_cents * (($p.market_ids|length) - 1)' >/dev/null && ok "entrega única: base + adicional por mercado extra" || fail "taxa unica"
echo "$CMP" | jq -e '.plans|all(.eta_max % 5 == 0 and .eta_max >= 20)' >/dev/null && ok "previsão de entrega (separação + rota + fila)" || fail "previsao"
curl -s "$API/markets?lat=-23.5560&lng=-46.6580" | jq -e --argjson b "$(echo "$CMP" | jq .rules.delivery_base_cents)" '.items|all(.delivery_fee_cents==$b)' >/dev/null && ok "mesma taxa de entrega em todos os mercados" || fail "taxa mercados"
curl -s -X PUT "$API/admin/configuracoes" -H "$J" -H "$AA" -d '{"delivery_base_cents":990}' >/dev/null
curl -s -X POST "$API/compare" -H "$J" -d '{"lat":-23.5575,"lng":-46.6560,"market_ids":["m1"],"items":[{"key":"alcatra bovina|1kg","qty":1}]}' | jq -e '.plans[0].delivery_cents==990' >/dev/null && ok "taxa de entrega configurável no painel" || fail "taxa config"
curl -s -X PUT "$API/admin/configuracoes" -H "$J" -H "$AA" -d '{"delivery_base_cents":790}' >/dev/null
curl -s "$API/painel/pedidos/$OM" -H "$MA" | jq -e '.order.items|all(has("cold"))' >/dev/null && ok "separação: refrigerados marcados (por último)" || fail "cold separacao"

# Fase 15: financeiro (livro-razão, extratos e repasses).
[ "$(code -X PATCH "$API/painel/loja" -H "$J" -H "$MA" -d '{"pix_key":"x"}')" = 400 ] && ok "chave Pix inválida recusada" || fail "pix invalido"
curl -s -X PATCH "$API/painel/loja" -H "$J" -H "$MA" -d '{"pix_key":"financeiro@supermais.com.br"}' | jq -e '.market.pix_key=="financeiro@supermais.com.br"' >/dev/null && ok "mercado cadastra a chave Pix" || fail "pix mercado"
EX=$(curl -s "$API/painel/extrato" -H "$MA")
echo "$EX" | jq -e "[.entries[]|select(.order_id==\"$MO\")|.kind]|sort==[\"comissao\",\"reembolso\",\"venda\"]" >/dev/null && ok "extrato do mercado: venda, comissão e reembolso do produto errado" || fail "extrato mercado: $(echo "$EX" | jq -c "[.entries[]|select(.order_id==\"$MO\")]")"
echo "$EX" | jq -e --arg o "$MO" '[.entries[]|select(.order_id==$o)] as $e | ($e|map(select(.kind=="comissao"))[0].amount_cents) == -((($e|map(select(.kind=="venda"))[0].amount_cents) * 10 / 100)|round)' >/dev/null && ok "comissão de 10% sobre os produtos entregues" || fail "comissao"
curl -s "$API/entregador/extrato" -H "$CA" | jq -e '.balance.available_cents>0 and (.entries[0].kind=="entrega")' >/dev/null && ok "extrato do entregador (liberado na hora)" || fail "extrato entregador"
curl -s "$API/admin/financeiro?dias=30" -H "$AA" | jq -e '.platform.commission_cents>0 and .platform.delivery_cents>0 and .couriers.available_cents>0' >/dev/null && ok "financeiro da plataforma (comissão, entrega, a repassar)" || fail "financeiro admin"
[ "$(code "$API/admin/financeiro" -H "Authorization: Bearer $FT")" = 200 ] && [ "$(code "$API/painel/extrato" -H "$CA")" = 403 ] && ok "acesso ao financeiro por perfil" || fail "acesso financeiro"
GEN=$(curl -s -X POST "$API/admin/repasses/gerar" -H "$J" -H "$AA" -d '{}')
echo "$GEN" | jq -e '.created>=2 and .total_cents>0' >/dev/null && ok "repasses gerados (mercados e entregadores)" || fail "gerar: $GEN"
curl -s -X PUT "$API/admin/configuracoes" -H "$J" -H "$AA" -d '{"market_hold_days":2}' >/dev/null
curl -s -X POST "$API/admin/repasses/gerar" -H "$J" -H "$AA" -d '{}' | jq -e '.created==0' >/dev/null && ok "não repassa duas vezes o mesmo valor" || fail "repasse duplo"
PAY=$(curl -s "$API/admin/repasses?status=pendente" -H "$AA" | jq -r '[.items[]|select(.party_id=="m1")][0]')
PID1=$(echo "$PAY" | jq -r .id)
echo "$PAY" | jq -e '.pix_key=="financeiro@supermais.com.br" and .amount_cents>0' >/dev/null && ok "repasse com a chave Pix do mercado" || fail "repasse pix"
[ "$(code -X POST "$API/admin/repasses/$PID1/pagar" -H "$J" -H "$AA" -d '{}')" = 400 ] && ok "confirmar repasse exige referência" || fail "ref"
curl -s -X POST "$API/admin/repasses/$PID1/pagar" -H "$J" -H "$AA" -d '{"referencia":"PIX E2E123456"}' | jq -e .ok >/dev/null && \
  curl -s "$API/painel/extrato" -H "$MA" | jq -e "[.payouts[]|select(.id==\"$PID1\")][0].status==\"pago\" and .balance.available_cents==0" >/dev/null && ok "repasse pago aparece no extrato do mercado" || fail "repasse pago"
CPID=$(curl -s "$API/admin/repasses?status=pendente" -H "$AA" | jq -r "[.items[]|select(.party_id==\"$CID13\")][0].id")
curl -s -X POST "$API/admin/repasses/$CPID/cancelar" -H "$J" -H "$AA" -d '{}' | jq -e .ok >/dev/null && \
  curl -s "$API/entregador/extrato" -H "$CA" | jq -e '.balance.available_cents>0' >/dev/null && ok "repasse cancelado volta para o saldo" || fail "cancelar repasse"
curl -s "$API/admin/extrato/plataforma/x" -H "$AA" | jq -e '(.entries|length)>=1' >/dev/null && ok "extrato da plataforma" || fail "extrato plataforma"

# Fase 16: notificações.
NT=$(curl -s "$API/me/notificacoes" -H "Authorization: Bearer $TOKEN")
echo "$NT" | jq -e '[.items[].kind] as $k | ($k|index("pedido_pago"))!=null and ($k|index("entregue"))!=null and ($k|index("em_rota"))!=null and ($k|index("ocorrencia"))!=null and .unread>0' >/dev/null && ok "cliente notificado (pago, a caminho, entregue, ocorrência)" || fail "notif cliente: $(echo "$NT" | jq -c '[.items[].kind]')"
echo "$NT" | jq -e '[.items[]|select(.kind=="entregue")][0].link|startswith("/avaliar/")' >/dev/null && ok "notificação de entrega leva à avaliação" || fail "link avaliar"
curl -s -X POST "$API/me/notificacoes/lidas" -H "$J" -H "Authorization: Bearer $TOKEN" -d '{}' >/dev/null
curl -s "$API/me/notificacoes/nao-lidas" -H "Authorization: Bearer $TOKEN" | jq -e '.unread==0' >/dev/null && ok "marcar todas como lidas" || fail "lidas"
curl -s "$API/me/notificacoes" -H "$MA" | jq -e '[.items[].kind]|index("novo_pedido")!=null' >/dev/null && ok "mercado recebe aviso de novo pedido" || fail "notif mercado"
curl -s "$API/me/notificacoes" -H "$AA" | jq -e '[.items[].kind]|index("ocorrencia")!=null' >/dev/null && ok "administração recebe aviso de ocorrência" || fail "notif admin"
curl -s "$API/me/notificacoes" -H "$CA" | jq -e '[.items[].kind]|index("cadastro")!=null' >/dev/null && ok "entregador avisado sobre o cadastro" || fail "notif entregador"
[ "$(code -X POST "$API/me/dispositivos" -H "$J" -H "Authorization: Bearer $TOKEN" -d '{"token":"x","platform":"android"}')" = 400 ] && ok "token de push inválido recusado" || fail "push invalido"
[ "$(code -X POST "$API/me/dispositivos" -H "$J" -H "Authorization: Bearer $TOKEN" -d "{\"token\":\"fcm-teste-$S-abcdefghijklmnop\",\"platform\":\"android\"}")" = 201 ] && ok "dispositivo registrado para push" || fail "push"
[ "$(code "$API/me/notificacoes")" = 401 ] && ok "notificações exigem login" || fail "notif login"

# Fase 17: segurança e LGPD.
DBQ() { (cd "$(dirname "$0")/.." && npx wrangler d1 execute econorota --local --json --command "$1" 2>/dev/null) | jq -r '.[0].results[0] | to_entries[0].value'; }
if grep -q '^DATA_KEY=' "$(dirname "$0")/../.dev.vars" 2>/dev/null; then
  CPF_RAW=$(DBQ "SELECT cpf FROM couriers WHERE id = '$CID13'")
  [[ "$CPF_RAW" == enc:v1:* ]] && ok "CPF do entregador cifrado no banco (AES-GCM)" || fail "cpf em texto: $CPF_RAW"
  PIX_RAW=$(DBQ "SELECT pix_key FROM markets WHERE id = 'm1'")
  [[ "$PIX_RAW" == enc:v1:* ]] && ok "chave Pix do mercado cifrada no banco" || fail "pix em texto"
fi
curl -s "$API/entregador/perfil" -H "$CA" | jq -e '.courier.pix_key=="carlos@pix.com" and .courier.cnh_number=="12345678901"' >/dev/null && ok "dados cifrados voltam legíveis para o dono" || fail "decifrar"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/auth/login" -H "$J" --data-binary @<(head -c 7000000 /dev/zero | tr '\0' 'a'))" = 413 ] && ok "requisição grande demais recusada (413)" || fail "413"
curl -s -D - -o /dev/null "$API/auth/me" -H "Authorization: Bearer $TOKEN" | grep -qi '^cache-control: no-store' && ok "dados da conta sem cache (no-store)" || fail "no-store"
curl -s -D - -o /dev/null "$API/health" | grep -qi '^x-content-type-options: nosniff' && ok "cabeçalhos de segurança" || fail "headers"
DADOS=$(curl -s "$API/me/dados" -H "Authorization: Bearer $TOKEN")
echo "$DADOS" | jq -e --arg e "$EMAIL" '.conta.email==$e and (.pedidos|length)>=2 and (.pedidos[0].items|length)>=1 and (.enderecos|type)=="array"' >/dev/null && ok "LGPD: exportar meus dados" || fail "export: $(echo "$DADOS" | head -c 200)"
[ "$(code -X POST "$API/me/conta/excluir" -H "$J" -H "$CA" -d '{"password":"senha1234"}')" = 409 ] && ok "entregador com saldo a receber não exclui a conta" || fail "excluir com saldo"
[ "$(code -X POST "$API/me/conta/excluir" -H "$J" -H "$MA" -d '{"password":"demo1234"}')" = 403 ] && ok "mercado exclui a conta pelo suporte" || fail "excluir mercado"
OUTSIDER=$(post /auth/login "{\"login\":\"f$EMAIL\",\"password\":\"senha1234\"}" | field token) # sessão nova (o bloqueio de teste encerrou a anterior)
[ "$(code -X POST "$API/me/conta/excluir" -H "$J" -H "Authorization: Bearer $OUTSIDER" -d '{"password":"errada00"}')" = 400 ] && ok "exclusão exige a senha" || fail "excluir senha"
curl -s -X POST "$API/me/conta/excluir" -H "$J" -H "Authorization: Bearer $OUTSIDER" -d '{"password":"senha1234"}' | jq -e .ok >/dev/null && \
  [ "$(code -X POST "$API/auth/login" -H "$J" -d "{\"login\":\"f$EMAIL\",\"password\":\"senha1234\"}")" = 401 ] && \
  [ "$(code "$API/auth/me" -H "Authorization: Bearer $OUTSIDER")" = 401 ] && ok "LGPD: conta excluída (dados apagados, sessão encerrada)" || fail "excluir conta"

# Fase 19: cadastro de mercado novo (dados da loja, aprovação) e versão do app.
MKE="mercado$S@econorota.dev"
NMT=$(post /auth/register "{\"name\":\"Dono Teste\",\"email\":\"$MKE\",\"password\":\"senha1234\",\"role\":\"mercado\",\"market_name\":\"Mercado Teste $S\",\"accept_terms\":true}" | field token); NMA="Authorization: Bearer $NMT"
NMID=$(curl -s "$API/painel/loja" -H "$NMA" | jq -r .market.id)
curl -s "$API/painel/loja" -H "$NMA" | jq -e '.market.status=="pendente" and (.market.missing|index("location"))!=null' >/dev/null && ok "mercado novo: pendente e com pendências de cadastro" || fail "mercado novo"
curl -s "$API/me/notificacoes" -H "$AA" | jq -e '[.items[].kind]|index("mercado_novo")!=null' >/dev/null && ok "administração avisada do mercado novo" || fail "aviso mercado novo"
[ "$(code -X POST "$API/admin/mercados/$NMID/status" -H "$J" -H "$AA" -d '{"status":"ativo"}')" = 409 ] && ok "não aprova mercado sem endereço" || fail "aprovar incompleto"
[ "$(code -X PATCH "$API/painel/loja" -H "$J" -H "$NMA" -d '{"document":"123"}')" = 400 ] && ok "CNPJ inválido recusado" || fail "cnpj"
curl -s -X PATCH "$API/painel/loja" -H "$J" -H "$NMA" -d '{"document":"12.345.678/0001-90","phone":"(11) 3333-4444","address":"Rua Augusta, 1200","district":"Consolação","city":"São Paulo","state":"sp","lat":-23.5535,"lng":-46.6575,"eta_min":20,"pix_key":"pix@mercadoteste.com"}' \
  | jq -e '.market.missing==[] and .market.state=="SP" and .market.eta_min==20' >/dev/null && ok "mercado completa os dados da loja" || fail "dados loja"
curl -s -X POST "$API/admin/mercados/$NMID/status" -H "$J" -H "$AA" -d '{"status":"ativo"}' | jq -e '.status=="ativo"' >/dev/null && [ "$(code "$API/markets/$NMID")" = 200 ] && ok "mercado aprovado entra nas buscas" || fail "aprovar mercado novo"
curl -s -X POST "$API/admin/mercados/$NMID/status" -H "$J" -H "$AA" -d '{"status":"suspenso","motivo":"Fim do teste"}' >/dev/null
curl -s "$API/app/versao" | jq -e '.min_version and .store_url' >/dev/null && ok "versão mínima do app" || fail "versao"

echo "Todos os testes passaram."
