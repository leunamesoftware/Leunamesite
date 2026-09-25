import '../../services/api_client.dart';

/// Mensagem amigável para qualquer erro (nunca expõe detalhes técnicos ao usuário).
String friendlyError(Object e) => switch (e) {
  ApiException(:final message) => message,
  _ => 'Algo deu errado. Tente novamente.',
};
