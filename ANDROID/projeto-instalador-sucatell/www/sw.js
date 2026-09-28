// Service worker do Sucatel -- só existe pra habilitar "Instalar app" no
// navegador. O app é online-first (busca/anúncios reais no servidor),
// então não fazemos cache de nada: toda requisição vai direto pra rede,
// pra nunca servir uma versão antiga depois de um deploy.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
