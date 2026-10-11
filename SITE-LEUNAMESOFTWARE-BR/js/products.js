/* ==========================================================================
   LeuName Softwares — Produtos do site (fonte única para todas as páginas)
   --------------------------------------------------------------------------
   Os produtos vêm de js/catalogo.js, gerado por ferramentas/gerar_catalogo.py
   a partir dos dados reais da loja (apps.json, servicos.json, cursos.json).
   Só produtos de verdade: nada de exemplo, estrela ou avaliação inventada.
   ========================================================================== */
(function (global) {
  'use strict';

  var ICONS = {
    delivery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6l-2-7h-3M13 10h4l2 4"/></svg>',
    pdv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M2 20h20"/></svg>',
    receitas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 10c0-3 2.5-6 6-6s6 3 6 6"/><path d="M4 10h16l-1.2 9a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 10Z"/></svg>',
    utilidades: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/></svg>',
    sites: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>',
    design: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.7 1.5-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4H16a4 4 0 0 0 4-4c0-5-3.6-9-8-9Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>',
    cursos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13Z"/></svg>'
  };

  var CATEGORIES = [
    { slug: 'pdv', name: 'PDV e Sistemas', curto: 'PDV', color: 'blue', icon: ICONS.pdv },
    { slug: 'delivery', name: 'Delivery', curto: 'Delivery', color: 'pink', icon: ICONS.delivery },
    { slug: 'receitas', name: 'Receitas e Calculadoras', curto: 'Receitas', color: 'amber', icon: ICONS.receitas },
    { slug: 'utilidades', name: 'Gestão e Utilidades', curto: 'Gestão', color: 'green', icon: ICONS.utilidades },
    { slug: 'sites', name: 'Sites e Templates', curto: 'Sites', color: 'green', icon: ICONS.sites },
    { slug: 'design', name: 'Logos e Design', curto: 'Design', color: 'purple', icon: ICONS.design },
    { slug: 'cursos', name: 'Cursos grátis', curto: 'Cursos grátis', color: 'gray', icon: ICONS.cursos }
  ];

  var PRODUCTS = (global.LEU_CATALOGO || []).slice();

  var FAQ_APP = [
    { q: 'Como funciona o teste grátis?', a: 'Toque em Baixar / Instalar, abra o app e entre com o seu e-mail. Você usa grátis durante o teste, sem cartão. Depois, para continuar, escolha um plano.' },
    { q: 'Funciona no celular e no computador?', a: 'Sim. O app abre no celular (Android ou iPhone) e no computador, direto pelo nosso site, sem Play Store.' },
    { q: 'Como eu pago?', a: 'Pelo Mercado Pago, no Pix ou no cartão. O plano é liberado na hora na sua conta.' },
    { q: 'Posso baixar pela Microsoft Store?', a: 'Em breve também na Microsoft Store, para computador com Windows. Por enquanto, baixe direto aqui pelo nosso site: funciona no celular e no computador.' },
    { q: 'E se eu tiver dúvida ou problema?', a: 'Fale com a gente no <a href="https://wa.me/5524998721557" target="_blank" rel="noopener" style="white-space:nowrap;font-weight:600;color:var(--blue-600)">WhatsApp (24)&nbsp;99872&#8209;1557</a>. O suporte é feito por quem criou o sistema.' }
  ];
  var FAQS_BY_CATEGORY = {
    pdv: FAQ_APP, delivery: FAQ_APP, receitas: FAQ_APP, utilidades: FAQ_APP,
    sites: [
      { q: 'Como funciona o site sob encomenda?', a: 'Você conta como quer o site pelo WhatsApp, nós mandamos o orçamento e criamos com a sua marca.' },
      { q: 'Vai ter site pronto para comprar e baixar?', a: 'Sim, em breve: modelos prontos para comprar, pagar e baixar a pasta completa.' }
    ],
    design: [
      { q: 'Como peço a minha logo ou banner?', a: 'Toque em Pedir orçamento e fale com a gente no WhatsApp. O orçamento é grátis.' },
      { q: 'Posso usar nas redes sociais e na fachada?', a: 'Sim, entregamos os arquivos prontos para redes sociais, impressão e fachada.' }
    ],
    cursos: [
      { q: 'Os cursos são grátis?', a: 'Sim. Toque em Começar e faça as aulas no celular ou no computador.' }
    ]
  };

  function getCategory(slug) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
    return null;
  }
  function getProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }
  // "Todos os produtos" é a loja: os cursos grátis ficam só na categoria deles, sem misturar.
  function getProductsByCategory(slug) {
    if (!slug || slug === 'todos') return PRODUCTS.filter(function (p) { return p.kind !== 'curso'; });
    return PRODUCTS.filter(function (p) { return p.category === slug; });
  }
  function formatPrice(value) {
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function priceHTML(product) { return product.priceText || (product.price ? formatPrice(product.price) : 'Grátis'); }
  function discountPercent() { return null; }
  function starsHTML() { return ''; }

  function productVisualHTML(product) {
    if (product.imageUrl) return '<div class="prod-visual prod-visual-photo pv-banner"><img src="' + product.imageUrl + '" alt="' + product.name + '" loading="lazy"></div>';
    var cat = getCategory(product.category) || CATEGORIES[0];
    return '<div class="prod-visual prod-visual-' + cat.color + ' pv-banner pv-icone" aria-hidden="true">' +
      (product.icon ? '<img src="' + product.icon + '" alt="" loading="lazy">' : '<span class="prod-visual-icon">' + cat.icon + '</span>') + '</div>';
  }

  function productCardHTML(product) {
    var selo = product.emBreve ? '<span class="product-tag pc-embreve">Em breve</span>'
      : product.kind === 'servico' ? '<span class="product-real-badge">Orçamento grátis</span>' : '';
    return (
      '<a class="product-card' + (product.emBreve ? ' is-embreve' : '') + '" href="producto.html?id=' + product.id + '">' +
        '<div class="product-card-media">' + productVisualHTML(product) + selo + '</div>' +
        '<div class="product-card-body">' +
          '<span class="product-card-name">' + product.name + '</span>' +
          (product.segmento ? '<span class="pc-seg">Para ' + product.segmento.charAt(0).toLowerCase() + product.segmento.slice(1) + '</span>' : '') +
          '<span class="pc-resumo">' + product.short + '</span>' +
          '<p class="product-card-price">' + priceHTML(product) + '</p>' +
        '</div>' +
      '</a>'
    );
  }

  function categoryCardHTML(cat) {
    var n = getProductsByCategory(cat.slug).length;
    return (
      '<a class="cat-card" href="categoria.html?slug=' + cat.slug + '">' +
        '<span class="cat-ic cat-ic-' + cat.color + '">' + cat.icon + '</span>' +
        '<span class="cat-card-name">' + cat.name + '</span>' +
        '<span class="cat-card-link">' + (n ? 'Ver produtos →' : 'Em breve') + '</span>' +
      '</a>'
    );
  }

  function mountCategoryGrid(elId) {
    var el = document.getElementById(elId);
    if (el) el.innerHTML = CATEGORIES.map(categoryCardHTML).join('');
  }
  function mountProductGrid(elId, products) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = products.length ? products.map(productCardHTML).join('')
      : '<p class="cat-empty">Em breve teremos produtos aqui. <a href="https://wa.me/5524998721557" target="_blank" rel="noopener">Fale com a gente</a>.</p>';
  }

  // Cabeçalho, barra do celular e rodapé com as categorias de verdade (iguais em todas as páginas).
  function montarCategorias() {
    var links = document.querySelector('.cat-links');
    if (links) links.innerHTML = CATEGORIES.map(function (c) {
      return '<li><a href="categoria.html?slug=' + c.slug + '"><span class="cat-ic cat-ic-' + c.color + '">' + c.icon + '</span>' + c.name + '</a></li>';
    }).join('');
    var rolar = document.querySelector('.mobile-cat-scroll');
    if (rolar) {
      rolar.removeAttribute('aria-hidden');
      rolar.innerHTML = CATEGORIES.map(function (c) {
        return '<a href="categoria.html?slug=' + c.slug + '"><span class="cat-ic cat-ic-' + c.color + '">' + c.icon + '</span>' + c.curto + '</a>';
      }).join('');
    }
    document.querySelectorAll('[data-rodape-categorias]').forEach(function (ul) {
      ul.innerHTML = CATEGORIES.map(function (c) { return '<li><a href="categoria.html?slug=' + c.slug + '">' + c.name + '</a></li>'; }).join('');
    });
  }
  document.addEventListener('DOMContentLoaded', montarCategorias);

  global.LeuStore = {
    CATEGORIES: CATEGORIES,
    PRODUCTS: PRODUCTS,
    FAQS_BY_CATEGORY: FAQS_BY_CATEGORY,
    getCategory: getCategory,
    getProduct: getProduct,
    getProductsByCategory: getProductsByCategory,
    formatPrice: formatPrice,
    priceHTML: priceHTML,
    discountPercent: discountPercent,
    starsHTML: starsHTML,
    productVisualHTML: productVisualHTML,
    productCardHTML: productCardHTML,
    categoryCardHTML: categoryCardHTML,
    mountCategoryGrid: mountCategoryGrid,
    mountProductGrid: mountProductGrid
  };
})(window);
