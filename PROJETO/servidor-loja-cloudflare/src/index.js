// Servidor da loja LeuName Softwares — Cloudflare Worker + D1.
// Serve o catalogo publico (SITE-LEUNAMESOFTWARE/js/api.js consome
// GET /productos com fallback para dados estaticos se este Worker
// nao responder) e registra pedidos apos o checkout (SEM processar
// pagamento — isso acontece futuramente com Stripe, no front-end).
//
// Segue o mesmo padrao do servidor de licencas
// (PROJETO/servidor-licencas-cloudflare/src/index.js): rotas publicas
// simples + rotas /admin/* protegidas por "Authorization: Bearer
// <ADMIN_TOKEN>" (o MESMO segredo ADMIN_TOKEN do outro Worker).

// Produtos do catalogo que tem sistema de licenca de verdade, mapeados
// pro app_id correspondente no servidor de licencas. Cada UNIDADE
// comprada gera uma licenca propria e separada (se o cliente comprar
// 2 do mesmo produto, ou produtos diferentes com licenca, cada um
// recebe seu proprio codigo -- nunca uma licenca unica compartilhada).
const PRODUTOS_COM_LICENCA = {
  'leuname-gestao': 'leuname-gestao',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
  });
}

function autenticado(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

async function listarProductos(env, { soloActivos = true } = {}) {
  const stmt = soloActivos
    ? env.DB.prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY categoria, nombre')
    : env.DB.prepare('SELECT * FROM productos ORDER BY categoria, nombre');
  const { results } = await stmt.all();
  return results;
}

// Busca un cupon de "proxima compra" activo (no usado) para un email.
// El cliente nunca escribe un codigo: el sistema lo reconoce solo por el
// email que puso en el checkout.
async function buscarCuponActivo(env, email) {
  if (!email) return null;
  return env.DB.prepare('SELECT id, codigo, porcentaje FROM cupones WHERE LOWER(cliente_email) = LOWER(?) AND usado = 0 ORDER BY creado_em DESC LIMIT 1')
    .bind(email.trim()).first();
}

// Valida el carrito contra el catalogo real (precios SIEMPRE del
// servidor, nunca del cuerpo de la peticion) y crea el pedido +
// pedido_items en estado 'pendiente'. Usado tanto por POST /pedidos
// (registro simple, sin pago) como por POST /checkout/session (que
// ademas crea la sesion de pago real en Stripe). Si el email del
// cliente tiene un cupon de proxima compra activo, se aplica solo.
async function crearPedidoDesdeCarrito(env, body) {
  if (!body || !body.cliente || !body.cliente.email || !Array.isArray(body.items) || !body.items.length) {
    return { erro: 'datos_invalidos' };
  }

  const itemsConPrecio = [];
  for (const item of body.items.slice(0, 50)) {
    if (!item || !item.id) continue;
    const producto = await env.DB.prepare('SELECT id, nombre, precio FROM productos WHERE id = ? AND activo = 1')
      .bind(item.id).first();
    if (!producto) continue;
    const cantidad = Math.max(1, Math.min(99, parseInt(item.qty, 10) || 1));
    itemsConPrecio.push({ producto, cantidad });
  }
  if (!itemsConPrecio.length) return { erro: 'sin_items_validos' };

  const subtotal = itemsConPrecio.reduce((sum, i) => sum + i.producto.precio * i.cantidad, 0);

  const cupon = await buscarCuponActivo(env, body.cliente.email);
  const descuento = cupon ? Math.round(subtotal * (cupon.porcentaje / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal - descuento) * 100) / 100;

  const clienteExistente = await env.DB.prepare('SELECT id FROM clientes WHERE email = ?')
    .bind(body.cliente.email).first();
  const clienteId = clienteExistente ? clienteExistente.id : crypto.randomUUID();
  if (!clienteExistente) {
    await env.DB.prepare(
      'INSERT INTO clientes (id, nombre, email, telefono, pais, creado_em) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
    ).bind(clienteId, body.cliente.nombre || null, body.cliente.email, body.cliente.telefono || null, body.cliente.pais || null).run();
  }

  const pedidoId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO pedidos (id, cliente_id, cliente_nombre, cliente_email, cliente_telefono, cliente_pais, subtotal, total, cupon_usado_codigo, cupon_usado_descuento, estado, creado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', datetime('now'))`
  ).bind(pedidoId, clienteId, body.cliente.nombre || null, body.cliente.email, body.cliente.telefono || null, body.cliente.pais || null, subtotal, total, cupon ? cupon.codigo : null, cupon ? descuento : null).run();

  const batch = itemsConPrecio.map((i) =>
    env.DB.prepare(
      'INSERT INTO pedido_items (id, pedido_id, producto_id, nombre_producto, precio_unitario, cantidad) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), pedidoId, i.producto.id, i.producto.nombre, i.producto.precio, i.cantidad)
  );
  await env.DB.batch(batch);

  return {
    pedidoId, itemsConPrecio, subtotal, total,
    clienteEmail: body.cliente.email, clienteNombre: body.cliente.nombre || null,
    cupon: cupon ? { id: cupon.id, codigo: cupon.codigo, porcentaje: cupon.porcentaje, descuento } : null,
  };
}

// ---- integracion con la API de Stripe (via fetch directo, sin SDK —
// el SDK oficial de Stripe no es compatible con el runtime de Workers) ----

function aplanarParametrosStripe(obj, params, prefijo) {
  for (const [clave, valor] of Object.entries(obj)) {
    const key = prefijo ? `${prefijo}[${clave}]` : clave;
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => {
        if (item && typeof item === 'object') aplanarParametrosStripe(item, params, `${key}[${i}]`);
        else params.append(`${key}[${i}]`, item);
      });
    } else if (valor && typeof valor === 'object') {
      aplanarParametrosStripe(valor, params, key);
    } else if (valor !== undefined && valor !== null) {
      params.append(key, valor);
    }
  }
}

async function stripeApi(env, path, datos) {
  const params = new URLSearchParams();
  aplanarParametrosStripe(datos, params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data && data.error && data.error.message) || 'error_desconocido_stripe');
  }
  return data;
}

// Verifica la firma de un webhook de Stripe (algoritmo HMAC-SHA256
// documentado por Stripe), usando Web Crypto — no hay SDK de Stripe
// disponible en el runtime de Workers.
async function verificarFirmaStripe(payloadCrudo, headerFirma, secreto) {
  if (!headerFirma) return false;
  const partes = Object.fromEntries(
    headerFirma.split(',').map((p) => {
      const idx = p.indexOf('=');
      return [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const timestamp = partes.t;
  const firmaEsperada = partes.v1;
  if (!timestamp || !firmaEsperada) return false;

  const payloadFirmado = `${timestamp}.${payloadCrudo}`;
  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(payloadFirmado));
  const hexCalculado = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');

  if (hexCalculado.length !== firmaEsperada.length) return false;
  let diff = 0;
  for (let i = 0; i < hexCalculado.length; i++) diff |= hexCalculado.charCodeAt(i) ^ firmaEsperada.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') return json({});

    if (pathname === '/health') {
      return json({ ok: true, servico: 'leuname-loja' });
    }

    // ---- catalogo publico ----

    if (pathname === '/productos' && request.method === 'GET') {
      const productos = await listarProductos(env);
      return json({ ok: true, productos });
    }

    const productoMatch = pathname.match(/^\/productos\/([a-z0-9-]+)$/);
    if (productoMatch && request.method === 'GET') {
      const producto = await env.DB.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1')
        .bind(productoMatch[1]).first();
      if (!producto) return json({ ok: false, erro: 'producto_no_encontrado' }, 404);
      return json({ ok: true, producto });
    }

    // GET /config?site=br|es — configuração editável do site (logo,
    // banners da home, WhatsApp). Sem linha salva ainda (site novo, nunca
    // editado pelo admin) devolve config: null e o site mantém o
    // conteúdo estático que já vem no HTML.
    if (pathname === '/config' && request.method === 'GET') {
      const site = url.searchParams.get('site');
      if (site !== 'br' && site !== 'es') return json({ ok: false, erro: 'site_invalido' }, 400);
      const config = await env.DB.prepare('SELECT * FROM site_config WHERE site = ?').bind(site).first();
      return json({ ok: true, config: config || null });
    }

    // GET /imagen/productos/<archivo> — sirve la imagen real de un producto,
    // subida por el panel admin (ver POST /admin/productos/:id/imagen). La
    // URL que se guarda en imagen_url ahora siempre trae ?v=<timestamp> (ver
    // abajo), asi que con version presente el cache puede ser larguisimo
    // (esa URL exacta nunca cambia); sin version (URLs antiguas guardadas
    // antes de este cambio) el cache queda corto, para no quedar pegado
    // en una imagen vieja despues de resubir.
    if (pathname.startsWith('/imagen/') && request.method === 'GET') {
      const clave = pathname.replace('/imagen/', '');
      const obj = await env.IMAGENES.get(clave);
      if (!obj) return new Response('Imagen no encontrada.', { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('Cache-Control', url.searchParams.has('v')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(obj.body, { headers });
    }

    // POST /pedidos — crea un pedido a partir del carrito, SIN procesar pago.
    // Se mantiene por compatibilidad/pruebas; el checkout real de la tienda
    // usa POST /checkout/session (abajo), que ademas crea el cobro en Stripe.
    // Body: { cliente: { nombre, email, telefono, pais }, items: [{ id, qty }] }
    if (pathname === '/pedidos' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const resultado = await crearPedidoDesdeCarrito(env, body);
      if (resultado.erro) return json({ ok: false, erro: resultado.erro }, 400);
      return json({ ok: true, pedido_id: resultado.pedidoId, estado: 'pendiente', subtotal: resultado.subtotal, total: resultado.subtotal });
    }

    // POST /checkout/session — crea el pedido (precios siempre del
    // servidor) y, con eso, una Stripe Checkout Session real. Devuelve la
    // URL de pago de Stripe a la que el front-end debe redirigir al
    // cliente. Ningun pago se marca como realizado aqui — eso solo ocurre
    // cuando Stripe confirma el pago via webhook (ver /webhook/stripe).
    if (pathname === '/checkout/session' && request.method === 'POST') {
      if (!env.STRIPE_SECRET_KEY) {
        return json({ ok: false, erro: 'stripe_no_configurado' }, 503);
      }

      const body = await request.json().catch(() => null);
      const resultado = await crearPedidoDesdeCarrito(env, body);
      if (resultado.erro) return json({ ok: false, erro: resultado.erro }, 400);
      const { pedidoId, itemsConPrecio, clienteEmail, cupon } = resultado;

      const siteUrl = (env.SITE_URL || 'https://leuname-site.emanuelantunes2024.workers.dev').replace(/\/$/, '');

      // Si el email tiene un cupon de "proxima compra" activo, se crea un
      // Stripe Coupon real (de un solo uso, valido solo en esta sesion) y
      // se aplica automaticamente -- el cliente no escribe ningun codigo.
      let discounts;
      if (cupon) {
        try {
          const stripeCoupon = await stripeApi(env, '/coupons', {
            percent_off: cupon.porcentaje,
            duration: 'once',
            name: `Cupón LeuName ${cupon.porcentaje}% (${cupon.codigo})`,
          });
          discounts = [{ coupon: stripeCoupon.id }];
        } catch (e) {
          // Si Stripe fallara al crear el cupon, seguimos sin descuento en
          // vez de bloquear la compra -- el pedido ya se guardo sin cupon.
          discounts = undefined;
        }
      }

      let session;
      try {
        session = await stripeApi(env, '/checkout/sessions', {
          mode: 'payment',
          payment_method_types: ['card'],
          customer_email: clienteEmail,
          // Propaga o pedido_id ate o Charge (a Stripe NAO copia metadata da
          // Checkout Session pro PaymentIntent/Charge sozinha) -- necessario
          // pro webhook de estorno (charge.refunded) saber qual pedido revogar.
          payment_intent_data: { metadata: { pedido_id: pedidoId } },
          line_items: itemsConPrecio.map((i) => ({
            quantity: i.cantidad,
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(i.producto.precio * 100),
              product_data: { name: i.producto.nombre },
            },
          })),
          discounts,
          success_url: `${siteUrl}/confirmacion.html?pedido=${pedidoId}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/checkout.html?cancelado=1`,
          metadata: { pedido_id: pedidoId },
        });
      } catch (e) {
        return json({ ok: false, erro: 'stripe_fallo', detalle: String((e && e.message) || e) }, 502);
      }

      await env.DB.prepare('UPDATE pedidos SET stripe_session_id = ? WHERE id = ?').bind(session.id, pedidoId).run();
      return json({ ok: true, url: session.url, pedido_id: pedidoId });
    }

    // GET /pedidos/:id?session_id=... — consulta publica y limitada del
    // estado de UN pedido especifico. Solo responde si el session_id de
    // Stripe coincide con el guardado (nadie mas conoce ese id salvo quien
    // completo el pago), asi la pagina de confirmacion puede mostrar el
    // estado real sin exponer el panel administrativo completo.
    const pedidoPublicoMatch = pathname.match(/^\/pedidos\/([a-z0-9-]+)$/);
    if (pedidoPublicoMatch && request.method === 'GET') {
      const sessionId = url.searchParams.get('session_id') || '';
      const pedido = await env.DB.prepare(
        'SELECT id, estado, total, cliente_email, chave_licencia, stripe_session_id, cupon_usado_codigo, cupon_usado_descuento FROM pedidos WHERE id = ?'
      ).bind(pedidoPublicoMatch[1]).first();
      if (!pedido || !sessionId || pedido.stripe_session_id !== sessionId) {
        return json({ ok: false, erro: 'pedido_no_encontrado' }, 404);
      }
      const { results: items } = await env.DB.prepare(
        'SELECT producto_id, nombre_producto, cantidad FROM pedido_items WHERE pedido_id = ?'
      ).bind(pedido.id).all();
      // Una fila por cada licencia generada para este pedido (puede ser
      // mas de una: productos distintos con licencia, o mas de una unidad
      // del mismo producto).
      const { results: licencas } = await env.DB.prepare(
        'SELECT producto_id, nombre_producto, chave_licencia FROM pedido_licencas WHERE pedido_id = ? ORDER BY creado_em'
      ).bind(pedido.id).all();
      // Cupon de regalo ganado con ESTA compra (para la proxima) — solo
      // existe despues de que el webhook procese el pago.
      const cuponGanado = await env.DB.prepare(
        'SELECT codigo, porcentaje FROM cupones WHERE pedido_origem_id = ?'
      ).bind(pedido.id).first();
      return json({
        ok: true,
        pedido: {
          id: pedido.id,
          estado: pedido.estado,
          total: pedido.total,
          email: pedido.cliente_email,
          chave_licencia: pedido.chave_licencia || null,
          licencas,
          cupon_usado: pedido.cupon_usado_codigo ? { codigo: pedido.cupon_usado_codigo, descuento: pedido.cupon_usado_descuento } : null,
          cupon_ganado: cuponGanado || null,
        },
        items,
      });
    }

    // GET /cupones/verificar?email=... — consulta publica: dice si ese
    // email tiene un cupon de "proxima compra" activo, sin exponer nada
    // mas. Usado por el checkout para mostrar el descuento automaticamente
    // apenas el cliente escribe su correo (antes de pagar).
    if (pathname === '/cupones/verificar' && request.method === 'GET') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email) return json({ ok: true, cupon: null });
      const cupon = await buscarCuponActivo(env, email);
      return json({ ok: true, cupon: cupon ? { codigo: cupon.codigo, porcentaje: cupon.porcentaje } : null });
    }

    // POST /webhook/stripe — Stripe llama a esta ruta cuando el pago se
    // confirma de verdad. Es la UNICA fuente de verdad para marcar un
    // pedido como pagado (el front-end nunca puede hacerlo por si solo).
    if (pathname === '/webhook/stripe' && request.method === 'POST') {
      if (!env.STRIPE_WEBHOOK_SECRET) {
        return json({ ok: false, erro: 'webhook_no_configurado' }, 503);
      }
      const firma = request.headers.get('Stripe-Signature') || '';
      const payloadCrudo = await request.text();
      const valido = await verificarFirmaStripe(payloadCrudo, firma, env.STRIPE_WEBHOOK_SECRET);
      if (!valido) return json({ ok: false, erro: 'firma_invalida' }, 400);

      const evento = JSON.parse(payloadCrudo);

      // idempotencia: Stripe puede reintentar el mismo evento varias veces
      const yaProcesado = await env.DB.prepare('SELECT id FROM webhook_eventos WHERE id = ?').bind(evento.id).first();
      if (yaProcesado) return json({ ok: true, duplicado: true });
      await env.DB.prepare('INSERT INTO webhook_eventos (id, procesado_em) VALUES (?, datetime(\'now\'))').bind(evento.id).run();

      if (evento.type === 'checkout.session.completed') {
        const session = evento.data.object;
        const pedidoId = session.metadata && session.metadata.pedido_id;
        if (pedidoId) {
          await env.DB.prepare("UPDATE pedidos SET estado = 'pagado' WHERE id = ?").bind(pedidoId).run();

          // Cupon de "proxima compra": se marca como gastado el que se haya
          // usado en este pedido, y se genera uno nuevo de regalo (10% de
          // descuento) para el mismo email -- se reconoce solo, sin que el
          // cliente tenga que escribir ningun codigo la proxima vez.
          const pedidoCupon = await env.DB.prepare(
            'SELECT cliente_email, cupon_usado_codigo FROM pedidos WHERE id = ?'
          ).bind(pedidoId).first();
          if (pedidoCupon) {
            if (pedidoCupon.cupon_usado_codigo) {
              await env.DB.prepare(
                "UPDATE cupones SET usado = 1, pedido_uso_id = ?, usado_em = datetime('now') WHERE codigo = ?"
              ).bind(pedidoId, pedidoCupon.cupon_usado_codigo).run();
            }
            if (pedidoCupon.cliente_email) {
              const codigo = `LEU10-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
              await env.DB.prepare(
                `INSERT INTO cupones (id, codigo, cliente_email, porcentaje, usado, pedido_origem_id, creado_em)
                 VALUES (?, ?, ?, 10, 0, ?, datetime('now'))`
              ).bind(crypto.randomUUID(), codigo, pedidoCupon.cliente_email, pedidoId).run();
            }
          }

          const { results: items } = await env.DB.prepare(
            'SELECT producto_id, nombre_producto, cantidad FROM pedido_items WHERE pedido_id = ?'
          ).bind(pedidoId).all();

          // Genera UNA licencia por cada unidad de cada producto que tenga
          // sistema de licencia (PRODUTOS_COM_LICENCA) -- si el pedido
          // tiene 2 productos con licencia, o 2 unidades del mismo, salen
          // 2 codigos distintos, cada uno guardado en pedido_licencas.
          if (env.ADMIN_TOKEN) {
            const pedido = await env.DB.prepare(
              'SELECT cliente_nombre, cliente_email FROM pedidos WHERE id = ?'
            ).bind(pedidoId).first();

            for (const item of items) {
              const appId = PRODUTOS_COM_LICENCA[item.producto_id];
              if (!appId) continue;
              for (let unidad = 0; unidad < item.cantidad; unidad++) {
                try {
                  const res = await fetch('https://api.leunamesoftware.com/admin/licencas/gerar', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${env.ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      app_id: appId,
                      cliente_nome: pedido.cliente_nombre,
                      cliente_contato: pedido.cliente_email,
                      origem: 'loja-stripe',
                    }),
                  });
                  const data = await res.json();
                  if (data && data.ok && data.chave) {
                    await env.DB.prepare(
                      `INSERT INTO pedido_licencas (id, pedido_id, producto_id, nombre_producto, chave_licencia, creado_em)
                       VALUES (?, ?, ?, ?, ?, datetime('now'))`
                    ).bind(crypto.randomUUID(), pedidoId, item.producto_id, item.nombre_producto, data.chave).run();
                    // Mantiene compatibilidad con pedidos.chave_licencia
                    // (uso historico): guarda ahi la primera licencia generada.
                    await env.DB.prepare('UPDATE pedidos SET chave_licencia = COALESCE(chave_licencia, ?) WHERE id = ?').bind(data.chave, pedidoId).run();
                  }
                } catch (e) {
                  // No bloquea el webhook: el pedido ya quedo 'pagado' en la base.
                  // Si esto falla, la licencia se puede generar manualmente
                  // despues desde el panel del servidor de licencias.
                }
              }
            }
          }
        }
      }

      // charge.refunded — dispara sempre que uma cobranca e reembolsada
      // (total ou parcial). So tratamos como cancelamento quando o
      // reembolso foi TOTAL (charge.refunded===true); um reembolso parcial
      // (ex: cortesia) nao revoga a licenca automaticamente.
      if (evento.type === 'charge.refunded') {
        const charge = evento.data.object;
        const pedidoId = charge.metadata && charge.metadata.pedido_id;
        if (pedidoId && charge.refunded === true) {
          await env.DB.prepare("UPDATE pedidos SET estado = 'reembolsado' WHERE id = ?").bind(pedidoId).run();
          const pedido = await env.DB.prepare('SELECT chave_licencia FROM pedidos WHERE id = ?').bind(pedidoId).first();
          if (pedido && pedido.chave_licencia && env.ADMIN_TOKEN) {
            try {
              await fetch('https://api.leunamesoftware.com/admin/licencas/revogar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ chave: pedido.chave_licencia }),
              });
            } catch (e) {
              // Nao bloqueia o webhook: o pedido ja ficou 'reembolsado'.
              // Se isso falhar, a licenca pode ser revogada manualmente
              // depois pelo painel admin-licencas.
            }
          }
        }
      }

      return json({ ok: true });
    }

    // ---- rotas administrativas (exigem Authorization: Bearer <ADMIN_TOKEN>) ----
    if (pathname.startsWith('/admin/')) {
      if (!autenticado(request, env)) {
        return json({ ok: false, erro: 'nao_autorizado' }, 401);
      }

      if (pathname === '/admin/productos' && request.method === 'GET') {
        const productos = await listarProductos(env, { soloActivos: false });
        return json({ ok: true, productos });
      }

      if (pathname === '/admin/productos' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body || !body.id || !body.categoria || (!body.nombre && !body.nombre_br) || (body.precio == null && body.precio_br == null)) {
          return json({ ok: false, erro: 'datos_invalidos' }, 400);
        }
        await env.DB.prepare(
          `INSERT INTO productos (id, nombre, nombre_br, categoria, descripcion_corta, descripcion_corta_br, descripcion, descripcion_br, precio, precio_br, real, rating, reviews, incluye, incluye_br, caracteristicas, caracteristicas_br, imagen_url, video_url, galeria_fotos, demo_url, tag, activo, creado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`
        ).bind(
          body.id, body.nombre || body.nombre_br, body.nombre_br || null, body.categoria,
          body.descripcion_corta || '', body.descripcion_corta_br || null,
          body.descripcion || '', body.descripcion_br || null,
          Number(body.precio || 0), body.precio_br != null ? Number(body.precio_br) : null,
          body.real ? 1 : 0, Number(body.rating || 4.5), Number(body.reviews || 0),
          JSON.stringify(body.incluye || []), body.incluye_br ? JSON.stringify(body.incluye_br) : null,
          JSON.stringify(body.caracteristicas || []), body.caracteristicas_br ? JSON.stringify(body.caracteristicas_br) : null,
          body.imagen_url || null, body.video_url || null, body.galeria_fotos ? JSON.stringify(body.galeria_fotos) : null,
          body.demo_url || null, body.tag || null
        ).run();
        return json({ ok: true, id: body.id });
      }

      const adminProductoMatch = pathname.match(/^\/admin\/productos\/([a-z0-9-]+)$/);
      if (adminProductoMatch && request.method === 'PUT') {
        const id = adminProductoMatch[1];
        const body = await request.json().catch(() => null);
        if (!body) return json({ ok: false, erro: 'datos_invalidos' }, 400);
        // Todo campo de texto/preço tem uma versão .com (espanhol) e uma
        // versão _br (português), com COALESCE: o painel de cada site só
        // envia os campos do seu próprio idioma, então o texto/preço do
        // outro site nunca é sobrescrito (nem apagado) por um salvamento
        // feito no painel do outro idioma. Categoria, avaliação, imagem,
        // demo, tag e ativo continuam compartilhados (não são texto de
        // idioma, os dois painéis já enviam os mesmos valores).
        await env.DB.prepare(
          `UPDATE productos SET
             nombre=COALESCE(?, nombre), nombre_br=COALESCE(?, nombre_br),
             categoria=?,
             descripcion_corta=COALESCE(?, descripcion_corta), descripcion_corta_br=COALESCE(?, descripcion_corta_br),
             descripcion=COALESCE(?, descripcion), descripcion_br=COALESCE(?, descripcion_br),
             precio=COALESCE(?, precio), precio_br=COALESCE(?, precio_br),
             real=?, rating=?, reviews=?,
             incluye=COALESCE(?, incluye), incluye_br=COALESCE(?, incluye_br),
             caracteristicas=COALESCE(?, caracteristicas), caracteristicas_br=COALESCE(?, caracteristicas_br),
             imagen_url=?, video_url=?, galeria_fotos=?, demo_url=?, tag=?, activo=?
           WHERE id=?`
        ).bind(
          body.nombre || null, body.nombre_br || null,
          body.categoria,
          body.descripcion_corta || null, body.descripcion_corta_br || null,
          body.descripcion || null, body.descripcion_br || null,
          body.precio != null ? Number(body.precio) : null,
          body.precio_br != null ? Number(body.precio_br) : null,
          body.real ? 1 : 0, Number(body.rating || 4.5), Number(body.reviews || 0),
          body.incluye ? JSON.stringify(body.incluye) : null, body.incluye_br ? JSON.stringify(body.incluye_br) : null,
          body.caracteristicas ? JSON.stringify(body.caracteristicas) : null, body.caracteristicas_br ? JSON.stringify(body.caracteristicas_br) : null,
          body.imagen_url || null, body.video_url || null, body.galeria_fotos ? JSON.stringify(body.galeria_fotos) : null,
          body.demo_url || null, body.tag || null,
          body.activo === false ? 0 : 1, id
        ).run();
        return json({ ok: true, id });
      }

      if (adminProductoMatch && request.method === 'DELETE') {
        await env.DB.prepare('UPDATE productos SET activo = 0 WHERE id = ?').bind(adminProductoMatch[1]).run();
        return json({ ok: true, id: adminProductoMatch[1], eliminado_logico: true });
      }

      // POST /admin/productos/:id/imagen — sube la imagen real del producto
      // (body = el archivo crudo, con el Content-Type del archivo) a R2 y
      // guarda la URL publica resultante en productos.imagen_url.
      const imagenMatch = pathname.match(/^\/admin\/productos\/([a-z0-9-]+)\/imagen$/);
      if (imagenMatch && request.method === 'POST') {
        const id = imagenMatch[1];
        const producto = await env.DB.prepare('SELECT id FROM productos WHERE id = ?').bind(id).first();
        if (!producto) return json({ ok: false, erro: 'producto_no_encontrado' }, 404);

        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
        const extPorTipo = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
        const ext = extPorTipo[contentType];
        if (!ext) return json({ ok: false, erro: 'tipo_no_soportado', detalle: 'Usa JPG, PNG, WEBP o GIF.' }, 400);

        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > 5 * 1024 * 1024) return json({ ok: false, erro: 'archivo_muy_grande', detalle: 'Maximo 5MB.' }, 400);

        const clave = `productos/${id}.${ext}`;
        await env.IMAGENES.put(clave, bytes, { httpMetadata: { contentType } });

        // Este mismo Worker sirve la imagen en /imagen/<clave> (ver abajo).
        // ?v=<timestamp> es cache-busting: como la clave en R2 es siempre la
        // misma (productos/<id>.<ext>), sin esto el navegador y la red de
        // Cloudflare seguirian mostrando la imagen vieja despues de subir
        // una nueva -- cada subida ahora genera una URL distinta.
        const imagenUrl = `${url.origin}/imagen/${clave}?v=${Date.now()}`;
        await env.DB.prepare('UPDATE productos SET imagen_url = ? WHERE id = ?').bind(imagenUrl, id).run();
        return json({ ok: true, id, imagen_url: imagenUrl });
      }

      // PUT /admin/config — guarda os banners da home e o WhatsApp de um
      // site (body: { site: 'br'|'es', whatsapp_numero, banner_slides }).
      // logo_url não é enviado aqui (usa COALESCE): é setado só pelo
      // upload de logo abaixo, então salvar o resto do formulário nunca
      // apaga a logo já enviada.
      if (pathname === '/admin/config' && request.method === 'PUT') {
        const body = await request.json().catch(() => null);
        if (!body || (body.site !== 'br' && body.site !== 'es')) {
          return json({ ok: false, erro: 'datos_invalidos' }, 400);
        }
        await env.DB.prepare(
          `INSERT INTO site_config (site, whatsapp_numero, banner_slides, actualizado_em)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(site) DO UPDATE SET
             whatsapp_numero = excluded.whatsapp_numero,
             banner_slides = excluded.banner_slides,
             actualizado_em = excluded.actualizado_em`
        ).bind(
          body.site,
          body.whatsapp_numero || null,
          body.banner_slides ? JSON.stringify(body.banner_slides) : null
        ).run();
        return json({ ok: true });
      }

      // POST /admin/config/:site/logo — sobe a logo real de um site (mesmo
      // padrão da imagem de produto: R2 + URL versionada pra nunca ficar
      // presa em cache).
      const logoMatch = pathname.match(/^\/admin\/config\/(br|es)\/logo$/);
      if (logoMatch && request.method === 'POST') {
        const site = logoMatch[1];
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
        const extPorTipo = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
        const ext = extPorTipo[contentType];
        if (!ext) return json({ ok: false, erro: 'tipo_no_soportado', detalle: 'Usa JPG, PNG, WEBP o SVG.' }, 400);

        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > 2 * 1024 * 1024) return json({ ok: false, erro: 'archivo_muy_grande', detalle: 'Maximo 2MB.' }, 400);

        const clave = `logo/${site}.${ext}`;
        await env.IMAGENES.put(clave, bytes, { httpMetadata: { contentType } });
        const logoUrl = `${url.origin}/imagen/${clave}?v=${Date.now()}`;
        await env.DB.prepare(
          `INSERT INTO site_config (site, logo_url, actualizado_em) VALUES (?, ?, datetime('now'))
           ON CONFLICT(site) DO UPDATE SET logo_url = excluded.logo_url, actualizado_em = excluded.actualizado_em`
        ).bind(site, logoUrl).run();
        return json({ ok: true, logo_url: logoUrl });
      }

      // POST /admin/upload-imagem?pasta=banners — upload genérico de imagem
      // (usado pra imagem de fundo do banner, e qualquer outra imagem que o
      // painel precisar no futuro): sobe pro R2 com um nome único e devolve
      // só a URL -- quem chamou decide onde guardar essa URL.
      if (pathname === '/admin/upload-imagem' && request.method === 'POST') {
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
        const extPorTipo = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
        const ext = extPorTipo[contentType];
        if (!ext) return json({ ok: false, erro: 'tipo_no_soportado', detalle: 'Usa JPG, PNG, WEBP o GIF.' }, 400);

        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > 5 * 1024 * 1024) return json({ ok: false, erro: 'archivo_muy_grande', detalle: 'Maximo 5MB.' }, 400);

        const pasta = (url.searchParams.get('pasta') || 'uploads').replace(/[^a-z0-9-]/g, '');
        const clave = `${pasta}/${crypto.randomUUID()}.${ext}`;
        await env.IMAGENES.put(clave, bytes, { httpMetadata: { contentType } });
        return json({ ok: true, imagen_url: `${url.origin}/imagen/${clave}?v=${Date.now()}` });
      }

      if (pathname === '/admin/pedidos' && request.method === 'GET') {
        const { results: pedidos } = await env.DB.prepare('SELECT * FROM pedidos ORDER BY creado_em DESC LIMIT 200').all();
        return json({ ok: true, pedidos });
      }

      const pedidoDetalleMatch = pathname.match(/^\/admin\/pedidos\/([a-z0-9-]+)$/);
      if (pedidoDetalleMatch && request.method === 'GET') {
        const pedido = await env.DB.prepare('SELECT * FROM pedidos WHERE id = ?').bind(pedidoDetalleMatch[1]).first();
        if (!pedido) return json({ ok: false, erro: 'pedido_no_encontrado' }, 404);
        const { results: items } = await env.DB.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').bind(pedidoDetalleMatch[1]).all();
        return json({ ok: true, pedido, items });
      }

      // DELETE /admin/pedidos/:id — exclui um pedido de teste/errado do
      // painel. Exclusão de verdade (não é "activo=0" como em produtos):
      // pedidos não aparecem em nenhuma vitrine pública, então não faz
      // sentido manter "desativado" -- e apaga os itens junto, senão
      // ficariam orfãos. NÃO revoga nenhuma licença já emitida (isso é
      // uma ação separada, de propósito, pra nunca travar o app de um
      // cliente sem querer só por apagar o registro do pedido).
      if (pedidoDetalleMatch && request.method === 'DELETE') {
        const id = pedidoDetalleMatch[1];
        await env.DB.prepare('DELETE FROM pedido_items WHERE pedido_id = ?').bind(id).run();
        const resultado = await env.DB.prepare('DELETE FROM pedidos WHERE id = ?').bind(id).run();
        if (!resultado.meta || !resultado.meta.changes) return json({ ok: false, erro: 'pedido_no_encontrado' }, 404);
        return json({ ok: true, id });
      }

      return json({ ok: false, erro: 'rota_nao_encontrada' }, 404);
    }

    return json({ ok: false, erro: 'rota_nao_encontrada' }, 404);
  },
};
