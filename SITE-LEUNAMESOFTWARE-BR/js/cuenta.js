/* ==========================================================================
   LeuName Softwares — Minha conta (mi-cuenta.html)
   Dados de exemplo: quando existir o backend de autenticação e compras,
   esta seção deve ser substituída pelos produtos realmente comprados
   pelo usuário autenticado.
   ========================================================================== */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var Store = window.LeuStore;
    var el = document.getElementById('ownedGrid');
    if (!Store || !el) return;

    var example = [
      { id: 'leuname-gestao', status: 'active' },
      { id: 'template-agencia-viajes', status: 'active' },
      { id: 'ebook-finanzas-personales', status: 'locked' }
    ];

    el.innerHTML = example.map(function (row) {
      var p = Store.getProduct(row.id);
      if (!p) return '';
      var locked = row.status === 'locked';
      return '<div class="owned-card">' +
        Store.productVisualHTML(p) +
        (locked ? '<span class="lock-badge"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="9" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>' : '') +
        '<div class="owned-card-body">' +
          '<div class="owned-card-name">' + p.name + '</div>' +
          '<span class="owned-status ' + row.status + '">' + (locked ? 'Bloqueado' : 'Disponível') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  });
})();
