import 'dart:math' as math;

/// Velocidade média urbana e tempo de retirada por mercado (mesmos valores da API).
const avgSpeedKmh = 25;
const pickupMinutes = 5;

typedef LatLng = ({double lat, double lng});

double distanceKm(LatLng a, LatLng b) {
  const r = math.pi / 180;
  final h =
      math.pow(math.sin((b.lat - a.lat) * r / 2), 2) +
      math.cos(a.lat * r) * math.cos(b.lat * r) * math.pow(math.sin((b.lng - a.lng) * r / 2), 2);
  return 6371 * 2 * math.asin(math.sqrt(h));
}

class DeliveryRoute {
  const DeliveryRoute({required this.order, required this.legsKm, required this.totalKm, required this.minutes});

  /// Ordem de coleta dos mercados; o último trecho vai até a casa do cliente.
  final List<String> order;
  final List<double> legsKm;
  final double totalKm;
  final int minutes;
}

Iterable<List<T>> _perms<T>(List<T> a) sync* {
  if (a.length <= 1) {
    yield a;
    return;
  }
  for (var i = 0; i < a.length; i++) {
    for (final p in _perms([...a.sublist(0, i), ...a.sublist(i + 1)])) {
      yield [a[i], ...p];
    }
  }
}

/// Ordem dos mercados que minimiza a distância total até a casa.
DeliveryRoute? bestRoute(
  Map<String, LatLng> markets,
  LatLng home, [
  double Function(LatLng, LatLng) dist = distanceKm,
]) {
  DeliveryRoute? best;
  for (final order in _perms(markets.keys.toList())) {
    final stops = [for (final id in order) markets[id]!, home];
    final legs = [for (var i = 1; i < stops.length; i++) dist(stops[i - 1], stops[i])];
    final total = legs.fold<double>(0, (s, l) => s + l);
    if (best == null || total < best.totalKm) {
      best = DeliveryRoute(
        order: order,
        legsKm: [for (final l in legs) (l * 10).round() / 10],
        totalKm: total,
        minutes: (total / avgSpeedKmh * 60 + pickupMinutes * markets.length).round(),
      );
    }
  }
  return best == null
      ? null
      : DeliveryRoute(
          order: best.order,
          legsKm: best.legsKm,
          totalKm: (best.totalKm * 10).round() / 10,
          minutes: best.minutes,
        );
}
