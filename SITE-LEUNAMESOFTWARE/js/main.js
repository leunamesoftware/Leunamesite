(function () {
  'use strict';

  var menuToggle = document.getElementById('menuToggle');
  var categoryNav = document.getElementById('categoryNav');
  var navOverlay = document.getElementById('navOverlay');

  function closeMenu() {
    categoryNav.classList.remove('is-open');
    navOverlay.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function openMenu() {
    categoryNav.classList.add('is-open');
    navOverlay.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  if (menuToggle && categoryNav && navOverlay) {
    menuToggle.addEventListener('click', function () {
      var isOpen = categoryNav.classList.contains('is-open');
      if (isOpen) closeMenu(); else openMenu();
    });
    navOverlay.addEventListener('click', closeMenu);
    categoryNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) closeMenu();
    });
  }
})();

/* ==========================================================================
   Carrusel del Hero — hoy muestra un único slide; el markup y los controles
   (flechas + puntos) ya están listos para cuando existan más slides.
   ========================================================================== */
(function () {
  'use strict';
  var carousel = document.querySelector('.hero-carousel');
  if (!carousel) return;
  var dots = carousel.querySelectorAll('.hero-dot');
  function setActive(i) {
    dots.forEach(function (d, idx) { d.classList.toggle('is-active', idx === i); d.setAttribute('aria-current', idx === i ? 'true' : 'false'); });
  }
  dots.forEach(function (dot, idx) { dot.addEventListener('click', function () { setActive(idx); }); });
  carousel.querySelectorAll('.hero-arrow').forEach(function (btn) {
    btn.addEventListener('click', function () { setActive(0); }); // no-op: un único slide por ahora
  });
})();

/* ==========================================================================
   Newsletter — 100% del lado del cliente. No hay ningún servicio de email
   real conectado: solo evita el envío del formulario y muestra un mensaje
   de confirmación en pantalla.
   ========================================================================== */
(function () {
  'use strict';
  var form = document.getElementById('newsletterForm');
  if (!form) return;
  var msg = document.getElementById('newsletterMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (msg) {
      msg.hidden = false;
      msg.textContent = '¡Gracias! Revisa tu correo para confirmar la suscripción. (Nota: este formulario aún no está conectado a un servicio de email real.)';
    }
    form.reset();
  });
})();

/* ==========================================================================
   Acordeón de preguntas frecuentes — reutilizable en cualquier página que
   incluya elementos .faq-item.
   ========================================================================== */
(function () {
  'use strict';
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var btn = item.querySelector('.faq-q');
    var panel = item.querySelector('.faq-a');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
    });
  });
})();

/* ==========================================================================
   Formulario de contacto — 100% del lado del cliente (sin envío real).
   ========================================================================== */
(function () {
  'use strict';
  var form = document.getElementById('contactForm');
  if (!form) return;
  var msg = document.getElementById('contactMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    form.hidden = true;
    if (msg) msg.hidden = false;
  });
})();

/* ==========================================================================
   Botones "Añadir al carrito" — cualquier botón con [data-add-to-cart]
   agrega el producto indicado en data-product-id (y, si existe, toma la
   cantidad de un input con id data-qty-target).
   ========================================================================== */
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add-to-cart]');
    if (!btn || !window.LeuCart) return;
    var id = btn.getAttribute('data-product-id');
    var qtyTarget = btn.getAttribute('data-qty-target');
    var qty = 1;
    if (qtyTarget) {
      var input = document.getElementById(qtyTarget);
      if (input) qty = Math.max(1, parseInt(input.value, 10) || 1);
    }
    window.LeuCart.addItem(id, qty);
    var original = btn.textContent;
    btn.textContent = 'Añadido ✓';
    btn.classList.add('is-added');
    setTimeout(function () { btn.textContent = original; btn.classList.remove('is-added'); }, 1600);
  });
})();

/* ==========================================================================
   Formularios de login / registro — todavía no hay backend de autenticación
   real conectado; solo evitamos el envío y mostramos una nota explicativa.
   ========================================================================== */
(function () {
  'use strict';
  var form = document.getElementById('loginForm');
  if (!form) return;
  var msg = document.getElementById('loginMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (msg) msg.hidden = false;
  });
})();

/* ==========================================================================
   Carrusel de productos con scroll horizontal ("Productos destacados",
   "Novedades") — las flechas deslizan por tarjetas y se apagan solas al
   llegar al principio/final. El contenido de cada carrusel se llena por
   separado (products.js), así que el estado inicial de las flechas se
   recalcula también en window "load", por si el carrusel todavía estaba
   vacío cuando este script corrió.
   ========================================================================== */
(function () {
  'use strict';

  function updateArrows(wrap) {
    var track = wrap.querySelector('.product-carousel');
    var prevBtn = wrap.querySelector('.carousel-arrow-prev');
    var nextBtn = wrap.querySelector('.carousel-arrow-next');
    if (!track) return;
    var maxScroll = track.scrollWidth - track.clientWidth;
    if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4;
    if (nextBtn) nextBtn.disabled = maxScroll <= 4 || track.scrollLeft >= maxScroll - 4;
  }

  function scrollByCards(track, dir) {
    var card = track.querySelector('.product-card');
    var step = card ? card.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
  }

  var wraps = document.querySelectorAll('.carousel-wrap');
  wraps.forEach(function (wrap) {
    var track = wrap.querySelector('.product-carousel');
    if (!track) return;
    var prevBtn = wrap.querySelector('.carousel-arrow-prev');
    var nextBtn = wrap.querySelector('.carousel-arrow-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { scrollByCards(track, -1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { scrollByCards(track, 1); });
    track.addEventListener('scroll', function () { updateArrows(wrap); });
    updateArrows(wrap);
  });
  window.addEventListener('load', function () { wraps.forEach(updateArrows); });
})();

/* ==========================================================================
   Stepper de cantidad genérico (usado en producto.html)
   ========================================================================== */
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-qty-step]');
    if (!btn) return;
    var targetId = btn.getAttribute('data-qty-step');
    var input = document.getElementById(targetId);
    if (!input) return;
    var dir = btn.getAttribute('data-dir') === 'down' ? -1 : 1;
    var next = Math.max(1, (parseInt(input.value, 10) || 1) + dir);
    input.value = next;
    input.dispatchEvent(new Event('change'));
  });
})();
