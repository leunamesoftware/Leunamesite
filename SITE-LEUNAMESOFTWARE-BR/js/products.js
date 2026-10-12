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
    logomarcas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9L12 3Z"/></svg>',
    banners: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/></svg>',
    cursos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13Z"/></svg>'
  };

  var CATEGORIES = [
    { slug: 'pdv', name: 'PDV e Sistemas', curto: 'PDV', color: 'blue', icon: ICONS.pdv },
    { slug: 'delivery', name: 'Delivery', curto: 'Delivery', color: 'pink', icon: ICONS.delivery },
    { slug: 'receitas', name: 'Receitas e Calculadoras', curto: 'Receitas', color: 'amber', icon: ICONS.receitas },
    { slug: 'utilidades', name: 'Gestão e Utilidades', curto: 'Gestão', color: 'green', icon: ICONS.utilidades },
    { slug: 'sites', name: 'Sites prontos', curto: 'Sites prontos', color: 'green', icon: ICONS.sites },
    { slug: 'logomarcas', name: 'Logomarcas', curto: 'Logomarcas', color: 'purple', icon: ICONS.logomarcas },
    { slug: 'banners', name: 'Banners', curto: 'Banners', color: 'pink', icon: ICONS.banners },
    { slug: 'cursos', name: 'Cursos grátis', curto: 'Cursos grátis', color: 'gray', icon: ICONS.cursos }
  ];

  var PRODUCTS = (global.LEU_CATALOGO || []).slice();

  var FAQ_APP = [
    { q: 'Como funciona o teste grátis?', a: 'Toque em Baixar / Instalar, abra o app e entre com o seu e-mail. Você usa grátis durante o teste, sem cartão. Depois, para continuar, escolha um plano.' },
    { q: 'Funciona no celular e no computador?', a: 'Sim. O app abre no celular (Android ou iPhone) e no computador, direto pelo nosso site, sem Play Store.' },
    { q: 'Como eu pago?', a: 'Pelo Mercado Pago, no Pix ou no cartão. O plano é liberado na hora na sua conta.' },
    { q: 'Posso baixar pela Microsoft Store?', a: 'O Gestacell já está na Microsoft Store, para computador com Windows. Os outros apps chegam em breve. Você também pode baixar qualquer um direto aqui pelo nosso site: funciona no celular e no computador.' },
    { q: 'E se eu tiver dúvida ou problema?', a: 'Fale com a gente no <a href="https://wa.me/5524998721557" target="_blank" rel="noopener" style="white-space:nowrap;font-weight:600;color:var(--blue-600)">WhatsApp (24)&nbsp;99872&#8209;1557</a>. O suporte é feito por quem criou o sistema.' }
  ];
  var FAQS_BY_CATEGORY = {
    pdv: FAQ_APP, delivery: FAQ_APP, receitas: FAQ_APP, utilidades: FAQ_APP,
    sites: [
      { q: 'Como funciona o site sob encomenda?', a: 'Você conta como quer o site pelo WhatsApp, nós mandamos o orçamento e criamos com a sua marca.' },
      { q: 'Como funciona o site pronto?', a: 'Veja a demonstração ao vivo, compre pelo Mercado Pago (Pix ou cartão parcelado) e receba no e-mail a pasta completa do site (ZIP) com o manual. Você troca nome, WhatsApp, cores, fotos e preços em um arquivo só e publica na sua hospedagem ou grátis.' },
      { q: 'O site vem com a marca de vocês?', a: 'Vem com o nome, o logo e as cores da sua empresa: você troca tudo. No rodapé fica só uma linha pequena: “Desenvolvido por LeuName Softwares”. Prefere sem? Na hora de comprar, escolha a opção “Sem o crédito no rodapé” (R$ 50 a mais).' },
      { q: 'Posso usar em mais de uma empresa?', a: 'Cada compra é a licença de 1 empresa e 1 domínio. Para outra empresa, é só comprar outra licença.' },
      { q: 'Preciso saber programar?', a: 'Não. O manual mostra passo a passo como editar e publicar. Se preferir, fazemos tudo para você: peça um orçamento pelo WhatsApp.' }
    ],
    logomarcas: [
      { q: 'Como peço a minha logomarca?', a: 'Veja os modelos, toque em Pedir orçamento e fale com a gente no WhatsApp. O orçamento é grátis. Criamos a logo com o nome e o estilo do seu negócio.' },
      { q: 'Posso usar nas redes sociais e na fachada?', a: 'Sim, entregamos os arquivos prontos para redes sociais, impressão e fachada.' }
    ],
    banners: [
      { q: 'Como peço o meu banner?', a: 'Escolha um modelo, toque em Pedir orçamento e fale com a gente no WhatsApp. O orçamento é grátis. Fazemos o banner com a sua marca, seus produtos e seus preços.' },
      { q: 'Serve para Instagram, WhatsApp e impressão?', a: 'Sim, entregamos no tamanho certo para onde você vai usar: redes sociais, WhatsApp, fachada ou impressão.' }
    ],
    cursos: [
      { q: 'Os cursos são grátis?', a: 'Sim. Toque em Começar e faça as aulas no celular ou no computador.' }
    ]
  };

  // Endereços antigos (Design) levam para Logomarcas.
  var APELIDOS = { design: 'logomarcas', diseno: 'logomarcas' };
  function getCategory(slug) {
    slug = APELIDOS[slug] || slug;
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
    return null;
  }
  function getProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    // Link antigo de serviço (ex.: servico-banners) abre o primeiro modelo dele.
    for (var j = 0; j < PRODUCTS.length; j++) if (id && PRODUCTS[j].id.indexOf(id + '-') === 0) return PRODUCTS[j];
    return null;
  }
  // "Todos os produtos" é a loja: os cursos grátis ficam só na categoria deles, sem misturar.
  function getProductsByCategory(slug) {
    if (!slug || slug === 'todos') return PRODUCTS.filter(function (p) { return p.kind !== 'curso'; });
    slug = APELIDOS[slug] || slug;
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

  // Botão do card: diz ao cliente o que acontece ao tocar.
  function acaoDoCard(p) {
    if (p.emBreve) return 'Ver detalhes';
    if (p.kind === 'template') return 'Ver site e comprar';
    if (p.kind === 'servico') return 'Pedir orçamento';
    if (p.kind === 'curso') return 'Curso grátis';
    return 'Ver e testar grátis';
  }

  function productCardHTML(product) {
    // Nada escrito em cima da imagem (pedido do dono): o "Orçamento grátis" fica embaixo, no preço.
    var selo = product.emBreve ? '<span class="product-tag pc-embreve">Em breve</span>' : '';
    return (
      '<a class="product-card' + (product.emBreve ? ' is-embreve' : '') + (product.kind === 'servico' ? ' pc-servico' : '') + '" href="' + (product.kind === 'curso' ? product.installUrl : 'producto.html?id=' + product.id) + '">' +
        '<div class="product-card-media">' + productVisualHTML(product) + selo + '</div>' +
        '<div class="product-card-body">' +
          // Serviço com modelo: título curto ("Banner sob encomenda"); o "Para pizzaria" vem logo abaixo, em azul.
          '<span class="product-card-name">' + (product.kind === 'servico' && product.segmento && !/^qualquer/i.test(product.segmento) ? product.name.replace(/ para .*$/, '') : product.name) + '</span>' +
          (product.segmento ? '<span class="pc-seg">Para ' + product.segmento.charAt(0).toLowerCase() + product.segmento.slice(1) + '</span>' : '') +
          '<span class="pc-resumo">' + product.short + '</span>' +
          (product.kind === 'curso' || product.kind === 'servico' ? '' : '<p class="product-card-price">' + priceHTML(product) + '</p>') +
          '<span class="pc-acao">' + acaoDoCard(product) + '</span>' +
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


  /* ---------- Tipos de negócio (carrossel "Explore por categoria" da página inicial) ----------
     Cada negócio junta os produtos cujo "segmento" tem uma das palavras-chave, mais os produtos
     para "qualquer negócio" (logomarca, Radar). Só aparece no carrossel quem já tem produto. */
  var SVG = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
  var NEGOCIOS = [
    { slug: 'pizzaria', nome: 'Pizzaria', chaves: ['pizzaria'], cores: ['#b91c1c', '#ef4444'], icon: SVG('<path d="M12 3 3 19.5c5.7 2 12.3 2 18 0L12 3Z"/><circle cx="11" cy="12" r="1.2"/><circle cx="14" cy="16" r="1.2"/><circle cx="9" cy="16.5" r="1.2"/>') },
    { slug: 'restaurante', nome: 'Restaurante', chaves: ['restaurante'], cores: ['#78350f', '#d4a017'], icon: SVG('<path d="M4 17h16"/><path d="M5.5 17a6.5 6.5 0 0 1 13 0"/><path d="M12 8.5V7"/><path d="M10.5 7h3"/><path d="M3 20h18"/>') },
    { slug: 'lanchonete', nome: 'Lanchonete e hamburgueria', curto: 'Lanchonete', chaves: ['lanchonete', 'hamburgueria'], cores: ['#c2410c', '#f59e0b'], icon: SVG('<path d="M4 11a8 6 0 0 1 16 0H4Z"/><path d="M3.5 14h17"/><path d="M5 17h14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/>') },
    { slug: 'padaria', nome: 'Padaria', chaves: ['padaria'], cores: ['#92400e', '#f59e0b'], icon: SVG('<path d="M4 14c0-4.4 3.6-8 8-8s8 3.6 8 8v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3Z"/><path d="M9 9.5l1 3M12 8.5v3.5M15 9.5l-1 3"/>') },
    { slug: 'mercado', nome: 'Mercado e mercearia', curto: 'Mercado', chaves: ['mercado'], cores: ['#1d4ed8', '#f97316'], icon: SVG('<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h11l2-8H6.2"/>') },
    { slug: 'loja-de-celular', nome: 'Loja de celular', chaves: ['celular'], ids: ['curso-gestao-loja-celular'], cores: ['#0e7490', '#22d3ee'], icon: SVG('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>') },
    { slug: 'material-de-construcao', nome: 'Material de construção', curto: 'Construção', chaves: ['construção'], ids: ['curso-loja-construcao'], cores: ['#9a3412', '#fb923c'], icon: SVG('<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/>') },
    { slug: 'confeitaria', nome: 'Confeitaria e salgados', curto: 'Confeitaria', chaves: ['confeitaria'], ids: ['curso-preco-certo'], cores: ['#be185d', '#f472b6'], icon: SVG('<path d="M4 20h16v-6H4v6Z"/><path d="M4 14c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1.5 4 0"/><path d="M12 10V7"/><path d="M12 4.5c.8.8.8 1.7 0 2.5-.8-.8-.8-1.7 0-2.5Z"/>') },
    { slug: 'agencia-de-viagens', nome: 'Agência de viagens', curto: 'Viagens', chaves: ['viagens'], cores: ['#0369a1', '#38bdf8'], icon: SVG('<path d="M2.5 13.5 21 6l-3.5 13-6-4.5-4 3v-5l10-7.5-12 6-3-1.5Z"/>') }
  ];
  function getNegocio(slug) {
    for (var i = 0; i < NEGOCIOS.length; i++) if (NEGOCIOS[i].slug === slug) return NEGOCIOS[i];
    return null;
  }
  function getProductsByNegocio(slug) {
    var n = getNegocio(slug); if (!n) return [];
    var seg = function (p) { return (p.segmento || '').toLowerCase(); };
    var proprios = PRODUCTS.filter(function (p) {
      return (n.ids || []).indexOf(p.id) >= 0 || n.chaves.some(function (k) { return seg(p).indexOf(k) >= 0; });
    });
    var gerais = PRODUCTS.filter(function (p) { return /^qualquer/.test(seg(p)) && proprios.indexOf(p) < 0; });
    return proprios.concat(gerais);
  }
  function temProprio(n) { return getProductsByNegocio(n.slug).some(function (p) { return !/^qualquer/.test((p.segmento || '').toLowerCase()); }); }

  // Categorias que não estão na barra de cima entram primeiro no carrossel.
  var CAT_CORES = { delivery: ['#be123c', '#fb7185'], receitas: ['#c2410c', '#fbbf24'], utilidades: ['#15803d', '#4ade80'], cursos: ['#1e40af', '#60a5fa'] };
  // Carrossel = só categorias de verdade, cada uma com os produtos dela (sem misturar). Cursos fica só no botão de cima.
  var FORA_DAS_CATEGORIAS = ['cursos'];
  var CAT_CORES = { pdv: ['#0f766e', '#2dd4bf'], delivery: ['#be123c', '#fb7185'], receitas: ['#c2410c', '#fbbf24'], utilidades: ['#15803d', '#4ade80'],
    sites: ['#1d4ed8', '#60a5fa'], logomarcas: ['#6d28d9', '#a78bfa'], banners: ['#be185d', '#f472b6'] };
  function itensDoCarrossel() {
    return CATEGORIES.filter(function (c) { return FORA_DAS_CATEGORIAS.indexOf(c.slug) < 0; }).map(function (c) {
      var n = getProductsByCategory(c.slug).filter(function (p) { return !p.emBreve; }).length;
      return { href: 'categoria.html?slug=' + c.slug, nome: c.name, tipo: 'Categoria', icon: c.icon, cores: CAT_CORES[c.slug] || ['#0a2647', '#2f7dff'],
               info: n ? n + (n === 1 ? ' produto' : ' produtos') : 'Em breve' };
    });
  }
  function mountCategoryCarousel(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML =
      '<button type="button" class="cc-seta cc-ant" aria-label="Anterior">&#8249;</button>' +
      '<div class="cc-trilho" tabindex="0" aria-label="Categorias e tipos de negócio">' + itensDoCarrossel().map(function (it) {
        return '<a class="cc-card" href="' + it.href + '" style="--c1:' + it.cores[0] + ';--c2:' + it.cores[1] + '">' +
          '<span class="cc-fundo" aria-hidden="true">' + it.icon + '</span>' +
          '<span class="cc-selo">' + it.icon + '</span>' +
          '<span class="cc-tipo">' + it.tipo + '</span>' +
          '<span class="cc-nome">' + it.nome + '</span>' +
          '<span class="cc-info">' + it.info + ' <b>→</b></span>' +
        '</a>';
      }).join('') + '</div>' +
      '<button type="button" class="cc-seta cc-prox" aria-label="Próximo">&#8250;</button>';
    var trilho = el.querySelector('.cc-trilho');
    var passo = function () { var c = trilho.querySelector('.cc-card'); return c ? c.getBoundingClientRect().width + 14 : 200; };
    var andar = function (dir) {
      var fim = trilho.scrollWidth - trilho.clientWidth - 4;
      if (dir > 0 && trilho.scrollLeft >= fim) trilho.scrollTo({ left: 0, behavior: 'smooth' });
      else if (dir < 0 && trilho.scrollLeft <= 4) trilho.scrollTo({ left: fim, behavior: 'smooth' });
      else trilho.scrollBy({ left: dir * passo(), behavior: 'smooth' });
    };
    el.querySelector('.cc-ant').addEventListener('click', function () { andar(-1); pausa(); });
    el.querySelector('.cc-prox').addEventListener('click', function () { andar(1); pausa(); });
    // Não passa sozinho (pedido do dono): o cliente arrasta com o dedo ou toca nas setas.
    function pausa() {}
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
  // Barra de cima (computador e celular): só o que a LeuName cria e vende. As outras categorias ficam
  // embaixo, em "Explore por categoria", no menu "Todas as categorias" e no rodapé.
  var NO_TOPO = ['pdv', 'sites', 'logomarcas', 'banners', 'cursos'];
  var TOPO = CATEGORIES.filter(function (c) { return NO_TOPO.indexOf(c.slug) >= 0; });
  function montarCategorias() {
    var links = document.querySelector('.cat-links');
    if (links) links.innerHTML = TOPO.map(function (c) {
      return '<li><a href="categoria.html?slug=' + c.slug + '"><span class="cat-ic cat-ic-' + c.color + '">' + c.icon + '</span>' + c.name + '</a></li>';
    }).join('');
    var rolar = document.querySelector('.mobile-cat-scroll');
    if (rolar) {
      rolar.removeAttribute('aria-hidden');
      rolar.innerHTML = TOPO.map(function (c) {
        return '<a href="categoria.html?slug=' + c.slug + '"><span class="cat-ic cat-ic-' + c.color + '">' + c.icon + '</span>' + c.curto + '</a>';
      }).join('');
    }
    document.querySelectorAll('[data-rodape-categorias]').forEach(function (ul) {
      ul.innerHTML = CATEGORIES.filter(function (c) { return FORA_DAS_CATEGORIAS.indexOf(c.slug) < 0; }).map(function (c) { return '<li><a href="categoria.html?slug=' + c.slug + '">' + c.name + '</a></li>'; }).join('');
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
    mountCategoryCarousel: mountCategoryCarousel,
    FORA_DAS_CATEGORIAS: FORA_DAS_CATEGORIAS,
    NEGOCIOS: NEGOCIOS,
    getNegocio: getNegocio,
    getProductsByNegocio: getProductsByNegocio,
    mountProductGrid: mountProductGrid
  };
})(window);
