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

// Valida el carrito contra el catalogo real (precios SIEMPRE del
// servidor, nunca del cuerpo de la peticion) y crea el pedido +
// pedido_items en estado 'pendiente'. Usado tanto por POST /pedidos
// (registro simple, sin pago) como por POST /checkout/session (que
// ademas crea la sesion de pago real en Stripe).
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
    `INSERT INTO pedidos (id, cliente_id, cliente_nombre, cliente_email, cliente_telefono, cliente_pais, subtotal, total, estado, creado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', datetime('now'))`
  ).bind(pedidoId, clienteId, body.cliente.nombre || null, body.cliente.email, body.cliente.telefono || null, body.cliente.pais || null, subtotal, subtotal).run();

  const batch = itemsConPrecio.map((i) =>
    env.DB.prepare(
      'INSERT INTO pedido_items (id, pedido_id, producto_id, nombre_producto, precio_unitario, cantidad) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), pedidoId, i.producto.id, i.producto.nombre, i.producto.precio, i.cantidad)
  );
  await env.DB.batch(batch);

  return { pedidoId, itemsConPrecio, subtotal, clienteEmail: body.cliente.email, clienteNombre: body.cliente.nombre || null };
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
      const { pedidoId, itemsConPrecio, clienteEmail } = resultado;

      const siteUrl = (env.SITE_URL || 'https://leuname-site.emanuelantunes2024.workers.dev').replace(/\/$/, '');

      let session;
      try {
        session = await stripeApi(env, '/checkout/sessions', {
          mode: 'payment',
          customer_email: clienteEmail,
          line_items: itemsConPrecio.map((i) => ({
            quantity: i.cantidad,
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(i.producto.precio * 100),
              product_data: { name: i.producto.nombre },
            },
          })),
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
        'SELECT id, estado, total, cliente_email, chave_licencia, stripe_session_id FROM pedidos WHERE id = ?'
      ).bind(pedidoPublicoMatch[1]).first();
      if (!pedido || !sessionId || pedido.stripe_session_id !== sessionId) {
        return json({ ok: false, erro: 'pedido_no_encontrado' }, 404);
      }
      const { results: items } = await env.DB.prepare(
        'SELECT producto_id, nombre_producto, cantidad FROM pedido_items WHERE pedido_id = ?'
      ).bind(pedido.id).all();
      return json({
        ok: true,
        pedido: {
          id: pedido.id,
          estado: pedido.estado,
          total: pedido.total,
          email: pedido.cliente_email,
          chave_licencia: pedido.chave_licencia || null,
        },
        items,
      });
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

          const { results: items } = await env.DB.prepare(
            'SELECT producto_id FROM pedido_items WHERE pedido_id = ?'
          ).bind(pedidoId).all();
          const tieneGestao = items.some((i) => i.producto_id === 'leuname-gestao');

          if (tieneGestao && env.ADMIN_TOKEN) {
            try {
              const pedido = await env.DB.prepare(
                'SELECT cliente_nombre, cliente_email FROM pedidos WHERE id = ?'
              ).bind(pedidoId).first();
              const res = await fetch('https://api.leunamesoftware.com/admin/licencas/gerar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  app_id: 'leuname-gestao',
                  cliente_nome: pedido.cliente_nombre,
                  cliente_contato: pedido.cliente_email,
                  origem: 'loja-stripe',
                }),
              });
              const data = await res.json();
              if (data && data.ok && data.chave) {
                await env.DB.prepare('UPDATE pedidos SET chave_licencia = ? WHERE id = ?').bind(data.chave, pedidoId).run();
              }
            } catch (e) {
              // No bloquea el webhook: el pedido ya quedo 'pagado' en la base.
              // Si esto falla, la licencia se puede generar manualmente
              // despues desde el panel del servidor de licencias.
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
        if (!body || !body.id || !body.nombre || !body.categoria || body.precio == null) {
          return json({ ok: false, erro: 'datos_invalidos' }, 400);
        }
        await env.DB.prepare(
          `INSERT INTO productos (id, nombre, categoria, descripcion_corta, descripcion, precio, real, rating, reviews, incluye, caracteristicas, activo, creado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`
        ).bind(
          body.id, body.nombre, body.categoria, body.descripcion_corta || '', body.descripcion || '',
          Number(body.precio), body.real ? 1 : 0, Number(body.rating || 4.5), Number(body.reviews || 0),
          JSON.stringify(body.incluye || []), JSON.stringify(body.caracteristicas || [])
        ).run();
        return json({ ok: true, id: body.id });
      }

      const adminProductoMatch = pathname.match(/^\/admin\/productos\/([a-z0-9-]+)$/);
      if (adminProductoMatch && request.method === 'PUT') {
        const id = adminProductoMatch[1];
        const body = await request.json().catch(() => null);
        if (!body) return json({ ok: false, erro: 'datos_invalidos' }, 400);
        await env.DB.prepare(
          `UPDATE productos SET nombre=?, categoria=?, descripcion_corta=?, descripcion=?, precio=?, real=?, rating=?, reviews=?, incluye=?, caracteristicas=?, activo=? WHERE id=?`
        ).bind(
          body.nombre, body.categoria, body.descripcion_corta || '', body.descripcion || '',
          Number(body.precio), body.real ? 1 : 0, Number(body.rating || 4.5), Number(body.reviews || 0),
          JSON.stringify(body.incluye || []), JSON.stringify(body.caracteristicas || []),
          body.activo === false ? 0 : 1, id
        ).run();
        return json({ ok: true, id });
      }

      if (adminProductoMatch && request.method === 'DELETE') {
        await env.DB.prepare('UPDATE productos SET activo = 0 WHERE id = ?').bind(adminProductoMatch[1]).run();
        return json({ ok: true, id: adminProductoMatch[1], eliminado_logico: true });
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

      return json({ ok: false, erro: 'rota_nao_encontrada' }, 404);
    }

    return json({ ok: false, erro: 'rota_nao_encontrada' }, 404);
  },
};
