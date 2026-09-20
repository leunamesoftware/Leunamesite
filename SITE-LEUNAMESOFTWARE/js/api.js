/* ==========================================================================
   LeuName Softwares — Capa de datos con mejora progresiva
   --------------------------------------------------------------------------
   Todas las páginas renderizan primero con los datos estáticos de
   js/products.js (rápido y siempre disponible, incluso sin backend).
   En segundo plano, este script intenta traer el catálogo real desde el
   Worker de Cloudflare; si responde, actualiza LeuStore.PRODUCTS en el
   mismo array (para que cualquier referencia ya tomada siga siendo válida)
   y dispara el evento "products:updated" para quien quiera re-renderizar.
   Si el backend no responde (aún no desplegado, sin red, etc.) el sitio
   sigue funcionando normalmente con los datos estáticos: nunca se muestra
   una página en blanco por falta de backend.
   ========================================================================== */
(function (global) {
  'use strict';

  // URL pública del Worker "leuname-loja" (Cloudflare). Se completa una vez
  // desplegado (ver PROJETO/servidor-loja-cloudflare/). Dejar vacío desactiva
  // el intento de red y el sitio usa solo los datos estáticos.
  var BACKEND_URL = 'https://leuname-loja.leunamesoftwares.workers.dev';

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
      badge: row.real ? 'Producto real' : 'Ejemplo'
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
        // Backend no disponible todavía: seguimos con los datos estáticos.
        if (timer) clearTimeout(timer);
      });
  }

  global.LeuApi = { refreshFromBackend: refreshFromBackend, BACKEND_URL: BACKEND_URL };
  document.addEventListener('DOMContentLoaded', refreshFromBackend);
})(window);
