// Web Crypto padrão: funciona igual no Node 22 e na Cloudflare.
const crypto = globalThis.crypto;

// 100 mil iterações: forte e ainda compatível com qualquer hospedagem (algumas limitam a 100 mil).
const ITERACOES = 100_000;
const BYTES_SAL = 16;

const paraHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
const deHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((par) => parseInt(par, 16)));

async function derivar(senha: string, sal: Uint8Array, pimenta: string, iteracoes: number): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha + pimenta), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteracoes }, chave, 256);
  return paraHex(bits);
}

/** Gera o hash guardado no banco: "pbkdf2$iterações$sal$hash". A senha em si nunca é guardada. */
export async function gerarHashSenha(senha: string, pimenta: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(BYTES_SAL));
  return `pbkdf2$${ITERACOES}$${paraHex(sal)}$${await derivar(senha, sal, pimenta, ITERACOES)}`;
}

export async function conferirSenha(senha: string, guardado: string, pimenta: string): Promise<boolean> {
  const [algoritmo, iteracoes, sal, hash] = guardado.split('$');
  if (algoritmo !== 'pbkdf2' || !iteracoes || !sal || !hash) return false;
  const calculado = await derivar(senha, deHex(sal), pimenta, Number(iteracoes));
  return compararSemVazarTempo(calculado, hash);
}

function compararSemVazarTempo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/** Credencial de sessão aleatória (vai só para o aparelho do usuário). */
export function gerarToken(): string {
  return paraHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(texto: string): Promise<string> {
  return paraHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
}

export const novoId = () => crypto.randomUUID();
