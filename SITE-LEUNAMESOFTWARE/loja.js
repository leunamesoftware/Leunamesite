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
    var p0 = porId[id.split("|")[0]];
    if (p0 && id.indexOf("|") < 0 && p0.variantes && p0.variantes.length > 1) { location.href = "producto.html?id=" + encodeURIComponent(id); return; }
    carrinho[id] = Math.min(9, (carrinho[id] || 0) + (q || 1)); salvar();
    aviso(T("Añadido al carrito ✓", "Adicionado ao carrinho ✓", "Added to cart ✓"));
  }
  contador();

  /* ---------- produtos ---------- */
  var PRODUTOS = [], porId = {};
  var nome = function (p) { return (p[lang()] || p.es || {}).nombre || ""; };
  var info = function (p) { return p[lang()] || p.es || {}; };
  // item do carrinho: "id" ou "id|vid" (variação: cor/tamanho)
  function resolver(chave) {
    var partes = chave.split("|"), p = porId[partes[0]];
    if (!p) return null;
    var v = null;
    if (p.variantes && p.variantes.length > 1) {
      v = p.variantes.filter(function (x) { return x.vid === partes[1]; })[0];
      if (!v) return null;
    }
    return { p: p, v: v, preco: v ? v.precio : p.precio, img: (v && v.img) || p.imagenes[0], nome: nome(p) + (v ? " — " + v.nombre : "") };
  }

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
      var POR = 20, pags = Math.max(1, Math.ceil(achados.length / POR));
      var pag = Math.min(pags, Math.max(1, parseInt(pr.get("p"), 10) || 1));
      grade.innerHTML = achados.slice((pag - 1) * POR, pag * POR).map(cartao).join("");
      paginacao(pag, pags);
      $("#semBusca").hidden = !temAlgum || achados.length > 0;
      $$(".cat").forEach(function (s) { s.hidden = true; });
      return;
    }
    var dest = PRODUTOS.filter(function (p) { return p.destaque; });
    if (!dest.length) dest = PRODUTOS.slice(0, 10);
    grade.innerHTML = dest.slice(0, 10).map(cartao).join("");
    paginacao(1, 1);
    $$(".cat").forEach(function (s) {
      var lista = PRODUTOS.filter(function (p) { return p.categoria === s.id; });
      s.hidden = !lista.length;
      $("[data-grade]", s).innerHTML = lista.slice(0, 10).map(cartao).join("");
      var n = $(".sec-n", s);
      if (!n) { n = document.createElement("span"); n.className = "sec-n"; $(".sec-cab h2", s).appendChild(n); }
      n.textContent = lista.length > 10 ? "(" + lista.length + ")" : "";
    });
    trilhos();
  }
  /* paginação: ‹ Anterior · 1 2 3 · Siguiente › */
  function paginacao(pag, pags) {
    var nav = $("#paginas");
    if (!nav) { nav = document.createElement("nav"); nav.id = "paginas"; nav.className = "paginas"; nav.setAttribute("aria-label", "Páginas"); $('[data-grade="destaque"]').insertAdjacentElement("afterend", nav); }
    nav.hidden = pags < 2;
    if (pags < 2) { nav.innerHTML = ""; return; }
    var link = function (n) { var u = new URLSearchParams(location.search); if (n > 1) u.set("p", n); else u.delete("p"); return "?" + u.toString(); };
    var nums = [];
    for (var k = 1; k <= pags; k++) {
      if (k === 1 || k === pags || Math.abs(k - pag) <= 1) nums.push(k);
      else if (nums[nums.length - 1] !== "…") nums.push("…");
    }
    nav.innerHTML = (pag > 1 ? '<a class="pg-seta" href="' + link(pag - 1) + '">‹ ' + T("Anterior", "Anterior", "Previous") + "</a>" : "") +
      nums.map(function (k) { return k === "…" ? "<span>…</span>" : k === pag ? '<b aria-current="page">' + k + "</b>" : '<a href="' + link(k) + '">' + k + "</a>"; }).join("") +
      (pag < pags ? '<a class="pg-seta" href="' + link(pag + 1) + '">' + T("Siguiente", "Seguinte", "Next") + " ›</a>" : "");
  }
  /* fileiras com setas (sem buracos quando há poucos produtos) */
  function trilhos() {
    $$(".grade").forEach(function (g) {
      var filtro = ["sugeridos", "rel"].indexOf(g.getAttribute("data-grade")) < 0;
      if (filtro) return;
      g.classList.add("trilho");
      if (filtro || g.parentNode.classList.contains("trilho-box")) { atualizarSetas(g); return; }
      var box = document.createElement("div"); box.className = "trilho-box";
      g.parentNode.insertBefore(box, g); box.appendChild(g);
      box.insertAdjacentHTML("beforeend", '<button type="button" class="seta-t ant" aria-label="‹">‹</button><button type="button" class="seta-t prox" aria-label="›">›</button><div class="trilho-pontos"></div>');
      $(".ant", box).addEventListener("click", function () { g.scrollBy({ left: -g.clientWidth * 0.9 }); });
      $(".prox", box).addEventListener("click", function () { g.scrollBy({ left: g.clientWidth * 0.9 }); });
      g.addEventListener("scroll", function () { atualizarSetas(g); }, { passive: true });
      atualizarSetas(g);
    });
  }
  function atualizarSetas(g) {
    var box = g.parentNode; if (!box.classList.contains("trilho-box")) return;
    var trilho = g.classList.contains("trilho"), max = g.scrollWidth - g.clientWidth;
    $(".ant", box).hidden = !trilho || g.scrollLeft < 8;
    $(".prox", box).hidden = !trilho || g.scrollLeft > max - 8;
    var pts = $(".trilho-pontos", box), paginas = trilho && max > 8 ? Math.ceil(g.scrollWidth / g.clientWidth - 0.05) : 0;
    pts.hidden = paginas < 2;
    if (paginas >= 2) {
      var atual = Math.round(g.scrollLeft / Math.max(1, max) * (paginas - 1));
      pts.innerHTML = new Array(paginas + 1).join("<i></i>");
      $$("i", pts).forEach(function (i, k) { i.classList.toggle("on", k === atual); });
    }
  }
  window.addEventListener("resize", function () { $$(".grade").forEach(atualizarSetas); });
  /* voltar ao topo */
  (function () {
    var b = document.createElement("button"); b.type = "button"; b.className = "topo-bt"; b.setAttribute("aria-label", "↑"); b.textContent = "↑";
    document.body.appendChild(b);
    b.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    window.addEventListener("scroll", function () { b.classList.toggle("on", window.scrollY > 600); }, { passive: true });
  })();
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
    var rel = $("#pRel");
    if (!rel) { rel = document.createElement("section"); rel.id = "pRel"; rel.className = "sugeridos"; box.appendChild(rel); }
    var outros = PRODUTOS.filter(function (x) { return x.id !== p.id && x.categoria === p.categoria; })
      .concat(PRODUTOS.filter(function (x) { return x.id !== p.id && x.categoria !== p.categoria; })).slice(0, 12);
    rel.hidden = !outros.length;
    rel.innerHTML = outros.length ? '<h2>' + T("También te puede gustar", "Também pode gostar", "You may also like") + '</h2><div class="grade" data-grade="rel">' + outros.map(cartao).join("") + "</div>" : "";
    trilhos();
    var box2 = $("#pVars");
    if (!box2) { box2 = document.createElement("div"); box2.id = "pVars"; box2.className = "vars"; $("#pPreco").insertAdjacentElement("afterend", box2); }
    varSel = null;
    if (p.variantes && p.variantes.length > 1) {
      box2.hidden = false;
      box2.innerHTML = '<p class="vars-t">' + T("Elige una opción", "Escolha uma opção", "Choose an option") + ':</p><div class="vars-l">' +
        p.variantes.map(function (x, k) {
          return '<button type="button" data-var="' + k + '">' + (x.img ? '<img src="' + esc(x.img) + '" alt="">' : "") + '<span>' + esc(x.nombre) + "</span></button>";
        }).join("") + "</div>";
      escolher(p, 0);
    } else { box2.hidden = true; box2.innerHTML = ""; }
  }
  var varSel = null;
  function escolher(p, k) {
    var x = p.variantes[k]; varSel = x;
    $$("#pVars [data-var]").forEach(function (b) { b.classList.toggle("on", Number(b.getAttribute("data-var")) === k); });
    $("#pPreco").textContent = euro(x.precio);
    if (x.img) $("#pFoto").src = x.img;
  }
  if ($("#prod")) {
    $("#pMinis").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $("#pFoto").src = b.getAttribute("data-src");
      $$("#pMinis button").forEach(function (x) { x.classList.toggle("on", x === b); });
    });
    $("[data-menos]").addEventListener("click", function () { qtdProd = Math.max(1, qtdProd - 1); $("#pQtd").textContent = qtdProd; });
    $("[data-mais]").addEventListener("click", function () { qtdProd = Math.min(9, qtdProd + 1); $("#pQtd").textContent = qtdProd; });
    $("#prod").addEventListener("click", function (e) {
      var b = e.target.closest("[data-var]"); if (!b) return;
      escolher(porId[new URLSearchParams(location.search).get("id")], Number(b.getAttribute("data-var")));
    });
    $("#pAdd").addEventListener("click", function () {
      var id = new URLSearchParams(location.search).get("id");
      adicionar(varSel ? id + "|" + varSel.vid : id, qtdProd); $("#pIr").hidden = false;
    });
  }

  /* ---------- carrinho / pagamento ---------- */
  function itensCarrinho() {
    return Object.keys(carrinho).filter(function (k) { return carrinho[k] > 0 && resolver(k); })
      .map(function (k) { var r = resolver(k); r.k = k; r.q = carrinho[k]; return r; });
  }
  function total() { return itensCarrinho().reduce(function (s, it) { return s + it.preco * it.q; }, 0); }
  function desenharCarrinho() {
    var box = $("#cItens"); if (!box) return;
    var itens = itensCarrinho();
    $("#cResumo").hidden = !itens.length;
    if ($(".carr-in")) $(".carr-in").classList.toggle("so", !itens.length);
    if (!itens.length) {
      var sug = PRODUTOS.slice().sort(function (a, b) { return (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0); }).slice(0, 12);
      box.innerHTML = '<div class="vazio-in"><h2>' + T("Tu carrito está vacío", "O seu carrinho está vazio", "Your cart is empty") + '</h2><a class="bt" href="./">' + T("Ver productos", "Ver produtos", "Shop now") + "</a></div>" +
        (sug.length ? '<div class="sugeridos"><h2>' + T("Te puede gustar", "Também pode gostar", "You may also like") + '</h2><div class="grade" data-grade="sugeridos">' + sug.map(cartao).join("") + "</div></div>" : "");
      trilhos();
      return;
    }
    box.innerHTML = itens.map(function (it) {
      return '<div class="item"><img src="' + esc(it.img) + '" alt=""><div class="item-tx"><a href="producto.html?id=' + encodeURIComponent(it.p.id) + '">' + esc(it.nome) + "</a><span>" + euro(it.preco) + '</span></div>' +
        '<div class="qtd"><button type="button" data-q="-1" data-id="' + esc(it.k) + '">−</button><span>' + it.q + '</span><button type="button" data-q="1" data-id="' + esc(it.k) + '">+</button></div>' +
        '<b class="item-total">' + euro(it.preco * it.q) + "</b></div>";
    }).join("");
    $("#cSub").textContent = euro(total());
    $("#cTotal").textContent = euro(total());
    var pedido = $("[data-pedido]");
    if (pedido) pedido.href = "mailto:" + (C.email || "") + "?subject=" + encodeURIComponent(T("Pedido", "Encomenda", "Order")) +
      "&body=" + encodeURIComponent(itens.map(function (it) { return it.q + " x " + it.nome + " (" + it.k + ")"; }).join("\n") + "\nTotal: " + euro(total()));
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
      body: JSON.stringify({ lang: lang(), itens: itensCarrinho().map(function (it) { return { id: it.p.id, v: it.v ? it.v.vid : undefined, q: it.q }; }) }) })
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
                return { name: it.nome.slice(0, 120), sku: it.k.slice(0, 120), quantity: String(it.q), unit_amount: { currency_code: "EUR", value: it.preco.toFixed(2) }, category: "PHYSICAL_GOODS" };
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
      Object.keys(carrinho).forEach(function (k) { if (!resolver(k)) delete carrinho[k]; });
      contador(); redesenhar(); iniciarPagamento();
    });
})();
