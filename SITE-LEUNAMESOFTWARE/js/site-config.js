/* ==========================================================================
   LeuName Softwares — Configuración editable del sitio (logo, banners de
   la home), viene del panel admin (admin/config.html).
   --------------------------------------------------------------------------
   Mejora progresiva, igual que el catálogo de productos: la página
   siempre renderiza primero con el contenido estático que ya está en el
   HTML (rápido, funciona aunque el backend no responda). Si el dueño ya
   editó algo desde el panel, este script cambia solo lo que se editó --
   si todavía no se guardó nada (config: null), el sitio sigue exactamente
   igual.
   ========================================================================== */
(function (global) {
  'use strict';

  var BACKEND_URL = 'https://leuname-loja.emanuelantunes2024.workers.dev';
  var SITE = 'es';

  function escapeHTML(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function slideHTML(s) {
    var tema = ['azul', 'vermelho', 'verde'].indexOf(s.tema) !== -1 ? s.tema : 'azul';
    var estilo = s.imagem_url ? ' style="background-image:url(&#39;' + escapeHTML(s.imagem_url) + '&#39;)"' : '';
    return (
      '<a class="promo-slide promo-theme-' + tema + '"' + estilo + ' href="' + escapeHTML(s.link || 'categoria.html') + '">' +
        '<div class="promo-slide-inner container">' +
          (s.eyebrow ? '<span class="promo-eyebrow">' + escapeHTML(s.eyebrow) + '</span>' : '') +
          '<h1>' + escapeHTML(s.titulo) + '</h1>' +
          (s.texto ? '<p>' + escapeHTML(s.texto) + '</p>' : '') +
          (s.boton_texto ? '<span class="btn btn-primary">' + escapeHTML(s.boton_texto) + '</span>' : '') +
        '</div>' +
      '</a>'
    );
  }

  function aplicarBanner(slides) {
    if (!slides || !slides.length) return;
    var track = document.getElementById('promoTrack');
    var dotsWrap = document.getElementById('promoDots');
    if (!track || !dotsWrap) return;
    track.innerHTML = slides.map(slideHTML).join('');
    dotsWrap.innerHTML = slides.map(function (s, i) {
      return '<button class="promo-dot' + (i === 0 ? ' is-active' : '') + '" type="button" aria-current="' + (i === 0 ? 'true' : 'false') + '" aria-label="Diapositiva ' + (i + 1) + '"></button>';
    }).join('');
    if (global.LeuPromoCarousel) global.LeuPromoCarousel.init();
  }

  function aplicarLogo(logoUrl) {
    if (!logoUrl) return;
    document.querySelectorAll('.brand-mark').forEach(function (img) { img.src = logoUrl; });
  }

  function carregar() {
    fetch(BACKEND_URL + '/config?site=' + SITE)
      .then(function (res) { if (!res.ok) throw new Error('bad_status'); return res.json(); })
      .then(function (data) {
        if (!data || !data.ok || !data.config) return;
        aplicarLogo(data.config.logo_url);
        if (data.config.banner_slides) {
          try { aplicarBanner(JSON.parse(data.config.banner_slides)); } catch (e) { /* JSON inválido: mantiene los slides estáticos */ }
        }
      })
      .catch(function () { /* backend no disponible: mantiene el contenido estático */ });
  }

  document.addEventListener('DOMContentLoaded', carregar);
})(window);
