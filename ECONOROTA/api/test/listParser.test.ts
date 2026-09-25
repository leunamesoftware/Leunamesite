import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseLine, resolveLine, splitList, type CatalogType } from '../src/lib/listParser.ts';

const t = (key: string, name: string, unit: string, brands: string[], markets = 3, price = 500): CatalogType => ({
  key, name, unit, brands, minPriceCents: price, markets, imageUrl: null,
});
const catalog = [
  t('acucar refinado|1kg', 'Açúcar Refinado', '1 kg', ['Caravelas', 'Marca da Casa', 'União'], 4, 399),
  t('acucar refinado|5kg', 'Açúcar Refinado', '5 kg', ['União'], 2, 2290),
  t('manteiga|200g', 'Manteiga', '200 g', ['Aviação', 'Qualy']),
  t('oleo de soja|900ml', 'Óleo de Soja', '900 ml', ['Liza']),
  t('arroz tipo 1|5kg', 'Arroz Tipo 1', '5 kg', ['Camil', 'Tio João']),
  t('leite integral|1l', 'Leite Integral', '1 L', ['Italac']),
];

test('quantidade no fim, no começo e tamanho', () => {
  assert.deepEqual(parseLine('Óleo de soja — 2'), { text: 'oleo de soja', qty: 2, size: null });
  assert.equal(parseLine('3x arroz 5kg').qty, 3);
  assert.equal(parseLine('3x arroz 5kg').size, '5kg');
  assert.equal(parseLine('Leite 1 litro').size, '1l');
  assert.equal(parseLine('- Açúcar').qty, 1);
});

test('marca informada é respeitada', () => {
  const r = resolveLine('Manteiga Qualy', catalog);
  assert.equal(r.brand, 'Qualy');
  assert.equal(r.brandFound, true);
  assert.equal(r.options[0].key, 'manteiga|200g');
});

test('item genérico devolve opções, a mais comum primeiro', () => {
  const r = resolveLine('Açúcar', catalog);
  assert.equal(r.brand, null);
  assert.deepEqual(r.options.map((o) => o.key), ['acucar refinado|1kg', 'acucar refinado|5kg']);
});

test('tamanho filtra as opções', () => {
  const r = resolveLine('açucar 5 kg', catalog);
  assert.deepEqual(r.options.map((o) => o.key), ['acucar refinado|5kg']);
});

test('marca com acento e várias palavras', () => {
  assert.equal(resolveLine('arroz tio joao', catalog).brand, 'Tio João');
  assert.equal(resolveLine('Açúcar marca da casa', catalog).brand, 'Marca da Casa');
});

test('marca que não existe para o produto não é trocada', () => {
  const r = resolveLine('Óleo de soja Camil', catalog);
  assert.equal(r.brand, 'Camil');
  assert.equal(r.brandFound, false);
  assert.equal(r.options[0].key, 'oleo de soja|900ml');
});

test('produto desconhecido fica sem opções', () => {
  assert.equal(resolveLine('Detergente', catalog).options.length, 0);
});

test('separa lista por linha, ponto e vírgula e vírgula', () => {
  assert.deepEqual(splitList('Açúcar\nManteiga Qualy; Óleo — 2, Leite 1,5 l'), ['Açúcar', 'Manteiga Qualy', 'Óleo — 2', 'Leite 1,5 l']);
});
