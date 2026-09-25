import 'package:geolocator/geolocator.dart';

enum LocationResult { granted, denied, deniedForever, serviceDisabled }

/// Acesso ao GPS com tratamento de permissão.
class LocationService {
  Future<LocationResult> requestPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return LocationResult.serviceDisabled;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    return switch (p) {
      LocationPermission.always || LocationPermission.whileInUse => LocationResult.granted,
      LocationPermission.deniedForever => LocationResult.deniedForever,
      _ => LocationResult.denied,
    };
  }

  Future<({double lat, double lng})> current() async {
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
    );
    return (lat: pos.latitude, lng: pos.longitude);
  }

  Future<void> openSettings() => Geolocator.openAppSettings();
}

/// Localização fixa para a prévia/testes.
class MockLocationService extends LocationService {
  @override
  Future<LocationResult> requestPermission() async => LocationResult.granted;

  @override
  Future<({double lat, double lng})> current() async => (lat: -23.5614, lng: -46.6559);

  @override
  Future<void> openSettings() async {}
}
