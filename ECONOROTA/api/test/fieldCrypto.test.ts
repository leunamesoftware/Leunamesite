import assert from 'node:assert/strict';
import { test } from 'node:test';

import { seal, unseal } from '../src/lib/fieldCrypto.ts';

const env = { DATA_KEY: Buffer.from(new Uint8Array(32).fill(7)).toString('base64') };

test('cifra e decifra (AES-GCM, IV aleatório)', async () => {
  const a = await seal(env, '52998224725');
  const b = await seal(env, '52998224725');
  assert.ok(a!.startsWith('enc:v1:'));
  assert.notEqual(a, b);
  assert.equal(await unseal(env, a), '52998224725');
});

test('texto antigo continua legível; sem chave não cifra', async () => {
  assert.equal(await unseal(env, 'chave@pix.com'), 'chave@pix.com');
  assert.equal(await seal({ DEV_MODE: 'true' }, 'x@y.com'), 'x@y.com');
  await assert.rejects(seal({}, 'x@y.com')); // produção sem chave: recusa
  assert.equal(await seal(env, null), null);
});

test('dado adulterado ou chave errada falha', async () => {
  const a = (await seal(env, 'segredo'))!;
  await assert.rejects(unseal(env, a.slice(0, -4) + 'AAAA'));
  await assert.rejects(unseal({ DATA_KEY: Buffer.from(new Uint8Array(32).fill(9)).toString('base64') }, a));
  await assert.rejects(unseal({}, a));
});
