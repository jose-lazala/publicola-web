/* sitio-v3.js — Diseño aprobado V3 (Owner, 31-oct-2026): menú del celular en las páginas del sitio. */
(function () {
  "use strict";
  var boton = document.querySelector(".v3-menu");
  var lista = document.querySelector("#v3-menu");
  if (!boton || !lista) return;
  function cerrar() {
    lista.classList.remove("abierto");
    boton.setAttribute("aria-expanded", "false");
    boton.textContent = "☰";
  }
  boton.addEventListener("click", function () {
    var abierto = boton.getAttribute("aria-expanded") !== "true";
    boton.setAttribute("aria-expanded", String(abierto));
    lista.classList.toggle("abierto", abierto);
    boton.textContent = abierto ? "×" : "☰";
  });
  lista.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", cerrar); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrar(); });
})();
