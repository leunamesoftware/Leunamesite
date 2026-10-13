(function () {
  "use strict";
  var grade = document.getElementById("nGrade");
  var dados = [], filtro = "todos";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var eur = function (n) { return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; };
  function aviso(t) { var a = document.getElementById("aviso"); a.textContent = t; a.classList.add("on"); setTimeout(function () { a.classList.remove("on"); }, 2200); }
  function lucro(c) { return c.precoSugerido - c.custoTotalEur - (c.precoSugerido * 0.034 + 0.35); }  // taxa PayPal aprox.
  function desenhar() {
    var lista = dados.filter(function (c) {
      if (filtro === "video") return c.videos && c.videos.length;
      if (filtro === "aprovado") return c.aprovado;
      if (filtro === "barato") return lucro(c) >= 10;
      return true;
    });
    if (!dados.length) { grade.innerHTML = '<p class="nov-sub">O robô ainda não rodou. Falta pôr a chave da CJ (segredo <b>CJ_API_KEY</b> no GitHub).</p>'; return; }
    grade.innerHTML = lista.map(function (c) {
      var v = (c.videos || []).find(function (x) { return /^https?:/.test(x); });
      var fr = c.fretes || {};
      return '<article class="nov-card">' +
        (v ? '<video src="' + esc(v) + '" poster="' + esc(c.imagens[0]) + '" controls muted playsinline preload="none"></video>' : '<img loading="lazy" src="' + esc(c.imagens[0]) + '" alt="">') +
        '<div class="nov-tx"><h3>' + esc(c.nomeEn) + '</h3>' +
        '<p class="nov-tags">' + (c.aprovado ? '<span class="t-ok">À venda</span>' : "") + (c.videos && c.videos.length ? '<span>🎬 vídeo</span>' : "") + '<span>📦 armazém ' + esc(c.armazem) + '</span></p>' +
        '<table><tr><td>Custo produto</td><td>$ ' + esc(c.custoProdutoUsd) + '</td></tr>' +
        '<tr><td>Frete ES / PT</td><td>$ ' + esc(fr.ES && fr.ES.usd) + ' / $ ' + esc(fr.PT && fr.PT.usd) + '</td></tr>' +
        '<tr><td>Prazo</td><td>' + esc((fr.ES && fr.ES.prazo) || "?") + ' dias</td></tr>' +
        '<tr><td>Custo total</td><td>' + eur(c.custoTotalEur) + '</td></tr>' +
        '<tr><td><b>Preço sugerido</b></td><td><b>' + eur(c.precoSugerido) + '</b></td></tr>' +
        '<tr><td>Lucro aprox.</td><td class="t-lucro">' + eur(lucro(c)) + '</td></tr></table>' +
        '<div class="nov-bts"><button type="button" data-id="' + esc(c.id) + '">Quero vender</button><a href="' + esc(c.linkCJ) + '" target="_blank" rel="noopener">Ver na CJ (vídeos)</a></div></div></article>';
    }).join("") || '<p class="nov-sub">Nada neste filtro.</p>';
  }
  document.querySelector(".nov-filtros").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    filtro = b.getAttribute("data-f");
    Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); });
    desenhar();
  });
  grade.addEventListener("click", function (e) {
    var b = e.target.closest("[data-id]"); if (!b) return;
    var txt = "Claude, coloca na loja Europa o produto CJ " + b.getAttribute("data-id");
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { aviso("Copiado! Cole na conversa com o Claude."); }, function () { prompt("Copie e mande para o Claude:", txt); });
  });
  fetch("catalogo-cj.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) {
    dados = (j && j.itens) || [];
    dados.sort(function (a, b) { return (b.aprovado - a.aprovado) || ((b.videos || []).length > 0) - ((a.videos || []).length > 0) || lucro(b) - lucro(a); });
    document.getElementById("nAtual").textContent = j && j.atualizado ? "Atualizado: " + j.atualizado + " · " + dados.length + " produtos" : "";
    desenhar();
  });
})();
