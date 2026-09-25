import 'package:flutter/foundation.dart';

import '../data/models/user.dart';
import '../data/repositories/auth_repository.dart';
import '../services/api_client.dart';
import '../services/google_auth_service.dart';
import '../services/session_store.dart';

enum AuthStatus { unknown, signedOut, signedIn }

class AuthController extends ChangeNotifier {
  AuthController(this._repo, this._store, this._api, this._google);

  static const _onboardingKey = 'econorota.onboarding.done';
  static const _guestKey = 'econorota.guest';

  final AuthRepository _repo;
  final SessionStore _store;
  final ApiClient _api;
  final GoogleAuthService _google;

  /// Chamado ao sair da conta para apagar dados locais ligados a ela.
  VoidCallback? onSignedOut;

  AuthStatus status = AuthStatus.unknown;
  AppUser? user;
  AuthConfig config = const AuthConfig();
  bool onboardingDone = false;

  /// Visitante: navega e vê preços sem conta; login só para comprar.
  bool guest = false;

  bool get needsVerification => user != null && user!.role == UserRole.customer && !user!.verified;
  bool get googleAvailable => config.google && _google.isConfigured;

  Future<void> restore() async {
    onboardingDone = await _safeRead(_onboardingKey) == '1';
    guest = await _safeRead(_guestKey) == '1';
    config = await _repo.config();
    final token = await _safeRead(SessionStoreKeys.token);
    if (token != null) {
      try {
        await _setSession(token, await _repo.me(token));
        return;
      } on ApiException catch (e) {
        // Sem internet mantém a sessão salva; token inválido é descartado.
        if (e.status == 0) {
          status = AuthStatus.signedOut;
          notifyListeners();
          return;
        }
        await _store.clear();
      }
    }
    status = AuthStatus.signedOut;
    notifyListeners();
  }

  Future<String?> _safeRead(String key) async {
    try {
      return await _store.read(key);
    } catch (_) {
      return null;
    }
  }

  Future<void> completeOnboarding() async {
    onboardingDone = true;
    await _store.write(_onboardingKey, '1');
  }

  Future<void> continueAsGuest() async {
    guest = true;
    await _store.write(_guestKey, '1');
    notifyListeners();
  }

  Future<void> login(String login, String password) async {
    final r = await _repo.login(login: login.trim(), password: password);
    await _setSession(r.token, r.user);
  }

  Future<void> register({required String name, required String email, required String password, String? phone}) async {
    final r = await _repo.register(
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      phone: phone,
      role: UserRole.customer,
    );
    await _setSession(r.token, r.user);
  }

  Future<void> signInWithGoogle() async {
    final idToken = await _google.signIn();
    final r = await _repo.google(idToken);
    await _setSession(r.token, r.user);
  }

  Future<CodeDelivery> sendVerification(CodeChannel channel) => _repo.sendVerification(channel);

  Future<void> confirmVerification(String code) async {
    user = await _repo.confirmVerification(code);
    notifyListeners();
  }

  Future<CodeDelivery> forgotPassword(String login, CodeChannel channel) =>
      _repo.forgotPassword(login: login.trim(), channel: channel);

  Future<void> resetPassword(String login, String code, String password) async {
    final r = await _repo.resetPassword(login: login.trim(), code: code, password: password);
    await _setSession(r.token, r.user);
  }

  /// Entrada rápida por perfil (somente modo demonstração).
  Future<void> enterDemo(UserRole role) => login('${role.apiValue}@demo.app', 'demo12345');

  /// [forgetDevice]: apaga também os dados locais ligados à conta (endereços).
  Future<void> logout({bool forgetDevice = true}) async {
    await _store.clear();
    await _store.delete(_guestKey);
    guest = false;
    await _google.signOut();
    _api.token = null;
    user = null;
    status = AuthStatus.signedOut;
    if (forgetDevice) onSignedOut?.call();
    notifyListeners();
  }

  Future<void> _setSession(String token, AppUser u) async {
    await _store.saveToken(token);
    _api.token = token;
    user = u;
    status = AuthStatus.signedIn;
    notifyListeners();
  }
}

abstract final class SessionStoreKeys {
  static const token = 'econorota.token';
}
