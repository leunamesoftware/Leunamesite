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
   Carrossel do Hero — hoje mostra um único slide; o markup e os controles
   (setas + pontos) já estão prontos para quando existirem mais slides.
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
    btn.addEventListener('click', function () { setActive(0); }); // no-op: apenas um slide por enquanto
  });
})();

/* ==========================================================================
   Newsletter — 100% do lado do cliente. Não há nenhum serviço de e-mail
   real conectado: apenas evita o envio do formulário e mostra uma mensagem
   de confirmação na tela.
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
      msg.textContent = 'Obrigado! Confira seu e-mail para confirmar a inscrição. (Nota: este formulário ainda não está conectado a um serviço de e-mail real.)';
    }
    form.reset();
  });
})();

/* ==========================================================================
   Acordeão de perguntas frequentes — reutilizável em qualquer página que
   inclua elementos .faq-item.
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
   Formulário de contato — 100% do lado do cliente (sem envio real).
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
   Botões "Adicionar ao carrinho" — qualquer botão com [data-add-to-cart]
   adiciona o produto indicado em data-product-id (e, se existir, usa a
   quantidade de um input com id data-qty-target).
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
    btn.textContent = 'Adicionado ✓';
    btn.classList.add('is-added');
    setTimeout(function () { btn.textContent = original; btn.classList.remove('is-added'); }, 1600);
  });
})();

/* ==========================================================================
   Formulários de login / cadastro — ainda não há backend de autenticação
   real conectado; apenas evitamos o envio e mostramos uma nota explicativa.
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
   Carrossel de produtos com scroll horizontal ("Produtos em destaque",
   "Novidades") — as setas deslizam pelos cartões e se desativam sozinhas
   ao chegar no início/fim. O conteúdo de cada carrossel é preenchido à
   parte (products.js), então o estado inicial das setas também é
   recalculado no window "load", caso o carrossel ainda estivesse vazio
   quando este script rodou.
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
   Stepper de quantidade genérico (usado em producto.html)
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

/* ==========================================================================
   Capa e preço promocional dos produtos (usados nos cards/listas) -- só aqui
   no site BR: a capa tem texto em português e o preço "de/por" é uma
   promoção só do Brasil. O catálogo (products.js / backend) é compartilhado
   com o site em espanhol, então a troca é feita aqui, no próprio objeto do
   produto, ao invés de mexer no dado compartilhado (o preço real cobrado no
   checkout continua vindo do backend, sem mudança).
   ========================================================================== */
(function () {
  'use strict';
  var PRODUCT_COVERS = {
    'leuname-gestao': 'assets/img/products/leuname-gestao-capa.jpg'
  };
  var PRODUCT_ORIGINAL_PRICE = {
    'leuname-gestao': 300
  };

  function aplicarCapas() {
    var Store = window.LeuStore;
    if (!Store) return;
    Store.PRODUCTS.forEach(function (p) {
      if (PRODUCT_COVERS[p.id]) p.imageUrl = PRODUCT_COVERS[p.id];
      if (PRODUCT_ORIGINAL_PRICE[p.id]) p.originalPrice = PRODUCT_ORIGINAL_PRICE[p.id];
    });
  }

  document.addEventListener('DOMContentLoaded', aplicarCapas);
  document.addEventListener('products:updated', aplicarCapas);
})();

/* ==========================================================================
   Botão flutuante do WhatsApp — aparece em todas as páginas, abre uma
   conversa direta com o número da empresa no Brasil.
   ========================================================================== */
(function () {
  'use strict';
  var WHATSAPP_NUMBER = '5524998721557';
  var link = document.createElement('a');
  link.className = 'whatsapp-float';
  link.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Olá! Vim pelo site da LeuName Softwares.');
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', 'Falar no WhatsApp');
  link.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.39 1.3-1.92 1.34-.49.05-1.03.24-3.44-.72-2.9-1.15-4.77-4.12-4.92-4.31-.15-.2-1.17-1.56-1.17-2.98 0-1.42.74-2.11 1-2.4.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.81 2 .88 2.14.07.15.12.32.02.52-.1.2-.15.32-.29.5-.15.18-.31.4-.44.53-.15.15-.3.31-.13.6.17.29.77 1.27 1.65 2.06 1.14 1.02 2.1 1.33 2.39 1.48.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.39-.24.65-.14.27.1 1.71.81 2 .96.29.15.48.22.55.34.07.13.07.75-.17 1.43Z"/></svg>';
  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(link);
  });
})();
