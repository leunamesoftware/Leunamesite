import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/utils/errors.dart';
import '../data/repositories/courier_repository.dart';
import '../services/location_service.dart';

/// Disponibilidade do entregador e envio do GPS (a cada 15 s enquanto disponível, com o app aberto).
class CourierController extends ChangeNotifier {
  CourierController(this._repo, this._location);

  final CourierRepository _repo;
  final LocationService _location;
  Timer? _gps;

  bool online = false;
  bool busy = false;
  ({double lat, double lng})? position;
  String? error;

  Future<void> setOnline(bool value) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      if (value) {
        final perm = await _location.requestPermission();
        if (perm != LocationResult.granted) {
          throw const _Msg('Ative a localização para ficar disponível e receber pedidos por perto.');
        }
        position = await _location.current();
        await _repo.setOnline(true, lat: position!.lat, lng: position!.lng);
        _gps?.cancel();
        _gps = Timer.periodic(const Duration(seconds: 15), (_) => _sendGps());
      } else {
        await _repo.setOnline(false);
        _gps?.cancel();
      }
      online = value;
    } on _Msg catch (e) {
      error = e.message;
    } catch (e) {
      error = friendlyError(e);
    }
    busy = false;
    notifyListeners();
  }

  Future<void> _sendGps() async {
    try {
      position = await _location.current();
      await _repo.sendLocation(position!.lat, position!.lng);
      notifyListeners();
    } catch (_) {
      // Sem sinal por um instante: tenta de novo no próximo envio.
    }
  }

  void sync({required bool online}) {
    if (this.online == online) return;
    this.online = online;
    if (online) {
      _gps ??= Timer.periodic(const Duration(seconds: 15), (_) => _sendGps());
    } else {
      _gps?.cancel();
      _gps = null;
    }
    notifyListeners();
  }

  void reset() {
    _gps?.cancel();
    _gps = null;
    online = false;
    position = null;
    error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _gps?.cancel();
    super.dispose();
  }
}

class _Msg implements Exception {
  const _Msg(this.message);
  final String message;
}
