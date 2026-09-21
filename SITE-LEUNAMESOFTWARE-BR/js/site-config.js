/* ==========================================================================
   LeuName Softwares — Configuração editável do site (logo, banners da
   home, WhatsApp), vinda do painel admin (admin/config.html).
   --------------------------------------------------------------------------
   Melhoria progressiva, igual o catálogo de produtos: a página sempre
   renderiza primeiro com o conteúdo estático que já está no HTML (rápido,
   funciona mesmo sem backend). Se o lojista já editou algo pelo painel,
   este script troca só o que foi editado -- se nada foi salvo ainda
   (config: null), o site continua exatamente como está.
   ========================================================================== */
(function (global) {
  'use strict';

  var BACKEND_URL = 'https://leuname-loja.emanuelantunes2024.workers.dev';
  var SITE = 'br';

  function escapeHTML(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function slideHTML(s) {
    var tema = ['azul', 'vermelho', 'verde'].indexOf(s.tema) !== -1 ? s.tema : 'azul';
    return (
      '<a class="promo-slide promo-theme-' + tema + '" href="' + escapeHTML(s.link || 'categoria.html') + '">' +
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
      return '<button class="promo-dot' + (i === 0 ? ' is-active' : '') + '" type="button" aria-current="' + (i === 0 ? 'true' : 'false') + '" aria-label="Slide ' + (i + 1) + '"></button>';
    }).join('');
    if (global.LeuPromoCarousel) global.LeuPromoCarousel.init();
  }

  function aplicarLogo(logoUrl) {
    if (!logoUrl) return;
    document.querySelectorAll('.brand-mark').forEach(function (img) { img.src = logoUrl; });
  }

  function aplicarWhatsApp(numero) {
    if (!numero) return;
    var link = document.querySelector('.whatsapp-float');
    if (!link) return;
    link.href = 'https://wa.me/' + numero + '?text=' + encodeURIComponent('Olá! Vim pelo site da LeuName Softwares.');
  }

  function carregar() {
    fetch(BACKEND_URL + '/config?site=' + SITE)
      .then(function (res) { if (!res.ok) throw new Error('bad_status'); return res.json(); })
      .then(function (data) {
        if (!data || !data.ok || !data.config) return;
        aplicarLogo(data.config.logo_url);
        aplicarWhatsApp(data.config.whatsapp_numero);
        if (data.config.banner_slides) {
          try { aplicarBanner(JSON.parse(data.config.banner_slides)); } catch (e) { /* JSON inválido: mantém os slides estáticos */ }
        }
      })
      .catch(function () { /* backend indisponível: mantém o conteúdo estático */ });
  }

  document.addEventListener('DOMContentLoaded', carregar);
})(window);
