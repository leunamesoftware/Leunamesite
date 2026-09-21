/* ==========================================================================
   LeuName Softwares — Camada de dados com melhoria progressiva
   --------------------------------------------------------------------------
   Todas as páginas renderizam primeiro com os dados estáticos de
   js/products.js (rápido e sempre disponível, mesmo sem backend).
   Em segundo plano, este script tenta buscar o catálogo real no
   Worker do Cloudflare; se responder, atualiza LeuStore.PRODUCTS no
   mesmo array (para que qualquer referência já obtida continue válida)
   e dispara o evento "products:updated" para quem quiser renderizar de novo.
   Se o backend não responder (ainda não implantado, sem rede, etc.) o site
   continua funcionando normalmente com os dados estáticos: nunca aparece
   uma página em branco por falta de backend.

   TODO: este backend ainda é o mesmo servidor/loja do site em espanhol,
   usado aqui só como placeholder até o backend brasileiro existir.
   ========================================================================== */
(function (global) {
  'use strict';

  // URL pública do Worker "leuname-loja" (Cloudflare). É preenchida quando
  // implantado (ver PROJETO/servidor-loja-cloudflare/). Deixar vazio desativa
  // a tentativa de rede e o site usa só os dados estáticos.
  var BACKEND_URL = 'https://leuname-loja.emanuelantunes2024.workers.dev';

  // Textos (nome, descrição, o que inclui, características) SEMPRE vêm dos
  // dados estáticos em português (js/products.js), nunca do backend: o
  // banco é compartilhado com o site em espanhol e "nombre"/"descripcion"
  // lá estão em espanhol. Guardamos uma cópia deles ANTES do backend
  // responder, por id, só pra usar como fonte de texto -- o backend segue
  // sendo a fonte de preço (precio_br), avaliação, estoque/ativo, imagem
  // e afins, que não têm problema de idioma.
  var textoEstaticoPorId = {};
  (global.LeuStore ? global.LeuStore.PRODUCTS : []).forEach(function (p) {
    textoEstaticoPorId[p.id] = p;
  });

  function mapRemoteProduct(row) {
    var estatico = textoEstaticoPorId[row.id];
    return {
      id: row.id,
      name: estatico ? estatico.name : row.nombre,
      category: row.categoria,
      real: !!row.real,
      // Preço do Brasil (precio_br) é uma coluna própria no banco,
      // separada do preço em euros do site .com (precio) -- os dois nunca
      // se misturam. Sem precio_br cadastrado, mostramos 0 em vez de cair
      // pro valor em euros, que seria o preço errado pro cliente brasileiro.
      price: row.precio_br != null ? Number(row.precio_br) : 0,
      rating: Number(row.rating || 4.5),
      reviews: Number(row.reviews || 0),
      short: estatico ? estatico.short : (row.descripcion_corta || ''),
      description: estatico ? estatico.description : (row.descripcion || ''),
      includes: estatico ? estatico.includes : (row.incluye ? JSON.parse(row.incluye) : []),
      features: estatico ? estatico.features : (row.caracteristicas ? JSON.parse(row.caracteristicas) : []),
      badge: row.real ? 'Produto real' : 'Exemplo',
      imageUrl: row.imagen_url || null,
      demoUrl: row.demo_url || (estatico ? estatico.demoUrl : null),
      tag: row.tag || null
    };
  }

  function refreshFromBackend() {
    if (!BACKEND_URL || !global.LeuStore) return;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 4000) : null;
    fetch(BACKEND_URL + '/productos', { signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { if (!res.ok) throw new Error('bad_status'); return res.json(); })
      .then(function (data) {
        if (timer) clearTimeout(timer);
        if (!data || !Array.isArray(data.productos) || !data.productos.length) return;
        var mapped = data.productos.map(mapRemoteProduct);
        global.LeuStore.PRODUCTS.splice(0, global.LeuStore.PRODUCTS.length);
        Array.prototype.push.apply(global.LeuStore.PRODUCTS, mapped);
        document.dispatchEvent(new CustomEvent('products:updated'));
      })
      .catch(function () {
        // Backend ainda não disponível: continuamos com os dados estáticos.
        if (timer) clearTimeout(timer);
      });
  }

  global.LeuApi = { refreshFromBackend: refreshFromBackend, BACKEND_URL: BACKEND_URL };
  document.addEventListener('DOMContentLoaded', refreshFromBackend);
})(window);
