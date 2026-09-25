import 'package:flutter/foundation.dart';

import '../core/utils/errors.dart';
import '../data/models/address.dart';
import '../data/models/compare.dart';
import '../data/models/order.dart';
import '../data/repositories/compare_repository.dart';

/// Carrinho por mercado (Fase 6): os mercados escolhidos na comparação ficam fixos e
/// o plano é recalculado a cada alteração de quantidade, com as mesmas regras do servidor.
class CheckoutController extends ChangeNotifier {
  List<String> marketIds = const [];
  PaymentMethod payment = PaymentMethod.pix;

  CompareResult? result;

  /// Mesma lista em todos os mercados próximos: referência de preço ("menor preço") e de economia.
  CompareResult? all;
  String? error;
  bool loading = false;
  int _gen = 0;

  ComparePlan? get plan => result?.best;

  /// Economia real vs. comprar tudo no mercado único mais barato (entrega incluída nos dois lados).
  int get savings {
    final p = plan, s = all?.single;
    if (p == null || s == null) return 0;
    return s.totalCents > p.totalCents ? s.totalCents - p.totalCents : 0;
  }

  int get savingsPct => savings == 0 ? 0 : (savings * 100 / all!.single!.totalCents).round();

  /// Menor preço unitário da região para o item.
  int? bestPrice(String key) => all?.rows.where((r) => r.key == key).firstOrNull?.best;

  void start(List<String> markets) {
    marketIds = List.unmodifiable(markets);
    result = null;
    error = null;
    notifyListeners();
  }

  void setPayment(PaymentMethod p) {
    payment = p;
    notifyListeners();
  }

  Future<void> refresh(CompareRepository repo, Map<String, int> wants, Address? at) async {
    final gen = ++_gen;
    if (wants.isEmpty) {
      result = null;
      loading = false;
      notifyListeners();
      return;
    }
    loading = true;
    error = null;
    notifyListeners();
    try {
      final r = await Future.wait([
        repo.compare(wants, lat: at?.lat, lng: at?.lng, marketIds: marketIds),
        repo.compare(wants, lat: at?.lat, lng: at?.lng),
      ]);
      if (gen != _gen) return;
      result = r[0];
      all = r[1];
    } catch (e) {
      if (gen != _gen) return;
      error = friendlyError(e);
    }
    loading = false;
    notifyListeners();
  }

  void clear() {
    _gen++;
    marketIds = const [];
    result = null;
    all = null;
    error = null;
    loading = false;
    payment = PaymentMethod.pix;
    notifyListeners();
  }
}
