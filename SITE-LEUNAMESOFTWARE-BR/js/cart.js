/* ==========================================================================
   LeuName Softwares — Carrinho de compras (100% cliente, localStorage)
   Não há backend envolvido no carrinho: o estado vive só no navegador do
   visitante. Usado por index/categoria/producto (botão
   "Adicionar ao carrinho"), pelo badge do cabeçalho e por carrito.html/checkout.html.
   ========================================================================== */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'leuname_cart_v1';

  function safeGet() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function safeSet(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) { /* armazenamento não disponível: seguimos em memória para esta carga */ }
  }

  var memoryItems = safeGet();

  function getItems() { return memoryItems.slice(); }

  function persist() { safeSet(memoryItems); updateBadges(); document.dispatchEvent(new CustomEvent('cart:changed')); }

  function addItem(productId, qty) {
    qty = Math.max(1, qty || 1);
    var existing = memoryItems.find(function (i) { return i.id === productId; });
    if (existing) existing.qty += qty;
    else memoryItems.push({ id: productId, qty: qty });
    persist();
  }

  function setQty(productId, qty) {
    qty = Math.max(1, qty || 1);
    var existing = memoryItems.find(function (i) { return i.id === productId; });
    if (existing) existing.qty = qty;
    persist();
  }

  function removeItem(productId) {
    memoryItems = memoryItems.filter(function (i) { return i.id !== productId; });
    persist();
  }

  function clear() {
    memoryItems = [];
    persist();
  }

  function lineItems() {
    var Store = global.LeuStore;
    if (!Store) return [];
    return memoryItems
      .map(function (i) {
        var product = Store.getProduct(i.id);
        if (!product) return null;
        return { product: product, qty: i.qty, lineTotal: product.price * i.qty };
      })
      .filter(Boolean);
  }

  function totals() {
    var items = lineItems();
    var count = items.reduce(function (sum, i) { return sum + i.qty; }, 0);
    var subtotal = items.reduce(function (sum, i) { return sum + i.lineTotal; }, 0);
    return { count: count, subtotal: subtotal };
  }

  function updateBadges() {
    var t = totals();
    document.querySelectorAll('.cart-badge').forEach(function (el) { el.textContent = String(t.count); });
    var Store = global.LeuStore;
    document.querySelectorAll('.cart-link .action-text').forEach(function (el) {
      var small = el.querySelector('small');
      el.innerHTML = '';
      if (small) el.appendChild(small);
      else {
        var s = document.createElement('small');
        s.textContent = 'Carrinho';
        el.appendChild(s);
      }
      el.appendChild(document.createTextNode(Store ? Store.formatPrice(t.subtotal) : ''));
    });
  }

  global.LeuCart = {
    getItems: getItems,
    addItem: addItem,
    setQty: setQty,
    removeItem: removeItem,
    clear: clear,
    lineItems: lineItems,
    totals: totals,
    updateBadges: updateBadges
  };

  document.addEventListener('DOMContentLoaded', updateBadges);
})(window);
