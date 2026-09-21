/* ==========================================================================
   LeuName Softwares — Painel admin de licenças (ferramenta interna, não
   faz parte da loja pública). Guarda o ADMIN_TOKEN no localStorage deste
   navegador e envia como Authorization: Bearer <token> em cada chamada.
   Mesmo padrão do painel admin da loja (SITE-LEUNAMESOFTWARE/admin/).
   ========================================================================== */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'leuname_admin_token';
  var BASE_URL = 'https://api.leunamesoftware.com.br';

  function getToken() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(token) {
    try { localStorage.setItem(STORAGE_KEY, token); } catch (e) { /* armazenamento indisponível */ }
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
    if (res.status === 401) { clearToken(); location.href = 'login.html'; throw new Error('nao_autorizado'); }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((data && data.erro) || 'erro_api');
    return data;
  }

  global.AdminLicencasAPI = { BASE_URL: BASE_URL, getToken: getToken, setToken: setToken, clearToken: clearToken, requireAuth: requireAuth, api: api };

  // Registra o service worker so pra habilitar "Instalar app" no celular.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/admin-sw.js', { scope: '/' }).catch(function () { /* no-op */ });
  }
})(window);
