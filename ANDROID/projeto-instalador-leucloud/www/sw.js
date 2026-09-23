// Service worker do LeuCloud -- só existe pra habilitar "Instalar app" no
// navegador, e pra receber compartilhamento de outros apps (Galeria,
// WhatsApp, etc escolhendo "LeuCloud" na tela de compartilhar). O app é
// online-first (upload/download real no servidor), então NÃO fazemos
// cache de nada além do compartilhamento recebido: toda outra
// requisição vai direto pra rede, pra nunca servir uma versão antiga do
// app nem uma resposta de API desatualizada depois de um deploy.
self.addEventListener('install', function (event) {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

var CACHE_COMPARTILHADO = 'leucloud-compartilhado-v1';

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // Android/Chrome manda um POST multipart pra essa URL quando a pessoa
  // escolhe "LeuCloud" na tela de compartilhar do sistema (foto, vídeo,
  // etc). Guarda os arquivos recebidos num Cache temporário e manda o
  // navegador abrir o app normal, que le esse cache e mostra a pessoa
  // onde salvar.
  if (event.request.method === 'POST' && url.pathname === '/compartilhar') {
    event.respondWith((async function () {
      try {
        var formData = await event.request.formData();
        var arquivos = formData.getAll('arquivos');
        var cache = await caches.open(CACHE_COMPARTILHADO);
        var chavesAntigas = await cache.keys();
        for (var i = 0; i < chavesAntigas.length; i++) await cache.delete(chavesAntigas[i]);
        for (var j = 0; j < arquivos.length; j++) {
          var arquivo = arquivos[j];
          var headers = new Headers();
          headers.set('Content-Type', arquivo.type || 'application/octet-stream');
          headers.set('X-Nome-Original', encodeURIComponent(arquivo.name || ('arquivo-' + j)));
          await cache.put('/__compartilhado__/' + j, new Response(arquivo, { headers: headers }));
        }
      } catch (e) {
        // Se der erro, so segue pro app sem nada pra processar.
      }
      return Response.redirect('/?compartilhar=1', 303);
    })());
    return;
  }
  // sem intercepção pro resto: deixa buscar normalmente na rede
});
