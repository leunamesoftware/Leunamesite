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

  function mapRemoteProduct(row) {
    return {
      id: row.id,
      name: row.nombre,
      category: row.categoria,
      real: !!row.real,
      price: Number(row.precio),
      rating: Number(row.rating || 4.5),
      reviews: Number(row.reviews || 0),
      short: row.descripcion_corta || '',
      description: row.descripcion || '',
      includes: row.incluye ? JSON.parse(row.incluye) : [],
      features: row.caracteristicas ? JSON.parse(row.caracteristicas) : [],
      badge: row.real ? 'Produto real' : 'Exemplo',
      imageUrl: row.imagen_url || null,
      demoUrl: row.demo_url || null,
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
