import assert from 'node:assert/strict';
import { test } from 'node:test';

import { maskCpf, normalizeCpf } from '../src/lib/cpf.ts';

test('CPF válido, com ou sem pontuação', () => {
  assert.equal(normalizeCpf('529.982.247-25'), '52998224725');
  assert.equal(normalizeCpf('52998224725'), '52998224725');
});

test('CPF inválido é recusado', () => {
  for (const v of ['529.982.247-24', '111.111.111-11', '123', '', null, 52998224725]) assert.equal(normalizeCpf(v), null);
});

test('CPF mascarado nunca mostra o número inteiro', () => {
  assert.equal(maskCpf('52998224725'), '***.982.247-**');
});
