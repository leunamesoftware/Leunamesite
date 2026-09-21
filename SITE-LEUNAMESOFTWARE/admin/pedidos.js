/* ==========================================================================
   LeuName Softwares — Admin: pedidos da loja (admin/pedidos.html)
   ========================================================================== */
(function () {
  'use strict';

  AdminAPI.requireAuth();

  var LICENCAS_URL = 'https://api.leunamesoftware.com';
  var banner = document.getElementById('apiBanner');

  function showBanner(msg, isError) {
    banner.hidden = false;
    banner.textContent = msg;
    banner.classList.toggle('is-error', !!isError);
  }

  function fmtPrice(v) { return Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function fmtData(iso) {
    if (!iso) return '';
    try { return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR'); } catch (e) { return iso; }
  }

  var ESTADO_LABEL = { pendiente: 'Pendente', pagado: 'Pago', reembolsado: 'Reembolsado', cancelado: 'Cancelado' };
  var ESTADO_CLASS = { pendiente: 'ejemplo', pagado: 'real', reembolsado: 'inactivo', cancelado: 'inactivo' };

  async function licenciaAPI(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Authorization': 'Bearer ' + AdminAPI.getToken(), 'Content-Type': 'application/json' }, options.headers || {});
    var res = await fetch(LICENCAS_URL + path, Object.assign({}, options, { headers: headers }));
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((data && data.erro) || 'erro_api');
    return data;
  }

  function renderRows(pedidos) {
    var body = document.getElementById('pedidosBody');
    document.getElementById('pedidoCount').textContent = pedidos.length;
    if (!pedidos.length) {
      body.innerHTML = '<tr><td colspan="7" class="admin-empty">Nenhum pedido ainda.</td></tr>';
      return;
    }
    body.innerHTML = pedidos.map(function (p) {
      var licencaCel = p.chave_licencia
        ? '<code>' + p.chave_licencia + '</code>'
        : '<span style="color:var(--ink-400);">—</span>';
      var acao = p.chave_licencia
        ? '<button class="admin-btn admin-btn-danger admin-btn-sm" data-revogar="' + p.chave_licencia + '">Revogar</button>' +
          '<button class="admin-btn admin-btn-outline admin-btn-sm" data-reativar="' + p.chave_licencia + '">Reativar</button>'
        : '';
      acao += '<button class="admin-btn admin-btn-danger admin-btn-sm" data-excluir="' + p.id + '">Excluir</button>';
      return '<tr>' +
        '<td><strong>' + (p.cliente_nombre || '—') + '</strong></td>' +
        '<td>' + (p.cliente_email || '—') + '</td>' +
        '<td>' + fmtPrice(p.total) + '</td>' +
        '<td><span class="admin-badge ' + (ESTADO_CLASS[p.estado] || 'ejemplo') + '">' + (ESTADO_LABEL[p.estado] || p.estado) + '</span></td>' +
        '<td>' + licencaCel + '</td>' +
        '<td>' + fmtData(p.creado_em) + '</td>' +
        '<td><div class="admin-row-actions">' + acao + '</div></td>' +
      '</tr>';
    }).join('');
  }

  async function load() {
    try {
      var data = await AdminAPI.api('/admin/pedidos');
      renderRows((data.pedidos || []).slice().sort(function (a, b) { return (b.creado_em || '').localeCompare(a.creado_em || ''); }));
    } catch (err) {
      document.getElementById('pedidosBody').innerHTML = '<tr><td colspan="7" class="admin-empty">Não foi possível conectar com o servidor.</td></tr>';
      showBanner('Não foi possível conectar com o backend da loja.', true);
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', function () {
    AdminAPI.clearToken();
    location.href = 'login.html';
  });

  document.getElementById('pedidosBody').addEventListener('click', function (e) {
    var revBtn = e.target.closest('[data-revogar]');
    var reatBtn = e.target.closest('[data-reativar]');
    var excBtn = e.target.closest('[data-excluir]');
    if (excBtn) {
      var idExc = excBtn.getAttribute('data-excluir');
      if (confirm('Excluir este pedido? Isso não revoga nenhuma licença já emitida, só apaga o registro do pedido.')) {
        AdminAPI.api('/admin/pedidos/' + idExc, { method: 'DELETE' })
          .then(load)
          .catch(function () { showBanner('Não foi possível excluir o pedido.', true); });
      }
      return;
    }
    if (revBtn) {
      var chaveRev = revBtn.getAttribute('data-revogar');
      if (confirm('Revogar a licença ' + chaveRev + '? O app do cliente vai travar em seguida.')) {
        licenciaAPI('/admin/licencas/revogar', { method: 'POST', body: JSON.stringify({ chave: chaveRev }) })
          .then(function () { showBanner('Licença ' + chaveRev + ' revogada.'); })
          .catch(function () { showBanner('Não foi possível revogar a licença.', true); });
      }
    }
    if (reatBtn) {
      var chaveReat = reatBtn.getAttribute('data-reativar');
      licenciaAPI('/admin/licencas/reativar', { method: 'POST', body: JSON.stringify({ chave: chaveReat }) })
        .then(function () { showBanner('Licença ' + chaveReat + ' reativada.'); })
        .catch(function () { showBanner('Não foi possível reativar a licença.', true); });
    }
  });

  load();
})();
