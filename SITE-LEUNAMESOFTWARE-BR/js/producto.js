/* ==========================================================================
   LeuName Softwares — Página de produto (producto.html?id=...)
   ========================================================================== */
(function () {
  'use strict';

  // Vídeo e fotos de telas reais (tela do sistema em uso) pra mostrar no
  // topo da página do produto. Ficam só aqui no site BR (as telas estão
  // em português) -- não são campo do catálogo compartilhado, pra não
  // vazar pro site em espanhol.
  // Link da ficha na Google Play -- só preencher aqui quando o app for
  // publicado de verdade lá (o selo "Disponível na Play Store" só aparece
  // pros produtos com uma entrada nesta lista). Ex.:
  // 'leuname-gestao': 'https://play.google.com/store/apps/details?id=...'
  var PRODUCT_PLAYSTORE = {};

  // Lightbox simples: abre a foto clicada em tela cheia e deixa passar
  // pras próximas/anteriores sem fechar (seta, teclado ou arrastar o dedo).
  var lightboxEl = null;
  var lbPhotos = [];
  var lbIndex = 0;

  function lbRender() {
    lightboxEl.querySelector('.photo-lightbox-img').src = lbPhotos[lbIndex];
    lightboxEl.querySelector('.photo-lightbox-count').textContent = (lbIndex + 1) + ' / ' + lbPhotos.length;
  }
  function lbStep(dir) {
    lbIndex = (lbIndex + dir + lbPhotos.length) % lbPhotos.length;
    lbRender();
  }
  function lbClose() {
    lightboxEl.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function ensureLightbox() {
    if (lightboxEl) return;
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'photo-lightbox';
    lightboxEl.innerHTML =
      '<button type="button" class="photo-lightbox-close" aria-label="Fechar">&times;</button>' +
      '<button type="button" class="photo-lightbox-nav photo-lightbox-prev" aria-label="Foto anterior">&#8249;</button>' +
      '<img class="photo-lightbox-img" alt="">' +
      '<button type="button" class="photo-lightbox-nav photo-lightbox-next" aria-label="Próxima foto">&#8250;</button>' +
      '<div class="photo-lightbox-count"></div>';
    document.body.appendChild(lightboxEl);

    lightboxEl.querySelector('.photo-lightbox-close').addEventListener('click', lbClose);
    lightboxEl.addEventListener('click', function (e) { if (e.target === lightboxEl) lbClose(); });
    lightboxEl.querySelector('.photo-lightbox-prev').addEventListener('click', function () { lbStep(-1); });
    lightboxEl.querySelector('.photo-lightbox-next').addEventListener('click', function () { lbStep(1); });

    var touchStartX = null;
    lightboxEl.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    lightboxEl.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) lbStep(dx > 0 ? -1 : 1);
      touchStartX = null;
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (!lightboxEl.classList.contains('is-open')) return;
      if (e.key === 'Escape') lbClose();
      if (e.key === 'ArrowLeft') lbStep(-1);
      if (e.key === 'ArrowRight') lbStep(1);
    });
  }

  function openLightbox(photos, startIndex) {
    ensureLightbox();
    lbPhotos = photos;
    lbIndex = startIndex;
    lbRender();
    lightboxEl.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function galleryHTML(product) {
    var photos = product.photos || [];
    var thumbsHTML = photos.map(function (src, i) {
      return '<button type="button" class="prod-gallery-thumb" data-photo-index="' + i + '">' +
        '<img src="' + src + '" alt="Tela de ' + product.name + '" loading="lazy">' +
      '</button>';
    }).join('');
    return window.LeuStore.productVisualHTML(product) + (thumbsHTML ? '<div class="prod-gallery-thumbs">' + thumbsHTML + '</div>' : '');
  }

  // Botões do produto: app (Baixar / Instalar + planos no Mercado Pago), serviço (orçamento) e curso (Começar).
  function acoesHTML(product) {
    if (product.emBreve) return '<div class="product-actions"><button class="btn btn-primary" type="button" disabled>Em breve</button>' +
      '<a class="btn btn-outline" href="https://wa.me/5524998721557?text=' + encodeURIComponent('Olá! Quero ser avisado quando lançar o ' + product.name + '.') + '" target="_blank" rel="noopener">Me avise no WhatsApp</a></div>';
    if (product.kind === 'servico') return '<div class="product-actions"><a class="btn btn-cart" href="' + product.whatsapp + '" target="_blank" rel="noopener">Pedir orçamento grátis</a></div>';
    if (product.kind === 'curso') return '<div class="product-actions"><a class="btn btn-primary" href="' + product.installUrl + '">Começar grátis</a></div>';
    var teste = product.trial || 'grátis';
    return '<div class="product-actions pd-um-botao"><a class="btn btn-primary" href="' + product.installUrl + '">Baixar e testar ' + teste + '</a></div>' +
      '<p class="pd-nota">Baixe no celular ou no computador e entre com o seu e-mail. Testou e gostou? Quando o teste acabar, o próprio app mostra os planos: <b>assinatura</b> ou <b>vitalício</b>, com pagamento pelo Mercado Pago.</p>';
  }



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

    var productPhotos = product.photos || [];

    detailEl.innerHTML =
      '<div class="product-gallery">' + galleryHTML(product) + '</div>' +
      '<div class="product-info">' +
        '<span class="cat-tag">' + (cat ? cat.name : '') + '</span>' +
        (product.emBreve ? '<span class="cat-tag" style="background:#fff4e5;color:#b45309;margin-left:8px;">Em breve</span>' : '') +
        '<h1>' + product.name + '</h1>' +
        '<p class="short-desc">' + product.short + '</p>' +
        (product.kind === 'app' && !product.emBreve && product.plans.length ? '<p class="pd-depois">Depois do teste, ' + Store.priceHTML(product) + '</p>' : '<div class="price-row"><span class="price-big">' + Store.priceHTML(product) + '</span></div>') +
        acoesHTML(product) +
        '<div class="trust-row">' +
          '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z"/></svg></span><div><h4>Compra segura</h4></div></div>' +
          '<div class="trust-item"><span class="trust-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M10 18h4"/></svg></span><div><h4>Celular e computador</h4></div></div>' +
        '</div>' +
      '</div>';

    if (productPhotos.length) {
      detailEl.querySelectorAll('.prod-gallery-thumb').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openLightbox(productPhotos, Number(btn.getAttribute('data-photo-index')));
        });
      });
    }

    // "Ver demo" abre a demo como overlay em tela cheia DENTRO desta
    // mesma página (sem navegar até demo.html) -- assim o clique do
    // cliente continua "vivo" enquanto o vídeo é montado, e o navegador
    // permite que o apresentador comece falando com som imediatamente.
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
              '<a href="index.html" aria-label="LeuName Softwares — Início">' +
                '<img src="assets/img/logo-mark.png" alt="" width="34" height="34">' +
                '<span><span class="demo-minimal-brand-word">LEUNAME</span><span class="demo-minimal-brand-sub">SOFTWARES</span></span>' +
              '</a>' +
              '<button type="button" class="demo-overlay-close" id="demoOverlayClose" aria-label="Fechar demo">&times;</button>' +
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
      '<div class="product-block"><h2>Descrição</h2><p style="color:var(--ink-600);line-height:1.7;">' + product.description + '</p></div>' +
      (featuresHTML ? '<div class="product-block"><h2>Recursos</h2><ul class="feature-list">' + featuresHTML + '</ul></div>' : '') +
      (faqHTML ? '<div class="product-block"><h2>Perguntas frequentes</h2>' + faqHTML + '</div>' : '');

    // Reativa o acordeão de FAQ recém-inserido (main.js já delega no DOMContentLoaded,
    // que rodou antes de este HTML existir).
    tabsEl.querySelectorAll('.faq-item').forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      var panel = item.querySelector('.faq-a');
      btn.addEventListener('click', function () {
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
      });
    });

    function renderRelated() {
      var related = Store.getProductsByCategory(product.category).filter(function (p) { return p.id !== product.id; }).slice(0, 6);
      if (!related.length) related = Store.PRODUCTS.filter(function (p) { return p.id !== product.id; }).slice(0, 6);
      Store.mountProductGrid('relatedGrid', related);
    }
    // Re-renderiza quando o catálogo real chega do servidor (a primeira
    // renderização usa os dados estáticos de fallback, que incluem
    // exemplos que já foram desativados no backend).
    document.addEventListener('products:updated', renderRelated);
    renderRelated();
  });
})();
