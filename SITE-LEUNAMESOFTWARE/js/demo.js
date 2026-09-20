/* ==========================================================================
   LeuName Softwares — Página de demo de producto (demo.html?id=...)
   --------------------------------------------------------------------------
   Página única en una sola columna: bienvenida, captura de pantalla real
   del producto, características, video (solo si existe uno real) y un
   llamado a comprar al final. Sin fondos oscuros ni recuadros de video
   vacíos "en camino" — si no hay video todavía, esa sección no aparece.
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
    var coverEl = document.getElementById('demoCover');
    if (!contentEl) return;
    if (coverEl) coverEl.innerHTML = '';

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

    var screenshotHTML = product.imageUrl
      ? '<div class="demo-screenshot"><img src="' + product.imageUrl + '" alt="Interfaz de ' + product.name + '"></div>'
      : '';

    // Solo se muestra si el producto tiene un video real cargado
    // (product.demoVideoUrl) — sin recuadro de "video en camino".
    var videoHTML = product.demoVideoUrl
      ? '<section class="demo-section"><h2>Mira cómo funciona</h2><video class="demo-video" controls src="' + product.demoVideoUrl + '"></video></section>'
      : '';

    contentEl.innerHTML =
      '<section class="demo-welcome">' +
        '<span class="demo-welcome-badge"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 1 1-4.2-7.6L21 3l-1.2 4.2A8.96 8.96 0 0 1 21 12Z"/></svg></span>' +
        '<h1>¡Hola! Bienvenido a la demo de ' + product.name + '</h1>' +
        '<p>' + product.short + '</p>' +
      '</section>' +
      screenshotHTML +
      (featuresHTML ? '<section class="demo-section"><h2>Qué vas a encontrar</h2><ul class="feature-list">' + featuresHTML + '</ul></section>' : '') +
      videoHTML +
      '<section class="demo-cta">' +
        '<h2>¿Listo para empezar?</h2>' +
        '<p class="demo-cta-price">' + Store.formatPrice(product.price) + '</p>' +
        '<button type="button" id="demoBuyNowBtn" class="btn btn-primary btn-block">Comprar ahora</button>' +
      '</section>';

    // Va directo al checkout (sin pasar por la página del producto primero)
    // -- el cliente ya vio todo en la demo, no necesita ver la misma info
    // de nuevo antes de pagar.
    var buyNow = document.getElementById('demoBuyNowBtn');
    if (buyNow) {
      buyNow.addEventListener('click', function () {
        if (window.LeuCart) window.LeuCart.addItem(product.id, 1);
        location.href = 'checkout.html';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', render);
  document.addEventListener('products:updated', render);
})();
