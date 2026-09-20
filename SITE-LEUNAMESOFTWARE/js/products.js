/* ==========================================================================
   LeuName Softwares — Datos de productos (fuente única para todas las páginas)
   --------------------------------------------------------------------------
   <!-- CATÁLOGO DE EJEMPLO — reemplazar con productos reales del cliente
        antes de publicar. Solo "leuname-gestao" es un producto real de la
        empresa; todos los demás son ejemplos para mostrar cómo luce la
        tienda con un catálogo completo. -->
   Cada precio lleva la marca PLACEHOLDER: son valores de ejemplo para que
   la tienda no se vea "rota" con precios vacíos; deben ser reemplazados
   por los precios reales antes de publicar el sitio.
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
    { slug: 'aplicaciones', name: 'Aplicaciones y Sistemas', color: 'blue', icon: ICONS.aplicaciones },
    { slug: 'templates', name: 'Templates', color: 'green', icon: ICONS.templates },
    { slug: 'libros', name: 'Libros', color: 'amber', icon: ICONS.libros },
    { slug: 'recetas', name: 'Recetas', color: 'pink', icon: ICONS.recetas },
    { slug: 'diseno', name: 'Diseño y Logos', color: 'purple', icon: ICONS.diseno },
    { slug: 'otros', name: 'Otros productos', color: 'gray', icon: ICONS.otros }
  ];

  var PRODUCTS = [
    {
      id: 'leuname-gestao',
      name: 'LeuName Gestão',
      category: 'aplicaciones',
      real: true,
      price: 29.90, // PRECIO DE EJEMPLO: reemplazar por el precio real
      rating: 4.8,
      reviews: 34,
      short: 'Sistema completo de gestión para tiendas de celulares, accesorios y asistencia técnica.',
      description: 'LeuName Gestão es un sistema completo de gestión pensado para tiendas de celulares, accesorios y asistencia técnica. Controla ventas, stock, clientes, órdenes de servicio y finanzas desde un solo lugar. Funciona 100% offline —no depende de internet para operar el día a día— y, si activas la misma licencia en más de un dispositivo, sincroniza automáticamente los datos entre ellos cuando hay conexión.',
      includes: ['Licencia de uso para 1 tienda', 'Aplicación para Android y Windows', 'Sincronización entre tus dispositivos', 'Actualizaciones incluidas', 'Soporte especializado'],
      features: ['Control de ventas y caja diaria', 'Gestión de stock y productos', 'Órdenes de servicio técnico', 'Ficha de clientes', 'Reportes financieros', 'Funciona 100% offline'],
      badge: 'Producto real'
    },
    {
      id: 'sistema-inventario',
      name: 'Sistema de Inventario para Supermercados',
      category: 'aplicaciones',
      real: false,
      price: 39.90,
      rating: 4.5,
      reviews: 21,
      short: 'Control de stock, entradas, salidas y alertas de reposición para supermercados y minimercados.',
      description: 'Ejemplo de producto: un sistema de control de inventario pensado para supermercados y minimercados, con entradas y salidas de stock, alertas de reposición y reportes de rotación de productos.',
      includes: ['Licencia de uso', 'Manual de instalación', 'Actualizaciones por 12 meses'],
      features: ['Control de entradas y salidas', 'Alertas de stock mínimo', 'Códigos de barra', 'Reportes de rotación'],
      badge: 'Ejemplo'
    },
    {
      id: 'sistema-punto-venta',
      name: 'Sistema de Punto de Venta (PDV)',
      category: 'aplicaciones',
      real: false,
      price: 44.90,
      rating: 4.6,
      reviews: 18,
      short: 'Punto de venta rápido con emisión de recibos, control de caja y múltiples usuarios.',
      description: 'Ejemplo de producto: un sistema de punto de venta (PDV) rápido, con emisión de recibos, control de caja por turno y soporte para múltiples usuarios.',
      includes: ['Licencia de uso', 'Guía rápida de configuración'],
      features: ['Emisión de recibos', 'Control de caja por turno', 'Múltiples usuarios', 'Historial de ventas'],
      badge: 'Ejemplo'
    },
    {
      id: 'template-agencia-viajes',
      name: 'Template Agencia de Viajes',
      category: 'templates',
      real: false,
      price: 19.90,
      rating: 4.7,
      reviews: 42,
      short: 'Sitio web listo para usar, ideal para agencias de viajes y turismo.',
      description: 'Ejemplo de producto: un template de sitio web completo y responsivo para agencias de viajes, con secciones de destinos, paquetes y formulario de contacto, listo para personalizar.',
      includes: ['Archivos HTML/CSS/JS', 'Documentación de instalación', 'Licencia de uso único'],
      features: ['100% responsivo', 'Fácil de personalizar', 'Optimizado para velocidad', 'Compatible con los navegadores principales'],
      badge: 'Ejemplo'
    },
    {
      id: 'template-portfolio-creativo',
      name: 'Template Portfolio Creativo',
      category: 'templates',
      real: false,
      price: 16.90,
      rating: 4.8,
      reviews: 37,
      short: 'Portfolio moderno para diseñadores, fotógrafos y creativos.',
      description: 'Ejemplo de producto: un template de portfolio moderno y minimalista, ideal para diseñadores, fotógrafos y otros profesionales creativos que quieran mostrar su trabajo.',
      includes: ['Archivos HTML/CSS/JS', 'Documentación de instalación', 'Licencia de uso único'],
      features: ['Galería de proyectos', 'Animaciones suaves', '100% responsivo', 'Fácil de personalizar'],
      badge: 'Ejemplo'
    },
    {
      id: 'template-tienda-online',
      name: 'Template Tienda Online',
      category: 'templates',
      real: false,
      price: 24.90,
      rating: 4.6,
      reviews: 29,
      short: 'Base lista para montar tu propia tienda online de productos digitales o físicos.',
      description: 'Ejemplo de producto: un template de tienda online listo para personalizar, con catálogo de productos, carrito y páginas de checkout de ejemplo.',
      includes: ['Archivos HTML/CSS/JS', 'Documentación de instalación', 'Licencia de uso único'],
      features: ['Catálogo de productos', 'Carrito de compras', 'Diseño responsivo', 'Fácil de personalizar'],
      badge: 'Ejemplo'
    },
    {
      id: 'pack-logos-profesionales',
      name: 'Pack de Logos Profesionales',
      category: 'diseno',
      real: false,
      price: 14.90,
      rating: 4.4,
      reviews: 53,
      short: 'Colección de logotipos editables para distintos rubros de negocio.',
      description: 'Ejemplo de producto: una colección de logotipos profesionales y editables, pensada para pequeños negocios que buscan una identidad visual rápida y de calidad.',
      includes: ['Archivos vectoriales editables', 'Versiones en PNG y SVG', 'Licencia de uso comercial'],
      features: ['Totalmente editables', 'Formatos vectoriales', 'Variedad de estilos', 'Uso comercial permitido'],
      badge: 'Ejemplo'
    },
    {
      id: 'logo-pack-minimalista',
      name: 'Pack de Logos Minimalistas',
      category: 'diseno',
      real: false,
      price: 12.90,
      rating: 4.5,
      reviews: 31,
      short: 'Logotipos de estilo minimalista, ideales para marcas modernas.',
      description: 'Ejemplo de producto: un pack de logotipos de estilo minimalista y geométrico, pensado para marcas modernas que buscan simplicidad.',
      includes: ['Archivos vectoriales editables', 'Versiones en PNG y SVG', 'Licencia de uso comercial'],
      features: ['Estilo minimalista', 'Totalmente editables', 'Formatos vectoriales', 'Uso comercial permitido'],
      badge: 'Ejemplo'
    },
    {
      id: 'ebook-finanzas-personales',
      name: 'E-book: Finanzas Personales',
      category: 'libros',
      real: false,
      price: 9.90,
      rating: 4.6,
      reviews: 64,
      short: 'Guía práctica para organizar tus finanzas y empezar a ahorrar.',
      description: 'Ejemplo de producto: un e-book práctico con conceptos básicos de organización financiera personal, presupuesto y ahorro, en formato PDF.',
      includes: ['Archivo PDF', 'Plantilla de presupuesto de regalo'],
      features: ['Lenguaje sencillo', 'Ejercicios prácticos', 'Formato PDF descargable'],
      badge: 'Ejemplo'
    },
    {
      id: 'ebook-productividad',
      name: 'E-book: Productividad Diaria',
      category: 'libros',
      real: false,
      price: 8.90,
      rating: 4.3,
      reviews: 27,
      short: 'Técnicas simples para organizar tu tiempo y tus tareas diarias.',
      description: 'Ejemplo de producto: un e-book con técnicas de organización personal y gestión del tiempo, pensado para quienes quieren ser más productivos en su día a día.',
      includes: ['Archivo PDF', 'Checklist imprimible de regalo'],
      features: ['Lenguaje sencillo', 'Técnicas aplicables', 'Formato PDF descargable'],
      badge: 'Ejemplo'
    },
    {
      id: 'recetas-italia',
      name: 'Recetas de Italia (207 recetas)',
      category: 'recetas',
      real: false,
      price: 7.90,
      rating: 4.9,
      reviews: 88,
      short: 'Colección de 207 recetas tradicionales de la cocina italiana.',
      description: 'Ejemplo de producto: una colección digital con 207 recetas tradicionales de la cocina italiana, desde pastas y salsas hasta postres clásicos.',
      includes: ['Archivo PDF', '207 recetas ilustradas', 'Índice por categorías'],
      features: ['207 recetas', 'Paso a paso detallado', 'Formato PDF descargable'],
      badge: 'Ejemplo'
    },
    {
      id: 'recetas-reposteria',
      name: 'Recetas de Repostería Casera',
      category: 'recetas',
      real: false,
      price: 6.90,
      rating: 4.7,
      reviews: 45,
      short: 'Recetas dulces fáciles de preparar en casa.',
      description: 'Ejemplo de producto: una colección de recetas de repostería casera, con instrucciones claras para principiantes y amantes de la cocina dulce.',
      includes: ['Archivo PDF', 'Recetas ilustradas', 'Índice por categorías'],
      features: ['Recetas fáciles', 'Paso a paso detallado', 'Formato PDF descargable'],
      badge: 'Ejemplo'
    },
    {
      id: 'kit-iconos-otros',
      name: 'Kit de Iconos y Recursos Gráficos',
      category: 'otros',
      real: false,
      price: 11.90,
      rating: 4.4,
      reviews: 22,
      short: 'Conjunto de iconos vectoriales para proyectos digitales.',
      description: 'Ejemplo de producto: un kit de iconos vectoriales editables, pensado para usar en aplicaciones, sitios web y presentaciones.',
      includes: ['Archivos SVG y PNG', 'Licencia de uso comercial'],
      features: ['Más de 100 iconos', 'Formatos vectoriales', 'Uso comercial permitido'],
      badge: 'Ejemplo'
    },
    {
      id: 'plantillas-excel-negocios',
      name: 'Plantillas de Excel para Negocios',
      category: 'otros',
      real: false,
      price: 13.90,
      rating: 4.5,
      reviews: 19,
      short: 'Plantillas listas para control financiero, ventas y stock en Excel.',
      description: 'Ejemplo de producto: un set de plantillas de Excel/Google Sheets para control financiero básico, seguimiento de ventas y control simple de stock.',
      includes: ['Archivos XLSX', 'Guía de uso en PDF'],
      features: ['Listas para usar', 'Compatible con Excel y Sheets', 'Fórmulas ya configuradas'],
      badge: 'Ejemplo'
    }
  ];

  var FAQS_BY_CATEGORY = {
    aplicaciones: [
      { q: '¿Cómo recibo el producto después de comprar?', a: 'El acceso de descarga se habilita en tu cuenta inmediatamente después de confirmarse el pago. También recibirás un correo con las instrucciones.' },
      { q: '¿El sistema funciona sin conexión a internet?', a: 'Depende del producto: revisa la descripción de cada aplicación. Varios de nuestros sistemas están pensados para funcionar de forma offline.' },
      { q: '¿Qué pasa si tengo un problema técnico?', a: 'Puedes escribirnos a soporte@leunamesoftware.com y te ayudaremos a resolverlo.' }
    ],
    templates: [
      { q: '¿Necesito conocimientos técnicos para usar el template?', a: 'Los templates incluyen documentación básica de instalación. Conocimientos de HTML/CSS ayudan para personalizaciones más avanzadas.' },
      { q: '¿Puedo usarlo para un cliente?', a: 'La licencia estándar permite uso propio o para un único proyecto de cliente. Consulta los términos de uso para más detalles.' },
      { q: '¿Incluye soporte de instalación?', a: 'Incluye documentación escrita. Para dudas puntuales, nuestro equipo de soporte está disponible por correo.' }
    ],
    libros: [
      { q: '¿En qué formato recibo el libro?', a: 'Todos nuestros libros digitales se entregan en formato PDF, descargable desde tu cuenta.' },
      { q: '¿Puedo leerlo en el celular?', a: 'Sí, el PDF puede abrirse en cualquier dispositivo con un lector de PDF instalado.' },
      { q: '¿Hay reembolso si no me gusta?', a: 'Consulta nuestra Política de reembolso para conocer los plazos y condiciones aplicables a productos digitales.' }
    ],
    recetas: [
      { q: '¿Las recetas incluyen fotos?', a: 'La mayoría de nuestras colecciones incluyen imágenes ilustrativas junto al paso a paso.' },
      { q: '¿Puedo imprimir las recetas?', a: 'Sí, al ser un archivo PDF puedes imprimirlo libremente para tu uso personal.' },
      { q: '¿Se pueden usar los ingredientes en cualquier país?', a: 'Las recetas usan ingredientes comunes, aunque la disponibilidad puede variar según tu región.' }
    ],
    diseno: [
      { q: '¿Puedo modificar los logos?', a: 'Sí, todos los packs incluyen archivos vectoriales totalmente editables.' },
      { q: '¿Puedo usarlos comercialmente?', a: 'Sí, la licencia incluida permite uso comercial. Revisa los términos de uso para más detalles.' },
      { q: '¿En qué programas puedo abrir los archivos?', a: 'Los archivos vectoriales son compatibles con programas de edición como Illustrator, Inkscape o CorelDRAW; también se incluyen versiones PNG.' }
    ],
    otros: [
      { q: '¿Cómo descargo el producto?', a: 'El enlace de descarga queda disponible en tu cuenta, en la sección "Mis productos", después de confirmarse el pago.' },
      { q: '¿Los archivos tienen actualizaciones?', a: 'Cuando corresponda, las actualizaciones se anuncian en tu cuenta y por correo electrónico.' },
      { q: '¿Puedo pedir soporte?', a: 'Sí, escríbenos a soporte@leunamesoftware.com ante cualquier duda.' }
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
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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

  // Arte visual "de producto" genérica por categoría (sin fotos), reutilizada
  // en las tarjetas de producto y en la galería de la página de detalle.
  function productVisualHTML(product) {
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

  function productCardHTML(product) {
    var priceComment = '<!-- PRECIO DE EJEMPLO: reemplazar por el precio real -->';
    return (
      '<article class="product-card">' +
        '<a class="product-card-media" href="producto.html?id=' + product.id + '">' +
          productVisualHTML(product) +
          (product.real ? '<span class="product-real-badge">Producto real</span>' : '') +
        '</a>' +
        '<div class="product-card-body">' +
          '<a class="product-card-name" href="producto.html?id=' + product.id + '">' + product.name + '</a>' +
          '<div class="product-card-rating">' +
            '<span class="stars">' + starsHTML(product.rating) + '</span>' +
            '<span class="rating-num">' + product.rating.toFixed(1) + '</span>' +
            '<span class="rating-count">(' + product.reviews + ')</span>' +
          '</div>' +
          priceComment +
          '<p class="product-card-price">' + formatPrice(product.price) + '</p>' +
          '<a class="btn btn-outline-block" href="producto.html?id=' + product.id + '">Ver producto</a>' +
        '</div>' +
      '</article>'
    );
  }

  function categoryCardHTML(cat) {
    return (
      '<a class="cat-card" href="categoria.html?slug=' + cat.slug + '">' +
        '<span class="cat-ic cat-ic-' + cat.color + '">' + cat.icon + '</span>' +
        '<span class="cat-card-name">' + cat.name + '</span>' +
        '<span class="cat-card-link">Ver productos →</span>' +
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
      : '<p class="cat-empty">No hay productos para mostrar todavía.</p>';
  }

  global.LeuStore = {
    CATEGORIES: CATEGORIES,
    PRODUCTS: PRODUCTS,
    FAQS_BY_CATEGORY: FAQS_BY_CATEGORY,
    getCategory: getCategory,
    getProduct: getProduct,
    getProductsByCategory: getProductsByCategory,
    formatPrice: formatPrice,
    starsHTML: starsHTML,
    productVisualHTML: productVisualHTML,
    productCardHTML: productCardHTML,
    categoryCardHTML: categoryCardHTML,
    mountCategoryGrid: mountCategoryGrid,
    mountProductGrid: mountProductGrid
  };
})(window);
