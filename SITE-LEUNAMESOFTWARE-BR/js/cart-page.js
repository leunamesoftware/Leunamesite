/* ==========================================================================
   LeuName Softwares — Página do carrinho (carrito.html)
   ========================================================================== */
(function () {
  'use strict';

  function render() {
    var Cart = window.LeuCart;
    var Store = window.LeuStore;
    if (!Cart || !Store) return;

    var items = Cart.lineItems();
    var emptyEl = document.getElementById('cartEmpty');
    var fullEl = document.getElementById('cartFull');
    var itemsEl = document.getElementById('cartItems');
    var totalsEl = document.getElementById('cartTotals');

    if (!items.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (fullEl) fullEl.hidden = true;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    if (fullEl) fullEl.hidden = false;

    itemsEl.innerHTML = items.map(function (li) {
      var cat = Store.getCategory(li.product.category);
      return '<div class="cart-item" data-id="' + li.product.id + '">' +
        '<a class="cart-item-media" href="producto.html?id=' + li.product.id + '">' + Store.productVisualHTML(li.product) + '</a>' +
        '<div class="cart-item-info">' +
          '<a class="cart-item-name" href="producto.html?id=' + li.product.id + '">' + li.product.name + '</a>' +
          '<div class="cart-item-cat">' + (cat ? cat.name : '') + '</div>' +
          '<button class="cart-item-remove" type="button" data-remove="' + li.product.id + '">Remover</button>' +
        '</div>' +
        '<div class="qty-stepper cart-item-qty">' +
          '<button type="button" data-qty-step="qty-' + li.product.id + '" data-dir="down" aria-label="Diminuir">−</button>' +
          '<input id="qty-' + li.product.id + '" type="number" min="1" value="' + li.qty + '" data-cart-qty="' + li.product.id + '" aria-label="Quantidade">' +
          '<button type="button" data-qty-step="qty-' + li.product.id + '" data-dir="up" aria-label="Aumentar">+</button>' +
        '</div>' +
        '<!-- PREÇO DE EXEMPLO: substituir pelo preço real -->' +
        '<div class="cart-item-price">' + Store.formatPrice(li.lineTotal) + '</div>' +
      '</div>';
    }).join('');

    var totals = Cart.totals();
    totalsEl.innerHTML =
      '<div class="totals-row"><span>Subtotal (' + totals.count + ' ' + (totals.count === 1 ? 'item' : 'itens') + ')</span><span>' + Store.formatPrice(totals.subtotal) + '</span></div>' +
      '<div class="totals-row"><span>Desconto</span><span>R$ 0,00</span></div>' +
      '<div class="totals-row totals-row-total"><span>Total</span><span>' + Store.formatPrice(totals.subtotal) + '</span></div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();
    document.addEventListener('cart:changed', render);

    document.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) window.LeuCart.removeItem(removeBtn.getAttribute('data-remove'));
    });

    document.addEventListener('change', function (e) {
      var qtyInput = e.target.closest('[data-cart-qty]');
      if (qtyInput) {
        var qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
        window.LeuCart.setQty(qtyInput.getAttribute('data-cart-qty'), qty);
      }
    });
  });
})();
