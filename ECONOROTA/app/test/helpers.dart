import 'dart:typed_data';

import 'package:econorota/app.dart';
import 'package:econorota/services/location_service.dart';
import 'package:econorota/services/session_store.dart';
import 'package:econorota/widgets/otp_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';

class MemoryStore extends SessionStore {
  final data = <String, String>{};

  @override
  Future<String?> read(String key) async => data[key];
  @override
  Future<void> write(String key, String value) async => data[key] = value;
  @override
  Future<void> delete(String key) async => data.remove(key);
}

Future<MemoryStore> startApp(WidgetTester tester, {MemoryStore? store}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
  final s = store ?? MemoryStore();
  await tester.pumpWidget(EconoRotaApp(store: s, location: MockLocationService()));
  await tester.pumpAndSettle();
  return s;
}

Future<void> tapText(WidgetTester tester, String text) async {
  final f = find.text(text).last;
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

Future<void> fill(WidgetTester tester, String hint, String value) async {
  final f = find.widgetWithText(TextFormField, hint);
  await tester.ensureVisible(f);
  await tester.enterText(f, value);
  await tester.pump();
}

Future<void> enterCode(WidgetTester tester, String code) async {
  await tester.enterText(find.descendant(of: find.byType(OtpField), matching: find.byType(TextField)), code);
  await tester.pumpAndSettle();
}

/// Estado de quem já passou pela apresentação e escolheu endereço.
MemoryStore returningUser() => MemoryStore()
  ..data['econorota.onboarding.done'] = '1'
  ..data['econorota.address.current'] =
      '{"street":"Rua das Flores","number":"123","district":"Centro","city":"São Paulo","state":"SP","zip":"01001000"}';

/// Botão pelo rótulo de acessibilidade (sem precisar ligar o leitor de tela no teste).
Finder byA11yLabel(String label) => find.byWidgetPredicate((w) => w is Semantics && w.properties.label == label);

Future<void> tapA11y(WidgetTester tester, String label) async {
  final f = byA11yLabel(label).first;
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

/// Rótulo completo de acessibilidade que começa com [prefix] (ex.: nome do produto).
String byA11yPrefix(WidgetTester tester, String prefix) => tester
    .widgetList<Semantics>(find.byType(Semantics))
    .map((w) => w.properties.label)
    .firstWhere((l) => l != null && l.startsWith('$prefix,'))!;

/// Entra como o mercado de demonstração.
Future<void> loginMarket(WidgetTester tester) async {
  await startApp(tester, store: returningUser());
  await fill(tester, 'E-mail ou telefone', 'mercado@demo.app');
  await fill(tester, 'Senha', 'senha1234');
  await tapText(tester, 'Entrar');
}

/// Abre uma aba da barra inferior.
Future<void> goTab(WidgetTester tester, String label) async {
  await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(label)));
  await tester.pumpAndSettle();
}

/// Galeria de fotos falsa para o teste (imagem JPEG mínima).
class FakePicker extends ImagePickerPlatform {
  @override
  Future<XFile?> getImageFromSource({
    required ImageSource source,
    ImagePickerOptions options = const ImagePickerOptions(),
  }) async => XFile.fromData(
    Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]),
    mimeType: 'image/jpeg',
  );
}
