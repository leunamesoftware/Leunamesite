// Script de linha de comando para a equipe da LeuName emitir uma licença
// diretamente no banco, sem precisar do servidor HTTP rodando.
//
// Uso:
//   node cli.js emitir "Loja Bencel" contato@bencel.com.br 4
//   node cli.js listar
//   node cli.js revogar LEU-XXXX-XXXX-XXXX

const crypto = require('crypto');
const db = require('./db');

function generateLicenseKey() {
  const block = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `LEU-${block()}-${block()}-${block()}`;
}

const [, , cmd, ...args] = process.argv;

if (cmd === 'emitir') {
  const [lojaNome, email, maxDevices] = args;
  if (!lojaNome) {
    console.error('Uso: node cli.js emitir "Nome da Loja" [email] [maxDispositivos]');
    process.exit(1);
  }
  const key = generateLicenseKey();
  db.prepare(
    'INSERT INTO licenses (id, license_key, loja_nome, responsavel_email, max_devices, status, created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(crypto.randomUUID(), key, lojaNome, email || null, Number(maxDevices) || 4, 'active', new Date().toISOString());
  console.log('Licença criada:');
  console.log('  Loja:  ', lojaNome);
  console.log('  Chave: ', key);
} else if (cmd === 'listar') {
  const rows = db.prepare('SELECT license_key, loja_nome, status, max_devices, created_at FROM licenses ORDER BY created_at DESC').all();
  console.table(rows);
} else if (cmd === 'revogar') {
  const [key] = args;
  if (!key) { console.error('Uso: node cli.js revogar LEU-XXXX-XXXX-XXXX'); process.exit(1); }
  const info = db.prepare("UPDATE licenses SET status = 'revoked' WHERE license_key = ?").run(key.toUpperCase());
  console.log(info.changes ? 'Licença revogada.' : 'Licença não encontrada.');
} else {
  console.log('Comandos disponíveis: emitir, listar, revogar');
}
