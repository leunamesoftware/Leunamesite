import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../core/config/env.dart';

class ApiException implements Exception {
  const ApiException(this.status, this.code, this.message);

  final int status;
  final String code;
  final String message;

  @override
  String toString() => 'ApiException($status, $code): $message';
}

/// Cliente HTTP da API EconoRota (Cloudflare Workers).
class ApiClient {
  ApiClient({http.Client? client, String? baseUrl}) : _http = client ?? http.Client(), _base = baseUrl ?? Env.apiUrl;

  final http.Client _http;
  final String _base;
  String? token;

  Future<Map<String, dynamic>> get(String path) => _send('GET', path);
  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) => _send('POST', path, body);
  Future<Map<String, dynamic>> put(String path, [Map<String, dynamic>? body]) => _send('PUT', path, body);
  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? body]) => _send('PATCH', path, body);
  Future<Map<String, dynamic>> delete(String path) => _send('DELETE', path);

  /// Envia um arquivo (corpo binário), ex.: foto do documento do entregador.
  Future<Map<String, dynamic>> upload(String path, List<int> bytes, String contentType) async {
    final req = http.Request('PUT', Uri.parse('$_base$path'))
      ..headers['Content-Type'] = contentType
      ..headers['Accept'] = 'application/json'
      ..bodyBytes = bytes;
    if (token != null) req.headers['Authorization'] = 'Bearer $token';
    return _handle(req);
  }

  /// Arquivo privado (documentos, fotos de ocorrências) — exige o token.
  Future<Uint8List> bytes(String path) async {
    final req = http.Request('GET', Uri.parse('$_base$path'));
    if (token != null) req.headers['Authorization'] = 'Bearer $token';
    final http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 30)));
    } catch (_) {
      throw const ApiException(0, 'network', 'Sem conexão com o servidor.');
    }
    if (res.statusCode >= 400) throw ApiException(res.statusCode, 'error', 'Arquivo indisponível.');
    return res.bodyBytes;
  }

  Future<Map<String, dynamic>> _send(String method, String path, [Map<String, dynamic>? body]) async {
    final req = http.Request(method, Uri.parse('$_base$path'))
      ..headers['Content-Type'] = 'application/json'
      ..headers['Accept'] = 'application/json';
    if (token != null) req.headers['Authorization'] = 'Bearer $token';
    if (body != null) req.body = jsonEncode(body);
    return _handle(req);
  }

  Future<Map<String, dynamic>> _handle(http.Request req) async {
    final http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 20)));
    } catch (_) {
      throw const ApiException(0, 'network', 'Sem conexão com o servidor.');
    }

    final data = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400) {
      final err = data['error'] as Map<String, dynamic>? ?? const {};
      throw ApiException(
        res.statusCode,
        err['code'] as String? ?? 'error',
        err['message'] as String? ?? 'Erro inesperado.',
      );
    }
    return data;
  }
}
