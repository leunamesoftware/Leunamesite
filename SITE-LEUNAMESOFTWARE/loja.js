(function () {
  "use strict";
  var C = window.CONFIG || {};
  var html = document.documentElement;
  var lang = function () { return html.lang === "pt" ? "pt" : "es"; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var guardar = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var ler = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var euro = function (n) { return new Intl.NumberFormat(lang() === "pt" ? "pt-PT" : "es-ES", { style: "currency", currency: "EUR" }).format(n); };
  var T = function (es, pt) { return lang() === "pt" ? pt : es; };

  /* ---------- idioma ---------- */
  $$("[data-idioma]").forEach(function (b) {
    b.addEventListener("click", function () {
      html.lang = lang() === "pt" ? "es" : "pt";
      guardar("lang", html.lang);
      redesenhar();
    });
  });

  /* ---------- básicos ---------- */
  $$("[data-mail]").forEach(function (a) { a.href = "mailto:" + (C.email || ""); });
  $$("[data-ano]").forEach(function (s) { s.textContent = new Date().getFullYear(); });
  if (C.titular) $$("[data-titular]").forEach(function (p) {
    p.textContent = (lang() === "pt" ? "Titular: " : "Titular: ") + C.titular + " · " + (C.email || "");
  });
  var ck = $("#cookies");
  if (ck && ler("ck") !== "1") ck.hidden = false;
  var ckOk = $("#cookiesOk");
  if (ckOk) ckOk.addEventListener("click", function () { ck.hidden = true; guardar("ck", "1"); });
  var avisoT;
  function aviso(txt) {
    var a = $("#aviso"); if (!a) return;
    a.textContent = txt; a.classList.add("on");
    clearTimeout(avisoT); avisoT = setTimeout(function () { a.classList.remove("on"); }, 2600);
  }

  /* ---------- carrinho ---------- */
  var carrinho = {};
  try { carrinho = JSON.parse(ler("carrito") || "{}") || {}; } catch (e) { carrinho = {}; }
  function salvar() { guardar("carrito", JSON.stringify(carrinho)); contador(); }
  function contador() {
    var n = 0; Object.keys(carrinho).forEach(function (k) { n += carrinho[k]; });
    $$("[data-qtd]").forEach(function (b) { b.textContent = n; b.hidden = !n; });
  }
  function adicionar(id, q) {
    carrinho[id] = Math.min(9, (carrinho[id] || 0) + (q || 1)); salvar();
    aviso(T("Añadido al carrito ✓", "Adicionado ao carrinho ✓"));
  }
  contador();

  /* ---------- produtos ---------- */
  var PRODUTOS = [], porId = {};
  var nome = function (p) { return (p[lang()] || p.es || {}).nombre || ""; };
  var info = function (p) { return p[lang()] || p.es || {}; };

  function cartao(p) {
    return '<article class="card">' +
      '<a class="card-img" href="producto.html?id=' + encodeURIComponent(p.id) + '"><img loading="lazy" src="' + esc(p.imagenes[0]) + '" alt="' + esc(nome(p)) + '"></a>' +
      '<div class="card-tx"><a href="producto.html?id=' + encodeURIComponent(p.id) + '"><h3>' + esc(nome(p)) + '</h3></a>' +
      '<p class="card-gancho">' + esc(info(p).gancho || "") + '</p>' +
      '<div class="card-pe"><b>' + euro(p.precio) + '</b><button class="mais" type="button" data-add="' + esc(p.id) + '" aria-label="' + T("Añadir", "Adicionar") + '">+</button></div></div></article>';
  }

  function desenharLoja() {
    if (!$("[data-grade]")) return;
    var temAlgum = PRODUTOS.length > 0;
    $("#vazio").hidden = temAlgum;
    var dest = PRODUTOS.filter(function (p) { return p.destaque; });
    $("#destaques").hidden = !dest.length;
    $('[data-grade="destaque"]').innerHTML = dest.map(cartao).join("");
    $$(".cat").forEach(function (s) {
      var lista = PRODUTOS.filter(function (p) { return p.categoria === s.id; });
      s.hidden = !lista.length;
      $("[data-grade]", s).innerHTML = lista.map(cartao).join("");
    });
    $$(".chip").forEach(function (c) {
      var id = c.getAttribute("href").slice(1);
      c.hidden = temAlgum && !PRODUTOS.some(function (p) { return p.categoria === id; });
    });
    $$(".nav a").forEach(function (a) {
      var id = a.getAttribute("href").split("#")[1];
      a.hidden = temAlgum && !PRODUTOS.some(function (p) { return p.categoria === id; });
    });
    var fotos = PRODUTOS.slice(0, 4);
    if (fotos.length >= 4) $$("#mosaico > div").forEach(function (d, i) {
      d.innerHTML = '<img src="' + esc(fotos[i].imagenes[0]) + '" alt="">'; d.classList.add("tem-foto");
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-add]");
    if (b) { adicionar(b.getAttribute("data-add"), 1); }
  });

  /* ---------- página do produto ---------- */
  var qtdProd = 1;
  function desenharProduto() {
    var box = $("#prod"); if (!box) return;
    var id = new URLSearchParams(location.search).get("id");
    var p = porId[id];
    $(".prod-in").hidden = !p; $("#pNada").hidden = !!p;
    if (!p) return;
    var i = info(p);
    document.title = nome(p) + " — LeuName";
    $("#pNome").textContent = nome(p);
    $("#pPreco").textContent = euro(p.precio);
    $("#pDesc").textContent = i.descripcion || "";
    $("#pLista").innerHTML = (i.puntos || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    $("#pPrazo").textContent = (p.plazo ? p.plazo + " " + T("días laborables", "dias úteis") : T("3–10 días laborables", "3–10 dias úteis"));
    var foto = $("#pFoto"); foto.src = p.imagenes[0]; foto.alt = nome(p);
    $("#pMinis").innerHTML = p.imagenes.map(function (src, k) {
      return '<button type="button" class="' + (k ? "" : "on") + '" data-src="' + esc(src) + '"><img src="' + esc(src) + '" alt=""></button>';
    }).join("");
    var v = $("#pVideo");
    if (p.video) { v.src = p.video; v.hidden = false; }
  }
  if ($("#prod")) {
    $("#pMinis").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $("#pFoto").src = b.getAttribute("data-src");
      $$("#pMinis button").forEach(function (x) { x.classList.toggle("on", x === b); });
    });
    $("[data-menos]").addEventListener("click", function () { qtdProd = Math.max(1, qtdProd - 1); $("#pQtd").textContent = qtdProd; });
    $("[data-mais]").addEventListener("click", function () { qtdProd = Math.min(9, qtdProd + 1); $("#pQtd").textContent = qtdProd; });
    $("#pAdd").addEventListener("click", function () {
      var id = new URLSearchParams(location.search).get("id");
      adicionar(id, qtdProd); $("#pIr").hidden = false;
    });
  }

  /* ---------- carrinho / pagamento ---------- */
  function itensCarrinho() {
    return Object.keys(carrinho).filter(function (id) { return porId[id] && carrinho[id] > 0; })
      .map(function (id) { return { p: porId[id], q: carrinho[id] }; });
  }
  function total() { return itensCarrinho().reduce(function (s, it) { return s + it.p.precio * it.q; }, 0); }
  function desenharCarrinho() {
    var box = $("#cItens"); if (!box) return;
    var itens = itensCarrinho();
    $("#cResumo").hidden = !itens.length;
    if (!itens.length) {
      box.innerHTML = '<div class="vazio-in"><b>🛍️</b><h2>' + T("Tu carrito está vacío", "O seu carrinho está vazio") + '</h2><a class="bt" href="./">' + T("Ver productos", "Ver produtos") + "</a></div>";
      return;
    }
    box.innerHTML = itens.map(function (it) {
      return '<div class="item"><img src="' + esc(it.p.imagenes[0]) + '" alt=""><div class="item-tx"><a href="producto.html?id=' + encodeURIComponent(it.p.id) + '">' + esc(nome(it.p)) + "</a><span>" + euro(it.p.precio) + '</span></div>' +
        '<div class="qtd"><button type="button" data-q="-1" data-id="' + esc(it.p.id) + '">−</button><span>' + it.q + '</span><button type="button" data-q="1" data-id="' + esc(it.p.id) + '">+</button></div>' +
        '<b class="item-total">' + euro(it.p.precio * it.q) + "</b></div>";
    }).join("");
    $("#cSub").textContent = euro(total());
    $("#cTotal").textContent = euro(total());
    var pedido = $("[data-pedido]");
    if (pedido) pedido.href = "mailto:" + (C.email || "") + "?subject=" + encodeURIComponent(T("Pedido", "Encomenda")) +
      "&body=" + encodeURIComponent(itens.map(function (it) { return it.q + " x " + nome(it.p) + " (" + it.p.id + ")"; }).join("\n") + "\nTotal: " + euro(total()));
  }
  if ($("#cItens")) {
    $("#cItens").addEventListener("click", function (e) {
      var b = e.target.closest("[data-q]"); if (!b) return;
      var id = b.getAttribute("data-id");
      carrinho[id] = (carrinho[id] || 0) + Number(b.getAttribute("data-q"));
      if (carrinho[id] <= 0) delete carrinho[id];
      if (carrinho[id] > 9) carrinho[id] = 9;
      salvar(); desenharCarrinho();
    });
  }
  var ppCarregado = false;
  function iniciarPayPal() {
    if (!$("#paypal") || ppCarregado || !itensCarrinho().length) return;
    if (!C.paypalClientId) { $("#semPP").hidden = false; return; }
    ppCarregado = true;
    var s = document.createElement("script");
    s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(C.paypalClientId) + "&currency=EUR&intent=capture&locale=" + (lang() === "pt" ? "pt_PT" : "es_ES");
    s.onload = function () {
      window.paypal.Buttons({
        style: { layout: "vertical", shape: "pill", label: "pay" },
        onClick: function (d, actions) {
          if (!$("#cAceite").checked) { aviso(T("Marca la casilla de condiciones para continuar", "Marque a caixa das condições para continuar")); return actions.reject(); }
          return actions.resolve();
        },
        createOrder: function (d, actions) {
          var itens = itensCarrinho();
          var tot = total().toFixed(2);
          return actions.order.create({
            purchase_units: [{
              description: "LeuName",
              amount: { currency_code: "EUR", value: tot, breakdown: { item_total: { currency_code: "EUR", value: tot } } },
              items: itens.map(function (it) {
                return { name: nome(it.p).slice(0, 120), sku: it.p.id.slice(0, 120), quantity: String(it.q), unit_amount: { currency_code: "EUR", value: it.p.precio.toFixed(2) }, category: "PHYSICAL_GOODS" };
              })
            }],
            application_context: { shipping_preference: "GET_FROM_FILE", brand_name: "LeuName" }
          });
        },
        onShippingAddressChange: function (d, actions) {
          var pais = d && d.shippingAddress && d.shippingAddress.countryCode;
          if (pais !== "ES" && pais !== "PT") return actions.reject(d.errors && d.errors.COUNTRY_ERROR);
        },
        onApprove: function (d, actions) {
          return actions.order.capture().then(function (r) {
            carrinho = {}; salvar();
            location.href = "gracias.html?pedido=" + encodeURIComponent((r && r.id) || d.orderID || "");
          });
        },
        onError: function () { aviso(T("No se pudo completar el pago. Inténtalo de nuevo.", "Não foi possível concluir o pagamento. Tente novamente.")); }
      }).render("#paypal");
    };
    document.head.appendChild(s);
  }
  var nr = $("#nrPedido");
  if (nr) { var n = new URLSearchParams(location.search).get("pedido"); if (n) nr.textContent = T("Pedido nº ", "Encomenda nº ") + n; }

  function redesenhar() { desenharLoja(); desenharProduto(); desenharCarrinho(); }

  fetch("produtos.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    .then(function (lista) {
      PRODUTOS = (Array.isArray(lista) ? lista : []).filter(function (p) { return p && p.id && p.imagenes && p.imagenes.length && p.precio > 0; });
      PRODUTOS.forEach(function (p) { porId[p.id] = p; });
      Object.keys(carrinho).forEach(function (id) { if (!porId[id]) delete carrinho[id]; });
      contador(); redesenhar(); iniciarPayPal();
    });
})();
