// Loja Europa (leunamesoftware.com): serve o site estático e o pagamento por cartão (Stripe Checkout).
// A chave fica no segredo STRIPE_SECRET_KEY do Worker (vem do segredo do GitHub, nunca do código).
// O preço é SEMPRE o de produtos.json (o navegador só manda id e quantidade).
const PAISES = ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "PT", "IE"];
const SITE = "https://leunamesoftware.com";

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function produtos(env, req) {
  const r = await env.ASSETS.fetch(new Request(new URL("/produtos.json", req.url)));
  if (!r.ok) return {};
  const lista = await r.json().catch(() => []);
  const mapa = {};
  for (const p of Array.isArray(lista) ? lista : []) if (p && p.id && p.precio > 0) mapa[p.id] = p;
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
    if (url.pathname === "/api/config") return json({ stripe: !!env.STRIPE_SECRET_KEY });
    if (url.pathname === "/api/pagar" && req.method === "POST") return pagar(req, env);
    if (url.pathname.startsWith("/api/")) return json({ erro: "404" }, 404);
    return env.ASSETS.fetch(req);
  },
};
