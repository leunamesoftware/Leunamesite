/* ==========================================================================
   LeuName Softwares — Checkout
   --------------------------------------------------------------------------
   IMPORTANTE: el pago real (Stripe) todavía no está integrado — falta que
   el cliente entregue sus credenciales de cuenta de Stripe. La función
   processPayment() de abajo es el único punto que un desarrollador necesita
   tocar para conectar el cobro real (por ejemplo, creando una Stripe
   Checkout Session en el backend y redirigiendo al usuario a Stripe).
   Ningún pago se simula como exitoso en este archivo.
   ========================================================================== */
(function () {
  'use strict';

  // TODO: reemplazar por Stripe Checkout Session real.
  // orderData = { cliente: {...}, items: [...], subtotal, total }
  async function processPayment(orderData) {
    throw new Error('Pago no configurado todavía');
  }
  window.processPayment = processPayment;

  document.addEventListener('DOMContentLoaded', function () {
    var Cart = window.LeuCart;
    var Store = window.LeuStore;
    if (!Cart || !Store) return;

    var summaryEl = document.getElementById('checkoutSummary');
    var totalsEl = document.getElementById('checkoutTotals');
    var form = document.getElementById('checkoutForm');
    var payBtn = document.getElementById('payButton');
    var payMsg = document.getElementById('payMessage');
    var emptyNotice = document.getElementById('checkoutEmpty');

    function render() {
      var items = Cart.lineItems();
      var totals = Cart.totals();

      if (!items.length) {
        if (emptyNotice) emptyNotice.hidden = false;
        if (form) form.hidden = true;
        if (summaryEl) summaryEl.innerHTML = '';
        if (totalsEl) totalsEl.innerHTML = '';
        return;
      }
      if (emptyNotice) emptyNotice.hidden = true;
      if (form) form.hidden = false;

      if (summaryEl) {
        summaryEl.innerHTML = items.map(function (li) {
          return '<div class="checkout-line">' +
            '<span class="checkout-line-name">' + li.product.name + ' <small>× ' + li.qty + '</small></span>' +
            '<span class="checkout-line-price">' + Store.formatPrice(li.lineTotal) + '</span>' +
          '</div>';
        }).join('');
      }
      if (totalsEl) {
        totalsEl.innerHTML =
          '<div class="totals-row"><span>Subtotal</span><span>' + Store.formatPrice(totals.subtotal) + '</span></div>' +
          '<div class="totals-row"><span>Descuento</span><span>0,00 €</span></div>' +
          '<div class="totals-row totals-row-total"><span>Total</span><span>' + Store.formatPrice(totals.subtotal) + '</span></div>';
      }
    }

    document.addEventListener('cart:changed', render);
    render();

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (payMsg) {
          payMsg.hidden = false;
          payMsg.textContent = 'El pago real todavía no está configurado en esta tienda (falta integrar Stripe). En cuanto el cliente entregue sus credenciales, este botón procesará el cobro real.';
        }
        var items = Cart.lineItems();
        var totals = Cart.totals();
        var orderData = {
          cliente: Object.fromEntries(new FormData(form).entries()),
          items: items.map(function (i) { return { id: i.product.id, qty: i.qty }; }),
          subtotal: totals.subtotal,
          total: totals.subtotal
        };
        processPayment(orderData).catch(function (err) {
          console.info('Pago no realizado (esperado): ' + err.message);
        });
      });
    }
  });
})();
