/* ==========================================================================
   LeuName Softwares — Panel admin interno (no es un sistema de cuentas de
   usuario real). Guarda el ADMIN_TOKEN en localStorage de este navegador
   y lo envía como Authorization: Bearer <token> en cada llamada.
   ========================================================================== */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'leuname_admin_token';
  var BASE_URL = 'https://leuname-loja.emanuelantunes2024.workers.dev';

  function getToken() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(token) {
    try { localStorage.setItem(STORAGE_KEY, token); } catch (e) { /* almacenamiento no disponible */ }
  }
  function clearToken() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* no-op */ }
  }

  function requireAuth() {
    if (!getToken()) location.href = 'login.html';
  }

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, options.headers || {});
    var res = await fetch(BASE_URL + path, Object.assign({}, options, { headers: headers }));
    if (res.status === 401) { clearToken(); location.href = 'login.html'; throw new Error('no_autorizado'); }
    var data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && data.erro) || 'error_api');
    return data;
  }

  global.AdminAPI = { BASE_URL: BASE_URL, getToken: getToken, setToken: setToken, clearToken: clearToken, requireAuth: requireAuth, api: api };

  // Registra o service worker so pra habilitar "Instalar app" no celular.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/admin-sw.js', { scope: '/' }).catch(function () { /* no-op */ });
  }
})(window);
