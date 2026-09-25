// Teste de carga simples (sem dependências). Uso:
//   API=http://localhost:8787 node scripts/load.mjs [usuarios=20] [segundos=20]
// Em produção, rode contra um ambiente de testes: /compare tem limite de 120 requisições/min por IP.
const API = process.env.API ?? 'http://localhost:8787';
const users = Number(process.argv[2] ?? 20);
const seconds = Number(process.argv[3] ?? 20);
const here = { lat: -23.5575, lng: -46.656 };
const list = ['banana prata|1kg', 'tomate|1kg', 'arroz tipo 1|5kg', 'feijao carioca|1kg', 'oleo de soja|900ml', 'leite integral|1l'];

const scenarios = [
  ['GET /markets', () => fetch(`${API}/markets?lat=${here.lat}&lng=${here.lng}`)],
  ['GET /products?q=', () => fetch(`${API}/products?q=arroz&sort=price`)],
  ['GET /products/:id', () => fetch(`${API}/products/p3`)],
  ['POST /compare', () =>
    fetch(`${API}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...here, items: list.map((key) => ({ key, qty: 1 + Math.floor(Math.random() * 3) })) }),
    })],
];

const stats = new Map(scenarios.map(([n]) => [n, { times: [], errors: 0, limited: 0 }]));
const end = Date.now() + seconds * 1000;

async function worker() {
  while (Date.now() < end) {
    const [name, run] = scenarios[Math.floor(Math.random() * scenarios.length)];
    const s = stats.get(name);
    const t = performance.now();
    try {
      const r = await run();
      await r.arrayBuffer();
      if (r.status === 429) s.limited++;
      else if (!r.ok) s.errors++;
      else s.times.push(performance.now() - t);
    } catch {
      s.errors++;
    }
  }
}

const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor((a.length * p) / 100))] : 0);
console.log(`Carga: ${users} usuários simultâneos por ${seconds}s em ${API}\n`);
await Promise.all(Array.from({ length: users }, worker));
let total = 0;
let failed = 0;
console.log('Rota'.padEnd(20), 'ok'.padStart(6), 'erros'.padStart(6), '429'.padStart(5), 'p50 ms'.padStart(8), 'p95 ms'.padStart(8), 'máx ms'.padStart(8));
for (const [name, s] of stats) {
  const t = s.times.sort((a, b) => a - b);
  total += t.length + s.errors + s.limited;
  failed += s.errors;
  console.log(
    name.padEnd(20),
    String(t.length).padStart(6),
    String(s.errors).padStart(6),
    String(s.limited).padStart(5),
    pct(t, 50).toFixed(0).padStart(8),
    pct(t, 95).toFixed(0).padStart(8),
    (t.at(-1) ?? 0).toFixed(0).padStart(8),
  );
}
console.log(`\n${total} requisições · ${(total / seconds).toFixed(1)} req/s · ${failed} erros`);
process.exit(failed ? 1 : 0);
