/* ==========================================================================
   LeuName Softwares — Página de demo de producto (demo.html?id=...)
   --------------------------------------------------------------------------
   Muestra una demostración del producto: por ahora solo un espacio
   reservado para el video (todavía no existe un video real grabado), sin
   simular ninguna reproducción falsa. Cuando el producto tenga un
   product.demoVideoUrl real, esta página lo mostrará automáticamente.
   ========================================================================== */
(function () {
  'use strict';

  function render() {
    var Store = window.LeuStore;
    if (!Store) return;
    var id = new URLSearchParams(window.location.search).get('id');
    var product = id ? Store.getProduct(id) : null;
    var contentEl = document.getElementById('demoContent');
    var breadcrumbEl = document.getElementById('demoBreadcrumb');
    if (!contentEl) return;

    if (!product) {
      contentEl.innerHTML =
        '<div class="confirm-card">' +
          '<h1>Demo no encontrada</h1>' +
          '<p>No encontramos una demostración para este producto.</p>' +
          '<div class="confirm-actions"><a href="categoria.html" class="btn btn-primary">Ver productos</a></div>' +
        '</div>';
      return;
    }

    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = '<a href="index.html">Inicio</a> / <a href="producto.html?id=' + product.id + '">' + product.name + '</a> / Demo';
    }
    document.title = 'Demo de ' + product.name + ' — LeuName Softwares';

    var featuresHTML = (product.features || []).map(function (f) {
      return '<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 13 4 4 10-10"/></svg>' + f + '</li>';
    }).join('');

    var videoBlock = product.demoVideoUrl
      ? '<video class="demo-video" controls src="' + product.demoVideoUrl + '"></video>'
      : '<div class="demo-video-placeholder">' +
          '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m21 8-4 3 4 3V8Z"/></svg>' +
          '<p>Video de demostración en camino</p>' +
          '<small>Muy pronto vas a poder ver el producto en acción aquí.</small>' +
        '</div>';

    contentEl.innerHTML =
      '<div class="demo-layout">' +
        '<div>' +
          '<h1>Demo: ' + product.name + '</h1>' +
          '<p class="short-desc">' + product.short + '</p>' +
          videoBlock +
          (featuresHTML ? '<div class="product-block" style="margin-top:28px;"><h2>Qué vas a ver en esta demo</h2><ul class="feature-list">' + featuresHTML + '</ul></div>' : '') +
        '</div>' +
        '<aside class="cart-summary">' +
          '<h2>' + Store.formatPrice(product.price) + '</h2>' +
          '<p style="color:var(--ink-600);font-size:13.5px;margin-top:6px;">¿Te gustó lo que viste?</p>' +
          '<a href="producto.html?id=' + product.id + '" class="btn btn-primary btn-block" style="margin-top:14px;">Ver página del producto</a>' +
        '</aside>' +
      '</div>';
  }

  document.addEventListener('DOMContentLoaded', render);
  document.addEventListener('products:updated', render);
})();
