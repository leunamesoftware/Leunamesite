/* ==========================================================================
   LeuName Softwares — Admin: configuración del sitio (admin/config.html)
   --------------------------------------------------------------------------
   Los banners de la home son solo imagen (sin título/texto/botón) y en
   cantidad libre -- por eso el formulario guarda la lista en memoria
   (state.slides) y redibuja slidesWrap entero en cada alta/baja, en vez
   de campos fijos con id "s0", "s1", "s2" como antes.
   ========================================================================== */
(function () {
  'use strict';

  AdminAPI.requireAuth();

  var SITE = 'es';
  var form = document.getElementById('configForm');
  var banner = document.getElementById('apiBanner');
  var slidesWrap = document.getElementById('slidesWrap');
  var addSlideBtn = document.getElementById('addSlideBtn');

  function showBanner(msg, isError) {
    banner.hidden = false;
    banner.textContent = msg;
    banner.classList.toggle('is-error', !!isError);
  }

  function escapeAttr(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  var state = { slides: [] };

  function novoSlideVazio() { return { imagem_url: '', link: '' }; }

  function slideBlockHTML(s, i) {
    return (
      '<div class="admin-slide-block" data-index="' + i + '" style="border-top:1px solid var(--gray-200);padding-top:14px;margin-top:14px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
          '<h3 style="margin:0;font-size:13px;color:var(--ink-400);text-transform:uppercase;letter-spacing:.4px;">Banner ' + (i + 1) + '</h3>' +
          (state.slides.length > 1 ? '<button type="button" class="admin-btn admin-btn-outline admin-btn-sm" data-remover-slide="' + i + '">Quitar este banner</button>' : '') +
        '</div>' +
        '<div class="admin-field">' +
          '<label class="admin-label">Imagen del banner</label>' +
          '<p class="admin-note" style="text-align:left;margin:0 0 8px;background:var(--blue-50);color:var(--ink-900);padding:10px 12px;border-radius:8px;">' +
            '<strong>Tamaño recomendado:</strong> 1600 × 500 píxeles (bien ancho, tipo faja).<br>' +
            '<strong>Formatos aceptados:</strong> JPG, PNG, WEBP o GIF. <strong>Tamaño máximo:</strong> 5 MB.' +
          '</p>' +
          (s.imagem_url ? (
            '<div style="margin-bottom:8px;">' +
              '<img src="' + escapeAttr(s.imagem_url) + '" alt="" style="width:220px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--gray-200);"> ' +
              '<button type="button" class="admin-btn admin-btn-outline admin-btn-sm" data-remover-imagem="' + i + '">Quitar imagen</button>' +
            '</div>'
          ) : '') +
          '<input type="file" data-imagem-file="' + i + '" accept="image/jpeg,image/png,image/webp,image/gif" class="admin-input" style="padding:8px;">' +
          '<p class="admin-note" data-hint="' + i + '" style="text-align:left;margin-top:6px;">' + (s.imagem_url ? 'Imagen ya guardada. Sube otra para cambiarla.' : 'Ninguna imagen enviada todavía.') + '</p>' +
        '</div>' +
        '<div class="admin-field" style="margin-top:10px;">' +
          '<label class="admin-label">Link al hacer clic (opcional)</label>' +
          '<input class="admin-input" data-link="' + i + '" placeholder="categoria.html" value="' + escapeAttr(s.link) + '">' +
        '</div>' +
      '</div>'
    );
  }

  function renderSlides() {
    if (!state.slides.length) state.slides.push(novoSlideVazio());
    slidesWrap.innerHTML = state.slides.map(slideBlockHTML).join('');
  }

  async function load() {
    try {
      var data = await AdminAPI.api('/config?site=' + SITE);
      var cfg = data.config;
      if (cfg) {
        if (cfg.logo_url) {
          document.getElementById('logoPreview').src = cfg.logo_url;
          document.getElementById('logoPreviewWrap').hidden = false;
        }
        if (cfg.banner_slides) {
          try {
            var slides = JSON.parse(cfg.banner_slides);
            if (Array.isArray(slides) && slides.length) {
              state.slides = slides.map(function (s) { return { imagem_url: s.imagem_url || '', link: s.link || '' }; });
            }
          } catch (e) { /* JSON inválido, empieza vacío */ }
        }
      }
    } catch (err) {
      showBanner('No se pudo cargar la configuración actual (' + AdminAPI.BASE_URL + ').', true);
    }
    renderSlides();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var slidesValidos = state.slides
      .filter(function (s) { return s.imagem_url; })
      .map(function (s) { return { imagem_url: s.imagem_url, link: s.link || '' }; });
    var payload = {
      site: SITE,
      banner_slides: slidesValidos
    };
    AdminAPI.api('/admin/config', { method: 'PUT', body: JSON.stringify(payload) })
      .then(function () { showBanner('Configuración guardada. Ya está activa en el sitio.'); })
      .catch(function () { showBanner('No se pudo guardar.', true); });
  });

  addSlideBtn.addEventListener('click', function () {
    state.slides.push(novoSlideVazio());
    renderSlides();
  });

  slidesWrap.addEventListener('click', function (e) {
    var remSlide = e.target.closest('[data-remover-slide]');
    if (remSlide) {
      state.slides.splice(Number(remSlide.getAttribute('data-remover-slide')), 1);
      renderSlides();
      return;
    }
    var remImg = e.target.closest('[data-remover-imagem]');
    if (remImg) {
      state.slides[Number(remImg.getAttribute('data-remover-imagem'))].imagem_url = '';
      renderSlides();
    }
  });

  slidesWrap.addEventListener('input', function (e) {
    var link = e.target.closest('input[data-link]');
    if (!link) return;
    state.slides[Number(link.getAttribute('data-link'))].link = link.value.trim();
  });

  slidesWrap.addEventListener('change', function (e) {
    var input = e.target.closest('input[type="file"][data-imagem-file]');
    if (!input) return;
    var file = input.files[0];
    if (!file) return;
    var i = Number(input.getAttribute('data-imagem-file'));
    var hint = slidesWrap.querySelector('[data-hint="' + i + '"]');
    if (hint) hint.textContent = 'Enviando imagen…';
    fetch(AdminAPI.BASE_URL + '/admin/upload-imagem?pasta=banners', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AdminAPI.getToken(), 'Content-Type': file.type },
      body: file
    })
      .then(function (res) { return res.json().then(function (data) { if (!res.ok) throw new Error(data.erro || 'error'); return data; }); })
      .then(function (data) {
        state.slides[i].imagem_url = data.imagen_url;
        renderSlides();
      })
      .catch(function (err) {
        if (hint) hint.textContent = 'No se pudo enviar la imagen (' + err.message + ').';
      });
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
        hint.textContent = 'Logo enviada. Ya está activa en el sitio.';
      })
      .catch(function (err) {
        hint.textContent = 'No se pudo enviar la logo (' + err.message + ').';
      });
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    AdminAPI.clearToken();
    location.href = 'login.html';
  });

  renderSlides();
  load();
})();
