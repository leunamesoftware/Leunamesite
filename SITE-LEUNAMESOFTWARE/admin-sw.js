/* Service worker minimo do Painel Admin — existe so para o navegador
   permitir "Instalar app" no celular. Nao guarda nada offline: o painel
   sempre precisa da rede para falar com o Worker, entao cada pedido so
   passa direto pra rede (sem cache proprio). */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
