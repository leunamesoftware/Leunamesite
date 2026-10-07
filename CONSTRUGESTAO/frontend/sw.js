// Service worker do ConstruGestão: habilita "Instalar app" no navegador (Chrome, Edge, Samsung Internet)
// e deixa o app abrir sem internet. Busca sempre na rede primeiro (nunca prende uma versão antiga depois
// de um deploy); só usa a cópia guardada quando está sem internet. Os dados ficam no IndexedDB do aparelho.
const CACHE = 'construgestao-v2';
const BASE = ['/', '/index.html', '/manifest.webmanifest', '/instalar.js', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  // Só os arquivos do próprio app; conta da loja (/loja-api) e outros endereços vão direto para a rede.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/loja-api/')) return;
  e.respondWith(fetch(req).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
