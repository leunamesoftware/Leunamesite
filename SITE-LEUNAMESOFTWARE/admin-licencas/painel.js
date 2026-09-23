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

  var STATUS_LABEL = { ativa: 'Ativa', revogada: 'Revogada', excluida: 'Excluída' };
  var STATUS_CLASS = { ativa: 'real', revogada: 'inactivo', excluida: 'inactivo' };
  var APP_LABEL = { 'leuname-gestao': 'Gestacell', 'construgestao': 'ConstruGestão' };
  var APP_COLOR = { 'leuname-gestao': 'linear-gradient(135deg,#3b82f6,#0a2647)', 'construgestao': 'linear-gradient(135deg,#f97316,#c2410c)' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Monta o link de WhatsApp (numero) ou e-mail (mailto), dependendo do
  // que a pessoa cadastrou em "contato" -- manda a chave direto no texto,
  // sem precisar copiar/colar em lugar nenhum.
  function linkEnviarChave(contato, chave, appId, nome) {
    if (!contato) return null;
    var appNome = APP_LABEL[appId] || appId || 'LeuName Softwares';
    var msg = 'Olá' + (nome ? ', ' + nome : '') + '! Sua licença do ' + appNome + ' é: ' + chave + '. Abra o app e digite essa chave pra ativar.';
    if (contato.indexOf('@') !== -1) {
      return 'mailto:' + contato.trim() + '?subject=' + encodeURIComponent('Sua licença do ' + appNome) + '&body=' + encodeURIComponent(msg);
    }
    var digitos = contato.replace(/\D/g, '');
    if (digitos.length <= 11) digitos = '55' + digitos; // assume Brasil quando nao tem DDI
    return 'https://wa.me/' + digitos + '?text=' + encodeURIComponent(msg);
  }

  var ultimaLista = [];

  function renderRows(licencas) {
    ultimaLista = licencas;
    var body = document.getElementById('licBody');
    document.getElementById('licCount').textContent = licencas.length;
    if (!licencas.length) {
      body.innerHTML = '<p class="admin-empty">Nenhuma licença gerada ainda.</p>';
      return;
    }
    body.innerHTML = licencas.map(function (l) {
      var acaoBtn = l.status === 'ativa'
        ? '<button class="admin-btn admin-btn-danger admin-btn-sm" data-revogar="' + l.chave + '">Revogar</button>'
        : '<button class="admin-btn admin-btn-outline admin-btn-sm" data-reativar="' + l.chave + '">Reativar</button>';
      var excluirBtn = '<button class="admin-btn admin-btn-danger admin-btn-sm" data-excluir="' + l.chave + '">Excluir</button>';
      var editarBtn = '<button class="admin-btn admin-btn-outline admin-btn-sm" data-editar="' + l.chave + '">Editar</button>';
      var linkEnv = linkEnviarChave(l.cliente_contato, l.chave, l.app_id, l.cliente_nome);
      var enviarBtn = linkEnv ? '<a class="admin-btn admin-btn-outline admin-btn-sm" href="' + linkEnv + '" target="_blank" rel="noopener" style="text-decoration:none;">Enviar</a>' : '';
      var appNome = APP_LABEL[l.app_id] || l.app_id || '—';
      var appCor = APP_COLOR[l.app_id] || '#64748b';
      return '<div class="lic-card" data-chave="' + l.chave + '">' +
        '<div class="lic-card__top">' +
          '<div>' +
            '<p class="lic-card__nome">' + esc(l.cliente_nome || 'Sem nome') + '</p>' +
            '<code class="lic-card__chave">' + esc(l.chave) + '</code>' +
          '</div>' +
          '<span class="admin-badge ' + (STATUS_CLASS[l.status] || 'ejemplo') + '">' + (STATUS_LABEL[l.status] || l.status) + '</span>' +
        '</div>' +
        '<span class="lic-card__app" style="background:' + appCor + '">' + esc(appNome) + '</span>' +
        '<div class="lic-card__meta">' + esc(l.cliente_contato || 'sem contato') + ' · ' + esc(l.origem || 'manual') + ' · ' + fmtData(l.criado_em) +
          (l.motivo_revogacao ? '<div class="lic-card__motivo">' + esc(l.motivo_revogacao) + '</div>' : '') +
        '</div>' +
        '<div class="admin-row-actions">' + editarBtn + enviarBtn + acaoBtn + excluirBtn + '</div>' +
      '</div>';
    }).join('');
  }

  async function load() {
    try {
      var data = await AdminLicencasAPI.api('/admin/licencas');
      renderRows(data.licencas || []);
    } catch (err) {
      document.getElementById('licBody').innerHTML = '<p class="admin-empty">Não foi possível conectar com o servidor.</p>';
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
    var excBtn = e.target.closest('[data-excluir]');
    var editBtn = e.target.closest('[data-editar]');
    if (editBtn) {
      var chaveEd = editBtn.getAttribute('data-editar');
      var licAtual = ultimaLista.filter(function (x) { return x.chave === chaveEd; })[0] || {};
      var novoNome = prompt('Nome do cliente:', licAtual.cliente_nome || '');
      if (novoNome === null) return;
      var novoContato = prompt('WhatsApp ou e-mail do cliente:', licAtual.cliente_contato || '');
      if (novoContato === null) return;
      AdminLicencasAPI.api('/admin/licencas/editar', { method: 'POST', body: JSON.stringify({ chave: chaveEd, cliente_nome: novoNome.trim(), cliente_contato: novoContato.trim() }) })
        .then(load)
        .catch(function (err) {
          var msg = err && err.message;
          if (msg === 'nome_e_contato_obrigatorios') showBanner('Preencha nome e contato.', true);
          else showBanner('Não foi possível editar a licença.', true);
        });
      return;
    }
    if (revBtn) {
      var chaveRev = revBtn.getAttribute('data-revogar');
      var motivoRev = prompt('Revogar a licença ' + chaveRev + '. Por qual motivo? (aparece pro cliente na tela e na mensagem de WhatsApp/e-mail — ex: "pagamento em atraso". Pode deixar em branco.)', '');
      if (motivoRev !== null) {
        AdminLicencasAPI.api('/admin/licencas/revogar', { method: 'POST', body: JSON.stringify({ chave: chaveRev, motivo: motivoRev.trim() || null }) })
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
    if (excBtn) {
      var chaveExc = excBtn.getAttribute('data-excluir');
      if (confirm('Excluir a licença ' + chaveExc + '? Ela sai do ar na hora, mas continua na lista marcada como "Excluída" -- se for engano, clica em "Reativar" que ela volta.')) {
        AdminLicencasAPI.api('/admin/licencas/excluir', { method: 'POST', body: JSON.stringify({ chave: chaveExc }) })
          .then(load)
          .catch(function () { showBanner('Não foi possível excluir a licença.', true); });
      }
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
        var linkEnv = linkEnviarChave(payload.cliente_contato, data.chave, payload.app_id, payload.cliente_nome);
        newKeyBanner.innerHTML = (payload.chave ? 'Licença registrada: ' : 'Licença gerada: ') + '<code>' + data.chave + '</code>' +
          (linkEnv ? ' &nbsp; <a href="' + linkEnv + '" target="_blank" rel="noopener" class="admin-btn admin-btn-primary admin-btn-sm" style="text-decoration:none;">Enviar pro cliente</a>' : '');
        form.reset();
        load();
      })
      .catch(function (err) {
        var msg = err && err.message;
        if (msg === 'chave_ja_cadastrada') showBanner('Essa chave já está cadastrada.', true);
        else if (msg === 'chave_invalida') showBanner('Chave inválida (formato ou checksum errado).', true);
        else if (msg === 'nome_e_contato_obrigatorios') showBanner('Preencha o nome e o contato do cliente.', true);
        else showBanner('Não foi possível gerar a licença.', true);
      });
  });

  load();
})();
