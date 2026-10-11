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

    // Sites: banner de site sob medida (orçamento no WhatsApp) acima dos templates prontos.
    if (slug === 'sites' && !query) {
      var msg = encodeURIComponent('Olá, LeuName Softwares! Vim pelo site e quero um orçamento de site para a minha empresa.');
      var ban = document.createElement('a');
      ban.className = 'sob-medida';
      ban.href = 'https://wa.me/5524998721557?text=' + msg;
      ban.target = '_blank'; ban.rel = 'noopener';
      ban.innerHTML = '<div class="sm-texto"><span class="sm-pill">Site sob medida</span>' +
        '<h2>Quer um site só seu, do seu jeito?</h2>' +
        '<p>Criamos o site da sua empresa do zero, com a sua marca, pronto para vender no celular e no computador.</p>' +
        '<span class="sm-btn">💬 Pedir orçamento grátis no WhatsApp</span></div>' +
        '<div class="sm-arte" aria-hidden="true"><span class="sm-tela"><i></i><i></i><i></i><b></b><b></b><b></b></span><span class="sm-cel"><i></i><b></b><b></b></span></div>';
      var alvo = document.querySelector('.cat-toolbar');
      alvo.parentNode.insertBefore(ban, alvo);
      var tit = document.createElement('h2');
      tit.className = 'sm-titulo'; tit.textContent = 'Sites prontos: compre e receba no e-mail';
      alvo.parentNode.insertBefore(tit, alvo);
    }

    // Filtro por tipo de negócio (Loja de celular, Mercado...), quando a categoria tem mais de um.
    var segmento = '';
    var segs = [];
    (slug ? Store.getProductsByCategory(slug) : []).forEach(function (p) { if (p.segmento && segs.indexOf(p.segmento) < 0) segs.push(p.segmento); });
    if (segs.length > 1) {
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
      // Poucos produtos na categoria: mostra outros embaixo (sem espaço vazio na tela).
      var veja = document.getElementById('vejaTambem');
      if (!veja) {
        veja = document.createElement('div'); veja.id = 'vejaTambem';
        document.getElementById('catGridResults').insertAdjacentElement('afterend', veja);
      }
      var outros = Store.getProductsByCategory('todos').filter(function (p) { return list.indexOf(p) < 0; }).slice(0, 6);
      if (slug && list.length < 4 && outros.length) {
        veja.innerHTML = '<h2 class="section-title" style="font-size:20px;margin:36px 0 16px">Veja também</h2><div class="product-grid" id="vejaGrid"></div>';
        Store.mountProductGrid('vejaGrid', outros);
      } else veja.innerHTML = '';
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
