/* vitrina-v3.js — Diseño aprobado V3 (Owner, 31-oct-2026): menú del celular y fuentes desplegables de la portada. */
(function () {
  "use strict";
  var menu = document.querySelector(".menu-toggle");
  var lista = document.querySelector("#main-menu");
  if (menu && lista) {
    var cerrar = function () {
      lista.classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
      menu.textContent = "☰";
    };
    menu.addEventListener("click", function () {
      var abierto = menu.getAttribute("aria-expanded") !== "true";
      menu.setAttribute("aria-expanded", String(abierto));
      lista.classList.toggle("open", abierto);
      menu.textContent = abierto ? "×" : "☰";
    });
    lista.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", cerrar); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrar(); });
  }
  document.querySelectorAll("[data-source]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      var destino = document.getElementById(boton.dataset.source);
      var abierto = boton.getAttribute("aria-expanded") !== "true";
      boton.setAttribute("aria-expanded", String(abierto));
      destino.hidden = !abierto;
      boton.textContent = abierto ? "Cerrar fuente −" : "Ver fuente y condición +";
    });
  });
})();
