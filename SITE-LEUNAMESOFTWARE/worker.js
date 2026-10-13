// Lojas drop da Europa (subdomínios de leuname.com, lista em lojas.json): site estático + pagamento (Stripe Checkout).
// Cada host é uma loja: pets.leuname.com = raiz do site; as outras = pasta _lojas/<id>/ (o que faltar vem da raiz:
// loja.js, loja.css, painel...). Os produtos de cada loja ficam separados (coluna "loja" no D1).
// A chave fica no segredo STRIPE_SECRET_KEY do Worker (vem do segredo do GitHub, nunca do código).
// O preço é SEMPRE o de produtos.json (o navegador só manda id e quantidade).
import { painel, catalogo, servirVideo, lojaPorHost } from "./painel-api.js";

const PAISES = ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "PT", "IE"];
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
  const lang = ["es", "pt", "en"].includes(corpo.lang) ? corpo.lang : "en";
  const cat = await produtos(env, req, L);
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("payment_method_types[0]", "card");
  f.set("locale", lang === "en" ? "auto" : lang);
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
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: f,
  });
  const s = await r.json().catch(() => ({}));
  if (!r.ok || !s.url) return json({ erro: "stripe", detalhe: s.error && s.error.message }, 502);
  return json({ url: s.url });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // leunamesoftware.com = site dos softwares (em espanhol, futuro). Por enquanto: página "próximamente".
    if (/(^|\.)leunamesoftware\.com$/.test(url.hostname) && !url.pathname.startsWith("/admin") && !url.pathname.startsWith("/api/")) {
      const r = await env.ASSETS.fetch(new Request(new URL("/_software/", url), req));
      return new Response(r.body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
    }
    // leuname.com / www.leuname.com = domínio-mãe das lojas drop; com uma loja só, leva para a LeunaPets
    if (/^(www\.)?leuname\.com$/.test(url.hostname)) {
      return Response.redirect("https://" + HOST_LOJA + url.pathname + url.search, 301);
    }
    const L = lojaPorHost(url.hostname);
    if (url.pathname === "/produtos.json") {
      return new Response(JSON.stringify(await catalogo(env, req, L.id)), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" } });
    }
    if (url.pathname === "/painel/app.apk" && env.DOWNLOADS) {
      const o = await env.DOWNLOADS.get("leunapets-painel.apk");
      if (!o) return new Response("O app ainda está sendo gerado. Tente em alguns minutos.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      return new Response(o.body, { headers: { "Content-Type": "application/vnd.android.package-archive", "Content-Disposition": 'attachment; filename="PainelLeunaPets.apk"', "Cache-Control": "no-cache" } });
    }
    if (url.pathname.startsWith("/v/")) return servirVideo(req, env, url.pathname.slice(3));
    if (url.pathname.startsWith("/api/painel/")) return painel(req, env, url);
    if (url.pathname === "/api/config") return json({ stripe: !!env.STRIPE_SECRET_KEY });
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
