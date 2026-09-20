/* ==========================================================================
   LeuName Softwares — Listado de categoría (categoria.html?slug=...)
   Si no hay slug, muestra todos los productos ("Todos los productos").
   También soporta ?q=... (usado por la barra de búsqueda del header).
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

    document.getElementById('catTitle').textContent = cat ? cat.name : 'Todos los productos';
    document.getElementById('catBreadName').textContent = cat ? cat.name : 'Todos los productos';
    document.getElementById('catDesc').textContent = query
      ? 'Resultados de búsqueda para "' + query + '".'
      : (cat ? 'Explora todos nuestros productos de ' + cat.name.toLowerCase() + '.' : 'Explora nuestro catálogo completo de productos digitales.');
    document.title = (cat ? cat.name : 'Todos los productos') + ' — LeuName Softwares';

    var filtersCats = document.getElementById('filtersCats');
    var links = ['<a href="categoria.html" class="' + (!slug ? 'is-active' : '') + '">Todos los productos</a>'];
    Store.CATEGORIES.forEach(function (c) {
      links.push('<a href="categoria.html?slug=' + c.slug + '" class="' + (slug === c.slug ? 'is-active' : '') + '">' + c.name + '</a>');
    });
    filtersCats.innerHTML = links.join('');

    var minInput = document.getElementById('filterMin');
    var maxInput = document.getElementById('filterMax');
    var sortSelect = document.getElementById('filterSort');
    var applyBtn = document.getElementById('filterApply');
    var resultCount = document.getElementById('catResultCount');

    function baseList() {
      var list = slug ? Store.getProductsByCategory(slug) : Store.PRODUCTS.slice();
      if (query) {
        list = list.filter(function (p) { return p.name.toLowerCase().indexOf(query) !== -1 || p.short.toLowerCase().indexOf(query) !== -1; });
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

      resultCount.textContent = list.length + (list.length === 1 ? ' producto encontrado' : ' productos encontrados');
      Store.mountProductGrid('catGridResults', list);
    }

    applyBtn.addEventListener('click', render);
    sortSelect.addEventListener('change', render);
    render();
  });
})();
