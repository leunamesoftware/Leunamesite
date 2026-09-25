enum UserRole {
  customer('cliente'),
  market('mercado'),
  courier('entregador'),
  admin('admin');

  const UserRole(this.apiValue);
  final String apiValue;

  static UserRole fromApi(String value) => values.firstWhere((r) => r.apiValue == value, orElse: () => customer);
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phone,
    this.verified = true,
    this.status = 'ativo',
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final UserRole role;
  final bool verified;
  final String status;

  String get firstName => name.trim().split(RegExp(r'\s+')).first;

  AppUser copyWith({bool? verified}) => AppUser(
    id: id,
    name: name,
    email: email,
    phone: phone,
    role: role,
    status: status,
    verified: verified ?? this.verified,
  );

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
    id: j['id'] as String,
    name: j['name'] as String,
    email: j['email'] as String,
    phone: j['phone'] as String?,
    role: UserRole.fromApi(j['role'] as String),
    verified: j['verified'] as bool? ?? true,
    status: j['status'] as String? ?? 'ativo',
  );
}
