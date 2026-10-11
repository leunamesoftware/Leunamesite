/* ==========================================================================
   LeuName Softwares — Banner do topo da categoria (no lugar da faixa azul)
   Roda NA HORA, dentro do HTML (logo depois de <main>), para o banner já nascer
   no lugar certo: sem a faixa azul aparecer antes e sem a página pular.
   Para pôr o banner de outra categoria, acrescente em BANNER_TOPO (1920x720).
   ========================================================================== */
(function () {
  'use strict';
  var DESIGN = { pc: '/img/destaques/design-novo-visual.webp', pcTam: [1800, 750], cel: '/img/destaques/design-novo-visual-cel.webp', celTam: [980, 769],
    alt: 'Sua marca com um novo visual. Logotipos, banners e artes profissionais para o seu negócio.', botao: true };
  var BANNER_TOPO = {
    logomarcas: Object.assign({ pedido: 'uma logomarca para o meu negócio' }, DESIGN),
    banners: { pc: '/img/destaques/banners-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/banners-topo-cel.webp', celTam: [1020, 765],
      alt: 'Banners que destacam. Artes profissionais para sites, lojas e redes sociais que atraem mais clientes.', pedido: 'um banner para o meu negócio', botao: true, cor: 'roxo' },
    sites: { pc: '/img/destaques/site-sob-medida.webp', pcTam: [1600, 576], cel: '/img/destaques/site-sob-medida-cel.webp', celTam: [720, 530],
      alt: 'Seu site sob medida, para qualquer tipo de negócio. Orçamento grátis.', pedido: 'um site para a minha empresa', botao: false, cor: 'site' },
    pdv: { pc: '/img/destaques/pdv-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/pdv-topo.webp', celTam: [1920, 720],
      alt: 'PDV e Sistemas: sua loja mais organizada e no controle. Vendas, estoque, relatórios e gestão do seu negócio.', link: '#catGridResults', botaoTexto: 'Ver os sistemas', botao: true, cor: 'pdv' },
    receitas: { pc: '/img/destaques/receitas-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/receitas-topo-cel.webp', celTam: [1020, 765],
      alt: 'Receitas e Calculadoras: receitas que vendem, com preço certo. Calcule custos, defina o preço de venda e aumente o seu lucro.', link: '#catGridResults', botaoTexto: 'Ver as receitas', botao: true, cor: 'laranja' },
    utilidades: { pc: '/img/destaques/gestao-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/gestao-topo-cel.webp', celTam: [1020, 765],
      alt: 'Gestão e Utilidades: mais controle para o seu dia a dia. Ferramentas para organizar e facilitar a gestão do seu negócio.', link: '#catGridResults', botaoTexto: 'Ver os sistemas', botao: true, cor: 'verde' },
    cursos: { pc: '/img/destaques/cursos-gratis-topo.webp', pcTam: [1920, 720], cel: '/img/destaques/cursos-gratis-topo-cel.webp', celTam: [1020, 765],
      alt: 'Cursos grátis: aprenda hoje e evolua sempre. Conteúdo prático, aulas em vídeo, passo a passo detalhado.', link: '#catGridResults', botaoTexto: 'Ver os cursos grátis', botao: true }
  };

  var APELIDOS = { design: 'logomarcas', diseno: 'logomarcas' };
  var params = new URLSearchParams(location.search);
  var slug = params.get('slug') || '';
  slug = APELIDOS[slug] || slug;
  var topo = !params.get('q') && BANNER_TOPO[slug];
  if (!topo) return;
  document.documentElement.classList.add('tem-banner-topo');
  var destino = topo.link ? '<a href="' + topo.link + '" aria-label="' + topo.alt + '">'
    : '<a href="https://wa.me/5524998721557?text=' + encodeURIComponent('Olá, LeuName Softwares! Vim pelo site e quero um orçamento de ' + topo.pedido + '.') + '" target="_blank" rel="noopener" aria-label="' + topo.alt + ' Pedir orçamento grátis no WhatsApp">';
  var html = '<div class="cat-banner-topo container">' + destino +
    '<img src="' + topo.pc + '" width="1920" height="720" alt="' + topo.alt + '" fetchpriority="high" decoding="async">' +
    '<span class="cbt-cta' + (topo.link ? ' cbt-azul' : '') + (topo.cor ? ' cbt-' + topo.cor : '') + (topo.botao ? '' : ' cbt-so-cel') + '">' + (topo.botaoTexto || 'Pedir orçamento grátis') + '</span></a></div>';
  var aqui = document.currentScript;
  if (aqui) aqui.insertAdjacentHTML('beforebegin', html);
})();
