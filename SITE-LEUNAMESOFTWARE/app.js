(function () {
  var C = window.CONFIG || {};
  function enlace(q) {
    var u = "https://www.amazon.es/s?k=" + encodeURIComponent(q).replace(/%20/g, "+");
    return C.amazonTag ? u + "&tag=" + encodeURIComponent(C.amazonTag) : u;
  }
  document.querySelectorAll("a[data-q]").forEach(function (a) { a.href = enlace(a.getAttribute("data-q")); });
  var f = document.getElementById("busca");
  if (f) f.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = document.getElementById("buscaQ").value.trim();
    if (q) window.open(enlace(q), "_blank", "noopener");
  });
  document.querySelectorAll("[data-mail]").forEach(function (a) { a.href = "mailto:" + (C.email || ""); });
  document.querySelectorAll("[data-ano]").forEach(function (s) { s.textContent = new Date().getFullYear(); });
  var ck = document.getElementById("cookies"), visto = false;
  try { visto = localStorage.getItem("ck") === "1"; } catch (e) {}
  if (ck && !visto) ck.hidden = false;
  var ok = document.getElementById("cookiesOk");
  if (ok) ok.addEventListener("click", function () { ck.hidden = true; try { localStorage.setItem("ck", "1"); } catch (e) {} });
})();
