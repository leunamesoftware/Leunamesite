/* ==========================================================================
   LeuName Softwares — Página de perguntas frequentes (preguntas-frecuentes.html)
   ========================================================================== */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var Store = window.LeuStore;
    var el = document.getElementById('faqList');
    if (!Store || !el) return;

    var html = '';
    Store.CATEGORIES.forEach(function (cat) {
      var faqs = Store.FAQS_BY_CATEGORY[cat.slug] || [];
      if (!faqs.length) return;
      html += '<div class="faq-page-cat">' + cat.name + '</div>';
      faqs.forEach(function (f) {
        html += '<div class="faq-item">' +
          '<button class="faq-q" aria-expanded="false">' + f.q + '<svg class="chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>' +
          '<div class="faq-a" hidden>' + f.a + '</div>' +
        '</div>';
      });
    });
    el.innerHTML = html;

    el.querySelectorAll('.faq-item').forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      var panel = item.querySelector('.faq-a');
      btn.addEventListener('click', function () {
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
      });
    });
  });
})();
