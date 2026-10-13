(function () {
  "use strict";
  var C = window.CONFIG || {};
  var html = document.documentElement;
  var lang = function () { return html.lang === "en" ? "en" : "es"; };
  var PAISES = ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "PT", "IE"];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var guardar = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var ler = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var euro = function (n) { return new Intl.NumberFormat({ pt: "pt-PT", es: "es-ES", en: "en-IE" }[lang()], { style: "currency", currency: "EUR" }).format(n); };
  var T = function (es, pt, en) { var l = lang(); return l === "pt" ? pt : l === "es" ? es : (en || es); };

  /* ---------- idioma ---------- */
  $$("[data-idioma]").forEach(function (s) {
    s.value = lang();
    s.addEventListener("change", function () {
      html.lang = s.value; guardar("lang", s.value);
      $$("[data-idioma]").forEach(function (o) { o.value = s.value; });
      redesenhar();
    });
  });

  /* ---------- básicos ---------- */
  $$("[data-mail]").forEach(function (a) { a.href = "mailto:" + (C.email || ""); });
  $$("[data-ano]").forEach(function (s) { s.textContent = new Date().getFullYear(); });
  if (C.titular) $$("[data-titular]").forEach(function (p) {
    p.textContent = T("Titular: ", "Titular: ", "Owner: ") + C.titular + " · " + (C.email || "");
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
    aviso(T("Añadido al carrito ✓", "Adicionado ao carrinho ✓", "Added to cart ✓"));
  }
  contador();

  /* ---------- produtos ---------- */
  var PRODUTOS = [], porId = {};
  var nome = function (p) { return (p[lang()] || p.es || {}).nombre || ""; };
  var info = function (p) { return p[lang()] || p.es || {}; };

  var CARRO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>';
  function cartao(p) {
    var link = 'producto.html?id=' + encodeURIComponent(p.id);
    return '<article class="card">' +
      '<a class="card-img" href="' + link + '"><img loading="lazy" src="' + esc(p.imagenes[0]) + '" alt="' + esc(nome(p)) + '">' +
      (p.destaque ? '<span class="tag">' + T("Destacado", "Destaque", "Featured") + '</span>' : (p.nuevo ? '<span class="tag tag-n">' + T("Novedad", "Novidade", "New") + '</span>' : '')) + '</a>' +
      '<div class="card-tx"><a href="' + link + '"><h3>' + esc(nome(p)) + '</h3></a>' +
      '<p class="card-gancho">' + esc(info(p).gancho || "") + '</p>' +
      '<div class="card-pe"><b>' + euro(p.precio) + '</b><button class="mais" type="button" data-add="' + esc(p.id) + '" aria-label="' + T("Añadir al carrito", "Adicionar ao carrinho", "Add to cart") + '">' + CARRO + '</button></div></div></article>';
  }

  var busca = (new URLSearchParams(location.search).get("q") || "").trim();
  var sem = function (x) { return String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };
  $$("[data-busca] input").forEach(function (i) { i.value = busca; });
  function placeholders() {
    $$("[data-busca] input").forEach(function (i) { i.placeholder = i.getAttribute("data-ph-" + lang()) || ""; });
  }
  placeholders();

  function desenharLoja() {
    placeholders();
    if (!$("[data-grade]")) return;
    var temAlgum = PRODUTOS.length > 0;
    $("#vazio").hidden = temAlgum;
    var grade = $('[data-grade="destaque"]');
    var pr = new URLSearchParams(location.search), animal = pr.get("animal"), catF = pr.get("cat");
    var minimo = PRODUTOS.reduce(function (m, p) { return Math.min(m, p.precio); }, Infinity);
    if ($("#desde") && isFinite(minimo)) { $("#desde b").textContent = euro(minimo); $("#desde").hidden = false; }
    $$(".menu a").forEach(function (a) {
      var m = (a.getAttribute("href") || "").match(/#(\w+)$/);
      if (m && PRODUTOS.length) a.hidden = !PRODUTOS.some(function (x) { return x.categoria === m[1]; });
    });
    $$("[data-bolha]").forEach(function (a) {
      var c = a.getAttribute("data-bolha"), p = PRODUTOS.filter(function (x) { return x.categoria === c; })[0];
      if (PRODUTOS.length) a.hidden = !p;
      var bc = $(".bolha-c", a);
      if (p && !bc.querySelector("img")) { bc.insertAdjacentHTML("beforeend", '<img src="' + esc(p.imagenes[0]) + '" alt="">'); bc.classList.add("tem-foto"); }
    });
    if (busca || animal || catF) {
      var q = sem(busca);
      var achados = PRODUTOS.filter(function (p) {
        if (animal && p.animal && p.animal !== animal && p.animal !== "ambos") return false;
        if (catF && p.categoria !== catF) return false;
        if (!busca) return true;
        return ["es", "pt", "en"].some(function (l) { var x = p[l] || {}; return sem(x.nombre + " " + (x.gancho || "") + " " + (x.descripcion || "")).indexOf(q) >= 0; });
      });
      var titulo = busca ? T("Resultados para", "Resultados para", "Results for") + " “" + busca + "”" :
        animal === "perro" ? T("Para perros", "Para cães", "For dogs") : animal === "gato" ? T("Para gatos", "Para gatos", "For cats") :
        ($('#' + catF + ' h2') ? $('#' + catF + ' h2').textContent : "");
      $("#novedades h2").textContent = titulo;
      $("#novedades .sec-sub").textContent = achados.length + " " + T("productos", "produtos", "products");
      setTimeout(function () { $("#novedades").scrollIntoView(); }, 50);
      grade.innerHTML = achados.map(cartao).join("");
      $("#semBusca").hidden = !temAlgum || achados.length > 0;
      $$(".cat").forEach(function (s) { s.hidden = true; });
      return;
    }
    var dest = PRODUTOS.filter(function (p) { return p.destaque; });
    if (!dest.length) dest = PRODUTOS.slice(0, 10);
    grade.innerHTML = dest.map(cartao).join("");
    $$(".cat").forEach(function (s) {
      var lista = PRODUTOS.filter(function (p) { return p.categoria === s.id; });
      s.hidden = !lista.length;
      $("[data-grade]", s).innerHTML = lista.map(cartao).join("");
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
    document.title = nome(p) + " — LeunaPets";
    $("#pNome").textContent = nome(p);
    $("#pPreco").textContent = euro(p.precio);
    $("#pDesc").textContent = i.descripcion || "";
    $("#pLista").innerHTML = (i.puntos || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    $("#pPrazo").textContent = (p.plazo ? p.plazo + " " + T("días laborables", "dias úteis", "business days") : T("7–15 días laborables", "7–15 dias úteis", "7–15 business days"));
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
      box.innerHTML = '<div class="vazio-in"><h2>' + T("Tu carrito está vacío", "O seu carrinho está vazio", "Your cart is empty") + '</h2><a class="bt" href="./">' + T("Ver productos", "Ver produtos", "Shop now") + "</a></div>";
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
    if (pedido) pedido.href = "mailto:" + (C.email || "") + "?subject=" + encodeURIComponent(T("Pedido", "Encomenda", "Order")) +
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
  var ppCarregado = false, temStripe = false;
  function aceitou() {
    if ($("#cAceite").checked) return true;
    aviso(T("Marca la casilla de condiciones para continuar", "Marque a caixa das condições para continuar", "Please tick the terms box to continue"));
    return false;
  }
  if ($("#btStripe")) $("#btStripe").addEventListener("click", function () {
    if (!aceitou()) return;
    var b = this; b.disabled = true;
    fetch("/api/pagar", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: lang(), itens: itensCarrinho().map(function (it) { return { id: it.p.id, q: it.q }; }) }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.url) location.href = j.url; else throw new Error(j && j.erro); })
      .catch(function () { b.disabled = false; aviso(T("No se pudo abrir el pago. Inténtalo de nuevo.", "Não foi possível abrir o pagamento. Tente novamente.", "Could not open checkout. Please try again.")); });
  });
  function iniciarPagamento() {
    if (!$("#paypal") || !itensCarrinho().length) return;
    fetch("/api/config").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (cfg) {
      temStripe = !!cfg.stripe;
      $("#btStripe").hidden = !temStripe;
      $("#ouPP").hidden = !(temStripe && C.paypalClientId);
      $("#semPP").hidden = temStripe || !!C.paypalClientId;
      iniciarPayPal();
    });
  }
  function iniciarPayPal() {
    if (ppCarregado || !C.paypalClientId) return;
    ppCarregado = true;
    var s = document.createElement("script");
    s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(C.paypalClientId) + "&currency=EUR&intent=capture&locale=" + ({ pt: "pt_PT", es: "es_ES", en: "en_GB" }[lang()]);
    s.onload = function () {
      window.paypal.Buttons({
        style: { layout: "vertical", shape: "pill", label: "pay" },
        onClick: function (d, actions) {
          return aceitou() ? actions.resolve() : actions.reject();
        },
        createOrder: function (d, actions) {
          var itens = itensCarrinho();
          var tot = total().toFixed(2);
          return actions.order.create({
            purchase_units: [{
              description: "LeunaPets",
              amount: { currency_code: "EUR", value: tot, breakdown: { item_total: { currency_code: "EUR", value: tot } } },
              items: itens.map(function (it) {
                return { name: nome(it.p).slice(0, 120), sku: it.p.id.slice(0, 120), quantity: String(it.q), unit_amount: { currency_code: "EUR", value: it.p.precio.toFixed(2) }, category: "PHYSICAL_GOODS" };
              })
            }],
            application_context: { shipping_preference: "GET_FROM_FILE", brand_name: "LeunaPets" }
          });
        },
        onShippingAddressChange: function (d, actions) {
          var pais = d && d.shippingAddress && d.shippingAddress.countryCode;
          if (PAISES.indexOf(pais) < 0) return actions.reject(d.errors && d.errors.COUNTRY_ERROR);
        },
        onApprove: function (d, actions) {
          return actions.order.capture().then(function (r) {
            carrinho = {}; salvar();
            location.href = "gracias.html?pedido=" + encodeURIComponent((r && r.id) || d.orderID || "");
          });
        },
        onError: function () { aviso(T("No se pudo completar el pago. Inténtalo de nuevo.", "Não foi possível concluir o pagamento. Tente novamente.", "Payment could not be completed. Please try again.")); }
      }).render("#paypal");
    };
    document.head.appendChild(s);
  }
  var nr = $("#nrPedido");
  if (nr) { if (/[?&]ok=1/.test(location.search)) { carrinho = {}; salvar(); } var n = new URLSearchParams(location.search).get("pedido"); if (n) nr.textContent = T("Pedido nº ", "Encomenda nº ", "Order no. ") + n; }

  /* ---------- banner rotativo ---------- */
  var slides = $$("[data-slide]"), atual = 0, timer;
  if (slides.length > 1) {
    var pts = $("[data-pontos]");
    pts.innerHTML = slides.map(function (_, i) { return '<button type="button" aria-label="' + (i + 1) + '"></button>'; }).join("");
    var ir = function (n) {
      atual = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle("on", i === atual); });
      $$("button", pts).forEach(function (b, i) { b.classList.toggle("on", i === atual); });
      clearInterval(timer); timer = setInterval(function () { ir(atual + 1); }, 6000);
    };
    $$("button", pts).forEach(function (b, i) { b.addEventListener("click", function () { ir(i); }); });
    $("[data-ant]").addEventListener("click", function () { ir(atual - 1); });
    $("[data-prox]").addEventListener("click", function () { ir(atual + 1); });
    ir(0);
  } else { $$(".seta-s").forEach(function (b) { b.hidden = true; }); }

  function redesenhar() { desenharLoja(); desenharProduto(); desenharCarrinho(); }

  fetch("produtos.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    .then(function (lista) {
      PRODUTOS = (Array.isArray(lista) ? lista : []).filter(function (p) { return p && p.id && p.imagenes && p.imagenes.length && p.precio > 0; });
      PRODUTOS.forEach(function (p) { porId[p.id] = p; });
      Object.keys(carrinho).forEach(function (id) { if (!porId[id]) delete carrinho[id]; });
      contador(); redesenhar(); iniciarPagamento();
    });
})();
