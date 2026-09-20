/* ==========================================================================
   LeuName Softwares — Página de demo de producto (demo.html?id=...)
   --------------------------------------------------------------------------
   Página única en una sola columna, pensada para "enganchar" al cliente y
   llevarlo a comprar sin fricción: bienvenida, descripción real del
   producto, captura de pantalla real, beneficios, video (solo si existe
   uno real, sin placeholder "en camino"), señales de confianza y un
   llamado a comprar que va DIRECTO al checkout. Una barra fija abajo (solo
   en mobile) mantiene el precio y el botón de compra siempre a mano
   mientras el cliente se desplaza por la página.

   Es la MISMA página para todos los productos: solo cambia el contenido
   según el id en la URL (?id=...) — nunca hay que crear una página nueva
   por producto.
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
    var stickyEl = document.getElementById('demoSticky');
    if (!contentEl) return;
    if (coverEl) coverEl.innerHTML = '';
    if (stickyEl) { stickyEl.innerHTML = ''; stickyEl.classList.remove('is-visible'); }

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

    var aboutHTML = product.description && product.description !== product.short
      ? '<p class="demo-about">' + product.description + '</p>'
      : '';

    var screenshotHTML = product.imageUrl
      ? '<div class="demo-screenshot">' +
          '<div class="demo-screenshot-bar"><span></span><span></span><span></span></div>' +
          '<img src="' + product.imageUrl + '" alt="Interfaz de ' + product.name + '">' +
        '</div>'
      : '';

    var benefitsHTML = (product.features || []).map(function (f) {
      return '<div class="demo-benefit">' +
        '<span class="demo-benefit-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 13 4 4 10-10"/></svg></span>' +
        '<p>' + f + '</p>' +
      '</div>';
    }).join('');

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
        aboutHTML +
      '</section>' +
      screenshotHTML +
      (benefitsHTML ? '<section class="demo-section"><h2>Qué vas a encontrar</h2><div class="demo-benefits">' + benefitsHTML + '</div></section>' : '') +
      videoHTML +
      '<div class="demo-trust-row">' +
        '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z"/></svg></span><div><h4>Compra segura</h4></div></div>' +
        '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg></span><div><h4>Entrega digital inmediata</h4></div></div>' +
      '</div>' +
      '<section class="demo-cta">' +
        '<h2>¿Listo para empezar?</h2>' +
        '<p class="demo-cta-price">' + Store.formatPrice(product.price) + '</p>' +
        '<button type="button" id="demoBuyNowBtn" class="btn btn-primary btn-block">Comprar ahora</button>' +
        '<p class="demo-cta-hint">Pago seguro con tarjeta · entrega digital inmediata</p>' +
      '</section>';

    function irAComprar() {
      if (window.LeuCart) window.LeuCart.addItem(product.id, 1);
      location.href = 'checkout.html';
    }

    var buyNow = document.getElementById('demoBuyNowBtn');
    if (buyNow) buyNow.addEventListener('click', irAComprar);

    // Barra fija abajo (solo mobile, ver CSS): mantiene el precio y el
    // botón de compra siempre visibles mientras el cliente se desplaza,
    // apareciendo recién cuando pasa la sección de bienvenida inicial.
    if (stickyEl) {
      stickyEl.innerHTML =
        '<span class="demo-sticky-bar-price">' + Store.formatPrice(product.price) + '</span>' +
        '<button type="button" id="demoStickyBuyBtn" class="btn btn-primary">Comprar ahora</button>';
      var stickyBuy = document.getElementById('demoStickyBuyBtn');
      if (stickyBuy) stickyBuy.addEventListener('click', irAComprar);

      var welcomeEl = contentEl.querySelector('.demo-welcome');
      if (welcomeEl && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            stickyEl.classList.toggle('is-visible', !entry.isIntersecting);
          });
        }, { threshold: 0 });
        observer.observe(welcomeEl);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', render);
  document.addEventListener('products:updated', render);
})();
