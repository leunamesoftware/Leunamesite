// Por enquanto o pagamento continua via Stripe (mesma conta/token do site
// em espanhol), só que cobrando em Real (BRL) com o preço próprio do
// Brasil (precio_br) -- ver crearPedidoDesdeCarrito() no backend. Trocar
// para Mercado Pago fica como evolução futura, não é bloqueio para vender.
/* ==========================================================================
   LeuName Softwares — Checkout
   --------------------------------------------------------------------------
   processPayment() chama o backend (Worker "leuname-loja"), que cria o
   pedido com os preços do catálogo do servidor e, com isso, uma Stripe
   Checkout Session real. A resposta traz a URL de pagamento da Stripe,
   para a qual redirecionamos o cliente — o pagamento em si sempre
   acontece na página da Stripe, nunca neste site. Nenhum pagamento é
   marcado como bem-sucedido aqui: a confirmação real chega por webhook
   ao backend (ver confirmacion.html).
   ========================================================================== */
(function () {
  'use strict';

  // orderData = { cliente: {...}, items: [{id, qty}] }
  async function processPayment(orderData) {
    var backend = (window.LeuApi && window.LeuApi.BACKEND_URL) || '';
    if (!backend) throw new Error('O servidor da loja não está disponível no momento.');

    var res = await fetch(backend + '/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok || !data || !data.ok || !data.url) {
      var motivo = (data && (data.erro === 'stripe_no_configurado'))
        ? 'O pagamento com cartão ainda não está ativado nesta loja.'
        : 'Não conseguimos iniciar o pagamento. Tente novamente em alguns minutos.';
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
    var emailInput = document.getElementById('ckEmail');

    // Cupom de "próxima compra" detectado automaticamente pelo e-mail que
    // o cliente digita — nunca pede um código, o sistema reconhece
    // sozinho. O backend valida de novo ao criar a sessão de pagamento,
    // isso aqui é só para mostrar o desconto antes de pagar.
    var cuponActivo = null;

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
        var descuento = cuponActivo ? totals.subtotal * (cuponActivo.porcentaje / 100) : 0;
        var totalConDescuento = totals.subtotal - descuento;
        totalsEl.innerHTML =
          '<div class="totals-row"><span>Subtotal</span><span>' + Store.formatPrice(totals.subtotal) + '</span></div>' +
          '<div class="totals-row"><span>Desconto' + (cuponActivo ? ' (cupom ' + cuponActivo.codigo + ')' : '') + '</span><span>' + (cuponActivo ? '−' : '') + Store.formatPrice(descuento) + '</span></div>' +
          '<div class="totals-row totals-row-total"><span>Total</span><span>' + Store.formatPrice(totalConDescuento) + '</span></div>' +
          (cuponActivo ? '<p class="checkout-coupon-note">🎁 Encontramos um cupom de ' + cuponActivo.porcentaje + '% para a sua compra! Ele é aplicado automaticamente.</p>' : '');
      }
    }

    // Verifica se o e-mail digitado tem um cupom ativo (sem expor mais
    // nada). É disparado ao sair do campo, com um pequeno debounce
    // enquanto o cliente digita.
    var backend = (window.LeuApi && window.LeuApi.BACKEND_URL) || '';
    var verificarCuponTimer;
    function verificarCupon() {
      clearTimeout(verificarCuponTimer);
      var email = emailInput && emailInput.value.trim();
      if (!email || !backend || !email.includes('@')) { cuponActivo = null; render(); return; }
      verificarCuponTimer = setTimeout(function () {
        fetch(backend + '/cupones/verificar?email=' + encodeURIComponent(email))
          .then(function (res) { return res.json(); })
          .then(function (data) {
            cuponActivo = (data && data.ok && data.cupon) ? data.cupon : null;
            render();
          })
          .catch(function () { /* sem cupom visível se a consulta falhar, não bloqueia o checkout */ });
      }, 400);
    }
    if (emailInput) {
      emailInput.addEventListener('input', verificarCupon);
      emailInput.addEventListener('blur', verificarCupon);
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
          payMsg.textContent = 'Redirecionando para a página de pagamento seguro da Stripe…';
        }
        if (payBtn) payBtn.disabled = true;

        var orderData = {
          site: 'br',
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
