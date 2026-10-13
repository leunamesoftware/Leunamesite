// Loja Europa LeunaPets (pets.leuname.com): serve o site estático e o pagamento por cartão (Stripe Checkout).
// A chave fica no segredo STRIPE_SECRET_KEY do Worker (vem do segredo do GitHub, nunca do código).
// O preço é SEMPRE o de produtos.json (o navegador só manda id e quantidade).
import { painel, catalogo, servirVideo } from "./painel-api.js";

const PAISES = ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "PT", "IE"];
const SITE = "https://pets.leuname.com";
const HOST_LOJA = "pets.leuname.com";

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function produtos(env, req) {
  const mapa = {};
  for (const p of await catalogo(env, req)) if (p && p.id && p.precio > 0) mapa[p.id] = p;
  return mapa;
}

async function pagar(req, env) {
  if (!env.STRIPE_SECRET_KEY) return json({ erro: "stripe-desligado" }, 503);
  const corpo = await req.json().catch(() => null);
  if (!corpo || !Array.isArray(corpo.itens) || !corpo.itens.length || corpo.itens.length > 30) return json({ erro: "carrinho" }, 400);
  const lang = ["es", "pt", "en"].includes(corpo.lang) ? corpo.lang : "en";
  const cat = await produtos(env, req);
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
    const info = p[lang] || p.es || {};
    f.set(`line_items[${n}][quantity]`, String(q));
    f.set(`line_items[${n}][price_data][currency]`, "eur");
    f.set(`line_items[${n}][price_data][unit_amount]`, String(Math.round(p.precio * 100)));
    f.set(`line_items[${n}][price_data][product_data][name]`, String(info.nombre || p.id).slice(0, 200));
    if (p.imagenes && p.imagenes[0]) f.set(`line_items[${n}][price_data][product_data][images][0]`, p.imagenes[0]);
    f.set(`line_items[${n}][price_data][product_data][metadata][cj]`, p.id);
    resumo.push(`${q}x ${p.id}`);
    n++;
  }
  f.set("metadata[itens]", resumo.join(", ").slice(0, 490));
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
    if (url.pathname === "/produtos.json") {
      return new Response(JSON.stringify(await catalogo(env, req)), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" } });
    }
    if (url.pathname === "/painel/app.apk" && env.DOWNLOADS) {
      const o = await env.DOWNLOADS.get("leunapets-painel.apk");
      if (!o) return new Response("O app ainda está sendo gerado. Tente em alguns minutos.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      return new Response(o.body, { headers: { "Content-Type": "application/vnd.android.package-archive", "Content-Disposition": 'attachment; filename="PainelLeunaPets.apk"', "Cache-Control": "no-cache" } });
    }
    if (url.pathname.startsWith("/v/")) return servirVideo(req, env, url.pathname.slice(3));
    if (url.pathname.startsWith("/api/painel/")) return painel(req, env, url);
    if (url.pathname === "/api/config") return json({ stripe: !!env.STRIPE_SECRET_KEY });
    if (url.pathname === "/api/pagar" && req.method === "POST") return pagar(req, env);
    if (url.pathname.startsWith("/api/")) return json({ erro: "404" }, 404);
    return env.ASSETS.fetch(req);
  },
};
