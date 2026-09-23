// Service worker do LeuCloud -- só existe pra habilitar "Instalar app" no
// navegador. O LeuCloud depende de rede de verdade (upload/download real
// no servidor), então aqui não fazemos cache de nada: deixamos toda
// requisição ir direto pra rede, pra nunca servir uma versão antiga do
// app nem uma resposta de API desatualizada depois de um deploy.
self.addEventListener('install', function (event) {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function () {
  // sem intercepção: deixa o navegador buscar normalmente na rede
});
