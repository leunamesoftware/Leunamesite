// Service worker do LeuName Gestão -- só existe pra habilitar "Instalar app"
// no navegador (celular e computador). Não faz cache agressivo de nada:
// o app é local-first (os dados ficam no IndexedDB do aparelho), então
// aqui só deixamos passar as requisições direto pra rede, sem
// interceptar nem guardar nada. Isso evita a dor de cabeça clássica de
// service worker servindo uma versão antiga do app depois de um deploy.
self.addEventListener('install', function (event) {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function () {
  // sem intercepção: deixa o navegador buscar normalmente na rede
});
