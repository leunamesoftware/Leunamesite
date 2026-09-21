/* ==========================================================================
   LeuName Softwares — Dados de produtos (fonte única para todas as páginas)
   --------------------------------------------------------------------------
   <!-- CATÁLOGO DE EXEMPLO — substituir pelos produtos reais do cliente
        antes de publicar. Somente "leuname-gestao" é um produto real da
        empresa; todos os demais são exemplos para mostrar como fica a
        loja com um catálogo completo. -->
   Cada preço leva a marca PLACEHOLDER: são valores de exemplo para que
   a loja não pareça "quebrada" com preços vazios; devem ser substituídos
   pelos preços reais antes de publicar o site.
   ========================================================================== */
(function (global) {
  'use strict';

  var ICONS = {
    aplicaciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M2 20h20"/></svg>',
    templates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>',
    libros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13Z"/></svg>',
    recetas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 10c0-3 2.5-6 6-6s6 3 6 6"/><path d="M4 10h16l-1.2 9a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 10Z"/></svg>',
    diseno: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.7 1.5-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4H16a4 4 0 0 0 4-4c0-5-3.6-9-8-9Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>',
    otros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 7v13M12 7c-1.5-3-5.5-3.5-5.5-1S9 7 12 7Zm0 0c1.5-3 5.5-3.5 5.5-1S15 7 12 7Z"/></svg>'
  };

  var CATEGORIES = [
    { slug: 'aplicaciones', name: 'Aplicativos e Sistemas', color: 'blue', icon: ICONS.aplicaciones },
    { slug: 'templates', name: 'Templates', color: 'green', icon: ICONS.templates },
    { slug: 'libros', name: 'Livros', color: 'amber', icon: ICONS.libros },
    { slug: 'recetas', name: 'Receitas', color: 'pink', icon: ICONS.recetas },
    { slug: 'diseno', name: 'Design e Logos', color: 'purple', icon: ICONS.diseno },
    { slug: 'otros', name: 'Outros produtos', color: 'gray', icon: ICONS.otros }
  ];

  var PRODUCTS = [
    {
      id: 'leuname-gestao',
      name: 'LeuName Gestão',
      category: 'aplicaciones',
      real: true,
      price: 250.00,
      originalPrice: 300.00,
      rating: 4.8,
      reviews: 34,
      short: 'Sistema completo de gestão para lojas de celulares, acessórios e assistência técnica.',
      description: 'LeuName Gestão é um sistema completo de gestão pensado para lojas de celulares, acessórios e assistência técnica. Controla vendas, estoque, clientes, ordens de serviço e finanças em um só lugar. Funciona 100% offline — não depende de internet para operar o dia a dia — e, se você ativar a mesma licença em mais de um dispositivo, sincroniza automaticamente os dados entre eles quando há conexão.',
      includes: ['Licença de uso para 1 loja: até 2 computadores e 2 celulares', 'Aplicativo para Android e Windows', 'Sincronização entre seus dispositivos', 'Atualizações incluídas', 'Suporte especializado'],
      features: ['Controle de vendas e caixa diário', 'Gestão de estoque e produtos', 'Ordens de serviço técnico', 'Cadastro de clientes', 'Relatórios financeiros', 'Funciona 100% offline'],
      badge: 'Produto real',
      demoUrl: 'demo.html?id=leuname-gestao'
    },
    {
      id: 'sistema-inventario',
      name: 'Sistema de Estoque para Supermercados',
      category: 'aplicaciones',
      real: false,
      price: 39.90,
      rating: 4.5,
      reviews: 21,
      short: 'Controle de estoque, entradas, saídas e alertas de reposição para supermercados e mercadinhos.',
      description: 'Exemplo de produto: um sistema de controle de estoque pensado para supermercados e mercadinhos, com entradas e saídas de estoque, alertas de reposição e relatórios de giro de produtos.',
      includes: ['Licença de uso', 'Manual de instalação', 'Atualizações por 12 meses'],
      features: ['Controle de entradas e saídas', 'Alertas de estoque mínimo', 'Códigos de barras', 'Relatórios de giro'],
      badge: 'Exemplo'
    },
    {
      id: 'sistema-punto-venta',
      name: 'Sistema de Ponto de Venda (PDV)',
      category: 'aplicaciones',
      real: false,
      price: 44.90,
      rating: 4.6,
      reviews: 18,
      short: 'PDV rápido com emissão de recibos, controle de caixa e múltiplos usuários.',
      description: 'Exemplo de produto: um sistema de ponto de venda (PDV) rápido, com emissão de recibos, controle de caixa por turno e suporte para múltiplos usuários.',
      includes: ['Licença de uso', 'Guia rápido de configuração'],
      features: ['Emissão de recibos', 'Controle de caixa por turno', 'Múltiplos usuários', 'Histórico de vendas'],
      badge: 'Exemplo'
    },
    {
      id: 'template-agencia-viajes',
      name: 'Template Agência de Viagens',
      category: 'templates',
      real: false,
      price: 19.90,
      rating: 4.7,
      reviews: 42,
      short: 'Site pronto para usar, ideal para agências de viagens e turismo.',
      description: 'Exemplo de produto: um template de site completo e responsivo para agências de viagens, com seções de destinos, pacotes e formulário de contato, pronto para personalizar.',
      includes: ['Arquivos HTML/CSS/JS', 'Documentação de instalação', 'Licença de uso único'],
      features: ['100% responsivo', 'Fácil de personalizar', 'Otimizado para velocidade', 'Compatível com os principais navegadores'],
      badge: 'Exemplo'
    },
    {
      id: 'template-portfolio-creativo',
      name: 'Template Portfólio Criativo',
      category: 'templates',
      real: false,
      price: 16.90,
      rating: 4.8,
      reviews: 37,
      short: 'Portfólio moderno para designers, fotógrafos e criativos.',
      description: 'Exemplo de produto: um template de portfólio moderno e minimalista, ideal para designers, fotógrafos e outros profissionais criativos que queiram mostrar seu trabalho.',
      includes: ['Arquivos HTML/CSS/JS', 'Documentação de instalação', 'Licença de uso único'],
      features: ['Galeria de projetos', 'Animações suaves', '100% responsivo', 'Fácil de personalizar'],
      badge: 'Exemplo'
    },
    {
      id: 'template-tienda-online',
      name: 'Template Loja Online',
      category: 'templates',
      real: false,
      tag: 'recomendado',
      price: 24.90,
      rating: 4.6,
      reviews: 29,
      short: 'Base pronta para montar sua própria loja online de produtos digitais ou físicos.',
      description: 'Exemplo de produto: um template de loja online pronto para personalizar, com catálogo de produtos, carrinho e páginas de checkout de exemplo.',
      includes: ['Arquivos HTML/CSS/JS', 'Documentação de instalação', 'Licença de uso único'],
      features: ['Catálogo de produtos', 'Carrinho de compras', 'Design responsivo', 'Fácil de personalizar'],
      badge: 'Exemplo'
    },
    {
      id: 'pack-logos-profesionales',
      name: 'Pacote de Logos Profissionais',
      category: 'diseno',
      real: false,
      price: 14.90,
      rating: 4.4,
      reviews: 53,
      short: 'Coleção de logotipos editáveis para diferentes ramos de negócio.',
      description: 'Exemplo de produto: uma coleção de logotipos profissionais e editáveis, pensada para pequenos negócios que buscam uma identidade visual rápida e de qualidade.',
      includes: ['Arquivos vetoriais editáveis', 'Versões em PNG e SVG', 'Licença de uso comercial'],
      features: ['Totalmente editáveis', 'Formatos vetoriais', 'Variedade de estilos', 'Uso comercial permitido'],
      badge: 'Exemplo'
    },
    {
      id: 'logo-pack-minimalista',
      name: 'Pacote de Logos Minimalistas',
      category: 'diseno',
      real: false,
      price: 12.90,
      rating: 4.5,
      reviews: 31,
      short: 'Logotipos de estilo minimalista, ideais para marcas modernas.',
      description: 'Exemplo de produto: um pacote de logotipos de estilo minimalista e geométrico, pensado para marcas modernas que buscam simplicidade.',
      includes: ['Arquivos vetoriais editáveis', 'Versões em PNG e SVG', 'Licença de uso comercial'],
      features: ['Estilo minimalista', 'Totalmente editáveis', 'Formatos vetoriais', 'Uso comercial permitido'],
      badge: 'Exemplo'
    },
    {
      id: 'ebook-finanzas-personales',
      name: 'E-book: Finanças Pessoais',
      category: 'libros',
      real: false,
      tag: 'novedad',
      price: 9.90,
      rating: 4.6,
      reviews: 64,
      short: 'Guia prático para organizar suas finanças e começar a poupar.',
      description: 'Exemplo de produto: um e-book prático com conceitos básicos de organização financeira pessoal, orçamento e poupança, em formato PDF.',
      includes: ['Arquivo PDF', 'Modelo de orçamento de brinde'],
      features: ['Linguagem simples', 'Exercícios práticos', 'Formato PDF para baixar'],
      badge: 'Exemplo'
    },
    {
      id: 'ebook-productividad',
      name: 'E-book: Produtividade Diária',
      category: 'libros',
      real: false,
      price: 8.90,
      rating: 4.3,
      reviews: 27,
      short: 'Técnicas simples para organizar seu tempo e suas tarefas diárias.',
      description: 'Exemplo de produto: um e-book com técnicas de organização pessoal e gestão do tempo, pensado para quem quer ser mais produtivo no dia a dia.',
      includes: ['Arquivo PDF', 'Checklist para imprimir de brinde'],
      features: ['Linguagem simples', 'Técnicas aplicáveis', 'Formato PDF para baixar'],
      badge: 'Exemplo'
    },
    {
      id: 'recetas-italia',
      name: 'Receitas da Itália (207 receitas)',
      category: 'recetas',
      real: false,
      tag: 'recomendado',
      price: 7.90,
      rating: 4.9,
      reviews: 88,
      short: 'Coleção de 207 receitas tradicionais da culinária italiana.',
      description: 'Exemplo de produto: uma coleção digital com 207 receitas tradicionais da culinária italiana, de massas e molhos a sobremesas clássicas.',
      includes: ['Arquivo PDF', '207 receitas ilustradas', 'Índice por categorias'],
      features: ['207 receitas', 'Passo a passo detalhado', 'Formato PDF para baixar'],
      badge: 'Exemplo'
    },
    {
      id: 'recetas-reposteria',
      name: 'Receitas de Confeitaria Caseira',
      category: 'recetas',
      real: false,
      price: 6.90,
      rating: 4.7,
      reviews: 45,
      short: 'Receitas doces fáceis de preparar em casa.',
      description: 'Exemplo de produto: uma coleção de receitas de confeitaria caseira, com instruções claras para iniciantes e amantes da culinária doce.',
      includes: ['Arquivo PDF', 'Receitas ilustradas', 'Índice por categorias'],
      features: ['Receitas fáceis', 'Passo a passo detalhado', 'Formato PDF para baixar'],
      badge: 'Exemplo'
    },
    {
      id: 'kit-iconos-otros',
      name: 'Kit de Ícones e Recursos Gráficos',
      category: 'otros',
      real: false,
      tag: 'novedad',
      price: 11.90,
      rating: 4.4,
      reviews: 22,
      short: 'Conjunto de ícones vetoriais para projetos digitais.',
      description: 'Exemplo de produto: um kit de ícones vetoriais editáveis, pensado para usar em aplicativos, sites e apresentações.',
      includes: ['Arquivos SVG e PNG', 'Licença de uso comercial'],
      features: ['Mais de 100 ícones', 'Formatos vetoriais', 'Uso comercial permitido'],
      badge: 'Exemplo'
    },
    {
      id: 'plantillas-excel-negocios',
      name: 'Planilhas de Excel para Negócios',
      category: 'otros',
      real: false,
      price: 13.90,
      rating: 4.5,
      reviews: 19,
      short: 'Planilhas prontas para controle financeiro, vendas e estoque no Excel.',
      description: 'Exemplo de produto: um conjunto de planilhas de Excel/Google Sheets para controle financeiro básico, acompanhamento de vendas e controle simples de estoque.',
      includes: ['Arquivos XLSX', 'Guia de uso em PDF'],
      features: ['Prontas para usar', 'Compatível com Excel e Sheets', 'Fórmulas já configuradas'],
      badge: 'Exemplo'
    }
  ];

  var FAQS_BY_CATEGORY = {
    aplicaciones: [
      { q: 'Como recebo o produto depois de comprar?', a: 'Assim que o pagamento é confirmado, a própria página de confirmação já mostra sua chave de licença e os botões para baixar o aplicativo (Android e Windows).' },
      { q: 'O sistema funciona sem conexão com a internet?', a: 'Depende do produto: confira a descrição de cada aplicativo. Vários dos nossos sistemas foram pensados para funcionar de forma offline.' },
      { q: 'O que acontece se eu tiver um problema técnico?', a: 'Você pode nos escrever para suporte@leunamesoftware.com.br e vamos te ajudar a resolver.' }
    ],
    templates: [
      { q: 'Preciso de conhecimentos técnicos para usar o template?', a: 'Os templates incluem documentação básica de instalação. Conhecimentos de HTML/CSS ajudam para personalizações mais avançadas.' },
      { q: 'Posso usar para um cliente?', a: 'A licença padrão permite uso próprio ou para um único projeto de cliente. Consulte os termos de uso para mais detalhes.' },
      { q: 'Inclui suporte de instalação?', a: 'Inclui documentação escrita. Para dúvidas pontuais, nossa equipe de suporte está disponível por e-mail.' }
    ],
    libros: [
      { q: 'Em que formato recebo o livro?', a: 'Todos os nossos livros digitais são entregues em formato PDF, disponível para download na sua conta.' },
      { q: 'Posso ler no celular?', a: 'Sim, o PDF pode ser aberto em qualquer dispositivo com um leitor de PDF instalado.' },
      { q: 'Tem reembolso se eu não gostar?', a: 'Consulte nossa Política de reembolso para conhecer os prazos e condições aplicáveis a produtos digitais.' }
    ],
    recetas: [
      { q: 'As receitas incluem fotos?', a: 'A maioria das nossas coleções inclui imagens ilustrativas junto com o passo a passo.' },
      { q: 'Posso imprimir as receitas?', a: 'Sim, por ser um arquivo PDF você pode imprimir livremente para uso pessoal.' },
      { q: 'Os ingredientes podem ser encontrados em qualquer lugar?', a: 'As receitas usam ingredientes comuns, embora a disponibilidade possa variar de acordo com a sua região.' }
    ],
    diseno: [
      { q: 'Posso modificar os logos?', a: 'Sim, todos os pacotes incluem arquivos vetoriais totalmente editáveis.' },
      { q: 'Posso usá-los comercialmente?', a: 'Sim, a licença incluída permite uso comercial. Confira os termos de uso para mais detalhes.' },
      { q: 'Em quais programas posso abrir os arquivos?', a: 'Os arquivos vetoriais são compatíveis com programas de edição como Illustrator, Inkscape ou CorelDRAW; também incluímos versões em PNG.' }
    ],
    otros: [
      { q: 'Como faço o download do produto?', a: 'O link de download aparece direto na página de confirmação, assim que o pagamento é aprovado.' },
      { q: 'Os arquivos têm atualizações?', a: 'Quando aplicável, as atualizações são anunciadas na sua conta e por e-mail.' },
      { q: 'Posso pedir suporte?', a: 'Sim, escreva para suporte@leunamesoftware.com.br com qualquer dúvida.' }
    ]
  };

  function getCategory(slug) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
    return null;
  }

  function getProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }

  function getProductsByCategory(slug) {
    if (!slug || slug === 'todos') return PRODUCTS.slice();
    return PRODUCTS.filter(function (p) { return p.category === slug; });
  }

  function formatPrice(value) {
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Preço "de/por": quando o produto tem originalPrice (promoção), mostra o
  // valor riscado antes do preço atual. Sem originalPrice, mostra só o preço.
  function priceHTML(product) {
    if (product.originalPrice && product.originalPrice > product.price) {
      return '<span class="price-old">' + formatPrice(product.originalPrice) + '</span>' + formatPrice(product.price);
    }
    return formatPrice(product.price);
  }

  // % de desconto arredondado, pra etiqueta tipo "-17%". null quando o
  // produto não tem promoção (sem originalPrice).
  function discountPercent(product) {
    if (!product.originalPrice || product.originalPrice <= product.price) return null;
    return Math.round((1 - product.price / product.originalPrice) * 100);
  }

  function starsHTML(rating) {
    var full = Math.round(rating * 2) / 2;
    var out = '';
    for (var i = 1; i <= 5; i++) {
      if (full >= i) {
        out += '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="m12 2 3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3 5.6 21.7 7 14.5l-5.3-5 7.2-.9L12 2Z"/></svg>';
      } else if (full >= i - 0.5) {
        out += '<svg viewBox="0 0 24 24" width="14" height="14"><defs><linearGradient id="half' + i + Math.random().toString(36).slice(2) + '"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs><path d="m12 2 3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3 5.6 21.7 7 14.5l-5.3-5 7.2-.9L12 2Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m12 2 3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3V2Z" fill="currentColor"/></svg>';
      } else {
        out += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m12 2 3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3 5.6 21.7 7 14.5l-5.3-5 7.2-.9L12 2Z"/></svg>';
      }
    }
    return out;
  }

  // Arte visual "de produto" genérica por categoria (sem fotos), reutilizada
  // nos cartões de produto e na galeria da página de detalhes.
  function productVisualHTML(product) {
    if (product.imageUrl) {
      return '<div class="prod-visual prod-visual-photo"><img src="' + product.imageUrl + '" alt="' + product.name + '" loading="lazy"></div>';
    }
    var cat = getCategory(product.category) || CATEGORIES[0];
    var initials = product.name.split(' ').slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    return (
      '<div class="prod-visual prod-visual-' + cat.color + '" aria-hidden="true">' +
        '<span class="prod-visual-blob prod-visual-blob-a"></span>' +
        '<span class="prod-visual-blob prod-visual-blob-b"></span>' +
        '<span class="prod-visual-icon">' + cat.icon + '</span>' +
        '<span class="prod-visual-initials">' + initials + '</span>' +
      '</div>'
    );
  }

  var TAG_LABELS = { novedad: 'Novidade', recomendado: 'Recomendado' };

  function productCardHTML(product) {
    var priceComment = '<!-- PREÇO DE EXEMPLO: substituir pelo preço real -->';
    var desconto = discountPercent(product);
    // O card inteiro é um único link (padrão Shopee/Mercado Livre): sem
    // botão "Ver produto" separado sobrando espaço vertical, a imagem e o
    // preço ficam maiores dentro do mesmo card.
    return (
      '<a class="product-card" href="producto.html?id=' + product.id + '">' +
        '<div class="product-card-media">' +
          productVisualHTML(product) +
          (product.real ? '<span class="product-real-badge">Produto real</span>' : '') +
          (product.tag && TAG_LABELS[product.tag] ? '<span class="product-tag product-tag-' + product.tag + '">' + TAG_LABELS[product.tag] + '</span>' : '') +
          (desconto ? '<span class="product-discount-badge">-' + desconto + '%</span>' : '') +
        '</div>' +
        '<div class="product-card-body">' +
          '<span class="product-card-name">' + product.name + '</span>' +
          '<div class="product-card-rating">' +
            '<span class="stars">' + starsHTML(product.rating) + '</span>' +
            '<span class="rating-num">' + product.rating.toFixed(1) + '</span>' +
            '<span class="rating-count">(' + product.reviews + ')</span>' +
          '</div>' +
          priceComment +
          '<p class="product-card-price">' + priceHTML(product) + '</p>' +
        '</div>' +
      '</a>'
    );
  }

  function categoryCardHTML(cat) {
    return (
      '<a class="cat-card" href="categoria.html?slug=' + cat.slug + '">' +
        '<span class="cat-ic cat-ic-' + cat.color + '">' + cat.icon + '</span>' +
        '<span class="cat-card-name">' + cat.name + '</span>' +
        '<span class="cat-card-link">Ver produtos →</span>' +
      '</a>'
    );
  }

  function mountCategoryGrid(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = CATEGORIES.map(categoryCardHTML).join('');
  }

  function mountProductGrid(elId, products) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = products.length
      ? products.map(productCardHTML).join('')
      : '<p class="cat-empty">Ainda não há produtos para mostrar.</p>';
  }

  global.LeuStore = {
    CATEGORIES: CATEGORIES,
    PRODUCTS: PRODUCTS,
    FAQS_BY_CATEGORY: FAQS_BY_CATEGORY,
    getCategory: getCategory,
    getProduct: getProduct,
    getProductsByCategory: getProductsByCategory,
    formatPrice: formatPrice,
    priceHTML: priceHTML,
    discountPercent: discountPercent,
    starsHTML: starsHTML,
    productVisualHTML: productVisualHTML,
    productCardHTML: productCardHTML,
    categoryCardHTML: categoryCardHTML,
    mountCategoryGrid: mountCategoryGrid,
    mountProductGrid: mountProductGrid
  };
})(window);
