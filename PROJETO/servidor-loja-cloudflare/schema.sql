-- Banco da loja LeuName Softwares (Cloudflare D1)
-- Serve o backend do site SITE-LEUNAMESOFTWARE/ (catalogo publico +
-- registro de pedidos). O pagamento real (Stripe) NAO acontece aqui —
-- este banco apenas guarda o catalogo e os pedidos criados apos o
-- checkout, para uso futuro do painel administrativo.

CREATE TABLE IF NOT EXISTS productos (
  id TEXT PRIMARY KEY,              -- slug, ex: 'leuname-gestao'
  nombre TEXT NOT NULL,             -- nome do site em espanhol (.com)
  nombre_br TEXT,                   -- nome do site brasileiro (.com.br), em português. NULL = ainda não tem texto próprio pro Brasil
  categoria TEXT NOT NULL,          -- aplicaciones | templates | libros | recetas | diseno | otros
  descripcion_corta TEXT,           -- descrição curta do site .com, em espanhol
  descripcion_corta_br TEXT,        -- descrição curta do site .com.br, em português
  descripcion TEXT,                 -- descrição longa do site .com, em espanhol
  descripcion_br TEXT,              -- descrição longa do site .com.br, em português
  precio REAL NOT NULL,             -- preço do site em espanhol (.com), em EUR. PRECIO DE EJEMPLO en los productos que no son reales
  precio_br REAL,                   -- preço do site brasileiro (.com.br), em BRL. NULL = ainda não tem preço próprio pro Brasil (o site BR não usa "precio" como fallback de valor)
  real INTEGER NOT NULL DEFAULT 0,  -- 1 = producto real de la empresa, 0 = ejemplo de catalogo
  rating REAL NOT NULL DEFAULT 4.5,
  reviews INTEGER NOT NULL DEFAULT 0,
  incluye TEXT,                     -- JSON array de strings, site .com (espanhol)
  incluye_br TEXT,                  -- JSON array de strings, site .com.br (português)
  caracteristicas TEXT,             -- JSON array de strings, site .com (espanhol)
  caracteristicas_br TEXT,          -- JSON array de strings, site .com.br (português)
  imagen_url TEXT,                  -- URL publica de la imagen real (subida via el panel admin a R2)
  demo_url TEXT,                    -- URL de la pagina/video de demo del producto (opcional)
  tag TEXT,                         -- etiqueta editorial opcional: 'novedad' | 'recomendado'
  activo INTEGER NOT NULL DEFAULT 1,
  creado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  email TEXT NOT NULL UNIQUE,
  telefono TEXT,
  pais TEXT,
  creado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pedidos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cliente_nombre TEXT,
  cliente_email TEXT,
  cliente_telefono TEXT,
  cliente_pais TEXT,
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | pagado | cancelado
  stripe_session_id TEXT,                   -- id de la Checkout Session de Stripe
  chave_licencia TEXT,                      -- licencia real generada tras el pago (solo leuname-gestao)
  cupon_usado_codigo TEXT,                  -- codigo del cupon aplicado a este pedido (si tenia uno)
  cupon_usado_descuento REAL,               -- monto real descontado por ese cupon
  creado_em TEXT NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- Cupones de descuento para "la proxima compra": se generan automaticamente
-- cuando un pedido se paga de verdad (webhook checkout.session.completed) y
-- se reconocen automaticamente por email en el checkout siguiente -- el
-- cliente NO escribe ningun codigo, el sistema lo aplica solo.
CREATE TABLE IF NOT EXISTS cupones (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  cliente_email TEXT NOT NULL,
  porcentaje INTEGER NOT NULL,
  usado INTEGER NOT NULL DEFAULT 0,
  pedido_origem_id TEXT,                    -- pedido que genero este cupon de regalo
  pedido_uso_id TEXT,                       -- pedido donde este cupon fue gastado
  creado_em TEXT NOT NULL,
  usado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_cupones_email_usado ON cupones(cliente_email, usado);

-- Una fila por cada licencia generada para un pedido. Un pedido puede
-- tener varias: productos distintos con licencia propia, o mas de una
-- unidad del mismo producto (cada unidad = una licencia separada).
CREATE TABLE IF NOT EXISTS pedido_licencas (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  nombre_producto TEXT NOT NULL,
  chave_licencia TEXT NOT NULL,
  creado_em TEXT NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
);
CREATE INDEX IF NOT EXISTS idx_pedido_licencas_pedido ON pedido_licencas(pedido_id);

-- Registro de eventos de webhook de Stripe ya procesados, para evitar
-- procesar el mismo evento dos veces si Stripe reintenta la entrega.
CREATE TABLE IF NOT EXISTS webhook_eventos (
  id TEXT PRIMARY KEY,
  procesado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pedido_items (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  nombre_producto TEXT NOT NULL,   -- snapshot: nombre del producto al momento del pedido
  precio_unitario REAL NOT NULL,   -- snapshot: precio al momento del pedido
  cantidad INTEGER NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_stripe_session ON pedidos(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);

-- Catalogo inicial: espejo de js/products.js en el sitio (SITE-LEUNAMESOFTWARE/js/products.js).
-- Solo 'leuname-gestao' es un producto real; el resto son ejemplos claramente
-- marcados con real = 0, pensados para que la vitrine de la tienda luzca completa.
INSERT OR IGNORE INTO productos (id, nombre, categoria, descripcion_corta, descripcion, precio, real, rating, reviews, incluye, caracteristicas, activo, creado_em) VALUES
('leuname-gestao', 'LeuName Gestão', 'aplicaciones', 'Sistema completo de gestión para tiendas de celulares, accesorios y asistencia técnica.', 'LeuName Gestão es un sistema completo de gestión pensado para tiendas de celulares, accesorios y asistencia técnica. Controla ventas, stock, clientes, órdenes de servicio y finanzas desde un solo lugar. Funciona 100% offline y sincroniza entre tus dispositivos.', 29.90, 1, 4.8, 34, '["Licencia de uso para 1 tienda","Aplicación para Android y Windows","Sincronización entre tus dispositivos","Actualizaciones incluidas","Soporte especializado"]', '["Control de ventas y caja diaria","Gestión de stock y productos","Órdenes de servicio técnico","Ficha de clientes","Reportes financieros","Funciona 100% offline"]', 1, datetime('now')),
('sistema-inventario', 'Sistema de Inventario para Supermercados', 'aplicaciones', 'Control de stock, entradas, salidas y alertas de reposición para supermercados.', 'Ejemplo de producto: sistema de control de inventario para supermercados y minimercados.', 39.90, 0, 4.5, 21, '["Licencia de uso","Manual de instalación","Actualizaciones por 12 meses"]', '["Control de entradas y salidas","Alertas de stock mínimo","Códigos de barra","Reportes de rotación"]', 1, datetime('now')),
('sistema-punto-venta', 'Sistema de Punto de Venta (PDV)', 'aplicaciones', 'Punto de venta rápido con emisión de recibos y control de caja.', 'Ejemplo de producto: sistema de punto de venta (PDV) rápido con control de caja por turno.', 44.90, 0, 4.6, 18, '["Licencia de uso","Guía rápida de configuración"]', '["Emisión de recibos","Control de caja por turno","Múltiples usuarios","Historial de ventas"]', 1, datetime('now')),
('template-agencia-viajes', 'Template Agencia de Viajes', 'templates', 'Sitio web listo para usar, ideal para agencias de viajes y turismo.', 'Ejemplo de producto: template responsivo para agencias de viajes.', 19.90, 0, 4.7, 42, '["Archivos HTML/CSS/JS","Documentación de instalación","Licencia de uso único"]', '["100% responsivo","Fácil de personalizar","Optimizado para velocidad","Compatible con navegadores principales"]', 1, datetime('now')),
('template-portfolio-creativo', 'Template Portfolio Creativo', 'templates', 'Portfolio moderno para diseñadores, fotógrafos y creativos.', 'Ejemplo de producto: template de portfolio moderno y minimalista.', 16.90, 0, 4.8, 37, '["Archivos HTML/CSS/JS","Documentación de instalación","Licencia de uso único"]', '["Galería de proyectos","Animaciones suaves","100% responsivo","Fácil de personalizar"]', 1, datetime('now')),
('template-tienda-online', 'Template Tienda Online', 'templates', 'Base lista para montar tu propia tienda online.', 'Ejemplo de producto: template de tienda online listo para personalizar.', 24.90, 0, 4.6, 29, '["Archivos HTML/CSS/JS","Documentación de instalación","Licencia de uso único"]', '["Catálogo de productos","Carrito de compras","Diseño responsivo","Fácil de personalizar"]', 1, datetime('now')),
('pack-logos-profesionales', 'Pack de Logos Profesionales', 'diseno', 'Colección de logotipos editables para distintos rubros.', 'Ejemplo de producto: colección de logotipos profesionales y editables.', 14.90, 0, 4.4, 53, '["Archivos vectoriales editables","Versiones en PNG y SVG","Licencia de uso comercial"]', '["Totalmente editables","Formatos vectoriales","Variedad de estilos","Uso comercial permitido"]', 1, datetime('now')),
('logo-pack-minimalista', 'Pack de Logos Minimalistas', 'diseno', 'Logotipos de estilo minimalista para marcas modernas.', 'Ejemplo de producto: pack de logotipos de estilo minimalista.', 12.90, 0, 4.5, 31, '["Archivos vectoriales editables","Versiones en PNG y SVG","Licencia de uso comercial"]', '["Estilo minimalista","Totalmente editables","Formatos vectoriales","Uso comercial permitido"]', 1, datetime('now')),
('ebook-finanzas-personales', 'E-book: Finanzas Personales', 'libros', 'Guía práctica para organizar tus finanzas y empezar a ahorrar.', 'Ejemplo de producto: e-book práctico de organización financiera personal.', 9.90, 0, 4.6, 64, '["Archivo PDF","Plantilla de presupuesto de regalo"]', '["Lenguaje sencillo","Ejercicios prácticos","Formato PDF descargable"]', 1, datetime('now')),
('ebook-productividad', 'E-book: Productividad Diaria', 'libros', 'Técnicas simples para organizar tu tiempo y tus tareas diarias.', 'Ejemplo de producto: e-book de técnicas de organización personal.', 8.90, 0, 4.3, 27, '["Archivo PDF","Checklist imprimible de regalo"]', '["Lenguaje sencillo","Técnicas aplicables","Formato PDF descargable"]', 1, datetime('now')),
('recetas-italia', 'Recetas de Italia (207 recetas)', 'recetas', 'Colección de 207 recetas tradicionales de la cocina italiana.', 'Ejemplo de producto: colección digital con 207 recetas tradicionales italianas.', 7.90, 0, 4.9, 88, '["Archivo PDF","207 recetas ilustradas","Índice por categorías"]', '["207 recetas","Paso a paso detallado","Formato PDF descargable"]', 1, datetime('now')),
('recetas-reposteria', 'Recetas de Repostería Casera', 'recetas', 'Recetas dulces fáciles de preparar en casa.', 'Ejemplo de producto: colección de recetas de repostería casera.', 6.90, 0, 4.7, 45, '["Archivo PDF","Recetas ilustradas","Índice por categorías"]', '["Recetas fáciles","Paso a paso detallado","Formato PDF descargable"]', 1, datetime('now')),
('kit-iconos-otros', 'Kit de Iconos y Recursos Gráficos', 'otros', 'Conjunto de iconos vectoriales para proyectos digitales.', 'Ejemplo de producto: kit de iconos vectoriales editables.', 11.90, 0, 4.4, 22, '["Archivos SVG y PNG","Licencia de uso comercial"]', '["Más de 100 iconos","Formatos vectoriales","Uso comercial permitido"]', 1, datetime('now')),
('plantillas-excel-negocios', 'Plantillas de Excel para Negocios', 'otros', 'Plantillas listas para control financiero, ventas y stock en Excel.', 'Ejemplo de producto: plantillas de Excel/Sheets para control financiero básico.', 13.90, 0, 4.5, 19, '["Archivos XLSX","Guía de uso en PDF"]', '["Listas para usar","Compatible con Excel y Sheets","Fórmulas ya configuradas"]', 1, datetime('now'));
