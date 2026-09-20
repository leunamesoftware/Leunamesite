/* ==========================================================================
   LeuName Softwares — Página de produto (producto.html?id=...)
   ========================================================================== */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var Store = window.LeuStore;
    if (!Store) return;

    var params = new URLSearchParams(location.search);
    var id = params.get('id');
    var product = id ? Store.getProduct(id) : null;

    var detailEl = document.getElementById('productDetail');
    var tabsEl = document.getElementById('productTabs');
    var relatedEl = document.getElementById('relatedGrid');
    var notFoundEl = document.getElementById('productNotFound');

    if (!product) {
      if (detailEl) detailEl.hidden = true;
      if (tabsEl) tabsEl.hidden = true;
      var relatedSection = relatedEl ? relatedEl.closest('section') : null;
      if (relatedSection) relatedSection.hidden = true;
      if (notFoundEl) notFoundEl.hidden = false;
      document.title = 'Produto não encontrado — LeuName Softwares';
      return;
    }

    document.title = product.name + ' — LeuName Softwares';
    var cat = Store.getCategory(product.category);

    var breadcrumbCat = document.getElementById('breadcrumbCat');
    var breadcrumbName = document.getElementById('breadcrumbName');
    if (breadcrumbCat && cat) { breadcrumbCat.textContent = cat.name; breadcrumbCat.href = 'categoria.html?slug=' + cat.slug; }
    if (breadcrumbName) breadcrumbName.textContent = product.name;

    detailEl.innerHTML =
      '<div class="product-gallery">' + Store.productVisualHTML(product) + '</div>' +
      '<div class="product-info">' +
        '<span class="cat-tag">' + (cat ? cat.name : '') + '</span>' +
        (product.real ? '<span class="cat-tag" style="background:#e2f6ea;color:#1a9a55;margin-left:8px;">Producto real</span>' : '') +
        '<h1>' + product.name + '</h1>' +
        '<div class="product-card-rating">' +
          '<span class="stars">' + Store.starsHTML(product.rating) + '</span>' +
          '<span class="rating-num">' + product.rating.toFixed(1) + '</span>' +
          '<span class="rating-count">(' + product.reviews + ' valoraciones)</span>' +
        '</div>' +
        '<p class="short-desc">' + product.short +
          (product.demoUrl ? ' Haz clic en «Ver demo» (el botón naranja) y mira una vista previa de cómo funciona.' : '') +
        '</p>' +
        '<!-- PRECIO DE EJEMPLO: reemplazar por el precio real -->' +
        '<div class="price-row"><span class="price-big">' + Store.formatPrice(product.price) + '</span>' + (product.real ? '' : '<span class="price-badge">Precio de ejemplo</span>') + '</div>' +
        '<div class="product-actions">' +
          '<div class="product-actions-cart">' +
            '<div class="qty-stepper">' +
              '<button type="button" data-qty-step="qtyInput" data-dir="down" aria-label="Restar">−</button>' +
              '<input id="qtyInput" type="number" min="1" value="1" aria-label="Cantidad">' +
              '<button type="button" data-qty-step="qtyInput" data-dir="up" aria-label="Sumar">+</button>' +
            '</div>' +
            '<button class="btn btn-cart" data-add-to-cart data-product-id="' + product.id + '" data-qty-target="qtyInput">Añadir al carrito</button>' +
          '</div>' +
          '<div class="product-actions-buy">' +
            '<button class="btn btn-primary" id="buyNowBtn">Comprar ahora</button>' +
            (product.demoUrl ? '<button type="button" class="btn btn-demo" id="verDemoBtn">Ver demo</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="trust-row">' +
          '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z"/></svg></span><div><h4>Compra segura</h4></div></div>' +
          '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg></span><div><h4>Entrega digital inmediata</h4></div></div>' +
        '</div>' +
      '</div>';

    var buyNow = document.getElementById('buyNowBtn');
    if (buyNow) {
      buyNow.addEventListener('click', function () {
        var qtyInput = document.getElementById('qtyInput');
        var qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
        window.LeuCart.addItem(product.id, qty);
        location.href = 'checkout.html';
      });
    }

    // "Ver demo" abre la demo como overlay de pantalla completa DENTRO de
    // esta misma página (sin navegar a demo.html) -- así el clic del
    // cliente sigue "vivo" cuando el video se arma, y el navegador permite
    // que el presentador arranque hablando con sonido de inmediato.
    var verDemoBtn = document.getElementById('verDemoBtn');
    var demoOverlay = document.getElementById('demoOverlay');
    if (verDemoBtn && demoOverlay && window.LeuDemo) {
      var cerrarDemo = function () {
        demoOverlay.hidden = true;
        demoOverlay.innerHTML = '';
        document.body.style.overflow = '';
      };
      verDemoBtn.addEventListener('click', function () {
        demoOverlay.innerHTML =
          '<header class="demo-minimal-header demo-overlay-header">' +
            '<div class="container">' +
              '<a href="index.html" aria-label="LeuName Softwares — Inicio">' +
                '<img src="assets/img/logo-mark.png" alt="" width="34" height="34">' +
                '<span><span class="demo-minimal-brand-word">LEUNAME</span><span class="demo-minimal-brand-sub">SOFTWARES</span></span>' +
              '</a>' +
              '<button type="button" class="demo-overlay-close" id="demoOverlayClose" aria-label="Cerrar demo">&times;</button>' +
            '</div>' +
          '</header>' +
          '<main><div id="demoOverlayCover"></div><div class="container" style="padding-block:8px 64px;"><div id="demoOverlayContent"></div></div></main>' +
          '<div class="demo-sticky-bar" id="demoOverlaySticky"></div>';

        demoOverlay.hidden = false;
        document.body.style.overflow = 'hidden';
        window.LeuDemo.render(product, {
          contentEl: demoOverlay.querySelector('#demoOverlayContent'),
          coverEl: demoOverlay.querySelector('#demoOverlayCover'),
          stickyEl: demoOverlay.querySelector('#demoOverlaySticky')
        }, { autoplaySound: true });

        history.pushState({ demoOverlay: true }, '', product.demoUrl);
        demoOverlay.querySelector('#demoOverlayClose').addEventListener('click', function () {
          history.back();
        });
      });
      window.addEventListener('popstate', function (ev) {
        if (!demoOverlay.hidden && !(ev.state && ev.state.demoOverlay)) cerrarDemo();
      });
    }

    var includesHTML = (product.includes || []).map(function (i) {
      return '<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 13 4 4 10-10"/></svg>' + i + '</li>';
    }).join('');
    var featuresHTML = (product.features || []).map(function (f) {
      return '<li><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 13 4 4 10-10"/></svg>' + f + '</li>';
    }).join('');
    var faqs = (Store.FAQS_BY_CATEGORY && Store.FAQS_BY_CATEGORY[product.category]) || [];
    var faqHTML = faqs.map(function (f, idx) {
      return '<div class="faq-item">' +
        '<button class="faq-q" aria-expanded="false" id="faqq' + idx + '">' + f.q + '<svg class="chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>' +
        '<div class="faq-a" hidden>' + f.a + '</div>' +
      '</div>';
    }).join('');

    tabsEl.innerHTML =
      '<div class="product-block"><h2>Descripción</h2><p style="color:var(--ink-600);line-height:1.7;">' + product.description + '</p></div>' +
      '<div class="product-block"><h2>Qué incluye</h2><ul class="check-list">' + includesHTML + '</ul></div>' +
      '<div class="product-block"><h2>Características</h2><ul class="feature-list">' + featuresHTML + '</ul></div>' +
      (faqHTML ? '<div class="product-block"><h2>Preguntas frecuentes</h2>' + faqHTML + '</div>' : '');

    // Reactiva el acordeón de FAQ recién insertado (main.js ya delega en DOMContentLoaded,
    // que corrió antes de que este HTML existiera).
    tabsEl.querySelectorAll('.faq-item').forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      var panel = item.querySelector('.faq-a');
      btn.addEventListener('click', function () {
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
      });
    });

    var related = Store.getProductsByCategory(product.category).filter(function (p) { return p.id !== product.id; }).slice(0, 6);
    if (!related.length) related = Store.PRODUCTS.filter(function (p) { return p.id !== product.id; }).slice(0, 6);
    Store.mountProductGrid('relatedGrid', related);
  });
})();
