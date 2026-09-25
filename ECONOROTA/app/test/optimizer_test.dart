import 'package:econorota/core/compare/compare_key.dart';
import 'package:econorota/core/compare/optimizer.dart';
import 'package:econorota/core/compare/route.dart';
import 'package:econorota/core/compare/rules.dart';
import 'package:flutter_test/flutter_test.dart';

MarketOffers mk(String id, int fee, Map<String, int> prices, {int minOrder = 0}) => MarketOffers(
  id: id,
  deliveryFeeCents: fee,
  minOrderCents: minOrder,
  offers: {for (final e in prices.entries) e.key: Offer(productId: '$id-${e.key}', priceCents: e.value, stock: 10)},
);

/// Testes das regras do motor com a taxa de cada mercado somada (isola a regra da entrega única).
({Plan? cheapest, Plan? single}) optimizeSum(List<MarketOffers> m, List<Want> w) =>
    optimize(m, w, fee: (ms) => ms.fold(0, (s, x) => s + x.deliveryFeeCents));

void main() {
  final ten = 'abcdefghij'.split('');
  List<Want> want(List<String> keys) => [for (final k in keys) Want(k, 1)];

  test('chave de comparação sem acento', () {
    expect(compareKey('Óleo de Soja', '900 ml'), 'oleo de soja|900ml');
    expect(compareKey('Feijão Carioca', '1 kg'), 'feijao carioca|1kg');
  });

  test('um mercado quando a divisão não compensa a taxa', () {
    final r = optimizeSum([
      mk('A', 500, {for (final k in ten) k: 100}),
      mk('B', 500, {for (final k in ten) k: 99}),
    ], want(ten));
    expect(r.cheapest!.marketIds, ['B']);
  });

  test('divide em 2 com no mínimo 5 itens por mercado', () {
    final a = mk('A', 300, {for (final (i, k) in ten.indexed) k: i < 5 ? 100 : 300});
    final b = mk('B', 300, {for (final (i, k) in ten.indexed) k: i < 5 ? 300 : 100});
    final r = optimizeSum([a, b], want(ten));
    expect(r.cheapest!.marketIds.length, 2);
    for (final m in r.cheapest!.marketIds) {
      expect(r.cheapest!.linesOf(m).length, greaterThanOrEqualTo(minItemsPerMarket));
    }
    expect(r.cheapest!.totalCents, 1600);
  });

  test('nunca divide com menos de 5 itens em um mercado', () {
    final a = mk('A', 300, {for (final k in ten) k: 200});
    final b = mk('B', 300, {for (final (i, k) in ten.indexed) k: i < 3 ? 10 : 500});
    expect(optimizeSum([a, b], want(ten)).cheapest!.marketIds, ['A']);
  });

  test('no máximo 3 mercados', () {
    final keys = [for (var i = 0; i < 20; i++) 'k$i'];
    final markets = [
      for (final (mi, id) in ['A', 'B', 'C', 'D'].indexed)
        mk(id, 0, {for (final (i, k) in keys.indexed) k: i ~/ 5 == mi ? 1 : 1000}),
    ];
    expect(optimizeSum(markets, want(keys)).cheapest!.marketIds.length, 3);
  });

  test('pedido mínimo e itens faltando', () {
    final r = optimizeSum([
      mk('A', 0, {'x': 100}, minOrder: 1000),
      mk('B', 0, {'x': 150}),
    ], want(['x', 'y']));
    expect(r.cheapest!.marketIds, ['B']);
    expect(r.cheapest!.missing, ['y']);
  });

  test('entrega única: base + adicional por mercado extra', () {
    expect(deliveryFeeFor(1), 790);
    expect(deliveryFeeFor(3), 1390);
    final a = mk('A', 0, {for (final (i, k) in ten.indexed) k: i < 5 ? 100 : 400});
    final b = mk('B', 0, {for (final (i, k) in ten.indexed) k: i < 5 ? 400 : 100});
    final r = optimize([a, b], want(ten));
    expect(r.cheapest!.marketIds.length, 2);
    expect(r.cheapest!.deliveryCents, 1090);
  });

  test('3 mercados: divide só quando cada um tem 5 itens e a economia paga as entregas extras', () {
    final keys = [for (var i = 0; i < 15; i++) 'k$i'];
    MarketOffers cheapIn(String id, int from) =>
        mk(id, 0, {for (final (i, k) in keys.indexed) k: i ~/ 5 == from ? 100 : 500});
    final r = optimize([cheapIn('A', 0), cheapIn('B', 1), cheapIn('C', 2)], [for (final k in keys) Want(k, 1)]);
    expect(r.cheapest!.marketIds.length, 3);
    expect(r.cheapest!.deliveryCents, deliveryFeeFor(3));
    for (final m in r.cheapest!.marketIds) {
      expect(r.cheapest!.linesOf(m).length, 5);
    }
    expect(r.cheapest!.totalCents, 1500 + 1390);
  });

  test('distância (Haversine) e melhor ordem de coleta até a casa', () {
    const paulista = (lat: -23.5614, lng: -46.6559);
    const se = (lat: -23.5503, lng: -46.6340);
    expect(distanceKm(paulista, se), closeTo(2.6, 0.2));
    const home = (lat: -23.5700, lng: -46.6450);
    final r = bestRoute({'longe': (lat: -23.5400, lng: -46.6300), 'perto': (lat: -23.5650, lng: -46.6480)}, home)!;
    expect(r.order, ['longe', 'perto']); // passa no mais distante primeiro e termina perto de casa
    expect(r.legsKm.length, 2);
    expect(r.minutes, greaterThan(0));
  });
}
