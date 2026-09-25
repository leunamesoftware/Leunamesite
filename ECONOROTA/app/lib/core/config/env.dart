/// Configuração por ambiente, definida no build:
/// flutter build appbundle --dart-define=USE_MOCK=false --dart-define=API_URL=https://api.exemplo.com
abstract final class Env {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:8787');

  /// Sem API configurada, o app usa dados de demonstração.
  static const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: true);

  /// ID do cliente OAuth "Web" do Google (usado para emitir o ID token validado pela API).
  static const googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

  /// Mapas (rastreamento). Produção: use um provedor com plano (ex.: MapTiler, Stadia) — o servidor público
  /// do OpenStreetMap é só para testes (política de uso).
  static const mapTilesUrl = String.fromEnvironment(
    'MAP_TILES_URL',
    defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );

  /// Versão deste app (manter igual ao `version:` do pubspec.yaml).
  static const appVersion = '1.0.0';

  /// Código aceito na verificação e recuperação em modo demonstração.
  static const demoCode = '123456';
}
