// Service worker do painel admin do Sucatell -- só existe pra habilitar
// "Instalar" (ícone na área de trabalho). Sem cache: tudo vai direto pra
// rede, pra nunca mostrar dados antigos no painel.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
