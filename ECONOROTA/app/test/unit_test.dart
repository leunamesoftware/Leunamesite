import 'package:econorota/core/utils/formatters.dart';
import 'package:econorota/core/utils/validators.dart';
import 'package:econorota/data/models/address.dart';
import 'package:econorota/core/compare/list_parser.dart';
import 'package:econorota/data/models/compare.dart';
import 'package:econorota/services/update_check.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('máscaras de CEP e telefone', () {
    expect(cepMask.apply('01001000'), '01001-000');
    expect(phoneMask.apply('1134567890'), '(11) 3456-7890');
    expect(phoneMask.apply('11987654321'), '(11) 98765-4321');
  });

  test('validações', () {
    expect(Validators.email('a@b.co'), isNull);
    expect(Validators.email('a@b'), isNotNull);
    expect(Validators.phone('(11) 98765-4321'), isNull);
    expect(Validators.phone('(01) 98765-4321'), isNotNull);
    expect(Validators.login('11987654321'), isNull);
    expect(Validators.login('abc'), isNotNull);
    expect(Validators.newPassword('abcdefgh'), 'Use letras e números.');
    expect(Validators.newPassword('abcd1234'), isNull);
    expect(Validators.name('Maria'), isNotNull);
    expect(Validators.name('Maria Silva'), isNull);
    expect(Validators.passwordStrength('Abcdef12!xyz'), 4);
  });

  test('endereço serializa e formata', () {
    const a = Address(street: 'Rua A', number: '10', district: 'Centro', city: 'SP', state: 'SP');
    final back = Address.decodeList(Address.encodeList([a])).single;
    expect(back.line1, 'Rua A, 10');
    expect(back.line2, 'Centro • SP - SP');
    expect(const Address(street: 'Rua B', city: 'X', state: 'Y').line1, 'Rua B, S/N');
  });

  group('lista inteligente', () {
    CatalogItem t(String key, String name, String unit, List<String> brands, [int markets = 3]) => CatalogItem(
      key: key,
      name: name,
      unit: unit,
      categoryId: 'mercearia',
      minPriceCents: 500,
      markets: markets,
      brands: brands,
    );
    final catalog = [
      t('acucar refinado|1kg', 'Açúcar Refinado', '1 kg', ['Caravelas', 'Marca da Casa', 'União'], 4),
      t('acucar refinado|5kg', 'Açúcar Refinado', '5 kg', ['União'], 2),
      t('manteiga|200g', 'Manteiga', '200 g', ['Aviação', 'Qualy']),
      t('oleo de soja|900ml', 'Óleo de Soja', '900 ml', ['Liza']),
      t('arroz tipo 1|5kg', 'Arroz Tipo 1', '5 kg', ['Camil', 'Tio João']),
    ];

    test('quantidade e tamanho', () {
      expect(parseLine('Óleo de soja — 2').qty, 2);
      expect(parseLine('3x arroz 5kg').qty, 3);
      expect(parseLine('3x arroz 5kg').size, '5kg');
      expect(parseLine('Leite 1 litro').size, '1l');
    });

    test('marca respeitada, genérico e marca inexistente', () {
      final m = resolveLine('Manteiga Qualy', catalog);
      expect((m.brand, m.brandFound, m.options.first.key), ('Qualy', true, 'manteiga|200g'));
      expect(resolveLine('Açúcar', catalog).options.map((o) => o.key), ['acucar refinado|1kg', 'acucar refinado|5kg']);
      expect(resolveLine('açucar 5 kg', catalog).options.single.key, 'acucar refinado|5kg');
      expect(resolveLine('arroz tio joao', catalog).brand, 'Tio João');
      final c = resolveLine('Óleo de soja Camil', catalog);
      expect((c.brand, c.brandFound), ('Camil', false));
      expect(resolveLine('Detergente', catalog).options, isEmpty);
    });

    test('separa a lista', () {
      expect(splitList('Açúcar\nManteiga Qualy; Óleo — 2, Leite 1,5 l'), [
        'Açúcar',
        'Manteiga Qualy',
        'Óleo — 2',
        'Leite 1,5 l',
      ]);
    });
  });

  test('comparação de versões para atualização obrigatória', () {
    expect(compareVersions('1.0.0', '1.0.0'), 0);
    expect(compareVersions('1.0.0', '1.0.1'), -1);
    expect(compareVersions('1.10.0', '1.9.9'), 1);
    expect(compareVersions('2', '1.9'), 1);
  });
}
