// Lojas drop da Europa (subdomínios de leuname.com, lista em lojas.json): site estático + pagamento (Stripe Checkout).
// Cada host é uma loja: pets.leuname.com = raiz do site; as outras = pasta _lojas/<id>/ (o que faltar vem da raiz:
// loja.js, loja.css, painel...). Os produtos de cada loja ficam separados (coluna "loja" no D1).
// A chave fica no segredo STRIPE_SECRET_KEY do Worker (vem do segredo do GitHub, nunca do código).
// O preço é SEMPRE o de produtos.json (o navegador só manda id e quantidade).
import { painel, catalogo, servirVideo, lojaPorHost, roboPedidos, legendaTikTok, salvarVendaPayPal } from "./painel-api.js";

const PAISES = ["PT"];
const HOST_LOJA = "pets.leuname.com";

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function produtos(env, req, L) {
  const mapa = {};
  for (const p of await catalogo(env, req, L.id)) if (p && p.id && p.precio > 0) mapa[p.id] = p;
  return mapa;
}

async function pagar(req, env, L) {
  const SITE = "https://" + L.host;
  if (!env.STRIPE_SECRET_KEY) return json({ erro: "stripe-desligado" }, 503);
  const corpo = await req.json().catch(() => null);
  if (!corpo || !Array.isArray(corpo.itens) || !corpo.itens.length || corpo.itens.length > 30) return json({ erro: "carrinho" }, 400);
  const lang = "pt";
  const cat = await produtos(env, req, L);
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("payment_method_types[0]", "card");
  f.set("locale", "pt");
  f.set("success_url", `${SITE}/gracias.html?ok=1&pedido={CHECKOUT_SESSION_ID}`);
  f.set("cancel_url", `${SITE}/carrito.html`);
  f.set("phone_number_collection[enabled]", "true");
  f.set("billing_address_collection", "auto");
  PAISES.forEach((p, i) => f.set(`shipping_address_collection[allowed_countries][${i}]`, p));
  const resumo = [];
  let n = 0;
  for (const it of corpo.itens) {
    const p = cat[it && it.id];
    const q = Math.max(1, Math.min(9, parseInt(it && it.q, 10) || 0));
    if (!p) return json({ erro: "produto", id: it && it.id }, 400);
    let v = null;
    if (Array.isArray(p.variantes) && p.variantes.length > 1) {
      v = p.variantes.find((x) => x.vid === (it && it.v));
      if (!v) return json({ erro: "variacao", id: p.id }, 400);
    }
    const preco = v ? v.precio : p.precio;
    const info = p[lang] || p.es || {};
    f.set(`line_items[${n}][quantity]`, String(q));
    f.set(`line_items[${n}][price_data][currency]`, "eur");
    f.set(`line_items[${n}][price_data][unit_amount]`, String(Math.round(preco * 100)));
    f.set(`line_items[${n}][price_data][product_data][name]`, (String(info.nombre || p.id) + (v ? " — " + v.nombre : "")).slice(0, 200));
    const img = (v && v.img) || (p.imagenes && p.imagenes[0]);
    if (img) f.set(`line_items[${n}][price_data][product_data][images][0]`, /^https?:/.test(img) ? img : SITE + "/" + img.replace(/^\//, ""));
    f.set(`line_items[${n}][price_data][product_data][metadata][cj]`, p.id);
    if (v) f.set(`line_items[${n}][price_data][product_data][metadata][vid]`, v.vid);
    resumo.push(`${q}x ${p.id}${v ? ":" + v.vid : ""}`);
    n++;
  }
  f.set("metadata[itens]", resumo.join(", ").slice(0, 490));
  f.set("metadata[loja]", L.id);
  const origem = String(corpo.origem || "").toLowerCase().replace(/[^a-z0-9.\-]/g, "").slice(0, 30);
  if (origem) f.set("metadata[origem]", origem);
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: f,
  });
  const s = await r.json().catch(() => ({}));
  if (!r.ok || !s.url) return json({ erro: "stripe", detalhe: s.error && s.error.message }, 502);
  return json({ url: s.url });
}

// ---------- PayPal (pedido criado e capturado no servidor; preço sempre o da loja) ----------
const PP = "https://api-m.paypal.com";
async function tokenPayPal(env) {
  const r = await fetch(PP + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_SECRET), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const d = await r.json().catch(() => ({}));
  if (!d.access_token) throw new Error("paypal-token");
  return d.access_token;
}
async function paypalCriar(req, env, L) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return json({ erro: "paypal-desligado" }, 503);
  const corpo = await req.json().catch(() => null);
  if (!corpo || !Array.isArray(corpo.itens) || !corpo.itens.length || corpo.itens.length > 30) return json({ erro: "carrinho" }, 400);
  const lang = ["es", "pt", "en"].includes(corpo.lang) ? corpo.lang : "es";
  const cat = await produtos(env, req, L);
  const itens = [];
  let total = 0;
  for (const it of corpo.itens) {
    const p = cat[it && it.id];
    if (!p) return json({ erro: "produto" }, 400);
    let v = null;
    if (Array.isArray(p.variantes) && p.variantes.length > 1) {
      v = p.variantes.find((x) => x.vid === (it && it.v));
      if (!v) return json({ erro: "variacao" }, 400);
    }
    const q = Math.max(1, Math.min(9, parseInt(it && it.q, 10) || 0));
    const preco = Math.round((v ? v.precio : p.precio) * 100);
    total += preco * q;
    const info = p[lang] || p.es || {};
    itens.push({ name: (String(info.nombre || p.id) + (v ? " — " + v.nombre : "")).slice(0, 120), sku: (p.id + (v ? ":" + v.vid : "")).slice(0, 120),
      quantity: String(q), unit_amount: { currency_code: "EUR", value: (preco / 100).toFixed(2) }, category: "PHYSICAL_GOODS" });
  }
  const valor = (total / 100).toFixed(2);
  const r = await fetch(PP + "/v2/checkout/orders", {
    method: "POST",
    headers: { Authorization: "Bearer " + (await tokenPayPal(env)), "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ custom_id: L.id, description: L.marca, items: itens,
        amount: { currency_code: "EUR", value: valor, breakdown: { item_total: { currency_code: "EUR", value: valor } } } }],
      application_context: { brand_name: L.marca, shipping_preference: "GET_FROM_FILE", user_action: "PAY_NOW",
        locale: lang === "en" ? "en-GB" : lang === "pt" ? "pt-PT" : "es-ES" },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) return json({ erro: "paypal", detalhe: d.message }, 502);
  return json({ id: d.id });
}
async function paypalCapturar(req, env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return json({ erro: "paypal-desligado" }, 503);
  const corpo = await req.json().catch(() => ({}));
  const id = String(corpo.id || "").replace(/[^A-Z0-9]/gi, "").slice(0, 40);
  if (!id) return json({ erro: "id" }, 400);
  const tk = await tokenPayPal(env);
  const h = { Authorization: "Bearer " + tk, "Content-Type": "application/json" };
  const o = await (await fetch(PP + "/v2/checkout/orders/" + id, { headers: h })).json().catch(() => ({}));
  const pais = o.purchase_units && o.purchase_units[0] && o.purchase_units[0].shipping && o.purchase_units[0].shipping.address && o.purchase_units[0].shipping.address.country_code;
  if (pais && !PAISES.includes(pais)) return json({ erro: "pais" }, 400);   // não cobra fora dos 9 países
  const r = await fetch(PP + "/v2/checkout/orders/" + id + "/capture", { method: "POST", headers: h });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status !== "COMPLETED") return json({ erro: "captura", detalhe: d.message }, 502);
  // guarda a venda: o robô cria o pedido na CJ e ela aparece no painel, como as do Stripe
  const origem = String(corpo.origem || "").toLowerCase().replace(/[^a-z0-9.\-]/g, "").slice(0, 30);
  try { await salvarVendaPayPal(env, o, d, origem); } catch (e) { console.log("salvar venda paypal", e); }
  return json({ ok: true, id: d.id });
}

export default {
  // de 5 em 5 minutos: vendas pagas viram pedido na CJ (pago com o saldo da CJ Wallet) e busca rastreios
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(roboPedidos(env));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    // leunamesoftware.com = site dos softwares (em espanhol, futuro). Por enquanto: página "próximamente".
    if (/(^|\.)leunamesoftware\.com$/.test(url.hostname) && !url.pathname.startsWith("/admin") && !url.pathname.startsWith("/api/")) {
      const r = await env.ASSETS.fetch(new Request(new URL("/_software/", url), req));
      return new Response(r.body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
    }
    // casa.leuname.com foi o endereço provisório da Cachik
    if (url.hostname === "casa.leuname.com") return Response.redirect("https://cachik.leuname.com" + url.pathname + url.search, 301);
    // leuname.com / www.leuname.com = domínio-mãe das lojas drop; com uma loja só, leva para a LeunaPets
    if (/^(www\.)?leuname\.com$/.test(url.hostname)) {
      return Response.redirect("https://" + HOST_LOJA + url.pathname + url.search, 301);
    }
    const L = lojaPorHost(url.hostname);
    if (url.pathname === "/produtos.json") {
      return new Response(JSON.stringify(await catalogo(env, req, L.id)), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" } });
    }
    // Google Shopping (listagens grátis): feed com os produtos ativos desta loja
    if (url.pathname === "/google-shopping.xml") {
      const x = (s) => String(s == null ? "" : s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
      const base = "https://" + L.host;
      const itens = (await catalogo(env, req, L.id)).filter((p) => p && p.id && p.precio > 0 && ((p.pt && p.pt.nombre) || (p.es && p.es.nombre)) && (p.imagenes || []).length);
      const xml = itens.map((p) => {
        const img = p.imagenes.map((i) => (/^https?:/.test(i) ? i : base + "/" + String(i).replace(/^\//, "")));
        const tx = (p.pt && p.pt.nombre) ? p.pt : p.es;
        const desc = [tx.descripcion, ...(tx.puntos || [])].filter(Boolean).join(" · ").slice(0, 4900);
        return "<item>" +
          "<g:id>" + x(p.id) + "</g:id><title>" + x(tx.nombre.slice(0, 150)) + "</title>" +
          "<description>" + x(desc || tx.nombre) + "</description>" +
          "<link>" + x(base + "/producto.html?id=" + encodeURIComponent(p.id)) + "</link>" +
          "<g:image_link>" + x(img[0]) + "</g:image_link>" +
          img.slice(1, 10).map((i) => "<g:additional_image_link>" + x(i) + "</g:additional_image_link>").join("") +
          "<g:availability>in_stock</g:availability><g:condition>new</g:condition>" +
          "<g:price>" + Number(p.precio).toFixed(2) + " EUR</g:price>" +
          "<g:brand>" + x(L.marca) + "</g:brand><g:identifier_exists>no</g:identifier_exists>" +
          "<g:product_type>" + x(p.categoria || "") + "</g:product_type>" +
          "<g:shipping><g:country>PT</g:country><g:service>Portes grátis</g:service><g:price>0.00 EUR</g:price></g:shipping>" +
          "</item>";
      }).join("\n");
      const doc = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>' +
        "<title>" + x(L.marca) + "</title><link>" + base + "</link><description>" + x(L.marca) + " – portes grátis para Portugal</description>\n" + xml + "\n</channel></rss>";
      return new Response(doc, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
    }
    if (url.pathname === "/painel/app-versao.json" && env.DOWNLOADS) {
      const o = await env.DOWNLOADS.get("leunapets-painel-versao.json");
      return new Response(o ? o.body : '{"versao":0}', { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/painel/app.apk" && env.DOWNLOADS) {
      const o = await env.DOWNLOADS.get("leunapets-painel.apk");
      if (!o) return new Response("O app ainda está sendo gerado. Tente em alguns minutos.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      return new Response(o.body, { headers: { "Content-Type": "application/vnd.android.package-archive", "Content-Disposition": 'attachment; filename="PainelLeunaPets.apk"', "Cache-Control": "no-cache" } });
    }
    if (url.pathname.startsWith("/v/")) return servirVideo(req, env, url.pathname.slice(3));
    if (url.pathname.startsWith("/api/painel/")) return painel(req, env, url);
    if (url.pathname === "/tt") {   // página simples para quem posta no TikTok: baixar vídeo + copiar legenda
      const id = String(url.searchParams.get("id") || "").slice(0, 64);
      const p = (await catalogo(env, req, L.id)).find((x) => x && x.id === id);
      const x = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      if (!p || !/^\/v\//.test(p.video || "")) return new Response("Produto não encontrado.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      const { legenda } = legendaTikTok(p, L);
      const nome = (p.es && p.es.nombre) || p.id;
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Post do TikTok</title>
<style>body{margin:0;font:17px/1.45 system-ui,sans-serif;background:#F4F6FB;color:#1B2140}main{max-width:520px;margin:0 auto;padding:16px}
h1{font-size:21px;margin:4px 0 12px}video{width:100%;max-height:52vh;background:#000;border-radius:14px}
.bt{display:block;width:100%;box-sizing:border-box;text-align:center;border:0;border-radius:14px;padding:16px;font-size:19px;font-weight:800;margin:12px 0 4px;text-decoration:none;cursor:pointer}
.b1{background:#0F1E44;color:#fff}.b2{background:#FF6B4A;color:#fff}.ok{background:#39B26B!important}
pre{white-space:pre-wrap;font:15px/1.4 system-ui,sans-serif;background:#fff;border-radius:12px;padding:10px 12px;margin:6px 0}
ol{background:#fff;border-radius:14px;padding:14px 14px 14px 36px}li{margin:6px 0}small{color:#5b6280}</style></head><body><main>
<h1>📱 Post de hoje: ${x(nome)}</h1>
<video src="${x(p.video)}" controls playsinline preload="metadata"></video>
<a class="bt b1" href="${x(p.video)}?baixar=${encodeURIComponent(nome)}">1️⃣ ⬇️ Baixar o vídeo</a><small>Se abrir o vídeo em vez de baixar: segure o dedo no vídeo → Baixar.</small>
<button class="bt b2" id="cop">2️⃣ 📋 Copiar a legenda</button>
<pre id="leg">${x(legenda)}</pre>
<ol><li>Abra o <b>TikTok</b> → toque no <b>＋</b> (meio, embaixo).</li><li><b>Carregar</b> → escolha o vídeo que baixou → <b>Avançar</b>.</li><li>Na descrição: segure o dedo → <b>Colar</b>.</li><li>Toque em <b>Publicar</b> ✅</li></ol>
</main><script>document.getElementById("cop").onclick=function(){var b=this,t=document.getElementById("leg").textContent;
function ok(){b.textContent="✅ Legenda copiada! Agora vá ao TikTok";b.classList.add("ok")}
(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(ok).catch(function(){var r=document.createRange();r.selectNodeContents(document.getElementById("leg"));var s=getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand("copy");ok()}catch(e){alert("Segure o dedo no texto e copie")}})}</script></body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
    }
    if (url.pathname === "/api/tiktok-recentes") {   // produtos dos últimos vídeos mandados para o TikTok (seção "Visto en TikTok")
      let ids = [];
      try { ids = (await env.DB.prepare("SELECT id FROM tiktok_envios WHERE loja=? ORDER BY enviado DESC LIMIT 60").bind(L.id).all()).results.map((r) => r.id); } catch (e) { ids = []; }
      return new Response(JSON.stringify({ ids }), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
    }
    if (url.pathname === "/api/config") return json({ stripe: !!env.STRIPE_SECRET_KEY, paypal: env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET ? env.PAYPAL_CLIENT_ID : "" });
    if (url.pathname === "/api/paypal/criar" && req.method === "POST") return paypalCriar(req, env, L);
    if (url.pathname === "/api/paypal/capturar" && req.method === "POST") return paypalCapturar(req, env);
    if (url.pathname === "/api/pagar" && req.method === "POST") return pagar(req, env, L);
    if (url.pathname.startsWith("/api/")) return json({ erro: "404" }, 404);
    // loja com pasta própria: tenta _lojas/<id>/<caminho>; se não existir, usa o arquivo comum da raiz
    if (L.pasta && !url.pathname.startsWith("/painel") && !url.pathname.startsWith("/_lojas/")) {
      const r = await env.ASSETS.fetch(new Request(new URL(L.pasta + url.pathname + url.search, url), req));
      if ([301, 302, 307, 308].includes(r.status)) {   // ex.: /carrito.html → /carrito (sem mostrar a pasta interna)
        const destino = new URL(r.headers.get("location") || "/", url);
        if (destino.pathname.startsWith(L.pasta)) return Response.redirect(url.origin + (destino.pathname.slice(L.pasta.length) || "/") + destino.search, r.status);
      }
      if (r.status !== 404) return r;
    }
    return env.ASSETS.fetch(req);
  },
};
