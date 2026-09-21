/* ==========================================================================
   LeuName Softwares — Confirmação de pedido
   --------------------------------------------------------------------------
   Esta página SÓ confia no que o backend responde em /pedidos/:id.
   O backend, por sua vez, SÓ marca um pedido como "pago" quando a Stripe
   confirma o pagamento real via webhook (ver /webhook/stripe no servidor).
   Por isso fazemos polling por alguns segundos: o webhook pode demorar
   alguns segundos a mais que o redirecionamento do navegador. Nunca é
   mostrado um estado de "pago" inventado no cliente.
   ========================================================================== */
(function () {
  'use strict';

  // Links fixos e permanentes dos instaladores (atualizados automaticamente
  // pelos workflows de build, nunca mudam de endereço).
  var DOWNLOAD_LINKS = {
    'leuname-gestao': {
      android: 'https://api.leunamesoftware.com.br/download/leuname-gestao.apk',
      windows: 'https://api.leunamesoftware.com.br/download/leuname-gestao.exe'
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    var pedidoId = params.get('pedido');
    var sessionId = params.get('session_id');

    var titleEl = document.getElementById('confirmTitle');
    var textEl = document.getElementById('confirmText');
    var iconEl = document.getElementById('confirmIcon');
    var orderEl = document.getElementById('confirmOrder');
    var licensesEl = document.getElementById('confirmLicenses');
    var actionsEl = document.getElementById('confirmActions');
    var couponBox = document.getElementById('confirmCoupon');
    var couponCodeText = document.getElementById('couponCodeText');
    var couponPercentText = document.getElementById('couponPercentText');

    function showError(msg) {
      if (iconEl) iconEl.style.color = 'var(--ink-400)';
      if (titleEl) titleEl.textContent = 'Não encontramos seu pedido';
      if (textEl) textEl.textContent = msg;
      if (actionsEl) actionsEl.hidden = false;
    }

    if (!pedidoId || !sessionId) {
      showError('Se você acabou de pagar, confira seu e-mail: é lá que chega a confirmação. Se o problema persistir, fale conosco.');
      return;
    }

    var backend = (window.LeuApi && window.LeuApi.BACKEND_URL) || '';
    if (!backend) {
      showError('Não conseguimos conectar com o servidor da loja. Tente recarregar esta página em alguns segundos.');
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
            showError('Seu pagamento pode ainda estar sendo processado. Vamos te enviar a confirmação por e-mail assim que estiver pronta.');
          }
        });
    }

    function renderPedido(pedido, items) {
      if (pedido.estado !== 'pagado') {
        if (intentos < maxIntentos) {
          setTimeout(consultar, 2500);
        } else {
          if (titleEl) titleEl.textContent = 'Seu pagamento está sendo processado';
          if (textEl) textEl.textContent = 'Assim que for confirmado, você receberá os detalhes no seu e-mail.';
          if (actionsEl) actionsEl.hidden = false;
        }
        return;
      }

      // Sucesso confirmado pelo backend (e só pelo backend).
      if (window.LeuCart) window.LeuCart.clear();

      if (titleEl) titleEl.textContent = 'Obrigado pela sua compra!';
      if (textEl) textEl.textContent = 'Seu pagamento foi confirmado. Enviamos os detalhes para ' + (pedido.email || 'o seu e-mail') + '.';

      if (orderEl) {
        var productos = items.map(function (i) { return i.nombre_producto + ' × ' + i.cantidad; }).join('<br>');
        orderEl.innerHTML =
          '<div><span>Número do pedido</span><strong>#' + pedido.id.slice(0, 8).toUpperCase() + '</strong></div>' +
          '<div><span>Produtos</span><strong>' + productos + '</strong></div>' +
          '<div><span>Total pago</span><strong>' + (window.LeuStore ? window.LeuStore.formatPrice(pedido.total) : 'R$ ' + pedido.total) + '</strong></div>';
        orderEl.hidden = false;
      }

      // Uma licença separada para cada produto/unidade com licença neste
      // pedido -- nunca um único código compartilhado entre vários.
      var licencias = pedido.licencias || [];
      if (licencias.length && licensesEl) {
        licencias.forEach(function (lic, idx) {
          var box = document.createElement('div');
          box.className = 'confirm-license';
          box.innerHTML =
            '<p>Sua chave de licença de ' + lic.nombre_producto + (licencias.length > 1 ? ' <small style="font-weight:400;color:var(--ink-400);">(' + (idx + 1) + '/' + licencias.length + ')</small>' : '') + '</p>' +
            '<div class="confirm-license-row">' +
              '<code></code>' +
              '<button type="button" class="btn btn-outline">Copiar</button>' +
            '</div>' +
            '<p class="confirm-license-hint">Guarde esta chave: você vai precisar dela para ativar o app nos seus dispositivos.</p>';
          box.querySelector('code').textContent = lic.chave_licencia;
          var copyBtn = box.querySelector('button');
          copyBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(lic.chave_licencia).then(function () {
              copyBtn.textContent = 'Copiado!';
              setTimeout(function () { copyBtn.textContent = 'Copiar'; }, 2000);
            });
          });
          licensesEl.appendChild(box);
        });

        // Um único bloco de download por produto (não repete se o cliente
        // comprou mais de uma unidade do mesmo app).
        var jaMostrados = {};
        licencias.forEach(function (lic) {
          var links = DOWNLOAD_LINKS[lic.producto_id];
          if (!links || jaMostrados[lic.producto_id]) return;
          jaMostrados[lic.producto_id] = true;

          var dl = document.createElement('div');
          dl.className = 'confirm-license confirm-download';
          dl.innerHTML =
            '<p>Baixe o aplicativo de ' + lic.nombre_producto + '</p>' +
            '<div class="confirm-download-buttons">' +
              '<a class="btn btn-primary" href="' + links.android + '">Baixar para Android (.apk)</a>' +
              '<a class="btn btn-outline" href="' + links.windows + '">Baixar para Windows (.exe)</a>' +
            '</div>' +
            '<p class="confirm-license-hint">Depois de instalar, abra o app e digite a chave de licença acima pra ativar.</p>';
          licensesEl.appendChild(dl);
        });
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
