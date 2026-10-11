/* ==========================================================================
   LeuName Softwares — Cursos grátis no site (curso.html?id=...&aula=N | &fim=1)
   Conteúdo em /cursos.json (o mesmo da loja). Progresso e certificado ficam
   no aparelho, com as mesmas chaves de antes: quem já começou continua de onde parou.
   ========================================================================== */
(function () {
  'use strict';

  var el = document.getElementById('cursoPagina');
  var params = new URLSearchParams(location.search);
  var id = params.get('id') || '';
  var aulaParam = params.get('aula');
  var naFim = params.get('fim') === '1';
  var ZAP = '5524998721557';
  var curso = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function progresso(cid) { try { return JSON.parse(ler('leuapps.curso.' + cid) || '[]'); } catch (e) { return []; } }
  function gratis(c) { return /grátis/i.test(c.preco); }
  function minutos(c) { return c.aulas.reduce(function (s, a) { return s + (a.minutos || 0); }, 0); }
  function unidade(c, n) { if (n === undefined) n = 2; return c.unidade === 'módulos' ? (n === 1 ? 'módulo' : 'módulos') : (n === 1 ? 'aula' : 'aulas'); }
  function maiuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function duracao(m) { return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }
  function fimDe(c) { return ler('leuapps.curso.' + c.id + '.fim'); }
  function link(c, extra) { return 'curso.html?id=' + encodeURIComponent(c.id) + (extra || ''); }

  // Cursos com partes: a numeração recomeça em cada parte (Parte 2 · Módulo 3 de 5).
  function lugarNaParte(c, i) {
    var partes = [];
    c.aulas.forEach(function (a) { if (a.parte && partes.indexOf(a.parte) < 0) partes.push(a.parte); });
    if (!partes.length) return null;
    var daParte = [];
    c.aulas.forEach(function (a, k) { if (a.parte === c.aulas[i].parte) daParte.push(k); });
    return { parte: partes.indexOf(c.aulas[i].parte) + 1, nome: c.aulas[i].parte, n: daParte.indexOf(i) + 1, de: daParte.length };
  }

  function naoAchou() {
    el.innerHTML = '<div class="prose"><h2>Curso não encontrado</h2><p>Esse curso não existe ou saiu do ar. <a href="categoria.html?slug=cursos">Ver os cursos grátis</a></p></div>';
  }

  function trilha(c, atual) {
    document.title = c.nome + ' — LeuName Softwares';
    return '<p class="breadcrumb"><a href="index.html">Início</a> / <a href="categoria.html?slug=cursos">Cursos grátis</a> / ' +
      (atual ? '<a href="' + link(c) + '">' + esc(c.nomeCurto || c.nome) + '</a> / <span>' + esc(atual) + '</span>' : '<span>' + esc(c.nomeCurto || c.nome) + '</span>') + '</p>';
  }

  function paginaCurso(c) {
    var feitas = progresso(c.id), total = c.aulas.length, pct = Math.round(feitas.length / total * 100);
    var prox = -1;
    for (var k = 0; k < total; k++) if (feitas.indexOf(k) < 0) { prox = k; break; }
    var botao = c.emBreve ? '<button class="btn btn-ghost" type="button" disabled>Em breve</button>'
      : !gratis(c) ? '<a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/' + ZAP + '?text=' + encodeURIComponent('Olá, LeuName Softwares! Quero o curso ' + c.nome + ' (' + c.preco + ').') + '">' + esc(c.preco) + '</a>'
      : '<a class="btn btn-primary" href="' + link(c, '&aula=' + (prox < 0 ? 0 : prox)) + '">' + (prox < 0 ? 'Rever o curso' : feitas.length ? 'Continuar' : 'Começar grátis') + '</a>';
    var lista = c.aulas.map(function (a, i) {
      var l = lugarNaParte(c, i), feita = feitas.indexOf(i) >= 0;
      return (l && l.n === 1 ? '<li class="cs-parte">Parte ' + l.parte + '<small>' + esc(l.nome) + '</small></li>' : '') +
        '<li><a ' + (c.emBreve ? '' : 'href="' + link(c, '&aula=' + i) + '"') + '><span class="cs-num' + (feita ? ' feita' : '') + '">' + (feita ? '✓' : l ? l.n : i + 1) + '</span>' +
        '<span class="cs-txt">' + esc(a.titulo) + '<small>' + (a.minutos || 1) + ' min</small></span></a></li>';
    }).join('');
    el.innerHTML = trilha(c) +
      '<div class="cs-topo">' +
        '<img class="cs-capa" src="' + esc(c.destaque ? c.destaque.imagem : c.icone) + '" alt="">' +
        '<div class="cs-info">' +
          '<h1>' + esc(c.nome) + '</h1>' +
          '<p class="cs-resumo">' + esc(c.resumo) + '</p>' +
          '<ul class="cs-fatos"><li><b>' + esc(c.preco) + '</b>' + (gratis(c) ? 'para sempre' : 'pagamento único') + '</li><li><b>' + total + '</b>' + unidade(c) + '</li><li><b>' + duracao(minutos(c)) + '</b>no total</li>' +
            (c.certificado ? '<li><b>Certificado</b>no final</li>' : '<li><b>' + esc(c.nivel || 'Todos') + '</b>nível</li>') + '</ul>' +
          (feitas.length ? '<div class="cs-prog"><i style="width:' + pct + '%"></i></div><p class="cs-prog-txt">' + (feitas.length >= total ? 'Curso concluído ✓' : feitas.length + ' de ' + total + ' ' + unidade(c) + ' feitos') + '</p>' : '') +
          (fimDe(c) && feitas.length < total ? '<p class="cs-aviso">🆕 <b>Continuação do curso:</b> chegaram ' + (total - feitas.length) + ' ' + unidade(c, total - feitas.length) + ' novos. O seu certificado continua valendo.</p>' : '') +
          '<div class="cs-botoes">' + botao + ((feitas.length >= total || fimDe(c)) && c.certificado ? '<a class="btn btn-ghost" href="' + link(c, '&fim=1') + '">Ver meu certificado</a>' : '') + '</div>' +
          '<p class="cs-nota">Curso livre da LeuName Softwares · ' + (gratis(c) ? 'Grátis e online' : 'Online') + (c.certificado ? ' · com certificado de conclusão' : '') + '. O seu progresso fica salvo neste aparelho.</p>' +
        '</div>' +
      '</div>' +
      '<h2 class="cs-h2">' + maiuscula(unidade(c)) + ' do curso</h2><ol class="cs-lista">' + lista + '</ol>';
  }

  function paginaAula(c, i) {
    var a = c.aulas[i], total = c.aulas.length, l = lugarNaParte(c, i), q = a.pergunta;
    var feitas = progresso(c.id), travado = q && feitas.indexOf(i) < 0;
    var nomeAula = maiuscula(unidade(c, 1));
    el.innerHTML = trilha(c, nomeAula + ' ' + (i + 1)) +
      '<article class="cs-aula">' +
        '<div class="cs-aula-topo">' + (l ? 'Parte ' + l.parte + ' · ' + esc(l.nome) + ' · ' + nomeAula + ' ' + l.n + ' de ' + l.de : nomeAula + ' ' + (i + 1) + ' de ' + total) + ' · ' + (a.minutos || 1) + ' min</div>' +
        '<div class="cs-prog"><i style="width:' + Math.round(i / total * 100) + '%"></i></div>' +
        '<h1>' + esc(a.titulo) + '</h1>' +
        '<div class="cs-texto">' + a.texto + '</div>' +
        (q ? '<div class="cs-quiz"><div class="cs-quiz-tit">Teste rápido</div><p>' + esc(q.texto) + '</p>' +
          q.opcoes.map(function (o, k) { return '<button type="button" class="cs-op' + (!travado && k === q.certa ? ' certa' : '') + '" data-resposta="' + k + '"' + (travado ? '' : ' disabled') + '>' + esc(o) + '</button>'; }).join('') +
          '<p class="cs-quiz-msg" role="status">' + (travado ? '' : esc(q.explica)) + '</p></div>' : '') +
        '<div class="cs-aula-acoes">' +
          '<button class="btn btn-primary" type="button" id="cs-concluir"' + (travado ? ' disabled' : '') + '>' + (i + 1 < total ? 'Concluir ' + (unidade(c, 1) === 'módulo' ? 'o módulo' : 'a aula') + ' e continuar' : 'Concluir o curso') + '</button>' +
          (travado ? '<small id="cs-trava">Responda o teste rápido para continuar.</small>' : '') +
          '<div class="cs-nav">' + (i > 0 ? '<a href="' + link(c, '&aula=' + (i - 1)) + '">← ' + nomeAula + ' anterior</a>' : '<span></span>') + '<a href="' + link(c) + '">Todos os ' + unidade(c) + '</a></div>' +
        '</div>' +
      '</article>';

    el.querySelectorAll('[data-resposta]').forEach(function (b) {
      b.addEventListener('click', function () {
        var msg = el.querySelector('.cs-quiz-msg');
        if (Number(b.dataset.resposta) === q.certa) {
          b.classList.add('certa');
          el.querySelectorAll('.cs-op').forEach(function (x) { x.disabled = true; });
          msg.textContent = q.explica;
          document.getElementById('cs-concluir').disabled = false;
          var t = document.getElementById('cs-trava'); if (t) t.remove();
        } else { b.classList.add('errada'); b.disabled = true; msg.textContent = 'Quase! Leia de novo e tente outra resposta.'; }
      });
    });
    document.getElementById('cs-concluir').addEventListener('click', function () {
      var f = progresso(c.id); if (f.indexOf(i) < 0) f.push(i);
      gravar('leuapps.curso.' + c.id, JSON.stringify(f));
      if (f.length >= total) { // concluiu (ou concluiu a continuação): data e carga horária do certificado
        gravar('leuapps.curso.' + c.id + '.fim', new Date().toISOString());
        gravar('leuapps.curso.' + c.id + '.min', String(minutos(c)));
      }
      location.href = i + 1 < total ? link(c, '&aula=' + (i + 1)) : link(c, '&fim=1');
    });
  }

  function paginaFim(c) {
    var terminou = progresso(c.id).length >= c.aulas.length || Boolean(fimDe(c));
    if (!terminou) { location.replace(link(c)); return; }
    var app = c.app && window.LeuStore && window.LeuStore.getProduct(c.app);
    el.innerHTML = trilha(c, 'Concluído') +
      '<div class="cs-fim">' +
        '<div class="cs-ok" aria-hidden="true"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<h1>Parabéns!</h1><p>Você concluiu o curso <b>' + esc(c.nome) + '</b>.</p>' +
        (c.certificado ? '<div class="cs-cert"><h2>Seu certificado</h2><p>Escreva o seu nome como quer que apareça. Você pode baixar ou compartilhar.</p>' +
          '<label for="cert-nome">Nome completo<input id="cert-nome" maxlength="60" autocomplete="name" value="' + esc(ler('leuapps.certificado.nome') || '') + '"></label>' +
          '<button class="btn btn-primary" type="button" id="cs-gerar">Gerar meu certificado</button><div id="cert-saida" aria-live="polite"></div></div>' : '') +
        (app ? '<a class="cs-app" href="producto.html?id=' + esc(app.id) + '"><img src="' + esc(app.icon || '') + '" alt=""><span><b>Coloque em prática</b><small>O ' + esc(app.name) + ' faz essas contas por você. ' + esc(app.trial || '') + '.</small></span><span class="btn btn-primary">Conhecer</span></a>' : '') +
        '<a class="btn btn-ghost" href="categoria.html?slug=cursos">Ver outros cursos</a>' +
      '</div>';
    var gerar = document.getElementById('cs-gerar');
    if (gerar) gerar.addEventListener('click', function () { gerarCertificado(c); });
  }

  // ---- Certificado de conclusão, feito aqui no aparelho ----
  function carregarImg(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function dataConclusao(c) {
    var d = fimDe(c); if (!d) { d = new Date().toISOString(); gravar('leuapps.curso.' + c.id + '.fim', d); }
    return new Date(d);
  }
  function linhas(ctx, texto, larg) {
    var out = [], l = '';
    texto.split(' ').forEach(function (p) { var t = l ? l + ' ' + p : p; if (ctx.measureText(t).width > larg && l) { out.push(l); l = p; } else l = t; });
    if (l) out.push(l); return out;
  }
  async function desenharCertificado(c, nome) {
    var W = 1754, H = 1240, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    // Assinatura do dono (desenhada na Área do Dono e guardada no servidor).
    var assinatura = (await carregarImg('/loja-api/assinatura.png?v=' + Date.now())) || (await carregarImg('/img/cursos/assinatura.png'));
    var tinta = '#1A1630', suave = '#5D5A6B', grad = x.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#FF8A00'); grad.addColorStop(0.5, '#E5306E'); grad.addColorStop(1, '#6A35E8');
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
    x.fillStyle = grad; x.fillRect(0, 0, W, 28); x.fillRect(0, H - 28, W, 28);
    x.strokeStyle = grad; x.lineWidth = 6; x.strokeRect(60, 70, W - 120, H - 140);
    x.strokeStyle = '#E6E1F5'; x.lineWidth = 2; x.strokeRect(80, 90, W - 160, H - 180);
    x.textAlign = 'center'; x.fillStyle = grad;
    x.font = '800 40px system-ui, "Segoe UI", Roboto, sans-serif'; x.letterSpacing = '12px'; x.fillText('LEUNAME SOFTWARES', W / 2 + 6, 205);
    var marca = x.measureText('LEUNAME SOFTWARES').width / 2 + 40;
    x.fillRect(W / 2 - marca - 160, 191, 160, 3); x.fillRect(W / 2 + marca, 191, 160, 3);
    x.fillStyle = tinta;
    x.font = '800 74px system-ui, "Segoe UI", Roboto, sans-serif'; x.letterSpacing = '10px'; x.fillText('CERTIFICADO', W / 2, 340);
    x.fillStyle = grad; x.font = '700 30px system-ui, "Segoe UI", Roboto, sans-serif'; x.letterSpacing = '8px'; x.fillText('DE CONCLUSÃO', W / 2, 392);
    x.letterSpacing = '0px'; x.fillStyle = suave; x.font = '400 32px system-ui, "Segoe UI", Roboto, sans-serif'; x.fillText('Certificamos que', W / 2, 480);
    var tam = 84; do { x.font = 'italic 600 ' + tam + 'px Georgia, "Noto Serif", "Times New Roman", serif'; tam -= 4; } while (x.measureText(nome).width > W - 360 && tam > 40);
    x.fillStyle = tinta; x.fillText(nome, W / 2, 590);
    x.fillStyle = grad; x.fillRect(W / 2 - 360, 618, 720, 4);
    x.fillStyle = suave; x.font = '400 32px system-ui, "Segoe UI", Roboto, sans-serif';
    var minCert = Number(ler('leuapps.curso.' + c.id + '.min')) || 0;
    var horas = duracao(minCert || minutos(c)).replace(' h', ' horas').replace(/^1 horas/, '1 hora');
    var texto = 'concluiu o curso livre e gratuito “' + c.nome + '”, com carga horária de ' + horas + ', oferecido pela LeuName Softwares.';
    linhas(x, texto, W - 420).forEach(function (l, k) { x.fillText(l, W / 2, 690 + k * 46); });
    var data = dataConclusao(c).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    x.font = '600 30px system-ui, "Segoe UI", Roboto, sans-serif'; x.fillStyle = tinta; x.fillText('Concluído em ' + data, W / 2, 860);
    var ax = W - 470, linhaY = 1012;
    if (assinatura) {
      // O corpo da assinatura (a linha de traço mais cheia) fica logo em cima da linha.
      var sw = assinatura.width, sh = assinatura.height, m = document.createElement('canvas'); m.width = sw; m.height = sh;
      var mc = m.getContext('2d'); mc.drawImage(assinatura, 0, 0); var px = mc.getImageData(0, 0, sw, sh).data;
      var corpo = 0, maior = -1;
      for (var y = 0; y < sh; y++) { var soma = 0; for (var k = 0; k < sw; k++) soma += px[(y * sw + k) * 4 + 3]; if (soma > maior) { maior = soma; corpo = y; } }
      var f = Math.min(400 / sw, 150 / sh, 76 / Math.max(1, sh - corpo)), w = Math.round(sw * f), h = Math.round(sh * f);
      var tela = document.createElement('canvas'); tela.width = w + 2; tela.height = h + 2; var t = tela.getContext('2d');
      [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]].forEach(function (d) { t.drawImage(assinatura, d[0] * 0.6, d[1] * 0.6, w, h); });
      t.globalCompositeOperation = 'source-in'; t.fillStyle = '#1C2E7A'; t.fillRect(0, 0, tela.width, tela.height);
      x.drawImage(tela, ax - w / 2, linhaY - 10 - corpo * f);
    }
    x.fillStyle = tinta; x.fillRect(ax - 210, linhaY, 420, 2);
    x.font = '700 26px system-ui, "Segoe UI", Roboto, sans-serif'; x.fillText('LeuName Softwares', ax, 1110);
    x.fillStyle = suave; x.font = '400 22px system-ui, "Segoe UI", Roboto, sans-serif'; x.fillText('www.leunamesoftware.com.br', ax, 1137);
    var sx = 470, sy = 1000;
    x.beginPath(); x.arc(sx, sy, 96, 0, Math.PI * 2); x.fillStyle = grad; x.fill();
    x.beginPath(); x.arc(sx, sy, 80, 0, Math.PI * 2); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#FFFFFF'; x.font = '800 26px system-ui, "Segoe UI", Roboto, sans-serif'; x.fillText('LeuName', sx, sy - 12);
    x.font = '700 15px system-ui, "Segoe UI", Roboto, sans-serif'; x.letterSpacing = '1px'; x.fillText('CURSO', sx, sy + 20); x.fillText('CONCLUÍDO', sx, sy + 40); x.letterSpacing = '0px';
    return cv;
  }
  async function gerarCertificado(c) {
    var campo = document.getElementById('cert-nome'), saida = document.getElementById('cert-saida');
    var nome = campo.value.replace(/\s+/g, ' ').trim();
    if (nome.length < 3) { saida.innerHTML = '<p>Escreva o seu nome completo.</p>'; campo.focus(); return; }
    gravar('leuapps.certificado.nome', nome);
    saida.innerHTML = '<p>Preparando…</p>';
    var cv = await desenharCertificado(c, nome);
    var blob = await new Promise(function (ok) { cv.toBlob(ok, 'image/png'); });
    var url = URL.createObjectURL(blob), arquivo = 'certificado-' + c.id + '.png';
    var arq = new File([blob], arquivo, { type: 'image/png' });
    var podeEnviar = navigator.canShare && navigator.canShare({ files: [arq] });
    saida.innerHTML = '<img class="cs-cert-img" src="' + url + '" alt="Certificado de ' + esc(nome) + '"><div class="cs-cert-botoes">' +
      '<a class="btn btn-primary" href="' + url + '" download="' + arquivo + '">Baixar</a>' + (podeEnviar ? '<button class="btn btn-ghost" type="button" id="cs-enviar">Compartilhar</button>' : '') + '</div>';
    var env = document.getElementById('cs-enviar');
    if (env) env.addEventListener('click', function () { navigator.share({ files: [arq], title: 'Meu certificado LeuName', text: 'Concluí um curso grátis da LeuName Softwares!' }).catch(function () {}); });
  }

  fetch('/cursos.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (lista) {
    curso = lista.filter(function (c) { return c.id === id; })[0];
    if (!curso) return naoAchou();
    var i = Number(aulaParam);
    if (naFim) paginaFim(curso);
    else if (aulaParam !== null && !curso.emBreve && curso.aulas[i]) paginaAula(curso, i);
    else paginaCurso(curso);
    scrollTo(0, 0);
  }).catch(naoAchou);
})();
