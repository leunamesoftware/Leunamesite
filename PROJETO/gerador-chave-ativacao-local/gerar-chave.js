#!/usr/bin/env node
/*
 * Gerador de chave de ativação LOCAL do LeuName Gestão (primeiro cliente).
 *
 * Não depende de internet, servidor ou pacotes externos — usa só o módulo
 * "crypto" que já vem com o Node.js. Gera uma chave no formato
 * LEU-XXXX-XXXX-YYYY, onde YYYY é uma assinatura (HMAC-SHA256) dos dois
 * primeiros grupos, calculada com o mesmo segredo que está embutido no
 * próprio app (constante LICENSE_LOCAL_SECRET). É esse segredo compartilhado
 * que faz o app conseguir validar a chave sozinho, sem precisar consultar
 * nenhum servidor.
 *
 * IMPORTANTE: o valor de SECRET abaixo tem que ser IDÊNTICO ao valor da
 * constante LICENSE_LOCAL_SECRET nos 3 arquivos do app:
 *   - PROJETO/leuname-gestao.html
 *   - WINDOWS/projeto-instalador-windows/app/index.html
 *   - ANDROID/projeto-instalador-android/www/index.html
 * Se um dia você trocar o segredo em algum desses arquivos, troque aqui
 * também (e toda chave já entregue antes da troca deixa de funcionar).
 *
 * Uso:
 *   node gerar-chave.js
 *   node gerar-chave.js MEUCLIENTE1     (rótulo só para você lembrar quem é;
 *                                        não é obrigatório, não vai dentro
 *                                        da chave nem é verificado pelo app)
 */

const crypto = require('crypto');

const SECRET = 'LeuName-Ativacao-Local-PrimeiroCliente-2026-v1';
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomGroup(len) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return out;
}

function checksum(g1, g2) {
  const h = crypto.createHmac('sha256', SECRET).update(`LEU-${g1}-${g2}`).digest();
  return h.subarray(0, 2).toString('hex').toUpperCase();
}

function gerarChave() {
  const g1 = randomGroup(4);
  const g2 = randomGroup(4);
  const g3 = checksum(g1, g2);
  return `LEU-${g1}-${g2}-${g3}`;
}

const rotulo = process.argv[2] || null;
const chave = gerarChave();

console.log('');
console.log('Chave de ativação gerada:');
console.log('  ' + chave);
if (rotulo) console.log('  (rótulo interno, não faz parte da chave: ' + rotulo + ')');
console.log('');
console.log('Entregue essa chave ao cliente para ele digitar na tela');
console.log('"Ativação da licença" na primeira vez que abrir o sistema.');
console.log('');
