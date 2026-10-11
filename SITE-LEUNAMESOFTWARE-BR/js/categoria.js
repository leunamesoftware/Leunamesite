/* ==========================================================================
   LeuName Softwares — Listagem de categoria (categoria.html?slug=...)
   Se não houver slug, mostra todos os produtos ("Todos os produtos").
   Também suporta ?q=... (usado pela barra de busca do cabeçalho).
   ========================================================================== */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var Store = window.LeuStore;
    if (!Store) return;

    var params = new URLSearchParams(location.search);
    var slug = params.get('slug') || '';
    var query = (params.get('q') || '').trim().toLowerCase();
    var cat = slug ? Store.getCategory(slug) : null;

    document.getElementById('catTitle').textContent = cat ? cat.name : 'Todos os produtos';
    document.getElementById('catBreadName').textContent = cat ? cat.name : 'Todos os produtos';
    document.getElementById('catDesc').textContent = query
      ? 'Resultados da busca por "' + query + '".'
      : (cat ? 'Explore todos os nossos produtos de ' + cat.name + '.' : 'Explore nosso catálogo completo de produtos digitais.');
    document.title = (cat ? cat.name : 'Todos os produtos') + ' — LeuName Softwares';

    var filtersCats = document.getElementById('filtersCats');
    var links = ['<a href="categoria.html" class="' + (!slug ? 'is-active' : '') + '">Todos os produtos</a>'];
    Store.CATEGORIES.forEach(function (c) {
      links.push('<a href="categoria.html?slug=' + c.slug + '" class="' + (slug === c.slug ? 'is-active' : '') + '">' + c.name + '</a>');
    });
    filtersCats.innerHTML = links.join('');

    var minInput = document.getElementById('filterMin');
    var maxInput = document.getElementById('filterMax');
    var sortSelect = document.getElementById('filterSort');
    var applyBtn = document.getElementById('filterApply');
    var resultCount = document.getElementById('catResultCount');

    // Banner da categoria no lugar da faixa azul (toque = orçamento no WhatsApp).
    // Para pôr o banner de outra categoria, acrescente aqui: imagens (computador e celular), tamanhos, pedido e texto.
    // botao: false quando a própria imagem já tem o botão de orçamento.
    var DESIGN = { pc: '/img/destaques/design-novo-visual.webp', pcTam: [1800, 750], cel: '/img/destaques/design-novo-visual-cel.webp', celTam: [980, 769],
      alt: 'Sua marca com um novo visual. Logotipos, banners e artes profissionais para o seu negócio.', botao: true };
    var BANNER_TOPO = {
      logomarcas: Object.assign({ pedido: 'uma logomarca para o meu negócio' }, DESIGN),
      banners: { pc: '/img/destaques/banners-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/banners-topo-cel.webp', celTam: [1020, 765],
        alt: 'Banners que destacam. Artes profissionais para sites, lojas e redes sociais que atraem mais clientes.', pedido: 'um banner para o meu negócio', botao: true, cor: 'roxo' },
      sites: { pc: '/img/destaques/site-sob-medida.webp', pcTam: [1600, 576], cel: '/img/destaques/site-sob-medida-cel.webp', celTam: [720, 530],
        alt: 'Seu site sob medida, para qualquer tipo de negócio. Orçamento grátis.', pedido: 'um site para a minha empresa', botao: false, cor: 'site' },
      pdv: { pc: '/img/destaques/pdv-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/pdv-topo.webp', celTam: [1920, 720],
        alt: 'PDV e Sistemas: sua loja mais organizada e no controle. Vendas, estoque, relatórios e gestão do seu negócio.', link: '#catGridResults', botaoTexto: 'Ver os sistemas', botao: true, cor: 'pdv' },
      receitas: { pc: '/img/destaques/receitas-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/receitas-topo-cel.webp', celTam: [1020, 765],
        alt: 'Receitas e Calculadoras: receitas que vendem, com preço certo. Calcule custos, defina o preço de venda e aumente o seu lucro.', link: '#catGridResults', botaoTexto: 'Ver as receitas', botao: true, cor: 'laranja' },
      utilidades: { pc: '/img/destaques/gestao-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/gestao-topo-cel.webp', celTam: [1020, 765],
        alt: 'Gestão e Utilidades: mais controle para o seu dia a dia. Ferramentas para organizar e facilitar a gestão do seu negócio.', link: '#catGridResults', botaoTexto: 'Ver os sistemas', botao: true, cor: 'verde' },
      cursos: { pc: '/img/destaques/cursos-gratis-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/cursos-gratis-topo-cel.webp', celTam: [1020, 765],
        alt: 'Cursos grátis: aprenda hoje e evolua sempre. Conteúdo prático, aulas em vídeo, passo a passo detalhado.', link: '#catGridResults', botaoTexto: 'Ver os cursos grátis', botao: true }
    };
    var topo = cat && !query && BANNER_TOPO[cat.slug];
    if (topo) {
      var hero = document.querySelector('.page-hero');
      var wrap = document.createElement('div');
      wrap.className = 'cat-banner-topo container';
      var destino = topo.link ? '<a href="' + topo.link + '" aria-label="' + topo.alt + '">'
        : '<a href="https://wa.me/5524998721557?text=' + encodeURIComponent('Olá, LeuName Softwares! Vim pelo site e quero um orçamento de ' + topo.pedido + '.') + '" target="_blank" rel="noopener" aria-label="' + topo.alt + ' Pedir orçamento grátis no WhatsApp">';
      wrap.innerHTML = destino +
        // Celular mostra o banner inteiro, deitado, igual ao computador (pedido do dono).
        '<img src="' + topo.pc + '" width="' + topo.pcTam[0] + '" height="' + topo.pcTam[1] + '" alt="' + topo.alt + '">' +
        '<span class="cbt-cta' + (topo.link ? ' cbt-azul' : '') + (topo.cor ? ' cbt-' + topo.cor : '') + (topo.botao ? '' : ' cbt-so-cel') + '">' + (topo.botaoTexto || 'Pedir orçamento grátis') + '</span>' + '</a>';
      hero.parentNode.insertBefore(wrap, hero);
      hero.classList.add('page-hero-titulo');
    }

    // Filtro por tipo de negócio (Loja de celular, Mercado...), quando a categoria tem mais de um.
    var segmento = '';
    var segs = [];
    (slug ? Store.getProductsByCategory(slug) : []).forEach(function (p) { if (p.segmento && segs.indexOf(p.segmento) < 0) segs.push(p.segmento); });
    // Sites prontos, Banners e Logomarcas mostram os botões por tipo de negócio já com um modelo.
    if (segs.length > 1 || (segs.length === 1 && segs[0] !== 'Qualquer negócio' && ['sites', 'banners', 'logomarcas'].indexOf(cat && cat.slug) >= 0)) {
      var barra = document.createElement('div');
      barra.className = 'seg-chips';
      barra.setAttribute('role', 'group');
      barra.setAttribute('aria-label', 'Tipo de negócio');
      barra.innerHTML = ['<button type="button" class="is-active" data-seg="">Todos</button>'].concat(segs.map(function (s) {
        return '<button type="button" data-seg="' + s + '">' + s + '</button>';
      })).join('');
      resultCount.parentNode.insertBefore(barra, resultCount);
      barra.addEventListener('click', function (e) {
        var b = e.target.closest('[data-seg]'); if (!b) return;
        segmento = b.getAttribute('data-seg');
        barra.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
        render();
      });
    }

    function baseList() {
      var list = Store.getProductsByCategory(slug);
      if (segmento) list = list.filter(function (p) { return p.segmento === segmento; });
      if (query) {
        list = list.filter(function (p) { return p.name.toLowerCase().indexOf(query) !== -1 || p.short.toLowerCase().indexOf(query) !== -1 || (p.segmento || '').toLowerCase().indexOf(query) !== -1; });
      }
      return list;
    }

    function render() {
      var list = baseList();
      var min = parseFloat(minInput.value);
      var max = parseFloat(maxInput.value);
      if (!isNaN(min)) list = list.filter(function (p) { return p.price >= min; });
      if (!isNaN(max)) list = list.filter(function (p) { return p.price <= max; });

      var sort = sortSelect.value;
      if (sort === 'precio-asc') list = list.slice().sort(function (a, b) { return a.price - b.price; });
      else if (sort === 'precio-desc') list = list.slice().sort(function (a, b) { return b.price - a.price; });
      else if (sort === 'mejor-valorados') list = list.slice().sort(function (a, b) { return b.rating - a.rating; });

      resultCount.textContent = list.length + (list.length === 1 ? ' produto encontrado' : ' produtos encontrados');
      Store.mountProductGrid('catGridResults', list);
    }

    applyBtn.addEventListener('click', render);
    sortSelect.addEventListener('change', render);
    // Re-renderiza quando o catálogo real chega do servidor (a primeira
    // renderização usa os dados estáticos de fallback, que incluem
    // exemplos que já foram desativados no backend).
    document.addEventListener('products:updated', render);
    render();
  });
})();
