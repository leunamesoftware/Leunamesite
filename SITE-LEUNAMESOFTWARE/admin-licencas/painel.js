/* ==========================================================================
   LeuName Softwares — Admin: gestão de licenças (admin-licencas/painel.html)
   ========================================================================== */
(function () {
  'use strict';

  AdminLicencasAPI.requireAuth();

  var formCard = document.getElementById('formCard');
  var form = document.getElementById('licForm');
  var banner = document.getElementById('apiBanner');
  var newKeyBanner = document.getElementById('newKeyBanner');

  function showBanner(msg, isError) {
    banner.hidden = false;
    banner.textContent = msg;
    banner.classList.toggle('is-error', !!isError);
  }

  function fmtData(iso) {
    if (!iso) return '';
    try { return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR'); } catch (e) { return iso; }
  }

  var STATUS_LABEL = { ativa: 'Ativa', revogada: 'Revogada' };
  var STATUS_CLASS = { ativa: 'real', revogada: 'inactivo' };
  var APP_LABEL = { 'leuname-gestao': 'Gestacell', 'construgestao': 'ConstruGestão' };

  function renderRows(licencas) {
    var body = document.getElementById('licBody');
    document.getElementById('licCount').textContent = licencas.length;
    if (!licencas.length) {
      body.innerHTML = '<tr><td colspan="8" class="admin-empty">Nenhuma licença gerada ainda.</td></tr>';
      return;
    }
    body.innerHTML = licencas.map(function (l) {
      var acaoBtn = l.status === 'ativa'
        ? '<button class="admin-btn admin-btn-danger admin-btn-sm" data-revogar="' + l.chave + '">Revogar</button>'
        : '<button class="admin-btn admin-btn-outline admin-btn-sm" data-reativar="' + l.chave + '">Reativar</button>';
      return '<tr data-chave="' + l.chave + '">' +
        '<td><code>' + l.chave + '</code></td>' +
        '<td>' + (APP_LABEL[l.app_id] || l.app_id || '—') + '</td>' +
        '<td><strong>' + (l.cliente_nome || '—') + '</strong></td>' +
        '<td>' + (l.cliente_contato || '—') + '</td>' +
        '<td>' + (l.origem || '—') + '</td>' +
        '<td><span class="admin-badge ' + (STATUS_CLASS[l.status] || 'ejemplo') + '">' + (STATUS_LABEL[l.status] || l.status) + '</span></td>' +
        '<td>' + fmtData(l.criado_em) + '</td>' +
        '<td><div class="admin-row-actions">' + acaoBtn + '</div></td>' +
      '</tr>';
    }).join('');
  }

  async function load() {
    try {
      var data = await AdminLicencasAPI.api('/admin/licencas');
      renderRows(data.licencas || []);
    } catch (err) {
      document.getElementById('licBody').innerHTML = '<tr><td colspan="7" class="admin-empty">Não foi possível conectar com o servidor.</td></tr>';
      showBanner('Não foi possível conectar com o backend (' + AdminLicencasAPI.BASE_URL + ').', true);
    }
  }

  document.getElementById('newLicBtn').addEventListener('click', function () {
    formCard.hidden = false;
    newKeyBanner.hidden = true;
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('cancelFormBtn').addEventListener('click', function () {
    formCard.hidden = true; form.reset(); newKeyBanner.hidden = true;
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    AdminLicencasAPI.clearToken();
    location.href = 'login.html';
  });

  document.getElementById('licBody').addEventListener('click', function (e) {
    var revBtn = e.target.closest('[data-revogar]');
    var reatBtn = e.target.closest('[data-reativar]');
    if (revBtn) {
      var chaveRev = revBtn.getAttribute('data-revogar');
      if (confirm('Revogar a licença ' + chaveRev + '? O app do cliente vai travar assim que detectar a revogação (pode levar até 90s se ele estiver com o app aberto, ou no próximo boot).')) {
        AdminLicencasAPI.api('/admin/licencas/revogar', { method: 'POST', body: JSON.stringify({ chave: chaveRev }) })
          .then(load)
          .catch(function () { showBanner('Não foi possível revogar a licença.', true); });
      }
    }
    if (reatBtn) {
      var chaveReat = reatBtn.getAttribute('data-reativar');
      AdminLicencasAPI.api('/admin/licencas/reativar', { method: 'POST', body: JSON.stringify({ chave: chaveReat }) })
        .then(load)
        .catch(function () { showBanner('Não foi possível reativar a licença.', true); });
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {
      app_id: document.getElementById('lApp').value,
      origem: document.getElementById('lOrigem').value.trim() || 'manual',
      cliente_nome: document.getElementById('lNome').value.trim() || null,
      cliente_contato: document.getElementById('lContato').value.trim() || null,
      chave: document.getElementById('lChave').value.trim() || null
    };
    AdminLicencasAPI.api('/admin/licencas/gerar', { method: 'POST', body: JSON.stringify(payload) })
      .then(function (data) {
        newKeyBanner.hidden = false;
        newKeyBanner.textContent = (payload.chave ? 'Licença registrada: ' : 'Licença gerada: ') + data.chave;
        form.reset();
        load();
      })
      .catch(function (err) {
        var msg = err && err.message;
        if (msg === 'chave_ja_cadastrada') showBanner('Essa chave já está cadastrada.', true);
        else if (msg === 'chave_invalida') showBanner('Chave inválida (formato ou checksum errado).', true);
        else showBanner('Não foi possível gerar a licença.', true);
      });
  });

  load();
})();
