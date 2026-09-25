import 'package:intl/intl.dart';

final _brl = NumberFormat.currency(locale: 'pt_BR', symbol: r'R$');

String money(int cents) => _brl.format(cents / 100);

String km(double value) => NumberFormat('0.0', 'pt_BR').format(value);

/// "800 m" abaixo de 1 km, "1,2 km" acima.
String distance(double kmValue) => kmValue < .1
    ? 'menos de 100 m'
    : kmValue < 1
    ? '${(kmValue * 1000 / 50).round() * 50} m'
    : '${km(kmValue)} km';

String dateTime(DateTime d) => DateFormat("dd/MM/yyyy '•' HH:mm", 'pt_BR').format(d);
String date(DateTime d) => DateFormat('dd/MM/yyyy', 'pt_BR').format(d);

/// Número curto do pedido/ocorrência para o cliente (6 caracteres), seguro para ids curtos.
String shortCode(String id) {
  final s = id.replaceAll('-', '');
  return (s.length > 6 ? s.substring(0, 6) : s).toUpperCase();
}
