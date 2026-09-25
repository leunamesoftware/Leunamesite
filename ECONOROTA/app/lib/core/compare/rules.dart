/// Regras do EconoRota exibidas no app (a API confirma os valores na comparação).
library;

/// Pedido mínimo da plataforma (MIN_ORDER_CENTS na API).
const platformMinOrderCents = 10000;

/// Entrega única (um entregador coleta em todos os mercados): base + adicional por mercado extra.
/// Padrões da API (ajustáveis no painel administrativo); a comparação devolve os valores em vigor.
const deliveryBaseCents = 790;
const deliveryExtraMarketCents = 300;

int deliveryFeeFor(int markets, {int base = deliveryBaseCents, int extra = deliveryExtraMarketCents}) =>
    base + extra * (markets > 1 ? markets - 1 : 0);

/// Pedido mínimo que o cliente vê num mercado: o maior entre o da plataforma e o do mercado.
int effectiveMinOrder(int marketMinCents) =>
    marketMinCents > platformMinOrderCents ? marketMinCents : platformMinOrderCents;

/// Estimativa de "ir você mesmo" (card Sem sair de casa). Valores conservadores e editáveis.
const tripCostPerKmCents = 100; // carro: combustível + desgaste, ~R$ 1,00/km
const shoppingMinutesPerMarket = 25; // procurar produtos, fila e caixa
