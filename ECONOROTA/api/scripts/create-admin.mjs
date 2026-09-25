// Gera o SQL para criar o primeiro administrador (a senha nunca vai para o repositório).
// Uso: node scripts/create-admin.mjs "Nome" email@dominio.com
//      → digite a senha → execute o SQL gerado com wrangler d1 execute.
import { webcrypto as crypto } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { writeFileSync } from 'node:fs';

const [name, email] = process.argv.slice(2);
if (!name || !email) {
  console.error('Uso: node scripts/create-admin.mjs "Nome" email@dominio.com');
  process.exit(1);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Senha (mín. 12 caracteres): ');
rl.close();
if (password.length < 12) {
  console.error('Senha muito curta.');
  process.exit(1);
}

const b64url = (b) => Buffer.from(b).toString('base64url');
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
const hash = `pbkdf2$100000$${b64url(salt)}$${b64url(bits)}`;
const esc = (s) => s.replace(/'/g, "''");

const sql = `INSERT INTO users (id, name, email, password_hash, role, status) VALUES ('${crypto.randomUUID()}', '${esc(name)}', '${esc(email.toLowerCase())}', '${hash}', 'admin', 'ativo');\n`;
writeFileSync('.admin.sql', sql);
console.log('SQL gerado em .admin.sql. Execute:\n  npx wrangler d1 execute econorota --remote --file=.admin.sql && rm .admin.sql');
