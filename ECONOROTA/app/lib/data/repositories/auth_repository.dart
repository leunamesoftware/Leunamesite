import '../../core/config/env.dart';
import '../../services/api_client.dart';
import '../models/user.dart';

typedef AuthResult = ({String token, AppUser user});

enum CodeChannel { email, whatsapp }

/// Resultado de um envio de código: canal, destino mascarado e tempo para reenviar.
class CodeDelivery {
  const CodeDelivery({required this.channel, required this.target, required this.resendIn, this.devCode});

  final CodeChannel channel;
  final String target;
  final int resendIn;
  final String? devCode;

  factory CodeDelivery.fromJson(Map<String, dynamic> j, {String target = ''}) => CodeDelivery(
    channel: j['channel'] == 'whatsapp' ? CodeChannel.whatsapp : CodeChannel.email,
    target: j['target'] as String? ?? target,
    resendIn: j['resend_in'] as int? ?? 60,
    devCode: j['dev_code'] as String?,
  );
}

class AuthConfig {
  const AuthConfig({this.email = true, this.whatsapp = false, this.google = false});

  final bool email;
  final bool whatsapp;
  final bool google;
}

abstract interface class AuthRepository {
  Future<AuthConfig> config();
  Future<AuthResult> login({required String login, required String password});
  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
    required UserRole role,
    String? phone,
  });
  Future<AuthResult> google(String idToken);
  Future<AppUser> me(String token);
  Future<CodeDelivery> sendVerification(CodeChannel channel);
  Future<AppUser> confirmVerification(String code);
  Future<CodeDelivery> forgotPassword({required String login, required CodeChannel channel});
  Future<AuthResult> resetPassword({required String login, required String code, required String password});
}

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._api);

  final ApiClient _api;

  AuthResult _parse(Map<String, dynamic> j) =>
      (token: j['token'] as String, user: AppUser.fromJson(j['user'] as Map<String, dynamic>));

  @override
  Future<AuthConfig> config() async {
    try {
      final j = await _api.get('/auth/config');
      final ch = j['channels'] as Map<String, dynamic>;
      return AuthConfig(email: ch['email'] == true, whatsapp: ch['whatsapp'] == true, google: j['google'] == true);
    } on ApiException {
      return const AuthConfig();
    }
  }

  @override
  Future<AuthResult> login({required String login, required String password}) async =>
      _parse(await _api.post('/auth/login', {'login': login, 'password': password}));

  @override
  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
    required UserRole role,
    String? phone,
  }) async => _parse(
    await _api.post('/auth/register', {
      'name': name,
      'email': email,
      'password': password,
      'role': role.apiValue,
      'phone': ?phone,
      'accept_terms': true,
    }),
  );

  @override
  Future<AuthResult> google(String idToken) async => _parse(await _api.post('/auth/google', {'id_token': idToken}));

  @override
  Future<AppUser> me(String token) async {
    _api.token = token;
    final j = await _api.get('/auth/me');
    return AppUser.fromJson(j['user'] as Map<String, dynamic>);
  }

  @override
  Future<CodeDelivery> sendVerification(CodeChannel channel) async =>
      CodeDelivery.fromJson(await _api.post('/auth/verify/send', {'channel': channel.name}));

  @override
  Future<AppUser> confirmVerification(String code) async =>
      AppUser.fromJson((await _api.post('/auth/verify/confirm', {'code': code}))['user'] as Map<String, dynamic>);

  @override
  Future<CodeDelivery> forgotPassword({required String login, required CodeChannel channel}) async =>
      CodeDelivery.fromJson(
        await _api.post('/auth/password/forgot', {'login': login, 'channel': channel.name}),
        target: login,
      );

  @override
  Future<AuthResult> resetPassword({required String login, required String code, required String password}) async =>
      _parse(await _api.post('/auth/password/reset', {'login': login, 'code': code, 'password': password}));
}

/// Autenticação local para a prévia, sem servidor. Código de demonstração: [Env.demoCode].
class MockAuthRepository implements AuthRepository {
  AppUser? _current;

  static UserRole _roleFor(String login) => switch (login.split('@').first.toLowerCase()) {
    'mercado' => UserRole.market,
    'entregador' => UserRole.courier,
    'admin' => UserRole.admin,
    _ => UserRole.customer,
  };

  AuthResult _session(AppUser u) {
    _current = u;
    return (token: 'demo.${u.role.apiValue}.${u.verified ? 1 : 0}', user: u);
  }

  void _checkCode(String code) {
    if (code != Env.demoCode) {
      throw const ApiException(400, 'invalid_code', 'Código incorreto. Confira e tente novamente.');
    }
  }

  @override
  Future<AuthConfig> config() async => const AuthConfig(email: true, whatsapp: true, google: false);

  @override
  Future<AuthResult> login({required String login, required String password}) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (password.length < 8) throw const ApiException(401, 'unauthorized', 'E-mail, telefone ou senha incorretos.');
    final role = _roleFor(login);
    final name = switch (role) {
      UserRole.market => 'Supermercado Demo',
      UserRole.courier => 'Entregador Demo',
      UserRole.admin => 'Administrador',
      UserRole.customer => 'Maria Silva',
    };
    return _session(
      AppUser(id: 'demo', name: name, email: login.contains('@') ? login : 'demo@econorota.app', role: role),
    );
  }

  @override
  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
    required UserRole role,
    String? phone,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return _session(AppUser(id: 'demo', name: name, email: email, phone: phone, role: role, verified: false));
  }

  @override
  Future<AuthResult> google(String idToken) =>
      throw const ApiException(503, 'unavailable', 'Login com Google indisponível.');

  @override
  Future<AppUser> me(String token) async {
    final parts = token.split('.');
    return _current ??
        AppUser(
          id: 'demo',
          name: 'Maria Silva',
          email: 'demo@econorota.app',
          role: UserRole.fromApi(parts.length > 1 ? parts[1] : 'cliente'),
          verified: parts.length < 3 || parts[2] == '1',
        );
  }

  @override
  Future<CodeDelivery> sendVerification(CodeChannel channel) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final u = _current;
    final target = channel == CodeChannel.email ? (u?.email ?? 'seu e-mail') : (u?.phone ?? 'seu WhatsApp');
    return CodeDelivery(channel: channel, target: target, resendIn: 60, devCode: Env.demoCode);
  }

  @override
  Future<AppUser> confirmVerification(String code) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    _checkCode(code);
    return _current = (_current ?? await me('demo.cliente.0')).copyWith(verified: true);
  }

  @override
  Future<CodeDelivery> forgotPassword({required String login, required CodeChannel channel}) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return CodeDelivery(channel: channel, target: login, resendIn: 60, devCode: Env.demoCode);
  }

  @override
  Future<AuthResult> resetPassword({required String login, required String code, required String password}) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    _checkCode(code);
    return this.login(login: login, password: password);
  }
}
