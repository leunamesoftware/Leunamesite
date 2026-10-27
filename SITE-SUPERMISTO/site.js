/* Supermisto Temperos: configuração do site. Troque aqui o WhatsApp, o e-mail e as redes sociais. */
const CONFIG = {
  whatsapp: '5524998721557',       // DDI + DDD + número, só números
  fone: '(24) 99872-1557',
  email: 'contato@supermistotemperos.com.br',
  instagram: '', // ex.: https://instagram.com/supermistotemperos (vazio = não aparece)
  facebook: '',
  tiktok: '',
  youtube: '',
  shopee: '', // link da loja na Shopee quando estiver no ar (vazio = botão não aparece)
  // condições de revenda: preencha quando definir (vazio = "a combinar pelo WhatsApp")
  revenda: { pedidoMinimo: '', prazo: '', regioes: '', pagamento: '' },
};

const KITS = [
  { ico: '🔥', nome: 'Kit Churrasco', itens: 'Chimichurri, tempero para churrasco, sal de parrilla e páprica defumada' },
  { ico: '🍲', nome: 'Kit Cozinha do Dia a Dia', itens: 'Colorau, tempero completo, cominho, pimenta-do-reino e orégano' },
  { ico: '🎁', nome: 'Kit Presente Gourmet', itens: 'Geleia de pimenta, pimenta biquinho, lemon pepper e ervas finas' },
];

/* Fotos dos produtos: só aparece para o cliente o que tem foto. Cada tamanho (10 g, 30 g, 50 g, 100 g, 250 g, 500 g, 1 kg)
   só aparece quando existe a foto dele. Fotos do site: img/produtos/<id>-<peso>.webp (ex.: tomate-seco-desidratado-30g.webp).
   Fotos enviadas pelo app (Meu site) também valem: a principal é do primeiro tamanho e as pequenas dos outros. */
const FOTOS = new Set();
const FOTOS_PESO = {   // 200 g, 250 g, 500 g e 1 kg: arte pronta, escondidos até liberar.
  'tomate-seco-desidratado': ['10 g', '20 g', '30 g', '50 g', '100 g'],
  'cebola-desidratada-em-flocos': ['10 g', '20 g', '30 g', '50 g', '100 g'],
  'pimentao-desidratado': ['10 g', '20 g', '30 g', '50 g', '100 g'],
  'banana-desidratada': ['10 g', '20 g', '30 g', '50 g', '100 g'],
  'maca-desidratada': ['10 g', '20 g', '30 g', '50 g', '100 g'],
  'cogumelo-shiitake-desidratado': ['10 g', '20 g', '30 g', '50 g', '100 g'],
  'champignon-desidratado': ['10 g', '20 g', '30 g', '50 g', '100 g'],
  'mix-de-cogumelos': ['10 g', '20 g', '30 g', '50 g', '100 g'],
  'alho-desidratado-em-flocos': ['10 g', '20 g', '30 g', '50 g', '100 g'],
};
const ORDEM_TAM = ['10 g', '20 g', '30 g', '50 g', '100 g', '250 g', '500 g', '1 kg'];
const ordemTam = (t) => { const i = ORDEM_TAM.indexOf(t); return i < 0 ? 99 : i; };
/** Tamanhos que têm foto (os outros não aparecem para o cliente). */
function tamFoto(p) {
  if (FOTOS_PESO[p.id]) return FOTOS_PESO[p.id];
  return []; // fotos antigas do app/ERP não entram: só aparece o que foi liberado em FOTOS_PESO
  const todos = p.tamAll || p.tam || [];
  const f = p.fotosPeso || {};
  return todos.filter((t, i) => (i === 0 && p.foto) || f[t]).sort((x, y) => ordemTam(x) - ordemTam(y));
}
function fotoUrl(p, peso) {
  if (FOTOS_PESO[p.id]) return `img/produtos/${p.id}-${peso.replace(' ', '')}.webp?v=86`;
  const todos = p.tamAll || p.tam || [];
  return (p.fotosPeso && p.fotosPeso[peso]) || (peso === todos[0] ? p.foto : '') || p.foto;
}
// fotos das linhas (cartão 4:3) e capas largas das páginas de linha (img/linhas/<id>-capa.webp)
const FOTOS_LINHA = ['desidratados', 'ervas', 'puros', 'conservas', 'misturas', 'churrasco', 'molhos', 'doces', 'amidos', 'chas', 'inteiros'];
const CAPAS_LINHA = ['chas', 'puros', 'inteiros', 'misturas', 'desidratados'];
// foto do quadradinho e capa larga de cada linha: a enviada pelo app (Meu site) vale mais que a do site
const NOME_IMG = (id) => (id === 'desidratados' ? 'cogumelos-linha' : id);
const EXT_IMG = (id) => (id === 'desidratados' ? 'jpg' : 'webp');
const fotoLinha = (l) => l.foto || (FOTOS_LINHA.includes(l.id) ? `img/linhas/${NOME_IMG(l.id)}.${EXT_IMG(l.id)}?v=86` : '');
const capaLinha = (l) => l.capa || (CAPAS_LINHA.includes(l.id) ? `img/linhas/${NOME_IMG(l.id)}-capa.${EXT_IMG(l.id)}?v=86` : '');
const slug = (n) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// cada produto tem um id fixo (o slug do nome original): o nome pode ser trocado pelo app sem perder a foto
PRODUTOS.forEach((p) => { p.id = p.id || slug(p.nome); });
const temFoto = (p) => tamFoto(p).length > 0;
function midia(p, peso) {
  const t = tamFoto(p), pe = t.includes(peso) ? peso : t[0];
  if (!pe) return embalagem(p, peso);
  return `<img class="foto-prod" src="${escapar(fotoUrl(p, pe))}" alt="${escapar(p.nome)} Supermisto ${pe}" loading="lazy" onerror="this.closest('.prod,.pd-foto,.rc-prod')&&this.closest('.prod,.rc-prod')&&(this.closest('.prod,.rc-prod').hidden=true)">`;
}

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const linkWhats = (msg) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
const linhaDe = (id) => LINHAS.find((l) => l.id === id) || {};
const WHATS_SVG = '<svg viewBox="0 0 32 32" width="30" height="30" fill="#fff" aria-hidden="true"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.6.7.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.3z"/></svg>';

/* ---------- cartões de produto ---------- */
function cartao(p) {
  if (!temFoto(p)) return `<article class="prod prod-embreve aparece" aria-label="${escapar(p.nome)}: em breve">
    <div class="prod-img"><img class="breve-logo" src="img/logo-supermisto.png?v=63" alt="" loading="lazy"><span class="breve-selo">Em breve</span></div>
    <div class="prod-corpo">
      <small class="prod-linha">${linhaDe(p.linha).nome}</small>
      <h3>${escapar(p.nome)}</h3>
      <p>${escapar(p.desc)}</p>
      <span class="btn btn-breve">Em breve</span>
    </div>
  </article>`;
  return `<a class="prod aparece" href="${linkProduto(p)}" aria-label="Ver ${escapar(p.nome)}">
    <div class="prod-img" style="--c:${linhaDe(p.linha).cor}">${p.tag ? `<span class="prod-tag">${p.tag}</span>` : ''}${midia(p, temFoto(p) ? p.tam[0] : p.tam[1] || p.tam[0])}</div>
    <div class="prod-corpo">
      <small class="prod-linha">${linhaDe(p.linha).nome}</small>
      <h3>${escapar(p.nome)}</h3>
      <p>${escapar(p.desc)}</p>
      <div class="prod-tam">${p.tam.length > 1 ? '<span class="varios">Vários tamanhos</span>' : `<span>${p.tam[0]}</span>`}</div>
      <span class="btn btn-roxo">${p.tam.length > 1 ? 'Escolher tamanho' : 'Ver produto'}</span>
    </div>
  </a>`;
}
const linkProduto = (p) => `produto.html?id=${p.id}`;
const recsDe = (p) => (typeof RECEITAS === 'undefined' ? [] : RECEITAS.filter((r) => r.usa.includes(p.nome)));


/* ---------- receitas ---------- */
const produtoPorNome = (n) => PRODUTOS.find((p) => p.nome === n);
function capaReceita(r, grande = false) {
  if (r.foto) return `<div class="rc-capa rc-foto${grande ? ' grande' : ''}" style="background-image:url(img/receitas/${r.foto}.webp)"></div>`;
  const pacotes = r.usa.slice(0, grande ? 4 : 3).map(produtoPorNome).filter(Boolean)
    .map((p, i) => `<span class="rc-p rc-p${i}">${embalagem(p, p.tam[1] || p.tam[0])}</span>`).join('');
  return `<div class="rc-capa${grande ? ' grande' : ''}" style="--c:${r.cor}"><span class="rc-prato">${r.emoji}</span>${pacotes}</div>`;
}
function cartaoReceita(r) {
  return `<a class="rec aparece" href="receita.html?id=${r.id}">${capaReceita(r)}
    <div class="rec-corpo"><small>${r.tempo} · ${r.rende}</small><h3>${r.titulo}</h3><p>${r.resumo}</p><span class="saiba">Saiba mais →</span></div></a>`;
}
function receitasLista(el, lista) { el.innerHTML = lista.map(cartaoReceita).join(''); }
function receitaDetalhe() {
  const r = RECEITAS.find((x) => x.id === new URLSearchParams(location.search).get('id')) || RECEITAS[0];
  document.title = r.titulo + ' | Supermisto Temperos';
  const usados = r.usa.map((n) => [produtoPorNome(n)]).filter(([p]) => p);
  $('#receita').innerHTML = `<header class="rc-topo" style="--c:${r.cor}"><div class="caixa rc-topo-in">
      <div><a class="voltar" href="receitas.html">← Todas as receitas</a><h1>${r.titulo}</h1><p>${r.resumo}</p>
      <div class="rc-info"><span>${r.tempo}</span><span>${r.rende}</span></div></div>${capaReceita(r, true)}</div></header>
    <div class="caixa rc-corpo">
      <div class="rc-col"><h2>Ingredientes</h2><ul class="rc-ing">${r.ingredientes.map((i) => `<li>${i}</li>`).join('')}</ul>
        <h2>Modo de preparo</h2><ol class="rc-modo">${r.preparo.map((i) => `<li>${i}</li>`).join('')}</ol>
        ${r.variacoes ? `<h2>Varie o sabor</h2><div class="rc-var">${r.variacoes.map(([t, d]) => `<div><b>${t}</b><p>${d}</p></div>`).join('')}</div>` : ''}</div>
      <aside class="rc-lado"><h3>Produtos Supermisto desta receita</h3><div class="rc-prods">${usados.map(([p]) =>
        (temFoto(p) ? `<a class="rc-prod" href="${linkProduto(p)}">${midia(p)}<span>${p.nome}</span></a>` : `<div class="rc-prod rc-breve"><span class="breve-mini">Em breve</span><span>${p.nome}</span></div>`)).join('')}</div>
        <a class="btn btn-roxo" href="${linkWhats('Olá! Vi a receita "' + r.titulo + '" no site e quero os temperos Supermisto.')}" target="_blank" rel="noopener">Quero estes temperos</a></aside>
    </div>`;
  receitasLista($('#receitas-mais'), RECEITAS.filter((x) => x.id !== r.id).slice(0, 3));
}

/* ---------- partes comuns ---------- */
function redes() {
  const r = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['youtube', 'YouTube']].filter(([k]) => CONFIG[k]);
  return r.length ? `<div class="redes">${r.map(([k, n]) => `<a href="${CONFIG[k]}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>` : '';
}
function rodape() {
  $('#rodape').innerHTML = `<div class="caixa rod-grid">
    <div><img src="img/logo-supermisto.png" alt="Supermisto Temperos" width="190" height="94" loading="lazy"><p><span class="ln">Temperos de verdade, 100% naturais</span> <span class="ln">e sem conservantes. Fábrica própria.</span></p>${redes()}</div>
    <div><b>Produtos</b>${LINHAS.slice(0, 5).map((l) => `<a href="linha.html?id=${l.id}">${l.nome}</a>`).join('')}<a href="catalogo.html">Ver todos →</a></div>
    <div><b>Empresa</b><a href="receitas.html">Receitas</a><a href="index.html#sobre">Nossa história</a><a href="revenda.html">Revenda e atacado</a><a href="revenda.html">Marca própria</a></div>
    <div class="rod-contato"><b>Contato</b><a data-whats="Olá! Vim pelo site da Supermisto."><span data-fone></span></a><a data-mail-link><span data-mail-txt></span></a><span class="rod-end"><span class="ln">Estrada de Xerém, 484 · Xerém</span><i class="sep"> · </i><span class="ln">Duque de Caxias (RJ)</span></span></div>
  </div>
  <div class="caixa rod-base"><span><span class="ln">SUPER MISTO TEMPEROS LTDA</span><i class="sep"> · </i><span class="ln">CNPJ 13.580.397/0001-80</span></span><span><span class="ln"><a href="privacidade.html">Política de privacidade</a></span><i class="sep"> · </i><span class="ln">© ${new Date().getFullYear()} Supermisto. Todos os direitos reservados.</span></span></div>`;
}
function ligacoes() {
  $$('[data-whats]').forEach((a) => { a.href = linkWhats(a.dataset.whats); a.target = '_blank'; a.rel = 'noopener'; });
  $$('[data-fone]').forEach((a) => { a.textContent = CONFIG.fone; });
  $$('[data-mail]').forEach((a) => { a.href = 'mailto:' + CONFIG.email; a.textContent = CONFIG.email; });
  $$('[data-mail-link]').forEach((a) => { a.href = 'mailto:' + CONFIG.email; });
  $$('[data-mail-txt]').forEach((a) => { a.textContent = CONFIG.email; });
  const w = $('.whats-flutua'); if (w) w.innerHTML = WHATS_SVG;
}
let obs;
function observar() {
  if (!('IntersectionObserver' in window)) { $$('.aparece').forEach((e) => e.classList.add('ok')); return; }
  obs = obs || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('ok'); obs.unobserve(e.target); } }), { threshold: 0.1 });
  $$('.aparece:not(.ok)').forEach((e) => obs.observe(e));
}

/* ---------- página inicial ---------- */
function inicio() {
  const pegar = (nome) => PRODUTOS.find((p) => p.nome === nome);
  // produtos com foto real entram como recorte (sem fundo); os outros com a embalagem desenhada
  const vit = (n) => FOTOS.has(slug(n)) ? `<img src="img/produtos/${slug(n)}-recorte.png" alt="${n} Supermisto">` : embalagem(pegar(n), pegar(n).tam[1] || pegar(n).tam[0]);
  $('#vitrine').innerHTML = '';
  // só aparecem as linhas que já têm produto com foto (as outras entram quando a arte chegar)
  const linhasOk = LINHAS.filter((l) => PRODUTOS.some((p) => p.linha === l.id && temFoto(p)));
  $('#num-prod').textContent = PRODUTOS.filter(temFoto).length; $('#num-linhas').textContent = linhasOk.length;
  $('#linhas-grid').innerHTML = linhasOk.map((l) => {
    const qtd = PRODUTOS.filter((p) => p.linha === l.id && temFoto(p)).length;
    const f = fotoLinha(l), fundo = f ? `background-image:url('${f}')` : `background:radial-gradient(circle at 50% 40%,#7A3E1E,#2A1208)`;
    return `<a class="linha aparece" href="linha.html?id=${l.id}"><span class="linha-foto" style="${fundo}">${f ? '' : `<i>${l.emoji}</i>`}</span><b>${l.nome}</b><em>${qtd} produto${qtd > 1 ? 's' : ''}</em></a>`;
  }).join('');
  // só produtos com foto real (os outros entram quando a foto chegar)
  const fav = PRODUTOS.map((p, i) => [p, i]).filter(([p]) => temFoto(p)).slice(0, 7);
  // "Mais sabores" só completa a fileira quando sobra espaço
  $('#favoritos').innerHTML = fav.map(([p, i]) => cartao(p, i)).join('') ;
  receitasLista($('#receitas-home'), RECEITAS.filter((r) => r.foto).slice(0, 4));
  $$('.emp, .dicas article, .passos li, details').forEach((e) => e.classList.add('aparece'));
  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    window.open(linkWhats(`Olá! Sou ${f.get('nome')}${f.get('empresa') ? ' da ' + f.get('empresa') : ''}. Vim pelo site e gostaria de um orçamento: ${f.get('msg')}`), '_blank', 'noopener');
  });
}

/* ---------- catálogo ---------- */
function catalogo() {
  const url = new URLSearchParams(location.search);
  let linha = LINHAS.some((l) => l.id === url.get('linha')) ? url.get('linha') : 'todos';
  const busca = $('#busca');
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const qtd = (id) => PRODUTOS.filter((p) => temFoto(p) && (!id || p.linha === id)).length;
  const comProd = LINHAS.filter((l) => qtd(l.id));
  if (linha !== 'todos' && !comProd.some((l) => l.id === linha)) linha = 'todos';
  menuCat($('#filtros'), linha);
  const desenhar = () => {
    const q = norm(busca.value.trim());
    const lista = PRODUTOS.map((p, i) => [p, i]).filter(([p]) => temFoto(p) && (linha === 'todos' || p.linha === linha) && (!q || norm(p.nome + ' ' + p.desc + ' ' + p.usos).includes(q)))
      .sort(([a], [b]) => temFoto(b) - temFoto(a));
    $('#conta').textContent = lista.length ? `${lista.length} produto${lista.length > 1 ? 's' : ''}` : 'Nenhum produto encontrado. Chame no WhatsApp: a gente pode produzir!';
    $('#catalogo').innerHTML = lista.map(([p, i]) => cartao(p, i)).join('');
    observar();
  };
  busca.addEventListener('input', desenhar);
  desenhar();
}

/* ---------- página de cada linha ---------- */
function paginaLinha() {
  const l = LINHAS.find((x) => x.id === new URLSearchParams(location.search).get('id')) || LINHAS[0];
  document.title = `${l.nome} | Supermisto Temperos`;
  const lista = PRODUTOS.map((p, i) => [p, i]).filter(([p]) => p.linha === l.id && temFoto(p))
    .sort(([a], [b]) => temFoto(b) - temFoto(a));
  const prontos = lista.filter(([p]) => temFoto(p)).length;
  const titulo = `<span class="sobre-tit amarelo">Nossas linhas</span><h1>${l.nome}</h1><p>${l.desc}</p>
    <span class="ln-conta">${lista.length ? `${lista.length} produto${lista.length > 1 ? 's' : ''}` : 'Em breve novidades nesta linha'}</span>`;
  // todas as linhas no mesmo modelo: banner (ou a foto do quadradinho) com a faixa roxa e o nome por cima
  const img = capaLinha(l) || fotoLinha(l);
  $('#linha').innerHTML = `<div class="ln-capa-larga${img ? (capaLinha(l) ? '' : ' so-foto') : ' sem-foto'}">${img ? `<img src="${img}" alt="${l.nome} Supermisto" width="1600" height="900">` : `<span class="ln-emoji">${l.emoji}</span>`}<div class="ln-capa-txt"><div class="caixa"><div>${titulo}</div></div></div></div>`;
  menuCat($('#linhas-nav'), l.id);
  $('#linha-prods').innerHTML = lista.map(([p, i]) => cartao(p, i)).join('');
}

/* ---------- página de cada produto ---------- */
function paginaProduto() {
  const id = new URLSearchParams(location.search).get('id');
  const p = PRODUTOS.find((x) => x.id === id && temFoto(x));
  if (!p) { location.replace('catalogo.html'); return; }
  const l = linhaDe(p.linha), info = p.info || (typeof INFO !== 'undefined' && INFO[p.nome]) || {};
  document.title = `${p.nome} Supermisto | ${l.nome}`;
  $('meta[name=description]').content = `${p.nome} Supermisto: ${p.desc} Embalagens de ${p.tam.join(', ')}.`;
  let tam = p.tam[0];
  const fichas = [['Ingredientes', info.ingredientes], ['Conservação', info.conservacao], ['Validade', info.validade], ['Alérgicos', info.alergicos]].filter(([, v]) => v);
  const recs = recsDe(p);
  const mais = PRODUTOS.filter((x) => x.linha === p.linha && x !== p && temFoto(x)).slice(0, 4);
  $('#produto').innerHTML = `<div class="caixa">
    <nav class="pd-trilha" aria-label="Você está em"><a href="index.html">Início</a> › <a href="linha.html?id=${l.id}">${l.nome}</a> › <span>${escapar(p.nome)}</span></nav>
    <div class="pd-grid">
      <div class="pd-foto" id="pd-foto">${midia(p, tam)}</div>
      <div class="pd-txt">
        <a class="prod-linha" href="linha.html?id=${l.id}">${l.nome}</a>
        <h1>${escapar(p.nome)}</h1>
        <p class="pd-desc">${escapar(p.desc)}</p>
        <p class="pd-usos"><b>Combina com:</b> ${escapar(p.usos)}</p>
        <b class="pd-rot">Embalagens</b>
        <div class="modal-tam" id="pd-tam" role="group" aria-label="Escolha a embalagem">${p.tam.map((t) => `<button type="button" class="${t === tam ? 'ativo' : ''}" data-tam="${t}" aria-pressed="${t === tam}">${t}</button>`).join('')}</div>
        <div class="pd-btns">
          <a class="btn btn-roxo" id="pd-orc" target="_blank" rel="noopener">Pedir orçamento</a>
          <a class="btn btn-amarelo" href="revenda.html">Quero revender</a>
          ${CONFIG.shopee ? `<a class="btn btn-vazado" href="${CONFIG.shopee}" target="_blank" rel="noopener">Comprar na Shopee</a>` : ''}
        </div>
        ${fichas.length ? `<dl class="pd-ficha">${fichas.map(([k, v]) => `<dt>${k}</dt><dd>${escapar(v)}</dd>`).join('')}</dl>` : ''}
      </div>
    </div>
    ${recs.length ? `<section class="pd-bloco"><h2>Receitas com ${escapar(p.nome.toLowerCase())}</h2><div class="rec-grid rec-4">${recs.map(cartaoReceita).join('')}</div></section>` : ''}
    ${mais.length ? `<section class="pd-bloco"><h2>Veja também</h2><div class="grade">${mais.map((x) => cartao(x)).join('')}</div></section>` : ''}
  </div>`;
  const orc = () => { $('#pd-orc').href = linkWhats(`Olá! Tenho interesse em ${p.nome} Supermisto (${tam}). Pode me passar valores e condições?`); };
  orc();
  $('#pd-tam').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tam]'); if (!b) return;
    tam = b.dataset.tam; $('#pd-foto').innerHTML = midia(p, tam);
    $$('#pd-tam button').forEach((x) => { const at = x === b; x.classList.toggle('ativo', at); x.setAttribute('aria-pressed', at); });
    orc();
  });
  const ld = document.createElement('script'); ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: `${p.nome} Supermisto`, description: p.desc, category: l.nome,
    brand: { '@type': 'Brand', name: 'Supermisto' }, image: p.foto || new URL(`img/produtos/${p.id}.webp`, location.href).href });
  document.head.append(ld);
}

/* ---------- revenda e empresas ---------- */
function revenda() {
  const c = CONFIG.revenda, ac = 'A combinar pelo WhatsApp';
  $('#rv-cond').innerHTML = [['Pedido mínimo', c.pedidoMinimo], ['Prazo de entrega', c.prazo], ['Regiões atendidas', c.regioes], ['Pagamento', c.pagamento]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v || ac}</dd></div>`).join('');
  $('#rv-linhas').innerHTML = LINHAS.filter((l) => PRODUTOS.some((p) => p.linha === l.id && temFoto(p))).map((l) => `<a href="linha.html?id=${l.id}">${l.nome}</a>`).join('');
  const tams = [...new Set(PRODUTOS.flatMap((p) => p.tam))];
  const ordem = (t) => { const n = parseFloat(t.replace(',', '.')); return /kg|L$/.test(t) ? n * 1000 : n; };
  $('#rv-emb').textContent = tams.sort((a, b) => ordem(a) - ordem(b)).join(' · ');
  $('#rv-interesse').innerHTML = LINHAS.map((l) => `<label class="rv-chk"><input type="checkbox" name="linhas" value="${l.nome}"> ${l.nome}</label>`).join('');
  $('#rv-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target), linhas = f.getAll('linhas');
    const msg = ['Olá! Quero comprar/revender Supermisto. Meus dados:', '',
      `*Nome:* ${f.get('nome')}`, `*Empresa:* ${f.get('empresa')}`, `*Cidade:* ${f.get('cidade')}`, `*Tipo de negócio:* ${f.get('tipo')}`,
      `*Produtos de interesse:* ${linhas.length ? linhas.join(', ') : 'Quero ver o catálogo'}`,
      f.get('qtd') ? `*Quantidade estimada:* ${f.get('qtd')}` : '', f.get('msg') ? `*Mensagem:* ${f.get('msg')}` : ''].filter((x, i) => x || i === 1).join('\n');
    window.open(linkWhats(msg), '_blank', 'noopener');
  });
}

const tentar = (f) => { try { f(); } catch (e) { console.error(e); } };

/* ---------- produtos editados pelo app (Área de gestão → Meu site) ---------- */
const CATALOGO_APP = 'https://precos.supermistotemperos.com.br/api/site/catalogo';
function aplicarCatalogo(lista) {
  for (const r of lista || []) {
    let p = PRODUTOS.find((x) => x.id === r.slug);
    if (r.oculto) { if (p) PRODUTOS.splice(PRODUTOS.indexOf(p), 1); continue; }
    if (!p) { if (!r.nome || !LINHAS.some((l) => l.id === r.linha)) continue; p = { id: r.slug, cor: '#C29433', emb: 'pouch', tag: '' }; PRODUTOS.push(p); }
    if (r.nome) p.nome = r.nome;
    if (LINHAS.some((l) => l.id === r.linha)) p.linha = r.linha;
    if (r.descricao) p.desc = r.descricao;
    if (r.usos) p.usos = r.usos;
    if (r.tamanhos && r.tamanhos.length) p.tam = r.tamanhos;
    if (r.foto) { p.foto = r.foto; p.fotosPeso = r.fotos_peso || {}; }
    const info = { ingredientes: r.ingredientes, conservacao: r.conservacao, validade: r.validade, alergicos: r.alergicos };
    if (Object.values(info).some(Boolean)) p.info = info;
    p.desc = p.desc || ''; p.usos = p.usos || ''; p.tam = p.tam && p.tam.length ? p.tam : ['10 g'];
  }
}
async function carregarCatalogo() {
  try {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 2500);
    const r = await fetch(CATALOGO_APP, { signal: c.signal }); clearTimeout(t);
    if (r.ok) {
      const d = await r.json();
      aplicarCatalogo(d.produtos);
      for (const [id, x] of Object.entries(d.linhas || {})) { const l = LINHAS.find((y) => y.id === id); if (l) { /* fotos das linhas ficam só no site */ } }
    }
  } catch { /* sem internet ou app fora do ar: o site segue com o catálogo fixo */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  // menu primeiro: funciona na hora, mesmo enquanto o catálogo do app ainda carrega
  const hamb = $('#hamb'), menu = $('#menu');
  hamb.addEventListener('click', () => { const ab = menu.classList.toggle('aberto'); hamb.setAttribute('aria-expanded', ab); });
  $$('#menu a').forEach((a) => a.addEventListener('click', () => { menu.classList.remove('aberto'); hamb.setAttribute('aria-expanded', false); }));
  await carregarCatalogo();
  PRODUTOS.forEach((p) => { p.tamAll = p.tamAll || p.tam; const t = tamFoto(p); if (t.length) p.tam = t; });
  rodape();
  if ($('#vitrine')) tentar(() => inicio());
  if ($('#catalogo')) tentar(() => catalogo());
  if ($('#receitas-lista')) tentar(() => receitasLista($('#receitas-lista'), RECEITAS));
  if ($('#receita')) tentar(() => receitaDetalhe());
  if ($('#linha')) tentar(() => paginaLinha());
  if ($('#produto')) tentar(() => paginaProduto());
  if ($('#rv-form')) tentar(() => revenda());
  ligacoes();
  observar();
});

/* ---------- zoom da foto ao tocar ---------- */
document.addEventListener('click', (e) => {
  const im = e.target.closest('.pd-foto img, .modal-img img.foto-prod, .vit-kit, .ln-capa-larga img');
  if (!im || im.closest('a')) return;
  const z = document.createElement('div');
  z.className = 'zoom';
  z.setAttribute('role', 'dialog');
  z.innerHTML = `<button class="zoom-x" aria-label="Fechar">×</button><img src="${im.currentSrc || im.src}" alt="${(im.alt || '').replace(/"/g, '')}"><span class="zoom-dica">Toque na foto para aproximar</span>`;
  const fechar = () => { z.remove(); document.removeEventListener('keydown', esc); };
  const esc = (k) => { if (k.key === 'Escape') fechar(); };
  z.querySelector('.zoom-x').onclick = fechar;
  z.querySelector('img').onclick = (ev) => { ev.stopPropagation(); z.classList.toggle('mais'); z.querySelector('.zoom-dica')?.remove(); };
  z.onclick = (ev) => { if (ev.target === z) fechar(); };
  document.addEventListener('keydown', esc);
  document.body.appendChild(z);
});

/* ---------- gaveta de categorias (botão ☰ no cabeçalho) ---------- */
const ICONE_LINHA = { desidratados: '🍄', puros: '🌿', ervas: '🌿', misturas: '🧂', churrasco: '🔥', molhos: '🥫', conservas: '🫙', doces: '🍯', amidos: '🌾', chas: '🍵', inteiros: '🌰' };
function menuCategorias() {
  const topo = document.querySelector('.topo'), marca = topo && topo.querySelector('.marca');
  if (!topo) return;
  const qtd = (id) => PRODUTOS.filter((p) => p.linha === id && temFoto(p)).length;
  const ls = LINHAS.filter((l) => qtd(l.id));
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'cat-btn'; btn.setAttribute('aria-label', 'Abrir categorias'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<b><i></i><i></i><i></i></b><span>Categorias</span>';
  topo.querySelector('.topo-in').prepend(btn);
  const fundo = document.createElement('div'); fundo.className = 'gav-fundo'; fundo.hidden = true;
  const gav = document.createElement('aside'); gav.className = 'gaveta'; gav.setAttribute('aria-label', 'Categorias'); gav.setAttribute('aria-hidden', 'true');
  gav.innerHTML = `<div class="gav-topo"><h2>Super Misto</h2><button type="button" class="gav-x" aria-label="Fechar">✕</button></div>
    <a class="gav-todos" href="catalogo.html"><span>Todos os produtos</span><b>›</b></a>
    <h3>Categorias</h3>
    <ul class="gav-lista">${ls.map((l) => `<li><a href="linha.html?id=${l.id}"><span class="ic">${ICONE_LINHA[l.id] || '🧂'}</span><span class="nm">${l.nome}</span><em>${qtd(l.id)}</em></a></li>`).join('')}</ul>
    <h3>Conheça a Super Misto</h3>
    <ul class="gav-lista gav-inst"><li><a href="index.html"><span class="nm">Início</span></a></li><li><a href="receitas.html"><span class="nm">Receitas</span></a></li><li><a href="revenda.html"><span class="nm">Seja revendedor</span></a></li></ul>`;
  document.body.append(fundo, gav);
  const abrir = (v) => { fundo.hidden = !v; gav.classList.toggle('aberta', v); gav.setAttribute('aria-hidden', !v); btn.setAttribute('aria-expanded', v); document.body.classList.toggle('gav-aberta', v); };
  btn.addEventListener('click', () => abrir(true));
  fundo.addEventListener('click', () => abrir(false));
  gav.querySelector('.gav-x').addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrir(false); });
}

/* ---------- menu suspenso "Categorias" (canto esquerdo, acima dos produtos) ---------- */
function menuCat(alvo, atual) {
  const ls = LINHAS.filter((l) => PRODUTOS.some((p) => p.linha === l.id && temFoto(p)));
  alvo.hidden = false; alvo.classList.add('cat-sus');
  alvo.innerHTML = `<button type="button" class="cat-sus-btn" aria-expanded="false">Categorias <i></i></button>
    <ul class="cat-sus-lista" hidden>
      <li><a href="catalogo.html"${atual === 'todos' ? ' class="atual"' : ''}>Todos os produtos</a></li>
      ${ls.map((l) => `<li><a href="linha.html?id=${l.id}"${l.id === atual ? ' class="atual"' : ''}>${l.nome}</a></li>`).join('')}
    </ul>`;
  const b = alvo.querySelector('button'), u = alvo.querySelector('ul');
  const fechar = () => { u.hidden = true; b.setAttribute('aria-expanded', 'false'); };
  b.addEventListener('click', (e) => { e.stopPropagation(); u.hidden = !u.hidden; b.setAttribute('aria-expanded', !u.hidden); });
  document.addEventListener('click', (e) => { if (!alvo.contains(e.target)) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
}

/* ao chegar com #âncora (ex.: Nossa história vindo de outra página), vai ao lugar certo mesmo depois que as fotos e produtos carregam */
(function () {
  const ir = () => { const h = location.hash; if (h.length > 1) { const el = document.getElementById(decodeURIComponent(h.slice(1))); if (el) el.scrollIntoView(); } };
  if (location.hash.length > 1) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('load', () => { ir(); setTimeout(ir, 400); setTimeout(ir, 1200); });
  }
})();
