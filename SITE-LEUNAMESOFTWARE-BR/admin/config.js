/* ==========================================================================
   LeuName Softwares — Admin: configurações do site (admin/config.html)
   ========================================================================== */
(function () {
  'use strict';

  AdminAPI.requireAuth();

  var SITE = 'br';
  var form = document.getElementById('configForm');
  var banner = document.getElementById('apiBanner');
  var slidesWrap = document.getElementById('slidesWrap');

  function showBanner(msg, isError) {
    banner.hidden = false;
    banner.textContent = msg;
    banner.classList.toggle('is-error', !!isError);
  }

  var TEMA_LABELS = { azul: 'Azul (marca)', vermelho: 'Vermelho (promoção)', verde: 'Verde (confiança)' };

  function slideBlockHTML(i) {
    return (
      '<div class="admin-slide-block" data-slide="' + i + '" style="border-top:1px solid var(--gray-200);padding-top:14px;margin-top:14px;">' +
        '<h3 style="margin:0 0 10px;font-size:13px;color:var(--ink-400);text-transform:uppercase;letter-spacing:.4px;">Tela ' + (i + 1) + '</h3>' +
        '<div class="admin-form-grid cols-2">' +
          '<div class="admin-field"><label class="admin-label" for="s' + i + 'Eyebrow">Etiqueta pequena (opcional)</label><input class="admin-input" id="s' + i + 'Eyebrow" placeholder="Ex: -17% OFF"></div>' +
          '<div class="admin-field"><label class="admin-label" for="s' + i + 'Tema">Cor de fundo (sem imagem)</label>' +
            '<select class="admin-select" id="s' + i + 'Tema">' +
              Object.keys(TEMA_LABELS).map(function (k) { return '<option value="' + k + '">' + TEMA_LABELS[k] + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="admin-field" style="margin-top:10px;"><label class="admin-label" for="s' + i + 'Titulo">Título</label><input class="admin-input" id="s' + i + 'Titulo" required></div>' +
        '<div class="admin-field" style="margin-top:10px;"><label class="admin-label" for="s' + i + 'Texto">Texto</label><textarea class="admin-textarea" id="s' + i + 'Texto" rows="2"></textarea></div>' +
        '<div class="admin-form-grid cols-2" style="margin-top:10px;">' +
          '<div class="admin-field"><label class="admin-label" for="s' + i + 'Botao">Texto do botão</label><input class="admin-input" id="s' + i + 'Botao" placeholder="Ver produtos →"></div>' +
          '<div class="admin-field"><label class="admin-label" for="s' + i + 'Link">Link do botão (ao clicar no banner)</label><input class="admin-input" id="s' + i + 'Link" placeholder="categoria.html"></div>' +
        '</div>' +
        '<div class="admin-field" style="margin-top:10px;">' +
          '<label class="admin-label">Imagem de fundo (opcional, substitui a cor)</label>' +
          '<input type="hidden" id="s' + i + 'ImagemUrl">' +
          '<div id="s' + i + 'ImagemPreviewWrap" hidden style="margin-bottom:8px;">' +
            '<img id="s' + i + 'ImagemPreview" alt="" style="width:160px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--gray-200);">' +
            ' <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" data-remover-imagem="' + i + '">Remover imagem</button>' +
          '</div>' +
          '<input type="file" id="s' + i + 'ImagemFile" accept="image/jpeg,image/png,image/webp,image/gif" class="admin-input" style="padding:8px;">' +
          '<p class="admin-note" id="s' + i + 'ImagemHint" style="text-align:left;margin-top:6px;">Recomendado: 1200×600px ou maior, formato paisagem.</p>' +
        '</div>' +
      '</div>'
    );
  }

  // Sempre 3 telas -- é o que o carrossel da home já espera.
  var N_SLIDES = 3;
  slidesWrap.innerHTML = '';
  for (var i = 0; i < N_SLIDES; i++) slidesWrap.insertAdjacentHTML('beforeend', slideBlockHTML(i));

  function preencherSlide(i, s) {
    s = s || {};
    document.getElementById('s' + i + 'Eyebrow').value = s.eyebrow || '';
    document.getElementById('s' + i + 'Tema').value = s.tema || 'azul';
    document.getElementById('s' + i + 'Titulo').value = s.titulo || '';
    document.getElementById('s' + i + 'Texto').value = s.texto || '';
    document.getElementById('s' + i + 'Botao').value = s.boton_texto || '';
    document.getElementById('s' + i + 'Link').value = s.link || '';
    document.getElementById('s' + i + 'ImagemUrl').value = s.imagem_url || '';
    if (s.imagem_url) {
      document.getElementById('s' + i + 'ImagemPreview').src = s.imagem_url;
      document.getElementById('s' + i + 'ImagemPreviewWrap').hidden = false;
    }
  }

  function lerSlide(i) {
    return {
      eyebrow: document.getElementById('s' + i + 'Eyebrow').value.trim(),
      tema: document.getElementById('s' + i + 'Tema').value,
      titulo: document.getElementById('s' + i + 'Titulo').value.trim(),
      texto: document.getElementById('s' + i + 'Texto').value.trim(),
      boton_texto: document.getElementById('s' + i + 'Botao').value.trim(),
      link: document.getElementById('s' + i + 'Link').value.trim() || 'categoria.html',
      imagem_url: document.getElementById('s' + i + 'ImagemUrl').value || null
    };
  }

  async function load() {
    try {
      var data = await AdminAPI.api('/config?site=' + SITE);
      var cfg = data.config;
      if (cfg) {
        document.getElementById('waNumero').value = cfg.whatsapp_numero || '';
        if (cfg.logo_url) {
          document.getElementById('logoPreview').src = cfg.logo_url;
          document.getElementById('logoPreviewWrap').hidden = false;
        }
        if (cfg.banner_slides) {
          try {
            var slides = JSON.parse(cfg.banner_slides);
            slides.forEach(function (s, i) { if (i < N_SLIDES) preencherSlide(i, s); });
          } catch (e) { /* JSON inválido, formulário fica em branco */ }
        }
      }
    } catch (err) {
      showBanner('Não foi possível carregar a configuração atual (' + AdminAPI.BASE_URL + ').', true);
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {
      site: SITE,
      whatsapp_numero: document.getElementById('waNumero').value.trim() || null,
      banner_slides: [lerSlide(0), lerSlide(1), lerSlide(2)]
    };
    AdminAPI.api('/admin/config', { method: 'PUT', body: JSON.stringify(payload) })
      .then(function () { showBanner('Configuração salva. Já está valendo no site.'); })
      .catch(function () { showBanner('Não foi possível salvar.', true); });
  });

  // Upload de imagem de fundo de cada tela do banner.
  slidesWrap.addEventListener('change', function (e) {
    var input = e.target.closest('input[type="file"][id$="ImagemFile"]');
    if (!input) return;
    var file = input.files[0];
    if (!file) return;
    var i = input.id.match(/^s(\d+)ImagemFile$/)[1];
    var hint = document.getElementById('s' + i + 'ImagemHint');
    hint.textContent = 'Enviando imagem…';
    fetch(AdminAPI.BASE_URL + '/admin/upload-imagem?pasta=banners', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AdminAPI.getToken(), 'Content-Type': file.type },
      body: file
    })
      .then(function (res) { return res.json().then(function (data) { if (!res.ok) throw new Error(data.erro || 'error'); return data; }); })
      .then(function (data) {
        document.getElementById('s' + i + 'ImagemUrl').value = data.imagen_url;
        document.getElementById('s' + i + 'ImagemPreview').src = data.imagen_url;
        document.getElementById('s' + i + 'ImagemPreviewWrap').hidden = false;
        hint.textContent = 'Imagem enviada. Salve o formulário pra confirmar.';
      })
      .catch(function (err) {
        hint.textContent = 'Não foi possível enviar a imagem (' + err.message + ').';
      });
  });

  slidesWrap.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remover-imagem]');
    if (!btn) return;
    var i = btn.getAttribute('data-remover-imagem');
    document.getElementById('s' + i + 'ImagemUrl').value = '';
    document.getElementById('s' + i + 'ImagemPreviewWrap').hidden = true;
    document.getElementById('s' + i + 'ImagemFile').value = '';
  });

  document.getElementById('logoFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var hint = document.getElementById('logoHint');
    hint.textContent = 'Enviando logo…';
    fetch(AdminAPI.BASE_URL + '/admin/config/' + SITE + '/logo', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AdminAPI.getToken(), 'Content-Type': file.type },
      body: file
    })
      .then(function (res) { return res.json().then(function (data) { if (!res.ok) throw new Error(data.erro || 'error'); return data; }); })
      .then(function (data) {
        document.getElementById('logoPreview').src = data.logo_url;
        document.getElementById('logoPreviewWrap').hidden = false;
        hint.textContent = 'Logo enviada. Já está valendo no site.';
      })
      .catch(function (err) {
        hint.textContent = 'Não foi possível enviar a logo (' + err.message + ').';
      });
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    AdminAPI.clearToken();
    location.href = 'login.html';
  });

  load();
})();
