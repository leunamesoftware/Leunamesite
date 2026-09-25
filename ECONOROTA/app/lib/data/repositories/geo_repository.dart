import '../../services/api_client.dart';
import '../models/address.dart';

abstract interface class GeoRepository {
  /// Endereço pelo CEP (8 dígitos).
  Future<Address> byZip(String zip);

  /// Endereço aproximado a partir do GPS.
  Future<Address> reverse(double lat, double lng);
}

class ApiGeoRepository implements GeoRepository {
  ApiGeoRepository(this._api);

  final ApiClient _api;

  Address _parse(Map<String, dynamic> j) => Address.fromJson(j['place'] as Map<String, dynamic>);

  @override
  Future<Address> byZip(String zip) async => _parse(await _api.get('/geo/cep/$zip'));

  @override
  Future<Address> reverse(double lat, double lng) async =>
      _parse(await _api.get('/geo/reverse?lat=${lat.toStringAsFixed(5)}&lng=${lng.toStringAsFixed(5)}'));
}

class MockGeoRepository implements GeoRepository {
  @override
  Future<Address> byZip(String zip) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (zip == '00000000') throw const ApiException(404, 'not_found', 'CEP não encontrado.');
    return Address(street: 'Rua das Flores', district: 'Centro', city: 'São Paulo', state: 'SP', zip: zip);
  }

  @override
  Future<Address> reverse(double lat, double lng) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    return Address(
      street: 'Av. Paulista',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310100',
      lat: lat,
      lng: lng,
    );
  }
}
