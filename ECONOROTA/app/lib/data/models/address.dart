import 'dart:convert';

class Address {
  const Address({
    required this.street,
    required this.city,
    required this.state,
    this.id,
    this.number,
    this.complement,
    this.district,
    this.zip,
    this.lat,
    this.lng,
  });

  final String? id;
  final String street;
  final String? number;
  final String? complement;
  final String? district;
  final String city;
  final String state;
  final String? zip;
  final double? lat;
  final double? lng;

  /// "Rua das Flores, 123"
  String get line1 => [street, if (number?.isNotEmpty ?? false) number else 'S/N'].join(', ');

  /// "Centro • São Paulo - SP"
  String get line2 => [if (district?.isNotEmpty ?? false) district, '$city - $state'].join(' • ');

  String get key => '${zip ?? ''}|${street.toLowerCase()}|${number ?? ''}|${complement ?? ''}';

  Address copyWith({String? number, String? complement, String? street, String? district}) => Address(
    id: id,
    street: street ?? this.street,
    number: number ?? this.number,
    complement: complement ?? this.complement,
    district: district ?? this.district,
    city: city,
    state: state,
    zip: zip,
    lat: lat,
    lng: lng,
  );

  Map<String, dynamic> toJson() => {
    'id': ?id,
    'street': street,
    'number': ?number,
    'complement': ?complement,
    'district': ?district,
    'city': city,
    'state': state,
    'zip': ?zip,
    'lat': ?lat,
    'lng': ?lng,
  };

  factory Address.fromJson(Map<String, dynamic> j) => Address(
    id: j['id'] as String?,
    street: j['street'] as String? ?? '',
    number: j['number'] as String?,
    complement: j['complement'] as String?,
    district: j['district'] as String?,
    city: j['city'] as String? ?? '',
    state: j['state'] as String? ?? '',
    zip: j['zip'] as String?,
    lat: (j['lat'] as num?)?.toDouble(),
    lng: (j['lng'] as num?)?.toDouble(),
  );

  static String encodeList(List<Address> list) => jsonEncode(list.map((a) => a.toJson()).toList());
  static List<Address> decodeList(String raw) =>
      (jsonDecode(raw) as List).cast<Map<String, dynamic>>().map(Address.fromJson).toList();
}
