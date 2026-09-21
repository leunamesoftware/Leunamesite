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

  var THEMES = ['azul', 'vermelho', 'verde'];

  // Banner é só imagem, sem texto: o lojista sobe a foto pronta no painel
  // e escolhe pra onde ela leva ao clicar (opcional). A cor de tema é só
  // um fundo de reserva enquanto nenhuma imagem foi enviada ainda.
  function slideHTML(s, tema) {
    var estilo = s.imagem_url ? ' style="background-image:url(&#39;' + escapeHTML(s.imagem_url) + '&#39;)"' : '';
    var href = escapeHTML(s.link || 'categoria.html');
    return '<a class="promo-slide promo-theme-' + tema + '"' + estilo + ' href="' + href + '" aria-label="Banner promocional"></a>';
  }

  function aplicarBanner(slides) {
    slides = (slides || []).filter(function (s) { return s && s.imagem_url; });
    if (!slides.length) return;
    var track = document.getElementById('promoTrack');
    var dotsWrap = document.getElementById('promoDots');
    if (!track || !dotsWrap) return;
    track.innerHTML = slides.map(function (s, i) { return slideHTML(s, THEMES[i % THEMES.length]); }).join('');
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
