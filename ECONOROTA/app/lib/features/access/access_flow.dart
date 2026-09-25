import '../../core/router/app_router.dart';
import '../../state/address_controller.dart';
import '../../state/auth_controller.dart';

/// Próxima tela do fluxo de acesso conforme o estado atual.
String nextAccessRoute(AuthController auth, AddressController address) {
  final user = auth.user;
  if (user != null) return auth.needsVerification ? '/verificar' : homeFor(user.role);
  if (!auth.onboardingDone) return '/boas-vindas';
  if (address.current == null) return '/localizacao';
  return auth.guest ? '/cliente' : '/entrar';
}
