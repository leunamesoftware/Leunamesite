// Assinatura HMAC-SHA256 dos tokens de ativação — evita que o app cliente
// precise confiar cegamente na resposta; o token é auto-verificável e tem
// validade curta, então o app deve chamar /validate periodicamente
// (ex.: uma vez por dia, quando houver internet) para renovar.

const crypto = require('crypto');

const SECRET = process.env.LICENSE_SECRET;
if (!SECRET || SECRET.length < 16) {
  throw new Error(
    'Defina LICENSE_SECRET no .env com uma chave longa e aleatória ' +
    '(ex.: openssl rand -hex 32) antes de iniciar o servidor.'
  );
}

function sign(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'formato_invalido' };
  }
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: 'assinatura_invalida' };
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'payload_corrompido' };
  }
  if (data.exp && Date.now() > data.exp) {
    return { ok: false, reason: 'expirado' };
  }
  return { ok: true, data };
}

module.exports = { sign, verify };
