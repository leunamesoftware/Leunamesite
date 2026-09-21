/* ==========================================================================
   LeuName Softwares — Admin: gestão de produtos (admin/productos.html)
   ========================================================================== */
(function () {
  'use strict';

  AdminAPI.requireAuth();

  var CATEGORY_NAMES = {
    aplicaciones: 'Aplicativos e Sistemas', templates: 'Templates', libros: 'Livros',
    recetas: 'Receitas', diseno: 'Design e Logos', otros: 'Outros produtos'
  };

  var formCard = document.getElementById('formCard');
  var form = document.getElementById('productForm');
  var banner = document.getElementById('apiBanner');

  function showBanner(msg, isError) {
    banner.hidden = false;
    banner.textContent = msg;
    banner.classList.toggle('is-error', !!isError);
  }

  function fmtPrice(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function renderRows(productos) {
    var body = document.getElementById('productsBody');
    document.getElementById('productCount').textContent = productos.length;
    if (!productos.length) {
      body.innerHTML = '<tr><td colspan="6" class="admin-empty">Ainda não há produtos.</td></tr>';
      return;
    }
    body.innerHTML = productos.map(function (p) {
      return '<tr data-id="' + p.id + '">' +
        '<td>' + p.id + '</td>' +
        '<td><strong>' + p.nombre + '</strong></td>' +
        '<td>' + (CATEGORY_NAMES[p.categoria] || p.categoria) + '</td>' +
        '<td>' + (p.precio_br != null ? fmtPrice(p.precio_br) : '—') + '</td>' +
        '<td>' +
          '<span class="admin-badge ' + (p.real ? 'real' : 'ejemplo') + '">' + (p.real ? 'Real' : 'Exemplo') + '</span> ' +
          (p.activo ? '' : '<span class="admin-badge inactivo">Inativo</span>') +
        '</td>' +
        '<td><div class="admin-row-actions">' +
          '<button class="admin-btn admin-btn-outline admin-btn-sm" data-edit="' + p.id + '">Editar</button>' +
          '<button class="admin-btn admin-btn-danger admin-btn-sm" data-delete="' + p.id + '">Excluir</button>' +
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
      document.getElementById('productsBody').innerHTML = '<tr><td colspan="6" class="admin-empty">Não foi possível conectar com o servidor.</td></tr>';
      showBanner('Não foi possível conectar com o backend (' + AdminAPI.BASE_URL + '). Verifique se o Worker está implantado.', true);
    }
  }

  function openForm(product) {
    formCard.hidden = false;
    document.getElementById('formTitle').textContent = product ? 'Editar produto' : 'Novo produto';
    document.getElementById('pOriginalId').value = product ? product.id : '';
    document.getElementById('pId').value = product ? product.id : '';
    document.getElementById('pId').disabled = !!product;
    document.getElementById('pNombre').value = product ? product.nombre : '';
    document.getElementById('pCategoria').value = product ? product.categoria : 'aplicaciones';
    document.getElementById('pPrecio').value = product && product.precio_br != null ? product.precio_br : '';
    document.getElementById('pRating').value = product ? product.rating : 4.5;
    document.getElementById('pReviews').value = product ? product.reviews : 0;
    document.getElementById('pCorta').value = product ? product.descripcion_corta : '';
    document.getElementById('pDescripcion').value = product ? product.descripcion : '';
    document.getElementById('pIncluye').value = product && product.incluye ? JSON.parse(product.incluye).join('\n') : '';
    document.getElementById('pCaracteristicas').value = product && product.caracteristicas ? JSON.parse(product.caracteristicas).join('\n') : '';
    document.getElementById('pReal').checked = !!(product && product.real);
    document.getElementById('pTag').value = (product && product.tag) || '';
    document.getElementById('pDemoUrl').value = (product && product.demo_url) || '';

    var imagenUrl = (product && product.imagen_url) || '';
    document.getElementById('pImagenUrl').value = imagenUrl;
    var previewWrap = document.getElementById('pImagenPreviewWrap');
    var preview = document.getElementById('pImagenPreview');
    if (imagenUrl) { preview.src = imagenUrl; previewWrap.hidden = false; } else { previewWrap.hidden = true; }
    document.getElementById('pImagenFile').value = '';
    var imagenHint = document.getElementById('pImagenHint');
    if (product) {
      imagenHint.textContent = 'Escolha uma imagem (JPG, PNG, WEBP ou GIF, máx. 5MB) para enviá-la agora.';
    } else {
      imagenHint.textContent = 'Salve o produto primeiro para poder enviar a imagem.';
    }

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
      if (confirm('Excluir (desativar) o produto "' + id + '"?')) {
        AdminAPI.api('/admin/productos/' + id, { method: 'DELETE' })
          .then(load)
          .catch(function () { showBanner('Não foi possível excluir o produto.', true); });
      }
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var originalId = document.getElementById('pOriginalId').value;
    var newId = document.getElementById('pId').value.trim();
    var payload = {
      id: newId,
      nombre: document.getElementById('pNombre').value.trim(),
      categoria: document.getElementById('pCategoria').value,
      // Este painel edita só o preço do Brasil (precio_br). O preço em
      // euros do site .com (precio) não é enviado, então o backend
      // preserva o valor que já estava salvo lá -- nunca é sobrescrito
      // por este formulário.
      precio_br: parseFloat(document.getElementById('pPrecio').value),
      rating: parseFloat(document.getElementById('pRating').value),
      reviews: parseInt(document.getElementById('pReviews').value, 10),
      descripcion_corta: document.getElementById('pCorta').value.trim(),
      descripcion: document.getElementById('pDescripcion').value.trim(),
      incluye: document.getElementById('pIncluye').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      caracteristicas: document.getElementById('pCaracteristicas').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      real: document.getElementById('pReal').checked,
      tag: document.getElementById('pTag').value || null,
      demo_url: document.getElementById('pDemoUrl').value.trim() || null,
      // O campo de imagem é enviado separadamente (POST .../imagen); reenviamos
      // o valor atual aqui para não apagá-lo ao salvar o restante do formulário.
      imagen_url: document.getElementById('pImagenUrl').value || null
    };
    var request = originalId
      ? AdminAPI.api('/admin/productos/' + originalId, { method: 'PUT', body: JSON.stringify(payload) })
      : AdminAPI.api('/admin/productos', { method: 'POST', body: JSON.stringify(payload) });
    request.then(function () {
      var savedId = originalId || newId;
      formCard.hidden = true;
      form.reset();
      load().then(function () {
        if (!originalId) {
          showBanner('Produto criado. Edite-o novamente se quiser enviar uma imagem.');
        }
      });
    }).catch(function () { showBanner('Não foi possível salvar o produto.', true); });
  });

  document.getElementById('pImagenFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var id = document.getElementById('pOriginalId').value;
    if (!id) {
      showBanner('Salve o produto primeiro, depois edite-o novamente para enviar a imagem.', true);
      e.target.value = '';
      return;
    }
    var hint = document.getElementById('pImagenHint');
    hint.textContent = 'Enviando imagem…';
    fetch(AdminAPI.BASE_URL + '/admin/productos/' + id + '/imagen', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AdminAPI.getToken(), 'Content-Type': file.type },
      body: file
    })
      .then(function (res) { return res.json().then(function (data) { if (!res.ok) throw new Error(data.erro || 'error'); return data; }); })
      .then(function (data) {
        document.getElementById('pImagenUrl').value = data.imagen_url;
        document.getElementById('pImagenPreview').src = data.imagen_url + '?t=' + Date.now();
        document.getElementById('pImagenPreviewWrap').hidden = false;
        hint.textContent = 'Imagem enviada. Foi salva automaticamente.';
        load();
      })
      .catch(function (err) {
        hint.textContent = 'Não foi possível enviar a imagem (' + err.message + ').';
      });
  });

  load();
})();
