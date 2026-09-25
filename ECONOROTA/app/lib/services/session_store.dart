import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Armazenamento local seguro (Keystore no Android, Keychain no iOS): sessão e preferências.
class SessionStore {
  SessionStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  static const _tokenKey = 'econorota.token';
  final FlutterSecureStorage _storage;

  Future<String?> readToken() => read(_tokenKey);
  Future<void> saveToken(String token) => write(_tokenKey, token);
  Future<void> clear() => delete(_tokenKey);

  Future<String?> read(String key) => _storage.read(key: key);
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);
  Future<void> delete(String key) => _storage.delete(key: key);
}
