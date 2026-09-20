/* ==========================================================================
   LeuName Softwares — Checkout
   --------------------------------------------------------------------------
   processPayment() llama al backend (Worker "leuname-loja"), que crea el
   pedido con los precios del catálogo del servidor y, con eso, una Stripe
   Checkout Session real. La respuesta trae la URL de pago de Stripe, a la
   que redirigimos al cliente — el pago en sí ocurre siempre en la página
   de Stripe, nunca en este sitio. Ningún pago se marca como exitoso aquí:
   la confirmación real llega por webhook al backend (ver confirmacion.html).
   ========================================================================== */
(function () {
  'use strict';

  // orderData = { cliente: {...}, items: [{id, qty}] }
  async function processPayment(orderData) {
    var backend = (window.LeuApi && window.LeuApi.BACKEND_URL) || '';
    if (!backend) throw new Error('El servidor de la tienda no está disponible ahora mismo.');

    var res = await fetch(backend + '/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok || !data || !data.ok || !data.url) {
      var motivo = (data && (data.erro === 'stripe_no_configurado'))
        ? 'El pago con tarjeta todavía no está activado en esta tienda.'
        : 'No pudimos iniciar el pago. Intenta de nuevo en unos minutos.';
      throw new Error(motivo);
    }
    return data;
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
        var items = Cart.lineItems();
        if (!items.length) return;

        if (payMsg) {
          payMsg.hidden = false;
          payMsg.textContent = 'Redirigiendo a la página de pago seguro de Stripe…';
        }
        if (payBtn) payBtn.disabled = true;

        var orderData = {
          cliente: Object.fromEntries(new FormData(form).entries()),
          items: items.map(function (i) { return { id: i.product.id, qty: i.qty }; })
        };
        processPayment(orderData).then(function (data) {
          window.location.href = data.url;
        }).catch(function (err) {
          if (payBtn) payBtn.disabled = false;
          if (payMsg) payMsg.textContent = err.message;
        });
      });
    }
  });
})();
