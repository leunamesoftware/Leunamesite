// Radar Preventivo — guarda o aplicativo no celular para abrir na hora.
// - Páginas do app: abre com a cópia guardada e atualiza a cópia por trás.
// - Arquivos /assets/ (nome muda a cada versão): guardados depois do primeiro uso.
// - /api, /baixar, /versao.json e as páginas .html avulsas: sempre direto da internet.
// A troca de versão é feita pelo app (estado/AtualizacaoAutomatica.tsx), que apaga a
// cópia da página e recarrega quando sai versão nova.

const CACHE = 'radar-app-v1';
const PAGINA = '/index.html';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/** Guarda a página nova e apaga os /assets/ de versões antigas que ela não usa mais. */
async function guardarPagina(cache, resposta) {
  const html = await resposta.clone().text();
  await cache.put(PAGINA, resposta);
  const usados = new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? []);
  for (const req of await cache.keys()) {
    const caminho = new URL(req.url).pathname;
    if (caminho.startsWith('/assets/') && !usados.has(caminho)) await cache.delete(req);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith('/api/') || p.startsWith('/baixar/') || p === '/versao.json' || p === '/sw.js') return;

  if (req.mode === 'navigate') {
    if (p.endsWith('.html')) return; // privacidade, excluir conta, baixar: sempre da internet
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const guardada = await cache.match(PAGINA);
        const daRede = fetch(req).then(async (r) => {
          if (r.ok) await guardarPagina(cache, r.clone());
          return r;
        });
        if (guardada) {
          e.waitUntil(daRede.catch(() => undefined));
          return guardada;
        }
        return daRede;
      }),
    );
    return;
  }

  if (p.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const guardado = await cache.match(req);
        if (guardado) return guardado;
        const r = await fetch(req);
        if (r.ok) await cache.put(req, r.clone());
        return r;
      }),
    );
  }
});
