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

    // POST /pedidos — crea un pedido a partir del carrito, SIN procesar pago
    // (eso ocurre en el front-end una vez que Stripe este integrado). Los
    // precios se toman siempre del catalogo en el servidor, nunca del
    // cuerpo de la peticion, para evitar que alguien manipule el total.
    // Body: { cliente: { nombre, email, telefono, pais }, items: [{ id, qty }] }
    if (pathname === '/pedidos' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || !body.cliente || !body.cliente.email || !Array.isArray(body.items) || !body.items.length) {
        return json({ ok: false, erro: 'datos_invalidos' }, 400);
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
      if (!itemsConPrecio.length) return json({ ok: false, erro: 'sin_items_validos' }, 400);

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

      return json({ ok: true, pedido_id: pedidoId, estado: 'pendiente', subtotal, total: subtotal });
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
