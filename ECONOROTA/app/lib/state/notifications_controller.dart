import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/repositories/notifications_repository.dart';
import 'auth_controller.dart';

/// Contador de notificações não lidas: atualiza ao entrar e a cada minuto com o app aberto.
class NotificationsController extends ChangeNotifier {
  NotificationsController(this._repo, this._auth) {
    _auth.addListener(_onAuth);
    _onAuth();
  }

  final NotificationsRepository _repo;
  final AuthController _auth;
  Timer? _timer;
  int unread = 0;

  void _onAuth() {
    _timer?.cancel();
    if (_auth.user == null || _auth.needsVerification) {
      if (unread != 0) {
        unread = 0;
        notifyListeners();
      }
      return;
    }
    refresh();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) => refresh());
  }

  Future<void> refresh() async {
    try {
      final n = await _repo.unread();
      if (n != unread) {
        unread = n;
        notifyListeners();
      }
    } catch (_) {
      // Sem conexão: tenta de novo no próximo ciclo.
    }
  }

  void set(int value) {
    if (value == unread) return;
    unread = value;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _auth.removeListener(_onAuth);
    super.dispose();
  }
}
