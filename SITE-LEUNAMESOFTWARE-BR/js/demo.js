/* ==========================================================================
   LeuName Softwares — Página de demo de producto (demo.html?id=...)
   --------------------------------------------------------------------------
   Página de ventas dedicada, pensada para enganchar al cliente sin hacerlo
   scrollear demasiado: mascota + saludo, funcionalidades en tarjetas de
   color, una captura/video destacado con checklist, y un cierre con precio
   y botón de compra que va DIRECTO al checkout (sin pasar por la página
   del producto). Es la MISMA página para todos los productos — solo
   cambia el contenido según el id de la URL.

   window.LeuDemo.render(product, els, opts) es reutilizable: la usa tanto
   esta página standalone (demo.html) como el overlay de pantalla completa
   que producto.js abre al hacer clic en "Ver demo" (ver producto.js).
   Cuando opts.autoplaySound es true (overlay de "Ver demo"), el video
   arranca hablando con sonido de inmediato, aprovechando ese mismo clic
   del cliente -- con un botón de respaldo que aparece solo si el
   navegador del cliente llega a bloquear el sonido (algunos lo bloquean
   en silencio, sin avisar, así que siempre se revisa después). La página
   standalone (a la que se puede llegar sin haber hecho ese clic, ej. un
   enlace compartido) pide el toque directo desde el principio, que es lo
   único garantizado ahí.

   Nada se inventa: el video real solo aparece cuando el producto tiene
   product.demoVideoUrl cargado; mientras tanto se muestra la captura de
   pantalla real del producto (product.imageUrl), sin un botón de play
   falso encima.
   ========================================================================== */
(function () {
  'use strict';

  var COLORS = ['ic-green', 'ic-blue', 'ic-amber', 'ic-purple', 'ic-pink'];
  var FEATURE_ICONS = [
    '<path d="M2.5 3h2.2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"/>', // carrito (ventas)
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', // caja (productos/stock)
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>', // base de datos (stock)
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c1-3.2 3.5-5 6.5-5s5.5 1.8 6.5 5"/><circle cx="17" cy="8.5" r="2.6"/><path d="M15.5 13.2c2.3.3 4 1.9 4.8 4.8"/>', // clientes
    '<path d="M6 3h9l4 4v14H6Z"/><path d="M15 3v4h4M9 12h6M9 16h6M9 8h2"/>' // informes
  ];

  var ICON_PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  function renderDemo(product, els, opts) {
    opts = opts || {};
    var contentEl = els.contentEl;
    var breadcrumbEl = els.breadcrumbEl;
    var coverEl = els.coverEl;
    var stickyEl = els.stickyEl;
    var Store = window.LeuStore;
    if (!Store || !contentEl) return;
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

    var features = product.features || [];

    var featureCardsHTML = features.slice(0, 5).map(function (f, i) {
      return '<div class="demo-feature-card">' +
        '<span class="demo-feature-ic ' + COLORS[i % COLORS.length] + '"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + FEATURE_ICONS[i % FEATURE_ICONS.length] + '</svg></span>' +
        '<h3>' + f + '</h3>' +
      '</div>';
    }).join('');

    var checklistHTML = features.slice(0, 4).map(function (f) {
      return '<li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 13 4 4 10-10"/></svg>' + f + '</li>';
    }).join('');

    // El video real solo aparece si el producto lo tiene cargado
    // (product.demoVideoUrl); si no, se muestra la captura real del
    // producto, sin ningún botón de play falso encima.
    var mediaHTML = product.demoVideoUrl
      ? '<video controls src="' + product.demoVideoUrl + '"></video>'
      : (product.imageUrl ? '<img src="' + product.imageUrl + '" alt="Interfaz de ' + product.name + '">' : '');

    contentEl.innerHTML =
      '<section class="demo-hero">' +
        '<div class="demo-hero-mascot">' +
          '<video id="demoMascotVideo" playsinline poster="assets/img/demo/poster-frame.png">' +
            '<source src="assets/img/demo/apresentador-transparente.webm" type="video/webm">' +
            '<source src="assets/img/demo/apresentador.mp4" type="video/mp4">' +
          '</video>' +
          '<button type="button" id="demoMascotPlay" class="demo-hero-play" aria-label="Activar el sonido" hidden>' +
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>' +
            '<span>Activar sonido</span>' +
          '</button>' +
          '<button type="button" id="demoMascotToggle" class="demo-hero-toggle" aria-label="Pausar" hidden>' + ICON_PAUSE + '</button>' +
        '</div>' +
        '<div class="demo-hero-bubble">' +
          '<h1>¡Hola! Sé muy bienvenido a <span>' + product.name + '</span></h1>' +
          '<p>' + product.short + '</p>' +
          '<span class="demo-script">¡Mira una demostración y descubre cómo funciona!</span>' +
        '</div>' +
      '</section>' +

      (featureCardsHTML ?
        '<section class="demo-section">' +
          '<h2>Funcionalidades principales</h2>' +
          '<p class="demo-section-lead">Todo lo que necesitas en un solo sistema.</p>' +
          '<div class="demo-features-grid">' + featureCardsHTML + '</div>' +
        '</section>'
        : '') +

      (mediaHTML ?
        '<section class="demo-showcase">' +
          '<div class="demo-showcase-media">' + mediaHTML + '</div>' +
          '<div class="demo-showcase-copy">' +
            '<h2>Mira ' + product.name + ' en acción</h2>' +
            '<p>En pocos minutos entiendes cómo el sistema puede transformar tu rutina.</p>' +
            (checklistHTML ? '<ul class="demo-showcase-list">' + checklistHTML + '</ul>' : '') +
            '<div class="demo-showcase-rocket"><img src="assets/img/demo/foguete.png" alt="">' +
              '<span class="demo-script">¡Tu negocio al próximo nivel!</span>' +
            '</div>' +
          '</div>' +
        '</section>'
        : '') +

      '<div class="demo-trust-row">' +
        '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z"/></svg></span><div><h4>Compra segura</h4></div></div>' +
        '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg></span><div><h4>Acceso inmediato</h4></div></div>' +
        '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M20 19v1a3 3 0 0 1-3 3h-3"/></svg></span><div><h4>Soporte especializado</h4></div></div>' +
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

    var buyNow = contentEl.querySelector('#demoBuyNowBtn');
    if (buyNow) buyNow.addEventListener('click', irAComprar);

    // Video del presentador: sin loop -- reproduce una vez y se queda
    // quieto en el último fotograma al terminar, sin pedirle nada más al
    // cliente. Un botón pequeño permite pausar/reanudar mientras suena.
    var mascotVideo = contentEl.querySelector('#demoMascotVideo');
    var playBtn = contentEl.querySelector('#demoMascotPlay');
    var toggleBtn = contentEl.querySelector('#demoMascotToggle');

    function actualizarToggle() {
      if (!toggleBtn || !mascotVideo) return;
      toggleBtn.innerHTML = mascotVideo.paused ? ICON_PLAY : ICON_PAUSE;
      toggleBtn.setAttribute('aria-label', mascotVideo.paused ? 'Reproducir' : 'Pausar');
    }

    function reproducirConSonido() {
      mascotVideo.muted = false;
      mascotVideo.volume = 1;
      return mascotVideo.play();
    }

    if (mascotVideo && playBtn) {
      playBtn.addEventListener('click', function () {
        reproducirConSonido().catch(function () {});
        playBtn.hidden = true;
      });
    }

    if (mascotVideo && toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        if (mascotVideo.paused) {
          reproducirConSonido().catch(function () {});
        } else {
          mascotVideo.pause();
        }
      });
      mascotVideo.addEventListener('play', function () {
        actualizarToggle();
        toggleBtn.hidden = false;
        if (playBtn) playBtn.hidden = true;
      });
      mascotVideo.addEventListener('pause', actualizarToggle);
      // Al terminar de hablar, se queda quieto -- no hay nada más que
      // pausar, así que se esconde el botón.
      mascotVideo.addEventListener('ended', function () { toggleBtn.hidden = true; });
    }

    if (mascotVideo) {
      if (opts.autoplaySound) {
        reproducirConSonido().then(function () {
          // Algunos navegadores no rechazan play() -- en cambio, dejan que
          // el video arranque pero fuerzan muted=true por su cuenta, sin
          // avisar. Si eso pasa, se revisa y se muestra el botón de
          // respaldo para que el cliente pueda activarlo con un toque.
          if (mascotVideo.muted) { if (playBtn) playBtn.hidden = false; }
        }).catch(function () {
          // El navegador lo bloqueó de plano -- se cae al modo "toca para
          // reproducir".
          if (playBtn) playBtn.hidden = false;
        });
      } else if (playBtn) {
        playBtn.hidden = false;
      }
    }

    // Barra fija abajo (solo mobile, ver CSS): mantiene el precio y el
    // botón de compra siempre visibles mientras el cliente se desplaza,
    // apareciendo recién cuando pasa la sección de bienvenida inicial.
    if (stickyEl) {
      stickyEl.innerHTML =
        '<span class="demo-sticky-bar-price">' + Store.formatPrice(product.price) + '</span>' +
        '<button type="button" id="demoStickyBuyBtn" class="btn btn-primary">Comprar ahora</button>';
      var stickyBuy = stickyEl.querySelector('#demoStickyBuyBtn');
      if (stickyBuy) stickyBuy.addEventListener('click', irAComprar);

      // Visible solo entre el hero y el CTA final -- si no, se duplica
      // con el botón "Comprar ahora" que ya está dentro del CTA.
      var heroEl = contentEl.querySelector('.demo-hero');
      var ctaEl = contentEl.querySelector('.demo-cta');
      if (heroEl && ctaEl && 'IntersectionObserver' in window) {
        var heroVisible = true;
        var ctaVisible = false;
        function actualizarSticky() {
          stickyEl.classList.toggle('is-visible', !heroVisible && !ctaVisible);
        }
        var heroObserver = new IntersectionObserver(function (entries) {
          heroVisible = entries[0].isIntersecting;
          actualizarSticky();
        }, { threshold: 0 });
        heroObserver.observe(heroEl);
        var ctaObserver = new IntersectionObserver(function (entries) {
          ctaVisible = entries[0].isIntersecting;
          actualizarSticky();
        }, { threshold: 0 });
        ctaObserver.observe(ctaEl);
      }
    }
  }

  window.LeuDemo = { render: renderDemo };

  // Bootstrap de la página standalone (demo.html?id=...).
  function renderStandalone() {
    var Store = window.LeuStore;
    if (!Store) return;
    var id = new URLSearchParams(window.location.search).get('id');
    var product = id ? Store.getProduct(id) : null;
    var contentEl = document.getElementById('demoContent');
    if (!contentEl) return;
    document.title = product ? ('Demo de ' + product.name + ' — LeuName Softwares') : 'Demo no encontrada — LeuName Softwares';
    renderDemo(product, {
      contentEl: contentEl,
      breadcrumbEl: document.getElementById('demoBreadcrumb'),
      coverEl: document.getElementById('demoCover'),
      stickyEl: document.getElementById('demoSticky')
    });
  }

  document.addEventListener('DOMContentLoaded', renderStandalone);
  document.addEventListener('products:updated', renderStandalone);
})();
