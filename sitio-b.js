/* sitio-b.js — Páginas públicas del diseño B: menú del celular y, si el expediente público responde, sus enlaces.
   Sin librerías ni recursos de internet. (La portada usa portada-b.js, que ya hace esto mismo.) */
(function () {
  "use strict";
  /* 1. Menú del celular */
  var boton = document.querySelector(".b-menu");
  var menu = document.getElementById("b-menu-movil");
  if (boton && menu) {
    var cerrar = function (devolverFoco) {
      menu.removeAttribute("data-abierto");
      boton.setAttribute("aria-expanded", "false");
      if (devolverFoco) boton.focus();
    };
    boton.addEventListener("click", function () {
      var abrir = boton.getAttribute("aria-expanded") !== "true";
      boton.setAttribute("aria-expanded", String(abrir));
      if (abrir) {
        menu.setAttribute("data-abierto", "");
        var primero = menu.querySelector("a");
        if (primero) primero.focus();
      } else {
        menu.removeAttribute("data-abierto");
      }
    });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { cerrar(false); }); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && boton.getAttribute("aria-expanded") === "true") cerrar(true);
    });
    window.matchMedia("(min-width: 1081px)").addEventListener("change", function (m) { if (m.matches) cerrar(false); });
  }

  /* Contacto: «Copiar dirección». Si el navegador no deja copiar, se dice y la dirección sigue a la vista. */
  document.querySelectorAll("[data-copiar]").forEach(function (b) {
    b.addEventListener("click", function () {
      var estado = document.querySelector("[data-copiar-estado]");
      var decir = function (t) { if (estado) estado.textContent = t; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(b.getAttribute("data-copiar")).then(function () { decir("Dirección copiada."); },
          function () { decir("No pudimos copiarla; la dirección está arriba."); });
      } else { decir("No pudimos copiarla; la dirección está arriba."); }
    });
  });

  /* 2. «Expediente público» solo se ofrece si hay un expediente destacado vigente. */
  var ocultos = document.querySelectorAll("[data-solo-con-expediente]");
  if (!ocultos.length || typeof window.fetch !== "function") return;
  fetch("/api/v1/expedientes/destacado", { credentials: "omit", cache: "no-store", headers: { "Accept": "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var x = d && d.expediente;
      var servido = Date.parse(d && d.servido_en) || Date.now();
      if (x && x.codigo && Date.parse(x.vence_en) - servido > 0) ocultos.forEach(function (a) { a.hidden = false; });
    })
    .catch(function () { /* se quedan ocultos */ });
})();
