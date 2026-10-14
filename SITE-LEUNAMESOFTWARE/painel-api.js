// Painel do dono das lojas drop (pets.leuname.com/painel/): login, busca na CJ ao vivo e "Publicar" com 1 clique.
// Várias lojas (lojas.json): cada produto do D1 tem a coluna "loja"; uma loja nunca vê os produtos da outra.
// Segredos do Worker (vêm dos segredos do GitHub pelo workflow): LOJA_ADMIN_SENHA, CJ_API_KEY. Nunca no código.
// Banco D1 "leunapets" (binding DB): produtos publicados pelo painel, sessões, token da CJ.
const CJ = "https://developers.cjdropshipping.com/api2.0/v1";
const USD_EUR = 0.93;
const FRETE_TESTE = ["DE", "FR", "ES", "IT"];
const FRETE_TESTE_UE = ["ES", "PT"];   // produto de armazém na Europa: o que importa é chegar na Espanha e em Portugal
const ARMAZENS_UE = ["DE", "PL"];
const PRAZO_MAX = 18;
import LOJAS from "./lojas.json";
export const lojaPorId = (id) => LOJAS.find((l) => l.id === id) || LOJAS[0];
export const lojaPorHost = (host) => LOJAS.find((l) => l.host === host) || LOJAS[0];
const catsDe = (L) => L.cats.map((c) => c[0]);
// fotos dos produtos do robô são "img/p/…" (relativas à loja); no painel (/painel/) precisam começar com "/"
const fotoAbs = (u) => (!u || /^(https?:)?\/\//.test(u) || u.startsWith("/") ? u || "" : "/" + u);
const DESC_LOJA = {
  pets: "a pet shop for dogs and cats in Spain",
  casa: "Cachik, a home, garden, décor, lighting and furniture shop in Spain",
};
const ANIMAIS = ["perro", "gato", "ambos"];
const MODELO = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => {
  if (typeof v === "string" && v.includes("--")) v = v.split("--").pop();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
// frete: o mais barato até o prazo máximo; se um mais rápido custar até US$ 1 a mais, fica com o mais rápido
function escolherFrete(ops, prazoMax) {
  const boas = ops.filter((o) => o.dias <= prazoMax);
  const lista = (boas.length ? boas : ops).slice().sort((a, b) => a.usd - b.usd);
  const barato = lista[0];
  const rapido = lista.filter((o) => o.usd <= barato.usd + 1).sort((a, b) => a.dias - b.dias || a.usd - b.usd)[0];
  return rapido || barato;
}
// o dono não quer o número 13 em preço nenhum: 13,xx vira 12,99 ou 14,49
export const sem13 = (v) => (v >= 13 && v < 14 ? (v < 13.5 ? 12.99 : 14.49) : v);
export const precoVenda = (custoEur) => sem13(Math.ceil(Math.max(custoEur * 2, custoEur + 8)) - 0.01);
export const lucro = (preco, custoEur) => Math.round((preco - custoEur - (preco * 0.07 + 0.35)) * 100) / 100;

async function sha(txt) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let tabelasOk = false;
async function tabelas(env) {
  if (tabelasOk) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS produtos (id TEXT PRIMARY KEY, dados TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, criado TEXT NOT NULL DEFAULT (datetime('now')), atualizado TEXT NOT NULL DEFAULT (datetime('now')))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sessoes (token TEXT PRIMARY KEY, expira INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS tentativas (ip TEXT PRIMARY KEY, n INTEGER NOT NULL, desde INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS produtos_v2 (loja TEXT NOT NULL, id TEXT NOT NULL, dados TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, criado TEXT NOT NULL DEFAULT (datetime('now')), atualizado TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (loja, id))"),
    // produtos publicados antes das várias lojas = LeunaPets
    env.DB.prepare("INSERT OR IGNORE INTO produtos_v2 (loja, id, dados, ativo, criado, atualizado) SELECT 'pets', id, dados, ativo, criado, atualizado FROM produtos"),
  ]);
  tabelasOk = true;
}

// ---------- login ----------
async function login(req, env) {
  if (!env.LOJA_ADMIN_SENHA) return json({ erro: "senha-nao-configurada" }, 503);
  const ip = req.headers.get("CF-Connecting-IP") || "?";
  const agora = Date.now();
  const t = await env.DB.prepare("SELECT n, desde FROM tentativas WHERE ip=?").bind(ip).first();
  if (t && t.n >= 6 && agora - t.desde < 15 * 60e3) return json({ erro: "muitas-tentativas" }, 429);
  const corpo = await req.json().catch(() => ({}));
  const ok = (await sha(String(corpo.senha || ""))) === (await sha(env.LOJA_ADMIN_SENHA));
  if (!ok) {
    if (!t || agora - t.desde >= 15 * 60e3) await env.DB.prepare("INSERT OR REPLACE INTO tentativas (ip,n,desde) VALUES (?,1,?)").bind(ip, agora).run();
    else await env.DB.prepare("UPDATE tentativas SET n=n+1 WHERE ip=?").bind(ip).run();
    await dormir(800);
    return json({ erro: "senha" }, 401);
  }
  await env.DB.prepare("DELETE FROM tentativas WHERE ip=?").bind(ip).run();
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare("DELETE FROM sessoes WHERE expira<?").bind(agora).run();
  await env.DB.prepare("INSERT INTO sessoes (token, expira) VALUES (?,?)").bind(await sha(token), agora + 60 * 864e5).run();
  return json({ token });
}

async function logado(req, env) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.get("Authorization") || "");
  if (!m) return false;
  const s = await env.DB.prepare("SELECT expira FROM sessoes WHERE token=?").bind(await sha(m[1])).first();
  return !!(s && s.expira > Date.now());
}

// ---------- CJ ----------
async function tokenCJ(env, novo = false) {
  if (!novo) {
    const c = await env.DB.prepare("SELECT valor FROM config WHERE chave='cj_token'").first();
    if (c) {
      const v = JSON.parse(c.valor);
      if (v.expira > Date.now() + 864e5) return v.token;
    }
  }
  if (!env.CJ_API_KEY) throw new Error("sem-chave-cj");
  const r = await fetch(CJ + "/authentication/getAccessToken", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: env.CJ_API_KEY }),
  });
  const d = await r.json().catch(() => ({}));
  const tk = d.data && d.data.accessToken;
  if (!tk) throw new Error("cj-token: " + (d.message || r.status));
  const expira = Date.parse(d.data.accessTokenExpiryDate || "") || Date.now() + 14 * 864e5;
  await env.DB.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES ('cj_token', ?)").bind(JSON.stringify({ token: tk, expira })).run();
  return tk;
}

async function cj(env, metodo, caminho, { params, corpo } = {}) {
  const url = CJ + caminho + (params ? "?" + new URLSearchParams(params) : "");
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const tk = await tokenCJ(env, tentativa === 1);
    const r = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json", "CJ-Access-Token": tk },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 429 || d.code === 1600200) { await dormir(1200); continue; }          // limite 1/s
    if (r.status === 401 || /token/i.test(d.message || "") && !d.result) continue;          // token vencido: pega outro
    return d;
  }
  return {};
}

async function buscar(env, url, L) {
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const pagina = Math.max(1, Math.min(50, parseInt(url.searchParams.get("pagina"), 10) || 1));
  const params = { page: pagina, size: 30 };
  if (q) params.keyWord = q;
  const cat = url.searchParams.get("cat");
  if (cat && /^\d{10,25}$/.test(cat)) params.categoryId = cat;
  if (!q && !params.categoryId) params.keyWord = "pet";
  const arm = String(url.searchParams.get("arm") || "").toUpperCase();
  if (ARMAZENS_UE.includes(arm)) params.countryCode = arm;
  const d = await cj(env, "GET", "/product/listV2", { params });
  if (!d.result && d.code !== 200) return json({ erro: "cj", detalhe: d.message || "sem resposta" }, 502);
  const publicados = new Set((await env.DB.prepare("SELECT id FROM produtos_v2 WHERE loja=? AND ativo=1").bind(L.id).all()).results.map((r) => r.id));
  const itens = [];
  for (const b of (d.data && d.data.content) || []) {
    for (const p of b.productList || []) {
      const custo = num(p.sellPrice);
      if (!p.id || custo == null) continue;
      itens.push({
        pid: p.id, nome: p.nameEn || p.productNameEn || "", img: p.bigImage || "", custoUsd: custo,
        popularidade: parseInt(p.listedNum, 10) || 0, video: !!((p.videoList && p.videoList.length) || String(p.isVedio) === "1"),
        categoria: p.threeCategoryName || p.categoryName || "", publicado: publicados.has(p.id), armazem: params.countryCode || "CN",
      });
    }
  }
  return json({ itens, pagina, total: (d.data && d.data.totalRecords) || itens.length });
}

function lista(v) {
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = [v]; } }
  return Array.isArray(v) ? v : [];
}

async function detalhe(env, pid, origem = "CN") {
  origem = ARMAZENS_UE.includes(origem) ? origem : "CN";
  const testar = origem === "CN" ? FRETE_TESTE : FRETE_TESTE_UE;
  const d = (await cj(env, "GET", "/product/query", { params: { pid, features: "enable_video" } })).data;
  if (!d) return null;
  const variantes = d.variants || [];
  if (!variantes.length) return null;
  const vid = variantes[0].vid;
  const custo = num(variantes[0].variantSellPrice) ?? num(d.sellPrice);
  if (!custo) return null;
  const fretes = {};
  for (const destino of testar) {
    await dormir(1100);
    const f = await cj(env, "POST", "/logistic/freightCalculate", {
      corpo: { startCountryCode: origem, endCountryCode: destino, products: [{ quantity: 1, vid }] },
    });
    const ops = (f.data || []).filter((o) => num(o.logisticPrice) != null).map((o) => {
      const tot = num(o.totalPostageFee);
      const usd = tot || num(o.logisticPrice) + (num(o.taxesFee) || 0) + (num(o.clearanceOperationFee) || 0);
      const dias = Math.max(0, ...(String(o.logisticAging || "").match(/\d+/g) || [99]).map(Number));
      return { usd, dias, prazo: o.logisticAging || "", nome: o.logisticName || "" };
    });
    if (!ops.length) { fretes[destino] = null; continue; }
    fretes[destino] = escolherFrete(ops, PRAZO_MAX);
  }
  const validos = Object.values(fretes).filter(Boolean);
  const freteUsd = validos.length ? Math.max(...validos.map((f) => f.usd)) : null;
  const custoEur = freteUsd == null ? null : Math.round((custo + freteUsd) * USD_EUR * 100) / 100;
  const sugerido = custoEur == null ? null : precoVenda(custoEur);
  const nums = validos.flatMap((f) => (f.prazo.match(/\d+/g) || []).map(Number));
  const imagens = [...new Set([d.bigImage, ...lista(d.productImageSet)].filter(Boolean))].slice(0, 8);
  const videos = lista(d.productVideo || d.videoList).filter(Boolean);
  return {
    pid: d.pid || pid, sku: d.productSku || "", vid, nomeEn: d.productNameEn || "",
    descricaoEn: String(d.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2500),
    categoriaCJ: d.categoryName || "", popularidade: d.listedNum || 0,
    custoProdutoUsd: custo, freteUsd, fretes, entregaTodos: validos.length === testar.length, origem,
    custoEur, sugerido, lucro: sugerido == null ? null : lucro(sugerido, custoEur),
    plazo: nums.length ? `${Math.min(...nums)}-${Math.max(...nums)}` : "",
    imagens, temVideo: videos.length > 0,
    variantes: variantes.slice(0, 24).map((v) => ({ vid: v.vid, chave: v.variantKey || "", nome: v.variantNameEn || v.variantKey || "", img: v.variantImage || "", custoUsd: num(v.variantSellPrice) })),
    linkCJ: `https://cjdropshipping.com/product/-p-${d.pid || pid}.html`,
  };
}

// ---------- vídeos: a CJ dá o link por queryVideosByProductId; guardamos no R2 (pede Referer) ----------
const seguro = (pid) => String(pid).replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
async function videosCJ(env, pid) {
  const d = await cj(env, "POST", "/product/queryVideosByProductId", { corpo: { productId: pid } });
  return (Array.isArray(d.data) ? d.data : []).filter((v) => v && v.videoUrl && v.videoState !== "OFF_STATE").map((v) => v.videoUrl);
}
async function guardarVideo(env, pid) {
  if (!env.DOWNLOADS) return "";
  try {
    for (const u of (await videosCJ(env, pid)).slice(0, 3)) {
      const r = await fetch(u, { headers: { Referer: "https://developers.cjdropshipping.com/" } });
      if (!r.ok) continue;
      const tam = parseInt(r.headers.get("content-length") || "0", 10);
      if (tam > 90e6) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 10000) continue;
      await env.DOWNLOADS.put(`leunapets/videos/${seguro(pid)}.mp4`, buf, { httpMetadata: { contentType: "video/mp4" } });
      return `/v/${seguro(pid)}.mp4`;
    }
  } catch { /* sem vídeo */ }
  return "";
}
export async function servirVideo(req, env, nome) {
  let chave;
  if (nome.startsWith("m/") && /^m\/[A-Za-z0-9-]+\.(mp4|mov|webm)$/.test(nome)) chave = "leunapets/meus/" + nome.slice(2);   // vídeos que o dono subiu
  else if (/^[A-Za-z0-9-]+\.mp4$/.test(nome)) chave = "leunapets/videos/" + nome;
  if (!env.DOWNLOADS || !chave) return new Response("404", { status: 404 });
  const range = req.headers.get("Range");
  const o = await env.DOWNLOADS.get(chave, range ? { range: req.headers } : undefined);
  if (!o) return new Response("404", { status: 404 });
  const tipo = /\.mov$/.test(chave) ? "video/quicktime" : /\.webm$/.test(chave) ? "video/webm" : "video/mp4";
  const h = new Headers({ "Content-Type": tipo, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400" });
  const pedido = new URL(req.url).searchParams.get("baixar");
  if (pedido !== null) h.set("Content-Disposition", `attachment; filename="${(pedido || "video").replace(/[^\w\-]/g, "_").slice(0, 60) || "video"}.${chave.split(".").pop()}"`);
  if (range && o.range) {
    const ini = o.range.offset || 0, fim = ini + (o.range.length || o.size - ini) - 1;
    h.set("Content-Range", `bytes ${ini}-${fim}/${o.size}`); h.set("Content-Length", String(fim - ini + 1));
    return new Response(o.body, { status: 206, headers: h });
  }
  h.set("Content-Length", String(o.size));
  return new Response(o.body, { headers: h });
}

// ---------- tradução automática (Workers AI) ----------
function textoBase(nome) {
  return { nombre: nome.slice(0, 80), gancho: "", descripcion: nome, puntos: [] };
}
async function traduzir(env, nomeEn, descricaoEn, animal, L) {
  if (!env.AI) return { es: textoBase(nomeEn), en: textoBase(nomeEn), ia: false };
  const pedido = `Product from a supplier (English, may be messy):
NAME: ${nomeEn}
DESCRIPTION: ${descricaoEn.slice(0, 1800)}
${L.id === "pets" ? "Animal: " + (animal === "perro" ? "dog" : animal === "gato" ? "cat" : "dogs and cats") : ""}

Write store copy for "${L.marca}", ${DESC_LOJA[L.id] || "an online shop in Spain"}. Return ONLY valid JSON, no markdown:
{"es":{"nombre":"...","gancho":"...","descripcion":"...","puntos":["...","...","..."]},"en":{"nombre":"...","gancho":"...","descripcion":"...","puntos":["...","...","..."]}}
Rules: "es" in natural Spanish from Spain, "en" in English. nombre: short product name, max 6 words, no brand, no supplier codes.
gancho: one warm short sentence (max 12 words). descripcion: 2 sentences, honest, no medical claims, no "best seller", no invented numbers.
puntos: 3 or 4 short factual benefits based only on the description (size/material only if given).`;
  try {
    const r = await env.AI.run(MODELO, { messages: [{ role: "user", content: pedido }], max_tokens: 900, temperature: 0.3 });
    let txt = typeof r.response === "string" ? r.response : JSON.stringify(r.response || "");
    txt = txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
    const o = JSON.parse(txt);
    const limpa = (x) => ({
      nombre: String(x.nombre || nomeEn).slice(0, 80), gancho: String(x.gancho || "").slice(0, 140),
      descripcion: String(x.descripcion || "").slice(0, 600), puntos: lista(x.puntos).map(String).slice(0, 5),
    });
    if (!o.es || !o.es.nombre) throw new Error("sem es");
    return { es: limpa(o.es), en: limpa(o.en || o.es), ia: true };
  } catch (e) {
    return { es: textoBase(nomeEn), en: textoBase(nomeEn), ia: false, erro: String(e).slice(0, 200) };
  }
}

// ---------- catálogo da loja = produtos.json (robô) + D1 (painel; o D1 manda) ----------
export async function catalogo(env, req, lojaId = "pets") {
  let base = [];
  if (lojaId === "pets") {   // só a LeunaPets tem o produtos.json do robô diário
    const r = await env.ASSETS.fetch(new Request(new URL("/produtos.json", req.url)));
    base = r.ok ? await r.json().catch(() => []) : [];
  }
  const mapa = new Map();
  for (const p of Array.isArray(base) ? base : []) if (p && p.id) mapa.set(p.id, p);
  if (env.DB) {
    try {
      await tabelas(env);
      const { results } = await env.DB.prepare("SELECT id, dados, ativo FROM produtos_v2 WHERE loja=? ORDER BY criado DESC").bind(lojaId).all();
      const novos = [];
      for (const row of results) {
        if (!row.ativo) { mapa.delete(row.id); continue; }
        const p = JSON.parse(row.dados);
        if (mapa.has(row.id)) mapa.set(row.id, p); else { novos.push(p); }
      }
      return [...novos, ...mapa.values()];
    } catch { /* sem banco: só o produtos.json */ }
  }
  return [...mapa.values()];
}

// nomes das variações (CJ: "Pink-Large") em espanhol
const PALAVRAS = {
  black: "Negro", white: "Blanco", red: "Rojo", blue: "Azul", green: "Verde", yellow: "Amarillo", pink: "Rosa", purple: "Morado",
  orange: "Naranja", grey: "Gris", gray: "Gris", brown: "Marrón", beige: "Beige", khaki: "Caqui", navy: "Azul marino", gold: "Dorado",
  silver: "Plateado", rose: "Rosa", coffee: "Café", camel: "Camel", cyan: "Cian", transparent: "Transparente", colorful: "Multicolor",
  light: "claro", dark: "oscuro", sky: "cielo", army: "militar", wine: "Vino", apricot: "Albaricoque", mint: "Menta",
  small: "Pequeño", medium: "Mediano", large: "Grande", big: "Grande", style: "Modelo", type: "Tipo", random: "Aleatorio",
};
export function rotulo(v) {
  let t = String(v.chave || "").trim();
  if (!t) t = String(v.nome || "").split(" ").slice(-2).join(" ");
  return t.split(/[-_/]+/).map((parte) => {
    const w = parte.trim().split(/\s+/).map((x) => PALAVRAS[x.toLowerCase()] || x);
    if (w.length > 1 && ["claro", "oscuro"].includes(w[0])) w.push(w.shift());   // "Light Blue" → "Azul claro"
    return w.join(" ");
  }).filter(Boolean).join(" / ").slice(0, 60);
}
export function variacoes(d, precio) {
  const lista = (d.variantes || []).filter((v) => v.vid && v.custoUsd != null);
  if (lista.length < 2) return [];
  const base = d.custoProdutoUsd;
  return lista.map((v) => {
    const extra = Math.max(0, v.custoUsd - base) * USD_EUR * 2;   // variação mais cara: preço sobe na mesma margem
    return { vid: v.vid, nombre: rotulo(v), img: v.img || "", precio: extra > 0.01 ? sem13(Math.ceil(precio + extra) - 0.01) : precio };
  });
}

function montar(pid, d, campos, textos, L) {
  const preco = sem13(Math.round((num(campos.precio) || d.sugerido) * 100) / 100);
  return {
    id: pid, es: textos.es, pt: textos.es, en: textos.en,
    categoria: catsDe(L).includes(campos.categoria) ? campos.categoria : catsDe(L)[0],
    animal: L.id === "pets" && ANIMAIS.includes(campos.animal) ? campos.animal : "ambos",
    nuevo: campos.nuevo !== false, destaque: !!campos.destaque,
    precio: preco, imagenes: d.imagens.slice(0, 6), video: "", plazo: d.plazo,
    cj: { vid: d.vid, sku: d.sku, custoEur: d.custoEur, painel: true, origem: d.origem || "CN" },
    variantes: variacoes(d, preco),
  };
}

async function publicar(req, env, L) {
  const c = await req.json().catch(() => ({}));
  const pid = String(c.pid || "").slice(0, 64);
  if (!pid) return json({ erro: "pid" }, 400);
  const d = await detalhe(env, pid, String(c.armazem || "CN").toUpperCase());
  if (!d) return json({ erro: "produto-nao-encontrado" }, 404);
  if (!d.entregaTodos) return json({ erro: "nao-entrega", detalhe: "A CJ não entrega em todos os países testados." }, 400);
  if (!d.imagens.length) return json({ erro: "sem-fotos" }, 400);
  const textos = c.es && c.es.nombre ? { es: c.es, en: c.en || c.es, ia: false } : await traduzir(env, d.nomeEn, d.descricaoEn, c.animal, L);
  const p = montar(pid, d, c, textos, L);
  p.video = await guardarVideo(env, pid);
  await env.DB.prepare("INSERT OR REPLACE INTO produtos_v2 (loja, id, dados, ativo, criado, atualizado) VALUES (?,?,?,1,COALESCE((SELECT criado FROM produtos_v2 WHERE loja=? AND id=?),datetime('now')),datetime('now'))").bind(L.id, pid, JSON.stringify(p), L.id, pid).run();
  return json({ ok: true, produto: p, ia: textos.ia, lucro: lucro(p.precio, d.custoEur) });
}

async function editar(req, env, L) {
  const c = await req.json().catch(() => ({}));
  const id = String(c.id || "");
  const todos = await catalogo(env, req, L.id);
  let p = todos.find((x) => x.id === id);
  if (!p) {
    const row = await env.DB.prepare("SELECT dados FROM produtos_v2 WHERE loja=? AND id=?").bind(L.id, id).first();
    if (!row) return json({ erro: "id" }, 404);
    p = JSON.parse(row.dados);
  }
  if (c.precio != null) {
    const v = num(c.precio);
    if (v > 0 && v < 1000) {
      const novo = sem13(Math.round(v * 100) / 100), dif = novo - p.precio;
      p.precio = novo;
      if (Array.isArray(p.variantes)) p.variantes = p.variantes.map((x) => ({ ...x, precio: sem13(Math.round((x.precio + dif) * 100) / 100) }));
    }
  }
  if (catsDe(L).includes(c.categoria)) p.categoria = c.categoria;
  if (ANIMAIS.includes(c.animal)) p.animal = c.animal;
  if (typeof c.destaque === "boolean") p.destaque = c.destaque;
  if (typeof c.nuevo === "boolean") p.nuevo = c.nuevo;
  if (c.es && c.es.nombre) {
    p.es = { nombre: String(c.es.nombre).slice(0, 80), gancho: String(c.es.gancho || "").slice(0, 140), descripcion: String(c.es.descripcion || "").slice(0, 600), puntos: lista(c.es.puntos).map(String).slice(0, 5) };
    p.pt = p.es;
  }
  const ativo = c.ativo === false ? 0 : 1;
  await env.DB.prepare("INSERT OR REPLACE INTO produtos_v2 (loja, id, dados, ativo, criado, atualizado) VALUES (?,?,?,?,COALESCE((SELECT criado FROM produtos_v2 WHERE loja=? AND id=?),datetime('now')),datetime('now'))")
    .bind(L.id, id, JSON.stringify(p), ativo, L.id, id).run();
  return json({ ok: true, produto: p, ativo: !!ativo });
}

async function publicados(req, env, L) {
  const loja = await catalogo(env, req, L.id);
  const { results } = await env.DB.prepare("SELECT id, dados FROM produtos_v2 WHERE loja=? AND ativo=0").bind(L.id).all();
  const fora = results.map((r) => ({ ...JSON.parse(r.dados), _fora: true }));
  return json({ itens: [...loja, ...fora].map((p) => ({
    id: p.id, nome: (p.es && p.es.nombre) || p.id, img: fotoAbs((p.imagenes || [])[0]), precio: p.precio,
    categoria: p.categoria, animal: p.animal, destaque: !!p.destaque, nuevo: !!p.nuevo, es: p.es,
    video: /^\/v\//.test(p.video || "") ? p.video : "", custoEur: p.cj && p.cj.custoEur, ativo: !p._fora, painel: !!(p.cj && p.cj.painel),
  })) });
}

// ---------- TikTok: postagens prontas (vídeo + frase + legenda em espanhol), 2 por dia ----------
const TAGS = {
  pets: { perro: "#perros #perrosdetiktok #mascotas #perro #españa", gato: "#gatos #gatosdetiktok #mascotas #gato #españa", ambos: "#mascotas #perros #gatos #petlovers #españa" },
  casa: "#hogar #decoracion #casa #ideasparacasa #españa",
};
const EMOJI = { juguetes: "🎾", paseo: "🦮", higiene: "🛁", comer: "🍽️", camas: "🛏️", rascadores: "🐾", luz: "💡", jardin: "🌿", deco: "✨", textil: "🧺", orden: "📦", hogar: "🏠", muebles: "🪑" };
export function legendaTikTok(p, L) {
  const es = p.es || {}, nome = es.nombre || "", gancho = (es.gancho || "").trim();
  const preco = Number(p.precio).toFixed(2).replace(".", ",");
  const tags = L.id === "pets" ? TAGS.pets[p.animal] || TAGS.pets.ambos : TAGS.casa;
  const frase = (gancho && gancho.length <= 48 ? gancho : nome).replace(/\.$/, "");
  const legenda = `${EMOJI[p.categoria] || "⭐"} ${gancho || nome}\n✨ ${nome}\n💶 Solo ${preco} € · 🚚 Envío GRATIS a toda España\n👉 Link en mi perfil\n${tags}`;
  return { frase, legenda };
}
async function tiktokPosts(env, req, L) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS tiktok_envios (loja TEXT NOT NULL, id TEXT NOT NULL, enviado TEXT, PRIMARY KEY (loja, id))").run();
  const envios = Object.fromEntries((await env.DB.prepare("SELECT id, enviado FROM tiktok_envios WHERE loja=?").bind(L.id).all()).results.map((r) => [r.id, r.enviado]));
  const limite = Date.now() - 30 * 86400000;   // mandou há mais de 30 dias: volta para a fila
  const itens = [];
  let semVideo = 0;
  for (const p of await catalogo(env, req, L.id)) {
    if (!p || !p.id || !(p.precio > 0)) continue;
    if (!/^\/v\//.test(p.video || "")) { semVideo++; continue; }
    const enviado = envios[p.id] || null;
    const t = enviado ? Date.parse(enviado.replace(" ", "T") + "Z") : 0;
    itens.push({ id: p.id, nome: (p.es && p.es.nombre) || p.id, precio: p.precio, img: fotoAbs((p.imagenes || [])[0]), video: p.video,
      destaque: !!p.destaque, enviado, naFila: !enviado || t < limite, ...legendaTikTok(p, L) });
  }
  itens.sort((a, b) => (b.naFila - a.naFila) || (b.destaque - a.destaque) || (a.precio - b.precio));
  await tabelas(env);
  const w = await env.DB.prepare("SELECT valor FROM config WHERE chave='tiktok_whats'").first();
  return json({ itens, semVideo, link: "https://" + L.host + "/?o=tiktok", host: L.host, whats: (w && w.valor) || "" });
}

// ---------- cotação do dia (euro e dólar em reais), guardada 3 h no cache ----------
async function cambio() {
  const chave = new Request("https://cache.leuname.interno/cambio-v1");
  const cache = caches.default;
  const guardado = await cache.match(chave);
  if (guardado) return json(await guardado.json());
  let d = null;
  try {   // 1ª fonte: open.er-api.com (grátis, sem chave)
    const r = await fetch("https://open.er-api.com/v6/latest/EUR");
    const j = await r.json();
    if (j && j.rates && j.rates.BRL && j.rates.USD) d = { eurBrl: j.rates.BRL, usdBrl: j.rates.BRL / j.rates.USD, fonte: "open.er-api.com", data: j.time_last_update_utc || "" };
  } catch (e) { /* tenta a outra */ }
  if (!d) {
    try {   // 2ª fonte: frankfurter (Banco Central Europeu)
      const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=BRL,USD");
      const j = await r.json();
      if (j && j.rates && j.rates.BRL && j.rates.USD) d = { eurBrl: j.rates.BRL, usdBrl: j.rates.BRL / j.rates.USD, fonte: "frankfurter.app (BCE)", data: j.date || "" };
    } catch (e) { /* sem cotação */ }
  }
  if (!d) return json({ erro: "cotacao" }, 502);
  d.eurBrl = Math.round(d.eurBrl * 10000) / 10000; d.usdBrl = Math.round(d.usdBrl * 10000) / 10000; d.ok = true;
  await cache.put(chave, new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=10800" } }));
  return json(d);
}

// ---------- pedidos (vendas pagas no Stripe) ----------
async function pedidos(req, env) {
  if (!env.STRIPE_SECRET_KEY) return json({ erro: "stripe-desligado" }, 503);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS pedidos_status (id TEXT PRIMARY KEY, feito INTEGER NOT NULL DEFAULT 0, rastreio TEXT, atualizado TEXT)").run();
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions?status=complete&limit=40", { headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ erro: "stripe", detalhe: d.error && d.error.message }, 502);
  const st = Object.fromEntries((await env.DB.prepare("SELECT id, feito, rastreio FROM pedidos_status").all()).results.map((x) => [x.id, x]));
  await tabelaCJ(env);
  const cjs = Object.fromEntries((await env.DB.prepare("SELECT id, cj_pedido, pago, msg, rastreio FROM pedidos_cj").all()).results.map((x) => [x.id, x]));
  const cats = {};
  const out = [];
  for (const s of d.data || []) {
    if (s.payment_status !== "paid") continue;
    const lojaId = (s.metadata && s.metadata.loja) || "pets";
    if (!cats[lojaId]) cats[lojaId] = Object.fromEntries((await catalogo(env, req, lojaId)).map((p) => [p.id, p]));
    const ship = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || {};
    const a = ship.address || {};
    const cli = s.customer_details || {};
    const itens = String((s.metadata && s.metadata.itens) || "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
      const m = /^(\d+)x\s+([^:]+)(?::(.+))?$/.exec(x) || [];
      const p = cats[lojaId][m[2]] || {};
      const v = (p.variantes || []).find((y) => y.vid === m[3]);
      return { q: +m[1] || 1, pid: m[2], vid: m[3] || (p.cj && p.cj.vid) || "", nome: (p.es && p.es.nombre) || m[2], variacao: v ? v.nombre : "",
        img: fotoAbs((v && v.img) || (p.imagenes || [])[0]), linkCJ: m[2] ? "https://cjdropshipping.com/product/-p-" + m[2] + ".html" : "" };
    });
    out.push({ id: s.id, loja: lojaId, data: s.created * 1000, total: s.amount_total / 100, moeda: s.currency,
      nome: ship.name || cli.name || "", email: cli.email || "", telefone: cli.phone || "",
      endereco: { linha1: a.line1 || "", linha2: a.line2 || "", cep: a.postal_code || "", cidade: a.city || "", estado: a.state || "", pais: a.country || "" },
      itens, feito: !!(st[s.id] && st[s.id].feito), rastreio: (st[s.id] && st[s.id].rastreio) || (cjs[s.id] && cjs[s.id].rastreio) || "",
      cj: cjs[s.id] ? { pedido: cjs[s.id].cj_pedido, pago: !!cjs[s.id].pago, msg: cjs[s.id].msg } : null });
  }
  return json({ pedidos: out });
}
// para o app Android (vigia em segundo plano): só a venda mais recente, leve
async function ultimo(env) {
  if (!env.STRIPE_SECRET_KEY) return json({ ultimo: 0 });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions?status=complete&limit=5", { headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } });
  const d = await r.json().catch(() => ({}));
  const pagos = (d.data || []).filter((s) => s.payment_status === "paid");
  if (!pagos.length) return json({ ultimo: 0 });
  const s = pagos[0];
  const loja = lojaPorId((s.metadata && s.metadata.loja) || "pets");
  const nome = ((s.customer_details && s.customer_details.name) || "").split(" ")[0];
  const pais = (s.customer_details && s.customer_details.address && s.customer_details.address.country) || "";
  return json({ ultimo: s.created * 1000, texto: `${(s.amount_total / 100).toFixed(2).replace(".", ",")} € — ${loja.marca}${nome ? " · " + nome : ""}${pais ? " (" + pais + ")" : ""}. Toque para atender.` });
}
async function marcarPedido(req, env) {
  const c = await req.json().catch(() => ({}));
  const id = String(c.id || "").replace(/[^\w]/g, "").slice(0, 80);
  if (!id) return json({ erro: "id" }, 400);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS pedidos_status (id TEXT PRIMARY KEY, feito INTEGER NOT NULL DEFAULT 0, rastreio TEXT, atualizado TEXT)").run();
  await env.DB.prepare("INSERT OR REPLACE INTO pedidos_status (id, feito, rastreio, atualizado) VALUES (?,?,?,datetime('now'))")
    .bind(id, c.feito ? 1 : 0, String(c.rastreio || "").slice(0, 60)).run();
  return json({ ok: true });
}

// ---------- pedido automático na CJ (cria, escolhe o frete mais barato e paga com o saldo da CJ Wallet) ----------
const NOMES_PAIS = { DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands", BE: "Belgium", AT: "Austria", PT: "Portugal", IE: "Ireland" };
async function tabelaCJ(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS pedidos_cj (id TEXT PRIMARY KEY, cj_pedido TEXT, pago INTEGER NOT NULL DEFAULT 0, msg TEXT, rastreio TEXT, criado TEXT NOT NULL DEFAULT (datetime('now')))").run();
}
async function sessaoStripe(env, id) {
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } });
  return r.ok ? r.json() : null;
}
async function vidPadrao(env, pid) {
  const d = (await cj(env, "GET", "/product/query", { params: { pid } })).data;
  return d && d.variants && d.variants[0] ? d.variants[0].vid : "";
}
async function freteMaisBarato(env, pais, produtos, origem = "CN") {
  const f = await cj(env, "POST", "/logistic/freightCalculate", { corpo: { startCountryCode: origem, endCountryCode: pais, products: produtos.map((p) => ({ quantity: p.quantity, vid: p.vid })) } });
  const ops = (f.data || []).filter((o) => num(o.logisticPrice) != null && o.logisticName).map((o) => ({
    nome: o.logisticName, usd: num(o.totalPostageFee) || num(o.logisticPrice),
    dias: Math.max(0, ...(String(o.logisticAging || "").match(/\d+/g) || [99]).map(Number)) }));
  if (!ops.length) return null;
  return escolherFrete(ops, 20).nome;
}
export async function comprarCJ(env, req, sessaoId, forcar = false) {
  await tabelaCJ(env);
  const ja = await env.DB.prepare("SELECT cj_pedido, pago, msg FROM pedidos_cj WHERE id=?").bind(sessaoId).first();
  if (ja && ja.cj_pedido && !forcar) return { ok: true, cj_pedido: ja.cj_pedido, pago: !!ja.pago, msg: ja.msg, repetido: true };
  if (!ja) {   // trava contra pedido duplicado (o robô e o botão ao mesmo tempo)
    const ins = await env.DB.prepare("INSERT OR IGNORE INTO pedidos_cj (id, msg) VALUES (?, 'criando')").bind(sessaoId).run();
    if (!ins.meta || ins.meta.changes !== 1) return { ok: false, msg: "já está sendo criado" };
  } else if (ja.msg === "criando" && !forcar) return { ok: false, msg: "já está sendo criado" };
  const s = await sessaoStripe(env, sessaoId);
  if (!s || s.payment_status !== "paid") { await env.DB.prepare("UPDATE pedidos_cj SET msg=? WHERE id=?").bind("venda não paga", sessaoId).run(); return { ok: false, msg: "venda não paga" }; }
  const ship = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || {};
  const a = ship.address || {}, cli = s.customer_details || {};
  const lojaId = (s.metadata && s.metadata.loja) || "pets";
  const cat = Object.fromEntries((await catalogo(env, req, lojaId)).map((p) => [p.id, p]));
  const produtos = [];
  for (const x of String((s.metadata && s.metadata.itens) || "").split(",").map((y) => y.trim()).filter(Boolean)) {
    const m = /^(\d+)x\s+([^:]+)(?::(.+))?$/.exec(x);
    if (!m) continue;
    const p = cat[m[2]] || {};
    const vid = m[3] || (p.cj && p.cj.vid) || (await vidPadrao(env, m[2]));
    if (vid) produtos.push({ vid, quantity: +m[1] || 1, origem: (p.cj && p.cj.origem) || "CN" });
  }
  const falha = async (msg) => { await env.DB.prepare("UPDATE pedidos_cj SET msg=? WHERE id=?").bind(String(msg).slice(0, 300), sessaoId).run(); return { ok: false, msg }; };
  if (!produtos.length) return falha("produto sem código da CJ");
  const pais = a.country || "";
  // um pedido na CJ por armazém (China, Alemanha, Polônia): cada um sai de um lugar
  const grupos = {};
  for (const x of produtos) (grupos[x.origem] = grupos[x.origem] || []).push({ vid: x.vid, quantity: x.quantity });
  const ids = [], msgs = [];
  let todosPagos = true, n = 0;
  for (const [origem, itensCJ] of Object.entries(grupos)) {
    n++;
    const r1 = await pedidoCJ(env, s, sessaoId, ship, cli, a, pais, origem, itensCJ, Object.keys(grupos).length > 1 ? "-" + n : "");
    if (!r1.ok) { if (!ids.length) return falha(r1.msg); msgs.push(r1.msg); todosPagos = false; continue; }
    ids.push(r1.id); msgs.push(r1.msg); if (!r1.pago) todosPagos = false;
  }
  const pago = todosPagos, msg = msgs.join(" · ");
  await env.DB.prepare("UPDATE pedidos_cj SET cj_pedido=?, pago=?, msg=? WHERE id=?").bind(ids.join(","), pago ? 1 : 0, msg, sessaoId).run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS pedidos_status (id TEXT PRIMARY KEY, feito INTEGER NOT NULL DEFAULT 0, rastreio TEXT, atualizado TEXT)").run();
  if (pago) await env.DB.prepare("INSERT OR REPLACE INTO pedidos_status (id, feito, rastreio, atualizado) VALUES (?,1,COALESCE((SELECT rastreio FROM pedidos_status WHERE id=?),''),datetime('now'))").bind(sessaoId, sessaoId).run();
  return { ok: true, cj_pedido: ids.join(","), pago, msg };
}
async function pedidoCJ(env, s, sessaoId, ship, cli, a, pais, origem, produtos, sufixo) {
  const logistica = await freteMaisBarato(env, pais, produtos, origem);
  if (!logistica) return { ok: false, msg: "a CJ não tem frete de " + origem + " para " + pais };
  const corpo = {
    orderNumber: "LN" + s.created + sessaoId.slice(-10) + sufixo, shippingCountryCode: pais, shippingCountry: NOMES_PAIS[pais] || pais,
    shippingProvince: a.state || a.city || "-", shippingCity: a.city || "-", shippingZip: a.postal_code || "", shippingAddress: a.line1 || "",
    shippingAddress2: a.line2 || "", shippingCustomerName: (ship.name || cli.name || "").slice(0, 50), shippingPhone: (cli.phone || "").slice(0, 20),
    email: (cli.email || "").slice(0, 50), remark: "", logisticName: logistica, fromCountryCode: origem, iossType: 3, products: produtos, payType: 2,
  };
  let r = await cj(env, "POST", "/shopping/order/createOrderV2", { corpo });
  let pago = true;
  if (!(r.data && r.data.orderId)) {
    // sem saldo (ou pagamento recusado): cria o pedido sem pagar, para o dono pagar na CJ
    const msg1 = r.message || "erro";
    corpo.payType = 3;
    r = await cj(env, "POST", "/shopping/order/createOrderV2", { corpo });
    if (!(r.data && r.data.orderId)) return { ok: false, msg: "CJ: " + msg1 + (r.message && r.message !== msg1 ? " / " + r.message : "") };
    pago = false;
  } else if (!(r.result || r.code === 200) || (r.data.orderStatus && /UNPAID|CREATED|IN_CART/.test(r.data.orderStatus))) pago = false;
  const de = { CN: "China", DE: "Alemanha", PL: "Polônia" }[origem] || origem;
  const msg = pago ? `Comprado e pago na CJ (sai da ${de}, ${logistica}, US$ ${r.data.orderAmount || r.data.actualPayment || "?"})` : `Pedido criado na CJ (sai da ${de}) — FALTA PAGAR: pague no app da CJ em Waiting for Payment`;
  return { ok: true, id: String(r.data.orderId), pago, msg };
}
async function atualizarRastreios(env) {
  await tabelaCJ(env);
  const { results } = await env.DB.prepare("SELECT id, cj_pedido FROM pedidos_cj WHERE cj_pedido IS NOT NULL AND (rastreio IS NULL OR rastreio='') ORDER BY criado DESC LIMIT 10").all();
  for (const x0 of results) {
    const x = { ...x0, cj_pedido: String(x0.cj_pedido).split(",")[0] };   // vários armazéns: o 1º já basta para o cliente acompanhar
    const d = (await cj(env, "GET", "/shopping/order/getOrderDetail", { params: { orderId: x.cj_pedido } })).data;
    if (!d) continue;
    const pago = !/UNPAID|CREATED|IN_CART/.test(d.orderStatus || "");
    if (d.trackNumber) {
      await env.DB.prepare("UPDATE pedidos_cj SET rastreio=?, pago=1 WHERE id=?").bind(d.trackNumber, x.id).run();
      await env.DB.prepare("INSERT OR REPLACE INTO pedidos_status (id, feito, rastreio, atualizado) VALUES (?,1,?,datetime('now'))").bind(x.id, d.trackNumber).run();
    } else if (pago) {
      await env.DB.prepare("UPDATE pedidos_cj SET pago=1, msg=? WHERE id=? AND pago=0").bind("Pago na CJ — aguardando envio", x.id).run();
    }
  }
}
// robô de 5 em 5 minutos (cron do Worker): vendas novas viram pedido na CJ sozinhas
export async function roboPedidos(env) {
  if (!env.DB || !env.STRIPE_SECRET_KEY || !env.CJ_API_KEY) return;
  await tabelas(env); await tabelaCJ(env);
  const auto = await env.DB.prepare("SELECT valor FROM config WHERE chave='auto_cj'").first();
  if (auto && auto.valor === "0") { await atualizarRastreios(env); return; }
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions?status=complete&limit=20", { headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } });
  const d = await r.json().catch(() => ({}));
  const req = new Request("https://pets.leuname.com/");
  for (const s of d.data || []) {
    if (s.payment_status !== "paid" || Date.now() / 1000 - s.created > 3 * 86400) continue;
    const ja = await env.DB.prepare("SELECT id FROM pedidos_cj WHERE id=?").bind(s.id).first();
    const feito = await env.DB.prepare("SELECT feito FROM pedidos_status WHERE id=?").bind(s.id).first().catch(() => null);
    if (ja || (feito && feito.feito)) continue;   // já criado, ou o dono comprou à mão
    try { await comprarCJ(env, req, s.id); } catch (e) { /* tenta de novo no próximo ciclo pelo botão */ }
  }
  await atualizarRastreios(env);
}

// ---------- resultados (gráfico): vendas, custo, lucro e origem por loja e por dia ----------
async function custosRobo(env, req) {
  try {
    const r = await env.ASSETS.fetch(new Request(new URL("/catalogo-cj.json", req.url)));
    const c = r.ok ? await r.json() : {};
    return Object.fromEntries((c.itens || []).map((x) => [x.id, x.custoTotalEur]));
  } catch { return {}; }
}
async function resumo(req, env, url) {
  if (!env.STRIPE_SECRET_KEY) return json({ erro: "stripe-desligado" }, 503);
  const dias = Math.max(7, Math.min(90, parseInt(url.searchParams.get("dias"), 10) || 30));
  const desde = Math.floor(Date.now() / 1000) - dias * 86400;
  const sess = [];
  let depois = "";
  for (let pag = 0; pag < 5; pag++) {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions?status=complete&limit=100&created[gte]=${desde}${depois ? "&starting_after=" + depois : ""}`,
      { headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ erro: "stripe", detalhe: d.error && d.error.message }, 502);
    sess.push(...(d.data || []));
    if (!d.has_more || !d.data.length) break;
    depois = d.data[d.data.length - 1].id;
  }
  const robo = await custosRobo(env, req);
  const cats = {};
  const dia = (t) => new Date((t - 3 * 3600) * 1000).toISOString().slice(0, 10);   // horário de Brasília
  const lista = [];
  for (let k = dias - 1; k >= 0; k--) lista.push(dia(Math.floor(Date.now() / 1000) - k * 86400));
  const out = {};
  const base = () => ({ vendas: lista.map(() => 0), receita: lista.map(() => 0), custo: lista.map(() => 0), lucro: lista.map(() => 0), origens: {}, lucroOrigem: {}, produtos: {} });
  for (const L of LOJAS) out[L.id] = base();
  for (const s of sess) {
    if (s.payment_status !== "paid") continue;
    const lojaId = (s.metadata && s.metadata.loja) || "pets";
    if (!out[lojaId]) out[lojaId] = base();
    const i = lista.indexOf(dia(s.created));
    if (i < 0) continue;
    if (!cats[lojaId]) cats[lojaId] = Object.fromEntries((await catalogo(env, req, lojaId)).map((p) => [p.id, p]));
    const receita = s.amount_total / 100;
    let custo = 0;
    for (const x of String((s.metadata && s.metadata.itens) || "").split(",").map((y) => y.trim()).filter(Boolean)) {
      const m = /^(\d+)x\s+([^:]+)/.exec(x);
      if (!m) continue;
      const p = cats[lojaId][m[2]] || {};
      const c = (p.cj && p.cj.custoEur) || robo[m[2]] || receita * 0.5;
      custo += c * (+m[1] || 1);
      const nome = (p.es && p.es.nombre) || m[2];
      out[lojaId].produtos[nome] = (out[lojaId].produtos[nome] || 0) + (+m[1] || 1);
    }
    const taxas = receita * 0.07 + 0.35;
    const o = out[lojaId];
    o.vendas[i] += 1; o.receita[i] += receita; o.custo[i] += custo + taxas; o.lucro[i] += receita - custo - taxas;
    const org = (s.metadata && s.metadata.origem) || "direto";
    o.origens[org] = (o.origens[org] || 0) + 1;
    o.lucroOrigem[org] = Math.round(((o.lucroOrigem[org] || 0) + receita - custo - taxas) * 100) / 100;
  }
  for (const k of Object.keys(out)) for (const c of ["receita", "custo", "lucro"]) out[k][c] = out[k][c].map((v) => Math.round(v * 100) / 100);
  return json({ dias: lista, lojas: out });
}

// ---------- pastas de vídeos (organizador do dono) ----------
async function tabelasVideo(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS vpastas (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, criado TEXT NOT NULL DEFAULT (datetime('now')))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS vitens (id INTEGER PRIMARY KEY AUTOINCREMENT, pasta INTEGER NOT NULL, titulo TEXT, url TEXT NOT NULL, chave TEXT, criado TEXT NOT NULL DEFAULT (datetime('now')))"),
  ]);
}
async function videos(req, env, rota, url) {
  await tabelasVideo(env);
  const c = req.method === "POST" && rota !== "video-upload" ? await req.json().catch(() => ({})) : {};
  const nome = (v) => String(v || "").trim().slice(0, 60);
  if (rota === "pasta" ) { if (!nome(c.nome)) return json({ erro: "nome" }, 400); await env.DB.prepare("INSERT INTO vpastas (nome) VALUES (?)").bind(nome(c.nome)).run(); }
  if (rota === "pasta-renomear") await env.DB.prepare("UPDATE vpastas SET nome=? WHERE id=?").bind(nome(c.nome), +c.id).run();
  if (rota === "pasta-apagar") {
    const { results } = await env.DB.prepare("SELECT chave FROM vitens WHERE pasta=? AND chave IS NOT NULL").bind(+c.id).all();
    for (const x of results) await env.DOWNLOADS.delete(x.chave).catch(() => {});
    await env.DB.batch([env.DB.prepare("DELETE FROM vitens WHERE pasta=?").bind(+c.id), env.DB.prepare("DELETE FROM vpastas WHERE id=?").bind(+c.id)]);
  }
  if (rota === "video-add") {
    const u = String(c.url || "");
    if (!/^\/v\/[A-Za-z0-9\-\/]+\.(mp4|mov|webm)$/.test(u)) return json({ erro: "video" }, 400);
    await env.DB.prepare("INSERT INTO vitens (pasta, titulo, url) VALUES (?,?,?)").bind(+c.pasta, nome(c.titulo) || "Vídeo", u).run();
  }
  if (rota === "video-renomear") await env.DB.prepare("UPDATE vitens SET titulo=? WHERE id=?").bind(nome(c.titulo), +c.id).run();
  if (rota === "video-mover") await env.DB.prepare("UPDATE vitens SET pasta=? WHERE id=?").bind(+c.pasta, +c.id).run();
  if (rota === "video-apagar") {
    const x = await env.DB.prepare("SELECT chave FROM vitens WHERE id=?").bind(+c.id).first();
    if (x && x.chave) await env.DOWNLOADS.delete(x.chave).catch(() => {});
    await env.DB.prepare("DELETE FROM vitens WHERE id=?").bind(+c.id).run();
  }
  if (rota === "video-upload") {   // o dono sobe um vídeo pronto (até ~95 MB)
    const pasta = +url.searchParams.get("pasta");
    const tit = nome(url.searchParams.get("nome")) || "Vídeo";
    const ext = (/\.(mov|webm)$/i.exec(tit) || [, "mp4"])[1].toLowerCase();
    const tam = parseInt(req.headers.get("content-length") || "0", 10);
    if (!pasta || !tam || tam > 99e6) return json({ erro: "arquivo grande demais (máx. 95 MB)" }, 400);
    const id = [...crypto.getRandomValues(new Uint8Array(10))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const chave = `leunapets/meus/${id}.${ext}`;
    await env.DOWNLOADS.put(chave, req.body, { httpMetadata: { contentType: ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4" } });
    await env.DB.prepare("INSERT INTO vitens (pasta, titulo, url, chave) VALUES (?,?,?,?)").bind(pasta, tit.replace(/\.(mp4|mov|webm)$/i, ""), `/v/m/${id}.${ext}`, chave).run();
  }
  const pastas = (await env.DB.prepare("SELECT id, nome FROM vpastas ORDER BY id").all()).results;
  const itens = (await env.DB.prepare("SELECT id, pasta, titulo, url FROM vitens ORDER BY id DESC").all()).results;
  return json({ pastas, itens });
}

export async function painel(req, env, url) {
  if (!env.DB) return json({ erro: "sem-banco" }, 503);
  await tabelas(env);
  const rota = url.pathname.replace("/api/painel/", "");
  if (rota === "login" && req.method === "POST") return login(req, env);
  if (!(await logado(req, env))) return json({ erro: "login" }, 401);
  const L = lojaPorId(url.searchParams.get("loja") || "pets");
  try {
    if (rota === "lojas") {
      const { results } = await env.DB.prepare("SELECT loja, COUNT(*) n FROM produtos_v2 WHERE ativo=1 GROUP BY loja").all();
      const n = Object.fromEntries(results.map((r) => [r.loja, r.n]));
      return json({ lojas: LOJAS.map((l) => ({ ...l, publicados: n[l.id] || 0 })) });
    }
    if (rota === "estado") return json({ ok: true, cj: !!env.CJ_API_KEY, ia: !!env.AI, stripe: !!env.STRIPE_SECRET_KEY });
    if (rota === "buscar") return await buscar(env, url, L);
    if (rota === "detalhe") {
      const d = await detalhe(env, String(url.searchParams.get("pid") || "").slice(0, 64), String(url.searchParams.get("arm") || "CN").toUpperCase());
      return d ? json(d) : json({ erro: "produto-nao-encontrado" }, 404);
    }
    if (rota === "publicar" && req.method === "POST") return await publicar(req, env, L);
    if (rota === "editar" && req.method === "POST") return await editar(req, env, L);
    if (rota === "video" && req.method === "POST") {
      const c = await req.json().catch(() => ({}));
      const p = (await catalogo(env, req, L.id)).find((x) => x.id === c.id);
      if (!p) return json({ erro: "id" }, 404);
      const v = await guardarVideo(env, p.id);
      if (!v) return json({ erro: "sem-video", detalhe: "A CJ não tem vídeo deste produto." }, 404);
      p.video = v;
      await env.DB.prepare("INSERT OR REPLACE INTO produtos_v2 (loja, id, dados, ativo, criado, atualizado) VALUES (?,?,?,1,COALESCE((SELECT criado FROM produtos_v2 WHERE loja=? AND id=?),datetime('now')),datetime('now'))").bind(L.id, p.id, JSON.stringify(p), L.id, p.id).run();
      return json({ ok: true, video: v });
    }
    if (rota === "publicados") return await publicados(req, env, L);
    if (rota === "pedidos") return await pedidos(req, env);
    if (rota === "ultimo") return await ultimo(env);
    if (rota === "resumo") return await resumo(req, env, url);
    if (["videos", "pasta", "pasta-renomear", "pasta-apagar", "video-add", "video-renomear", "video-mover", "video-apagar", "video-upload"].includes(rota)) return await videos(req, env, rota, url);
    if (rota === "videos-produtos") {   // vídeos dos produtos das lojas, para pôr nas pastas
      const out = [];
      for (const Lx of LOJAS) for (const p of await catalogo(env, req, Lx.id)) if (/^\/v\//.test(p.video || "")) out.push({ loja: Lx.id, nome: (p.es && p.es.nombre) || p.id, url: p.video, img: fotoAbs((p.imagenes || [])[0]) });
      return json({ itens: out });
    }
    if (rota === "comprar-cj" && req.method === "POST") {
      const c = await req.json().catch(() => ({}));
      return json(await comprarCJ(env, req, String(c.id || "").slice(0, 100), !!c.forcar));
    }
    if (rota === "auto-cj") {
      if (req.method === "POST") {
        const c = await req.json().catch(() => ({}));
        await env.DB.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES ('auto_cj', ?)").bind(c.ligado ? "1" : "0").run();
      }
      const v = await env.DB.prepare("SELECT valor FROM config WHERE chave='auto_cj'").first();
      const b = (await cj(env, "GET", "/shopping/pay/getBalance").catch(() => ({}))).data;
      return json({ ligado: !v || v.valor !== "0", saldo: b ? num(b.amount) : null });
    }
    if (rota === "rastreios" && req.method === "POST") { await atualizarRastreios(env); return json({ ok: true }); }
    if (rota === "pedido" && req.method === "POST") return await marcarPedido(req, env);
    if (rota === "cambio") return await cambio();
    if (rota === "tiktok") return await tiktokPosts(env, req, L);
    if (rota === "tiktok-whats" && req.method === "POST") {   // WhatsApp de quem posta no TikTok (o irmão)
      const c = await req.json().catch(() => ({}));
      const n = String(c.numero || "").replace(/\D/g, "").slice(0, 16);
      await tabelas(env);
      await env.DB.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES ('tiktok_whats', ?)").bind(n).run();
      return json({ ok: true, numero: n });
    }
    if (rota === "tiktok-enviado" && req.method === "POST") {
      const c = await req.json().catch(() => ({}));
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS tiktok_envios (loja TEXT NOT NULL, id TEXT NOT NULL, enviado TEXT, PRIMARY KEY (loja, id))").run();
      if (c.desfazer) await env.DB.prepare("DELETE FROM tiktok_envios WHERE loja=? AND id=?").bind(L.id, String(c.id || "")).run();
      else await env.DB.prepare("INSERT OR REPLACE INTO tiktok_envios (loja, id, enviado) VALUES (?,?,datetime('now'))").bind(L.id, String(c.id || "")).run();
      return json({ ok: true });
    }
    if (rota === "traduzir-cj" && req.method === "POST") {   // conversa com a agente da CJ: pt → en (para enviar) ou en → pt (resposta)
      const c = await req.json().catch(() => ({}));
      const texto = String(c.texto || "").trim().slice(0, 3000);
      if (!texto) return json({ erro: "texto" }, 400);
      if (!env.AI) return json({ erro: "ia" }, 500);
      const paraIngles = c.para !== "pt";
      const instr = paraIngles
        ? "Translate the following Portuguese message into clear, polite, simple English for a CJdropshipping support agent. Keep every order number, product ID, tracking number and name exactly as written. Write as the store owner (first person). Return ONLY the translated message, no quotes, no notes."
        : "Traduza a mensagem abaixo (de uma agente de suporte da CJdropshipping) para português do Brasil simples e claro. Mantenha números de pedido, códigos e valores exatamente iguais. Responda SOMENTE com a tradução, sem aspas e sem comentários.";
      try {
        const r = await env.AI.run(MODELO, { messages: [{ role: "system", content: instr }, { role: "user", content: texto }], max_tokens: 900, temperature: 0.2 });
        const out = String(typeof r.response === "string" ? r.response : "").trim();
        return out ? json({ ok: true, texto: out }) : json({ erro: "vazio" }, 502);
      } catch (e) { return json({ erro: "ia", detalhe: String(e).slice(0, 200) }, 502); }
    }
    if (rota === "sair" && req.method === "POST") {
      const m = /^Bearer (\w+)$/.exec(req.headers.get("Authorization") || "");
      if (m) await env.DB.prepare("DELETE FROM sessoes WHERE token=?").bind(await sha(m[1])).run();
      return json({ ok: true });
    }
  } catch (e) {
    return json({ erro: "falha", detalhe: String(e.message || e).slice(0, 300) }, 500);
  }
  return json({ erro: "404" }, 404);
}
