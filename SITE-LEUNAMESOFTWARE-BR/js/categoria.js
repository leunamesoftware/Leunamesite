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
    // Página de um tipo de negócio (vem do carrossel da página inicial): tudo o que temos para ele.
    var negocio = !slug && params.get('negocio') ? Store.getNegocio(params.get('negocio')) : null;
    if (negocio) cat = { slug: '', name: 'Para ' + negocio.nome.charAt(0).toLowerCase() + negocio.nome.slice(1), negocio: negocio.slug };

    document.getElementById('catTitle').textContent = cat ? cat.name : 'Todos os produtos';
    document.getElementById('catBreadName').textContent = cat ? cat.name : 'Todos os produtos';
    document.getElementById('catDesc').textContent = query
      ? 'Resultados da busca por "' + query + '".'
      : (negocio ? 'Sistemas, sites, banners e logomarcas para ' + negocio.nome.toLowerCase() + '.' : cat ? 'Explore todos os nossos produtos de ' + cat.name + '.' : 'Explore nosso catálogo completo de produtos digitais.');
    document.title = (cat ? cat.name : 'Todos os produtos') + ' — LeuName Softwares';

    var filtersCats = document.getElementById('filtersCats');
    var links = ['<a href="categoria.html" class="' + (!slug ? 'is-active' : '') + '">Todos os produtos</a>'];
    Store.CATEGORIES.forEach(function (c) {
      if ((Store.FORA_DAS_CATEGORIAS || []).indexOf(c.slug) >= 0) return;
      links.push('<a href="categoria.html?slug=' + c.slug + '" class="' + (slug === c.slug ? 'is-active' : '') + '">' + c.name + '</a>');
    });
    filtersCats.innerHTML = links.join('');

    var minInput = document.getElementById('filterMin');
    var maxInput = document.getElementById('filterMax');
    var sortSelect = document.getElementById('filterSort');
    var applyBtn = document.getElementById('filterApply');
    var resultCount = document.getElementById('catResultCount');

    // O banner do topo é montado antes, por js/banner-topo.js (sem a faixa azul piscar).

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
      var list = negocio ? Store.getProductsByNegocio(negocio.slug) : Store.getProductsByCategory(slug);
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
