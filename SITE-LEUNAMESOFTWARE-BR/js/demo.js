/* ==========================================================================
   LeuName Softwares — Página de demo de produto (demo.html?id=...)
   --------------------------------------------------------------------------
   Página de vendas dedicada, pensada para prender a atenção do cliente sem
   fazê-lo rolar demais: mascote + saudação, funcionalidades em cartões
   coloridos, uma captura/vídeo em destaque com checklist, e um fechamento
   com preço e botão de compra que vai DIRETO ao checkout (sem passar pela
   página do produto). É a MESMA página para todos os produtos — só muda o
   conteúdo de acordo com o id da URL.

   window.LeuDemo.render(product, els, opts) é reutilizável: é usada tanto
   por esta página standalone (demo.html) quanto pelo overlay em tela cheia
   que producto.js abre ao clicar em "Ver demo" (ver producto.js).
   Quando opts.autoplaySound é true (overlay de "Ver demo"), o vídeo
   começa a falar com som imediatamente, aproveitando esse mesmo clique
   do cliente -- com um botão de apoio que aparece só se o navegador do
   cliente acabar bloqueando o som (alguns bloqueiam silenciosamente, sem
   avisar, então isso é sempre verificado depois). A página standalone (à
   qual se pode chegar sem ter feito esse clique, ex. um link
   compartilhado) pede o toque direto desde o início, que é o único jeito
   garantido ali.

   Nada é inventado: o vídeo real só aparece quando o produto tem
   product.demoVideoUrl carregado; enquanto isso, mostra-se a captura de
   tela real do produto (product.imageUrl), sem nenhum botão de play
   falso por cima.
   ========================================================================== */
(function () {
  'use strict';

  // Vídeo curto (tela do sistema em uso), só deste site BR -- ver mesma
  // lista em producto.js.
  var PRODUCT_VIDEOS = {
    'leuname-gestao': 'assets/img/demo/leuname-gestao-preview.mp4'
  };

  var COLORS = ['ic-green', 'ic-blue', 'ic-amber', 'ic-purple', 'ic-pink'];
  var FEATURE_ICONS = [
    '<path d="M2.5 3h2.2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"/>', // carrinho (vendas)
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', // caixa (produtos/estoque)
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>', // banco de dados (estoque)
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c1-3.2 3.5-5 6.5-5s5.5 1.8 6.5 5"/><circle cx="17" cy="8.5" r="2.6"/><path d="M15.5 13.2c2.3.3 4 1.9 4.8 4.8"/>', // clientes
    '<path d="M6 3h9l4 4v14H6Z"/><path d="M15 3v4h4M9 12h6M9 16h6M9 8h2"/>' // relatórios
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
          '<h1>Demo não encontrada</h1>' +
          '<p>Não encontramos uma demonstração para este produto.</p>' +
          '<div class="confirm-actions"><a href="categoria.html" class="btn btn-primary">Ver produtos</a></div>' +
        '</div>';
      return;
    }

    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = '<a href="index.html">Início</a> / <a href="producto.html?id=' + product.id + '">' + product.name + '</a> / Demo';
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

    // O vídeo real só aparece se o produto tiver um carregado (aqui local,
    // só neste site BR, ou via product.demoVideoUrl); se não, mostra-se a
    // captura real do produto, sem nenhum botão de play falso por cima.
    var localVideo = PRODUCT_VIDEOS[product.id];
    var mediaHTML = (localVideo || product.demoVideoUrl)
      ? '<video controls muted loop playsinline src="' + (localVideo || product.demoVideoUrl) + '"></video>'
      : (product.imageUrl ? '<img src="' + product.imageUrl + '" alt="Interface de ' + product.name + '">' : '');

    contentEl.innerHTML =
      '<section class="demo-hero">' +
        '<div class="demo-hero-mascot">' +
          '<video id="demoMascotVideo" playsinline poster="assets/img/demo/poster-frame.png" src="assets/img/demo/apresentador.mp4"></video>' +
          '<button type="button" id="demoMascotPlay" class="demo-hero-play" aria-label="Ativar o som" hidden>' +
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>' +
            '<span>Ativar som</span>' +
          '</button>' +
          '<button type="button" id="demoMascotToggle" class="demo-hero-toggle" aria-label="Pausar" hidden>' + ICON_PAUSE + '</button>' +
        '</div>' +
        '<div class="demo-hero-bubble">' +
          '<h1>Olá! Seja muito bem-vindo(a) ao <span>' + product.name + '</span></h1>' +
          '<p>' + product.short + '</p>' +
          '<span class="demo-script">Assista a uma demonstração e descubra como funciona!</span>' +
        '</div>' +
      '</section>' +

      (featureCardsHTML ?
        '<section class="demo-section">' +
          '<h2>Principais funcionalidades</h2>' +
          '<p class="demo-section-lead">Tudo o que você precisa em um único sistema.</p>' +
          '<div class="demo-features-grid">' + featureCardsHTML + '</div>' +
        '</section>'
        : '') +

      (mediaHTML ?
        '<section class="demo-showcase">' +
          '<div class="demo-showcase-media">' + mediaHTML + '</div>' +
          '<div class="demo-showcase-copy">' +
            '<h2>Veja ' + product.name + ' em ação</h2>' +
            '<p>Em poucos minutos você entende como o sistema pode transformar sua rotina.</p>' +
            (checklistHTML ? '<ul class="demo-showcase-list">' + checklistHTML + '</ul>' : '') +
            '<div class="demo-showcase-rocket"><img src="assets/img/demo/foguete.png" alt="">' +
              '<span class="demo-script">Seu negócio no próximo nível!</span>' +
            '</div>' +
          '</div>' +
        '</section>'
        : '') +

      '<div class="demo-trust-row">' +
        '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z"/></svg></span><div><h4>Compra segura</h4></div></div>' +
        '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg></span><div><h4>Acesso imediato</h4></div></div>' +
        '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M20 19v1a3 3 0 0 1-3 3h-3"/></svg></span><div><h4>Suporte especializado</h4></div></div>' +
      '</div>' +

      '<section class="demo-cta">' +
        '<h2>Pronto para começar?</h2>' +
        '<p class="demo-cta-price">' + Store.formatPrice(product.price) + '</p>' +
        '<button type="button" id="demoBuyNowBtn" class="btn btn-primary btn-block">Comprar agora</button>' +
        '<p class="demo-cta-hint">Pagamento seguro com cartão · entrega digital imediata</p>' +
      '</section>';

    function irAComprar() {
      if (window.LeuCart) window.LeuCart.addItem(product.id, 1);
      location.href = 'checkout.html';
    }

    var buyNow = contentEl.querySelector('#demoBuyNowBtn');
    if (buyNow) buyNow.addEventListener('click', irAComprar);

    // Vídeo do apresentador: sem loop -- toca uma vez e fica parado no
    // último frame ao terminar, sem pedir mais nada ao cliente. Um botão
    // pequeno permite pausar/retomar enquanto está tocando.
    var mascotVideo = contentEl.querySelector('#demoMascotVideo');
    var playBtn = contentEl.querySelector('#demoMascotPlay');
    var toggleBtn = contentEl.querySelector('#demoMascotToggle');

    function actualizarToggle() {
      if (!toggleBtn || !mascotVideo) return;
      toggleBtn.innerHTML = mascotVideo.paused ? ICON_PLAY : ICON_PAUSE;
      toggleBtn.setAttribute('aria-label', mascotVideo.paused ? 'Reproduzir' : 'Pausar');
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
          // Alguns navegadores não rejeitam o play() -- em vez disso,
          // deixam o vídeo começar mas forçam muted=true por conta
          // própria, sem avisar. Se isso acontecer, verificamos e
          // mostramos o botão de apoio para o cliente poder ativá-lo com
          // um toque.
          if (mascotVideo.muted) { if (playBtn) playBtn.hidden = false; }
        }).catch(function () {
          // O navegador bloqueou de vez -- cai no modo "toque para
          // reproduzir".
          if (playBtn) playBtn.hidden = false;
        });
      } else if (playBtn) {
        playBtn.hidden = false;
      }
    }

  }

  window.LeuDemo = { render: renderDemo };

  // Bootstrap da página standalone (demo.html?id=...).
  function renderStandalone() {
    var Store = window.LeuStore;
    if (!Store) return;
    var id = new URLSearchParams(window.location.search).get('id');
    var product = id ? Store.getProduct(id) : null;
    var contentEl = document.getElementById('demoContent');
    if (!contentEl) return;
    document.title = product ? ('Demo de ' + product.name + ' — LeuName Softwares') : 'Demo não encontrada — LeuName Softwares';
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
