import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../core/config/env.dart';

class GoogleAuthCancelled implements Exception {}

/// Login com Google (Android/iOS). Requer GOOGLE_SERVER_CLIENT_ID no build.
class GoogleAuthService {
  bool _ready = false;

  bool get isConfigured => Env.googleServerClientId.isNotEmpty && !kIsWeb;

  /// Retorna o ID token para ser validado pela API.
  Future<String> signIn() async {
    final g = GoogleSignIn.instance;
    if (!_ready) {
      await g.initialize(serverClientId: Env.googleServerClientId);
      _ready = true;
    }
    try {
      final account = await g.authenticate();
      final token = account.authentication.idToken;
      if (token == null) throw GoogleAuthCancelled();
      return token;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) throw GoogleAuthCancelled();
      rethrow;
    }
  }

  Future<void> signOut() async {
    if (_ready) await GoogleSignIn.instance.signOut();
  }
}
