/* portada-b.js — Portada B «Azul profundo» (12-nov-2026).
   1. Menú del celular.
   2. Ficha de la portada con el expediente destacado REAL cuando la API responde con uno vigente
      (`/api/v1/expedientes/destacado`, el mismo origen que usa /expedientes/). Si no responde o no hay
      uno vigente, se queda el ejemplo ilustrativo de la referencia, con su marca. No se inventa nada:
      solo se pintan los campos que trae la respuesta.
   Sin librerías ni recursos de internet. */
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

  /* 2. Expediente destacado */
  var ficha = document.querySelector("[data-ficha-portada]");
  if (!ficha || typeof window.fetch !== "function") return;

  var texto = function (valor) {
    return String(valor == null ? "" : valor).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var fecha = function (valor) {
    var p = String(valor || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!p || !MESES[Number(p[2]) - 1]) return "";
    var dia = Number(p[3]) + " " + MESES[Number(p[2]) - 1] + ".";
    if (p[4] === undefined) return dia;
    var h = Number(p[4]);
    return dia + " · " + (h % 12 || 12) + ":" + p[5] + " " + (h < 12 ? "a. m." : "p. m.");
  };
  var urlSegura = function (url) {
    try { var u = new URL(url, location.href); return /^https?:$/.test(u.protocol) ? u.href : ""; }
    catch (e) { return ""; }
  };
  var ICONO_SEGUIR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v17l-5-4-5 4z"/></svg>';
  var ICONO_SALIR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

  function citas(cotejo, paginas) {
    var fuentes = (cotejo && cotejo.fuentes) || {};
    var primera = (paginas || [])[0];
    if (!primera || !primera[1]) return "";
    var doc = fuentes[primera[0]] || {};
    var url = urlSegura(doc.url);
    var etiqueta = "p. " + texto(primera[1]);
    var nombre = "Ver en " + (doc.titulo || "el pliego") + ", página " + primera[1];
    return url
      ? '<a class="b-cita" href="' + texto(url.split("#")[0] + "#page=" + primera[1]) + '" target="_blank" rel="noopener noreferrer" aria-label="' + texto(nombre) + '">' + etiqueta + "</a>"
      : '<span class="b-cita" aria-label="' + texto(nombre) + '">' + etiqueta + "</span>";
  }

  function pintar(x) {
    var requisitos = [];
    ((x.cotejo && x.cotejo.grupos) || []).forEach(function (g) {
      (g.requisitos || []).forEach(function (r) { if (r && r.titulo) requisitos.push(r); });
    });
    requisitos = requisitos.slice(0, 3);
    var cierre = fecha(x.cierre);
    var datos = [x.institucion, x.dirigido_a ? "Dirigido a: " + x.dirigido_a : ""].filter(Boolean).map(texto).join(" · ");
    var oficial = urlSegura(x.url_oficial);
    var seguir = "/app/?acceso=crear#/oportunidades?seleccion=" + encodeURIComponent(x.codigo || "");
    ficha.innerHTML =
      '<div class="b-luz b-luz-oro" aria-hidden="true"></div>' +
      '<div class="b-ficha-pastillas">' +
        (x.modalidad ? '<span class="b-pastilla">' + texto(x.modalidad) + "</span>" : "") +
        (x.estado ? '<span class="b-pastilla b-vigente"><span class="b-punto b-pulso" aria-hidden="true"></span>' + texto(x.estado) + "</span>" : "") +
        (cierre ? '<span class="b-pastilla b-solo-escritorio">Cierre: ' + texto(cierre) + "</span>" : "") +
      "</div>" +
      '<p class="b-mono b-ficha-antetitulo">Ficha del proceso' + (x.codigo ? " · " + texto(x.codigo) : "") + "</p>" +
      '<h3 class="b-x b-ficha-titulo" id="ficha-titulo">' + texto(x.titulo || "Licitación pública") + "</h3>" +
      (datos ? '<p class="b-ficha-datos b-solo-escritorio">' + datos + "</p>" : "") +
      (cierre ? '<p class="b-ficha-datos b-ficha-cierre-movil">Cierre publicado: ' + texto(cierre) + "</p>" : "") +
      (requisitos.length
        ? '<div class="b-ficha-requisitos-cabecera"><h4>Qué debes presentar</h4><span class="b-marca b-marca-azul">Requisitos cotejados</span></div><ol>' +
          requisitos.map(function (r) {
            return '<li class="b-requisito"><span>' + texto(r.titulo) + "</span>" + citas(x.cotejo, r.paginas) + "</li>";
          }).join("") + "</ol>"
        : '<p class="b-ficha-nota">Consulta el expediente para ver los renglones, los requisitos y los documentos oficiales.</p>') +
      '<div class="b-ficha-botones">' +
        '<a class="b-btn b-primario b-sm" href="' + texto(seguir) + '">' + ICONO_SEGUIR + "Seguir este proceso</a>" +
        (oficial ? '<a class="b-btn b-secundario b-sm b-solo-escritorio" href="' + texto(oficial) + '" target="_blank" rel="noopener noreferrer">Abrir en el SECP' + ICONO_SALIR + "</a>" : "") +
      "</div>";
    ficha.setAttribute("data-expediente-real", "");
    // La fila resaltada del Explorador es parte del ejemplo: ya no corresponde a la ficha real.
    document.querySelectorAll("[data-fila-ejemplo]").forEach(function (f) { f.classList.remove("b-fila-activa"); });
    // El expediente público vuelve a funcionar: se restituye el botón y los enlaces.
    var botonExpediente = document.querySelector("[data-boton-expediente]");
    if (botonExpediente) { botonExpediente.href = "/expedientes/"; botonExpediente.textContent = "Ver un expediente"; }
    document.querySelectorAll("[data-solo-con-expediente]").forEach(function (a) { a.hidden = false; });
  }

  var controlador = typeof AbortController === "function" ? new AbortController() : null;
  var espera = controlador ? setTimeout(function () { controlador.abort(); }, 6000) : 0;
  fetch("/api/v1/expedientes/destacado", {
    credentials: "omit", cache: "no-store", headers: { "Accept": "application/json" },
    signal: controlador ? controlador.signal : undefined,
  }).then(function (r) {
    if (!r.ok) throw new Error("sin_expediente");
    return r.json();
  }).then(function (datos) {
    var x = datos && datos.expediente;
    var servido = Date.parse(datos && datos.servido_en) || Date.now();
    if (x && x.codigo && Date.parse(x.vence_en) - servido > 0) pintar(x);
  }).catch(function () {
    /* Sin expediente vigente o sin respuesta: se queda el ejemplo ilustrativo. */
  }).then(function () { clearTimeout(espera); });
})();
