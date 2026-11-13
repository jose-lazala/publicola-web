/* expediente-b.js — /expedientes/ en el diseño B. Pinta el expediente destacado REAL que devuelve
   /api/v1/expedientes/destacado (el mismo que enseña la portada). Solo datos publicados por la DGCP:
   si un dato no viene, no se inventa; se dice que no está publicado o se envía al SECP. */
(function () {
  "use strict";
  var raiz = document.querySelector("[data-expediente]");
  if (!raiz || typeof window.fetch !== "function") return;

  var API = "/api/v1/expedientes/destacado";
  var CINCO_MINUTOS = 5 * 60 * 1000;
  var MESES = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
  var FLECHA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var SALIR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  var SEGUIR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v17l-5-4-5 4z"/></svg>';
  var BAJAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M6 11l6 6 6-6M5 20h14"/></svg>';
  var AVISO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>';

  var texto = function (valor) {
    return String(valor == null ? "" : valor).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var urlSegura = function (url) {
    try { var u = new URL(url, location.href); return u.protocol === "https:" ? u.href : ""; }
    catch (e) { return ""; }
  };
  // Las fechas de la DGCP traen la hora de pared de Santo Domingo (aunque algunas lleven «Z»): se leen tal cual.
  var partes = function (valor) {
    return String(valor || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  };
  var fecha = function (valor, conHora) {
    var p = partes(valor);
    if (!p || !MESES[Number(p[2]) - 1]) return "";
    var dia = Number(p[3]) + " " + MESES[Number(p[2]) - 1] + " " + p[1];
    if (conHora === false || p[4] === undefined || (p[4] === "00" && p[5] === "00" && conHora !== true)) return dia;
    var h = Number(p[4]);
    return dia + " · " + (h % 12 || 12) + ":" + p[5] + " " + (h < 12 ? "a. m." : "p. m.");
  };
  var instante = function (valor) {
    var p = partes(valor);
    return p ? Date.parse(p[1] + "-" + p[2] + "-" + p[3] + "T" + (p[4] || "23") + ":" + (p[5] || "59") + ":00-04:00") : NaN;
  };
  var faltan = function (ms) {
    if (!(ms > 0)) return "";
    var horas = Math.floor(ms / 3600000);
    if (horas < 1) return "Cierra en menos de una hora";
    if (horas < 48) return "Faltan " + horas + (horas === 1 ? " hora" : " horas");
    var dias = Math.floor(horas / 24);
    return "Faltan " + dias + " días";
  };
  var seguir = function (x) { return "/app/?acceso=crear#/oportunidades?seleccion=" + encodeURIComponent(x.codigo); };
  var descarga = function (x, archivo, etiqueta) {
    return '<a class="b-btn b-secundario b-sm" href="' + texto(API + "/" + encodeURIComponent(x.codigo) + "/descargas/" + archivo) + '" download>' + BAJAR + texto(etiqueta) + "</a>";
  };
  var secp = function (x, clase, etiqueta) {
    var url = urlSegura(x.url_oficial);
    return url ? '<a class="' + clase + '" href="' + texto(url) + '" target="_blank" rel="noopener noreferrer">' + texto(etiqueta || "Abrir en el SECP") + SALIR + "</a>" : "";
  };
  var cabeza = function (id, antetitulo, titulo, nota) {
    return '<div class="x-bloque-cabeza"><div><p class="b-antetitulo"><span class="b-rombo" aria-hidden="true"></span>' + texto(antetitulo) +
      '</p><h2 class="b-h2 b-x" id="' + id + '-titulo">' + texto(titulo) + "</h2></div>" + (nota ? '<p class="s-note">' + nota + "</p>" : "") + "</div>";
  };

  function renglones(x) {
    var filas = x.renglones || [];
    if (!filas.length) {
      return '<div class="x-aviso">' + AVISO + "<p>Todavía no tenemos los renglones publicados para este proceso. " + secp(x, "b-enlace", "Consultarlos en el SECP") + "</p></div>";
    }
    var cuerpo = filas.map(function (r) {
      var cantidad = [r.cantidad, r.unidad].filter(Boolean).join(" ");
      return "<tr>" +
        '<td class="x-num">' + texto(r.numero != null ? r.numero : "") + "</td>" +
        '<td class="x-desc">' + texto(r.descripcion) + (r.categoria ? "<small>" + texto(r.categoria) + (r.unspsc ? " · UNSPSC " + texto(r.unspsc) : "") + "</small>" : "") + "</td>" +
        '<td class="x-cifra" data-etiqueta="Cantidad">' + texto(cantidad || "—") + "</td>" +
        '<td class="x-cifra" data-etiqueta="Precio unitario">' + texto(r.precio_unitario || "No publicado") + "</td>" +
        '<td class="x-cifra" data-etiqueta="Total estimado">' + texto(r.total_estimado || "No publicado") + "</td>" +
        "</tr>";
    }).join("");
    var total = x.total_renglones
      ? '<tfoot><tr><td></td><td>Total de referencia</td><td></td><td></td><td class="x-cifra" data-etiqueta="Total">' + texto(x.total_renglones) + "</td></tr></tfoot>" : "";
    return '<div class="x-tabla-marco"><table class="x-tabla"><caption class="b-sr">Renglones publicados del proceso ' + texto(x.codigo) + "</caption>" +
      '<thead><tr><th scope="col">N.º</th><th scope="col">Descripción</th><th scope="col" class="x-cifra">Cantidad</th><th scope="col" class="x-cifra">Precio unitario</th><th scope="col" class="x-cifra">Total estimado</th></tr></thead>' +
      "<tbody>" + cuerpo + "</tbody>" + total + "</table></div>" +
      '<div class="x-descargas"><p class="s-note">Descarga los renglones:</p>' + descarga(x, "renglones.xlsx", "Excel") + descarga(x, "renglones.pdf", "PDF") + "</div>";
  }

  function hitos(x) {
    var ahora = Date.now();
    var lista = (x.fechas || []).filter(function (f) { return f && f.fecha && fecha(f.fecha); });
    if (!lista.length) return '<div class="x-aviso">' + AVISO + "<p>El cronograma no está publicado en los datos abiertos. " + secp(x, "b-enlace", "Consultarlo en el SECP") + "</p></div>";
    return '<ol class="x-hitos">' + lista.map(function (f) {
      var pasado = instante(f.fecha) < ahora;
      var clave = f.tipo === "cierre";
      return '<li class="x-hito' + (pasado ? " x-hito-pasado" : "") + (clave ? " x-hito-clave" : "") + '"><span class="x-hito-marca" aria-hidden="true"></span>' +
        '<span class="x-hito-titulo">' + texto(f.titulo) + (pasado ? '<span class="b-sr"> (ya pasó)</span>' : "") + "</span>" +
        '<time datetime="' + texto(f.fecha) + '">' + texto(fecha(f.fecha)) + "</time></li>";
    }).join("") + "</ol>";
  }

  function condiciones(x) {
    var filas = (x.condiciones || []).slice();
    if (x.dirigido_a) filas.push({ titulo: "Dirigido a", valor: x.dirigido_a });
    if (!filas.length) return "";
    return '<dl class="s-kv x-condiciones">' + filas.map(function (c) {
      return "<div><dt>" + texto(c.titulo) + "</dt><dd>" + texto(c.valor) + "</dd></div>";
    }).join("") + "</dl>";
  }

  function documentos(x) {
    var lista = x.documentos || [];
    if (!lista.length) return '<div class="x-aviso">' + AVISO + "<p>Los documentos del proceso se consultan en el expediente oficial. " + secp(x, "b-enlace", "Abrir en el SECP") + "</p></div>";
    return '<ul class="x-documentos">' + lista.map(function (d) {
      var url = urlSegura(d.url);
      return '<li class="x-documento"><span>' + texto(d.titulo || "Documento del proceso") + (d.tipo ? "<small>" + texto(d.tipo) + "</small>" : "") + "</span>" +
        (url ? '<a class="b-enlace b-enlace-sm" href="' + texto(url) + '" target="_blank" rel="noopener noreferrer">Abrir en el SECP' + SALIR + "</a>" : "") + "</li>";
    }).join("") + "</ul>";
  }

  function pintar(x) {
    var cierre = fecha(x.cierre);
    var restante = faltan(Date.parse(x.vence_en) - Date.now());
    var indice = [["bloque-renglones", "Qué se compra"], ["bloque-fechas", "Fechas"], ["bloque-condiciones", "Condiciones"],
      ["bloque-documentos", "Documentos oficiales"], ["bloque-requisitos", "Qué debes presentar"]];
    document.title = (x.titulo ? x.titulo + " · " : "") + "Expediente público · Publicola";
    raiz.innerHTML =
      '<section class="s-hero x-hero" aria-labelledby="expediente-titulo"><div class="b-wrap">' +
        '<p class="s-crumbs"><a href="/">Inicio</a><span aria-hidden="true">›</span><span>Expediente público</span></p>' +
        '<div class="x-pastillas">' +
          (x.estado ? '<span class="x-pastilla x-vigente"><span class="x-punto" aria-hidden="true"></span>' + texto(x.estado) + "</span>" : "") +
          (x.modalidad ? '<span class="x-pastilla">' + texto(x.modalidad) + "</span>" : "") +
          '<span class="x-pastilla x-pastilla-codigo">' + texto(x.codigo) + "</span>" +
        "</div>" +
        '<h1 class="b-x s-h1 x-titulo" id="expediente-titulo">' + texto(x.titulo || "Licitación pública") + "</h1>" +
        '<p class="x-entidad"><strong>' + texto(x.institucion) + "</strong></p>" +
        '<div class="b-panel x-resumen"><div class="b-luz b-luz-oro" aria-hidden="true"></div>' +
          '<dl class="s-kv">' +
            "<div><dt>Cierre de ofertas</dt><dd>" + (cierre ? '<time datetime="' + texto(x.vence_en) + '">' + texto(cierre) + "</time>" : "No publicado") +
              "<small>" + (restante ? '<span class="x-faltan">' + texto(restante) + "</span> · " : "") + (x.cierre_tiene_hora ? "Hora de República Dominicana" : "Fecha publicada") + "</small></dd></div>" +
            "<div><dt>Monto de referencia</dt><dd>" + texto(x.monto || "No publicado") + "<small>Publicado por la institución</small></dd></div>" +
            "<div><dt>Renglones</dt><dd>" + texto((x.renglones || []).length || "—") + "<small>" + ((x.renglones || []).length ? "Publicados en datos abiertos" : "No publicados todavía") + "</small></dd></div>" +
          "</dl>" +
          '<div class="x-acciones">' +
            '<a class="b-btn b-primario" href="' + texto(seguir(x)) + '">' + SEGUIR + "Seguir este proceso</a>" +
            secp(x, "b-btn b-secundario") +
          "</div>" +
        "</div>" +
      "</div></section>" +
      '<section class="s-sec"><div class="b-wrap x-cuerpo">' +
        '<aside><nav class="s-toc" aria-label="En este expediente"><p class="s-cat" style="margin: 0 0 10px">En este expediente</p>' +
          indice.map(function (i) { return '<a href="#' + i[0] + '">' + texto(i[1]) + "</a>"; }).join("") + "</nav></aside>" +
        '<div class="x-bloques">' +
          '<section id="bloque-renglones" aria-labelledby="bloque-renglones-titulo">' + cabeza("bloque-renglones", "01 · Renglones", "Qué se compra",
            "Cantidades y precios de referencia tal como los publicó la institución en el SECP.") + renglones(x) + "</section>" +
          '<section id="bloque-fechas" aria-labelledby="bloque-fechas-titulo">' + cabeza("bloque-fechas", "02 · Cronograma", "Fechas del proceso",
            "Hora de República Dominicana. Las enmiendas pueden moverlas: confírmalas en el SECP.") + hitos(x) + "</section>" +
          '<section id="bloque-condiciones" aria-labelledby="bloque-condiciones-titulo">' + cabeza("bloque-condiciones", "03 · Información general", "Condiciones publicadas", "") + condiciones(x) + "</section>" +
          '<section id="bloque-documentos" aria-labelledby="bloque-documentos-titulo">' + cabeza("bloque-documentos", "04 · Fuentes", "Documentos oficiales",
            "Los abres directamente en el Sistema Electrónico de Contrataciones Públicas.") + documentos(x) + "</section>" +
          '<section id="bloque-requisitos" aria-labelledby="bloque-requisitos-titulo">' + cabeza("bloque-requisitos", "05 · Participar", "Qué debes presentar", "") +
            '<div class="x-aviso">' + AVISO + "<p>Los requisitos de este proceso están en el pliego de condiciones y sus enmiendas. Ábrelos desde los documentos oficiales o en el SECP antes de preparar tu oferta. " + secp(x, "b-enlace", "Ver el expediente oficial") + "</p></div>" +
            '<div class="x-descargas"><p class="s-note">Descarga la ficha completa:</p>' + descarga(x, "ficha.pdf", "Ficha en PDF") + "</div>" +
          "</section>" +
          '<section class="s-band x-cierre" aria-labelledby="cierre-titulo"><p class="b-antetitulo"><span class="b-guion" aria-hidden="true"></span>Tu próximo paso</p>' +
            '<h2 class="b-h2 b-x" id="cierre-titulo">Sigue este proceso y recibe sus cambios.</h2>' +
            '<p class="b-entrada" style="margin-top: 16px">Crea tu cuenta gratis y te avisamos si cambian las fechas, llegan enmiendas o se adjudica.</p>' +
            '<div class="x-cierre-botones"><a class="b-btn b-primario b-lg" href="' + texto(seguir(x)) + '">' + SEGUIR + "Seguir este proceso</a>" +
            '<a class="b-btn b-secundario b-lg" href="/app/#/oportunidades">Ver más licitaciones' + FLECHA + "</a></div>" +
          "</section>" +
        "</div>" +
      "</div></section>";
    var pie = document.querySelectorAll("[data-solo-con-expediente]");
    for (var i = 0; i < pie.length; i++) pie[i].hidden = false;
    if (location.hash) { var destino = document.getElementById(location.hash.slice(1)); if (destino) destino.scrollIntoView(); }
  }

  function sinExpediente(mensaje) {
    var estado = raiz.querySelector("[data-estado]");
    if (estado) { estado.textContent = mensaje; return; }
    raiz.innerHTML = '<section class="s-hero x-hero"><div class="b-wrap"><p class="s-crumbs"><a href="/">Inicio</a><span aria-hidden="true">›</span><span>Expediente público</span></p>' +
      '<h1 class="b-x s-h1 x-titulo">Expediente público</h1><p class="x-estado" role="status">' + texto(mensaje) + "</p>" +
      '<div class="x-cierre-botones"><a class="b-btn b-primario" href="/app/#/oportunidades">Abrir el Explorador' + FLECHA + "</a></div></div></section>";
  }

  var visible = "";
  var temporizador = 0;
  function actualizar() {
    clearTimeout(temporizador);
    var siguiente = CINCO_MINUTOS;
    fetch(API, { credentials: "omit", cache: "no-store", headers: { "Accept": "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("sin_expediente"); return r.json(); })
      .then(function (datos) {
        var x = datos && datos.expediente;
        var servido = Date.parse(datos && datos.servido_en) || Date.now();
        var vigencia = x && x.codigo ? Date.parse(x.vence_en) - servido : 0;
        if (vigencia > 0) {
          var firma = JSON.stringify(x);
          if (firma !== visible) { visible = firma; pintar(x); }
          siguiente = Math.min(CINCO_MINUTOS, vigencia + 500);
        } else {
          visible = "";
          sinExpediente("Ahora mismo no hay un expediente vigente destacado. Vuelve en unos minutos o busca en el Explorador.");
          siguiente = 60000;
        }
      })
      .catch(function () {
        if (!visible) sinExpediente("El expediente no está disponible en este momento. Vuelve en unos minutos o busca en el Explorador.");
        siguiente = 60000;
      })
      .then(function () { temporizador = setTimeout(actualizar, siguiente); });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) actualizar(); });
  actualizar();
})();
