/* ==========================================================================
   LeuName Softwares — Confirmación de pedido
   --------------------------------------------------------------------------
   Esta página SOLO confía en lo que el backend responde para /pedidos/:id.
   El backend, a su vez, SOLO marca un pedido como "pagado" cuando Stripe
   confirma el pago real via webhook (ver /webhook/stripe en el servidor).
   Por eso hacemos polling unos segundos: el webhook puede tardar un par de
   segundos más que la redirección del navegador. Nunca se muestra un
   estado de "pagado" inventado en el cliente.
   ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    var pedidoId = params.get('pedido');
    var sessionId = params.get('session_id');

    var titleEl = document.getElementById('confirmTitle');
    var textEl = document.getElementById('confirmText');
    var iconEl = document.getElementById('confirmIcon');
    var orderEl = document.getElementById('confirmOrder');
    var licenseBox = document.getElementById('confirmLicense');
    var licenseText = document.getElementById('licenseKeyText');
    var copyBtn = document.getElementById('copyLicenseBtn');
    var actionsEl = document.getElementById('confirmActions');
    var couponBox = document.getElementById('confirmCoupon');
    var couponCodeText = document.getElementById('couponCodeText');
    var couponPercentText = document.getElementById('couponPercentText');

    function showError(msg) {
      if (iconEl) iconEl.style.color = 'var(--ink-400)';
      if (titleEl) titleEl.textContent = 'No encontramos tu pedido';
      if (textEl) textEl.textContent = msg;
      if (actionsEl) actionsEl.hidden = false;
    }

    if (!pedidoId || !sessionId) {
      showError('Si acabas de pagar, revisa tu correo electrónico: ahí te llega la confirmación. Si el problema persiste, contáctanos.');
      return;
    }

    var backend = (window.LeuApi && window.LeuApi.BACKEND_URL) || '';
    if (!backend) {
      showError('No pudimos conectar con el servidor de la tienda. Intenta recargar esta página en unos segundos.');
      return;
    }

    var intentos = 0;
    var maxIntentos = 10;

    function consultar() {
      intentos++;
      fetch(backend + '/pedidos/' + encodeURIComponent(pedidoId) + '?session_id=' + encodeURIComponent(sessionId))
        .then(function (res) {
          if (!res.ok) throw new Error('bad_status');
          return res.json();
        })
        .then(function (data) {
          if (!data || !data.ok) throw new Error('pedido_no_encontrado');
          renderPedido(data.pedido, data.items);
        })
        .catch(function () {
          if (intentos < maxIntentos) {
            setTimeout(consultar, 2500);
          } else {
            showError('Tu pago puede estar aún procesándose. Te enviaremos la confirmación por correo en cuanto esté lista.');
          }
        });
    }

    function renderPedido(pedido, items) {
      if (pedido.estado !== 'pagado') {
        if (intentos < maxIntentos) {
          setTimeout(consultar, 2500);
        } else {
          if (titleEl) titleEl.textContent = 'Tu pago está siendo procesado';
          if (textEl) textEl.textContent = 'En cuanto se confirme, te llegará el detalle a tu correo electrónico.';
          if (actionsEl) actionsEl.hidden = false;
        }
        return;
      }

      // Éxito confirmado por el backend (y solo por el backend).
      if (window.LeuCart) window.LeuCart.clear();

      if (titleEl) titleEl.textContent = '¡Gracias por tu compra!';
      if (textEl) textEl.textContent = 'Tu pago fue confirmado. Te enviamos los detalles a ' + (pedido.email || 'tu correo electrónico') + '.';

      if (orderEl) {
        var productos = items.map(function (i) { return i.nombre_producto + ' × ' + i.cantidad; }).join('<br>');
        orderEl.innerHTML =
          '<div><span>Número de pedido</span><strong>#' + pedido.id.slice(0, 8).toUpperCase() + '</strong></div>' +
          '<div><span>Productos</span><strong>' + productos + '</strong></div>' +
          '<div><span>Total pagado</span><strong>' + (window.LeuStore ? window.LeuStore.formatPrice(pedido.total) : pedido.total + ' €') + '</strong></div>';
        orderEl.hidden = false;
      }

      if (pedido.chave_licencia && licenseBox && licenseText) {
        licenseText.textContent = pedido.chave_licencia;
        licenseBox.hidden = false;
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(pedido.chave_licencia).then(function () {
              copyBtn.textContent = '¡Copiado!';
              setTimeout(function () { copyBtn.textContent = 'Copiar'; }, 2000);
            });
          });
        }
      }

      if (pedido.cupon_ganado && couponBox && couponCodeText && couponPercentText) {
        couponCodeText.textContent = pedido.cupon_ganado.codigo;
        couponPercentText.textContent = pedido.cupon_ganado.porcentaje;
        couponBox.hidden = false;
      }

      if (actionsEl) actionsEl.hidden = false;
    }

    consultar();
  });
})();
