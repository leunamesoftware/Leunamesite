/* ==========================================================================
   LeuName Softwares — Admin: gestión de productos (admin/productos.html)
   ========================================================================== */
(function () {
  'use strict';

  AdminAPI.requireAuth();

  var CATEGORY_NAMES = {
    aplicaciones: 'Aplicaciones y Sistemas', templates: 'Templates', libros: 'Libros',
    recetas: 'Recetas', diseno: 'Diseño y Logos', otros: 'Otros productos'
  };

  var formCard = document.getElementById('formCard');
  var form = document.getElementById('productForm');
  var banner = document.getElementById('apiBanner');

  function showBanner(msg, isError) {
    banner.hidden = false;
    banner.textContent = msg;
    banner.classList.toggle('is-error', !!isError);
  }

  function fmtPrice(v) { return Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

  function renderRows(productos) {
    var body = document.getElementById('productsBody');
    document.getElementById('productCount').textContent = productos.length;
    if (!productos.length) {
      body.innerHTML = '<tr><td colspan="6" class="admin-empty">Todavía no hay productos.</td></tr>';
      return;
    }
    body.innerHTML = productos.map(function (p) {
      return '<tr data-id="' + p.id + '">' +
        '<td>' + p.id + '</td>' +
        '<td><strong>' + p.nombre + '</strong></td>' +
        '<td>' + (CATEGORY_NAMES[p.categoria] || p.categoria) + '</td>' +
        '<td>' + fmtPrice(p.precio) + '</td>' +
        '<td>' +
          '<span class="admin-badge ' + (p.real ? 'real' : 'ejemplo') + '">' + (p.real ? 'Real' : 'Ejemplo') + '</span> ' +
          (p.activo ? '' : '<span class="admin-badge inactivo">Inactivo</span>') +
        '</td>' +
        '<td><div class="admin-row-actions">' +
          '<button class="admin-btn admin-btn-outline admin-btn-sm" data-edit="' + p.id + '">Editar</button>' +
          '<button class="admin-btn admin-btn-danger admin-btn-sm" data-delete="' + p.id + '">Eliminar</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  var currentProducts = [];

  async function load() {
    try {
      var data = await AdminAPI.api('/admin/productos');
      currentProducts = data.productos || [];
      renderRows(currentProducts);
    } catch (err) {
      document.getElementById('productsBody').innerHTML = '<tr><td colspan="6" class="admin-empty">No se pudo conectar con el servidor.</td></tr>';
      showBanner('No se pudo conectar con el backend (' + AdminAPI.BASE_URL + '). Verifica que el Worker esté desplegado.', true);
    }
  }

  function openForm(product) {
    formCard.hidden = false;
    document.getElementById('formTitle').textContent = product ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('pOriginalId').value = product ? product.id : '';
    document.getElementById('pId').value = product ? product.id : '';
    document.getElementById('pId').disabled = !!product;
    document.getElementById('pNombre').value = product ? product.nombre : '';
    document.getElementById('pCategoria').value = product ? product.categoria : 'aplicaciones';
    document.getElementById('pPrecio').value = product ? product.precio : '';
    document.getElementById('pRating').value = product ? product.rating : 4.5;
    document.getElementById('pReviews').value = product ? product.reviews : 0;
    document.getElementById('pCorta').value = product ? product.descripcion_corta : '';
    document.getElementById('pDescripcion').value = product ? product.descripcion : '';
    document.getElementById('pIncluye').value = product && product.incluye ? JSON.parse(product.incluye).join('\n') : '';
    document.getElementById('pCaracteristicas').value = product && product.caracteristicas ? JSON.parse(product.caracteristicas).join('\n') : '';
    document.getElementById('pReal').checked = !!(product && product.real);
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('newProductBtn').addEventListener('click', function () { openForm(null); });
  document.getElementById('cancelFormBtn').addEventListener('click', function () { formCard.hidden = true; form.reset(); });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    AdminAPI.clearToken();
    location.href = 'login.html';
  });

  document.getElementById('productsBody').addEventListener('click', function (e) {
    var editBtn = e.target.closest('[data-edit]');
    var delBtn = e.target.closest('[data-delete]');
    if (editBtn) {
      var product = currentProducts.find(function (p) { return p.id === editBtn.getAttribute('data-edit'); });
      if (product) openForm(product);
    }
    if (delBtn) {
      var id = delBtn.getAttribute('data-delete');
      if (confirm('¿Eliminar (desactivar) el producto "' + id + '"?')) {
        AdminAPI.api('/admin/productos/' + id, { method: 'DELETE' })
          .then(load)
          .catch(function () { showBanner('No se pudo eliminar el producto.', true); });
      }
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var originalId = document.getElementById('pOriginalId').value;
    var payload = {
      id: document.getElementById('pId').value.trim(),
      nombre: document.getElementById('pNombre').value.trim(),
      categoria: document.getElementById('pCategoria').value,
      precio: parseFloat(document.getElementById('pPrecio').value),
      rating: parseFloat(document.getElementById('pRating').value),
      reviews: parseInt(document.getElementById('pReviews').value, 10),
      descripcion_corta: document.getElementById('pCorta').value.trim(),
      descripcion: document.getElementById('pDescripcion').value.trim(),
      incluye: document.getElementById('pIncluye').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      caracteristicas: document.getElementById('pCaracteristicas').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      real: document.getElementById('pReal').checked
    };
    var request = originalId
      ? AdminAPI.api('/admin/productos/' + originalId, { method: 'PUT', body: JSON.stringify(payload) })
      : AdminAPI.api('/admin/productos', { method: 'POST', body: JSON.stringify(payload) });
    request.then(function () {
      formCard.hidden = true;
      form.reset();
      load();
    }).catch(function () { showBanner('No se pudo guardar el producto.', true); });
  });

  load();
})();
