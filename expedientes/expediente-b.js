/* expediente-b.js — /expedientes/ en el diseño B. Pinta el expediente destacado REAL que devuelve
   /api/v1/expedientes/destacado (el mismo que enseña la portada). Solo datos publicados por la DGCP y la lectura
   del pliego que ya hizo Publicola: si un dato no viene, no se inventa; se dice que no está o se envía al SECP.
   Los renglones siguen el diseño aprobado de la ficha (suma estimada, renglones de mayor importe con su porcentaje,
   búsqueda y orden). */
(function () {
  "use strict";
  var raiz = document.querySelector("[data-expediente]");
  if (!raiz || typeof window.fetch !== "function") return;

  var API = "/api/v1/expedientes/destacado";
  var CINCO_MINUTOS = 5 * 60 * 1000;
  var TRAMO = 30;
  var MESES = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
  var FLECHA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var SALIR = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  var SEGUIR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v17l-5-4-5 4z"/></svg>';
  var BAJAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M6 11l6 6 6-6M5 20h14"/></svg>';
  var AVISO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>';
  var BUSCAR = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>';
  var SOBRES = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="m3 8 9 6 9-6"/></svg>';

  var numero = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });
  var monto = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var texto = function (valor) {
    return String(valor == null ? "" : valor).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var urlSegura = function (url) {
    try { var u = new URL(url, location.href); return u.protocol === "https:" ? u.href : ""; }
    catch (e) { return ""; }
  };
  var normalizar = function (valor) {
    return String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  };
  var valor = function (v) { var n = Number(String(v == null ? "" : v).replace(/,/g, "")); return v == null || v === "" || isNaN(n) ? null : n; };
  // Las fechas de la DGCP traen la hora de pared de Santo Domingo (aunque algunas lleven «Z»): se leen tal cual.
  var partes = function (v) { return String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/); };
  var fecha = function (v) {
    var p = partes(v);
    if (!p || !MESES[Number(p[2]) - 1]) return "";
    var dia = Number(p[3]) + " " + MESES[Number(p[2]) - 1] + " " + p[1];
    if (p[4] === undefined || (p[4] === "00" && p[5] === "00")) return dia;
    var h = Number(p[4]);
    return dia + " · " + (h % 12 || 12) + ":" + p[5] + " " + (h < 12 ? "a. m." : "p. m.");
  };
  var instante = function (v) {
    var p = partes(v);
    return p ? Date.parse(p[1] + "-" + p[2] + "-" + p[3] + "T" + (p[4] || "23") + ":" + (p[5] || "59") + ":00-04:00") : NaN;
  };
  var faltan = function (ms) {
    if (!(ms > 0)) return "";
    var horas = Math.floor(ms / 3600000);
    if (horas < 1) return "Cierra en menos de una hora";
    if (horas < 48) return "Faltan " + horas + (horas === 1 ? " hora" : " horas");
    return "Faltan " + Math.floor(horas / 24) + " días";
  };
  var seguir = function (x) { return "/app/?acceso=crear#/oportunidades?seleccion=" + encodeURIComponent(x.codigo); };
  var descargas = function (x, etiqueta, archivos) {
    return '<div class="x-descargas"><p class="s-note">' + texto(etiqueta) + "</p>" + archivos.map(function (a) {
      return '<a class="b-btn b-secundario b-sm" href="' + texto(API + "/" + encodeURIComponent(x.codigo) + "/descargas/" + a[0]) + '" download>' + BAJAR + texto(a[1]) + "</a>";
    }).join("") + "</div>";
  };
  var secp = function (x, clase, etiqueta) {
    var url = urlSegura(x.url_oficial);
    return url ? '<a class="' + clase + '" href="' + texto(url) + '" target="_blank" rel="noopener noreferrer">' + texto(etiqueta || "Abrir en el SECP") + SALIR + "</a>" : "";
  };
  var cita = function (c) {
    var etiqueta = (c.documento || "Pliego") + (c.pagina ? " · pág. " + c.pagina : "");
    var url = urlSegura(c.url);
    return url
      ? '<a class="x-cita" href="' + texto(url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + texto("Ver en " + etiqueta) + '">' + texto(etiqueta) + SALIR + "</a>"
      : '<span class="x-cita">' + texto(etiqueta) + "</span>";
  };
  var cabeza = function (id, antetitulo, titulo, nota) {
    return '<div class="x-bloque-cabeza"><div><p class="b-antetitulo"><span class="b-rombo" aria-hidden="true"></span>' + texto(antetitulo) +
      '</p><h2 class="b-h2 b-x" id="' + id + '-titulo">' + texto(titulo) + "</h2></div>" + (nota ? '<p class="s-note">' + nota + "</p>" : "") + "</div>";
  };
  var aviso = function (html) { return '<div class="x-aviso">' + AVISO + "<p>" + html + "</p></div>"; };

  /* ---------- Renglones: diseño aprobado de la ficha ---------- */
  function filasDeRenglones(x) {
    return (x.renglones || []).map(function (r, i) {
      var cantidad = valor(r.cantidad_valor != null ? r.cantidad_valor : r.cantidad);
      var precio = valor(r.precio_unitario_valor);
      var importe = valor(r.total_estimado_valor);
      if (importe == null && cantidad != null && precio != null) importe = cantidad * precio;
      return { r: r, i: i, cantidad: cantidad, precio: precio, importe: importe,
        palabras: normalizar([r.numero, r.descripcion, r.categoria, r.unspsc].join(" ")) };
    });
  }

  function resumenDeRenglones(x, filas) {
    var dop = filas.every(function (f) { return (f.r.moneda || "DOP") === "DOP" && f.importe != null && f.importe >= 0; });
    var suma = dop ? filas.reduce(function (s, f) { return s + f.importe; }, 0) : 0;
    var estimacion = dop && suma > 0 ? (x.total_renglones || "RD$ " + monto.format(suma)) : "";
    var unidades = filas.every(function (f) { return f.cantidad != null && /^(unidad(es)?|und\.?|ud\.?)$/i.test(String(f.r.unidad || "").trim()); })
      ? filas.reduce(function (s, f) { return s + f.cantidad; }, 0) : null;
    var cuenta = (filas.length === 1 ? "1 renglón" : numero.format(filas.length) + " renglones") +
      (unidades == null ? "" : " · " + numero.format(unidades) + (unidades === 1 ? " unidad" : " unidades"));
    var mayores = suma > 0 && filas.length > 4
      ? filas.filter(function (f) { return f.importe > 0; }).sort(function (a, b) { return b.importe - a.importe; }).slice(0, 4) : [];
    var pct = function (v) { return Math.round(v / suma * 100); };
    var parteMayores = mayores.reduce(function (s, f) { return s + f.importe; }, 0);
    return '<div class="x-renglones-resumen">' +
      '<div class="x-renglones-monto">' + (estimacion ? "<span>Suma estimada de los renglones</span><strong>" + texto(estimacion) + "</strong>" : "") +
        "<p>" + texto(cuenta) + "</p></div>" +
      (mayores.length ? '<div class="x-renglones-distribucion">' +
        "<h3>Renglones de mayor importe <span>" + pct(parteMayores) + " % de la suma</span></h3>" +
        '<div class="x-barra" aria-hidden="true">' + mayores.map(function (f, n) {
          return '<span class="x-barra-' + n + '" style="width:' + (f.importe / suma * 100).toFixed(4) + '%"></span>';
        }).join("") + "</div>" +
        "<ul>" + mayores.map(function (f, n) {
          return '<li><button type="button" data-ir-renglon="' + f.i + '"><i class="x-barra-' + n + '" aria-hidden="true"></i>' +
            "<span>" + texto(f.r.numero != null ? f.r.numero + ". " : "") + texto(f.r.descripcion) + "</span><strong>" + pct(f.importe) + " %</strong></button></li>";
        }).join("") + "</ul></div>" : "") +
    "</div>";
  }

  function renglones(x) {
    var filas = filasDeRenglones(x);
    if (!filas.length) return aviso("Todavía no tenemos los renglones publicados para este proceso. " + secp(x, "b-enlace", "Consultarlos en el SECP"));
    var controles = filas.length > 1
      ? '<div class="x-filtros"><label class="x-buscar">' + BUSCAR + '<span class="b-sr">Buscar renglón</span>' +
        '<input type="search" data-buscar-renglones placeholder="Buscar por descripción o número" autocomplete="off"></label>' +
        '<label class="x-orden"><span class="b-sr">Ordenar renglones</span><select data-orden-renglones>' +
        '<option value="oficial">Orden del expediente</option>' +
        (filas.some(function (f) { return f.importe != null; }) ? '<option value="importe">Mayor importe</option>' : "") +
        '<option value="cantidad">Mayor cantidad</option><option value="nombre">Descripción A–Z</option></select></label></div>'
      : "";
    var cuerpo = filas.map(function (f) {
      var r = f.r;
      return '<tr id="renglon-' + f.i + '" tabindex="-1" data-renglon="' + f.i + '">' +
        '<td class="x-num">' + texto(r.numero != null ? r.numero : "—") + "</td>" +
        '<td class="x-desc">' + texto(r.descripcion) + (r.categoria ? "<small>" + texto(r.categoria) + (r.unspsc ? " · UNSPSC " + texto(r.unspsc) : "") + "</small>" : "") + "</td>" +
        '<td class="x-cifra" data-etiqueta="Cantidad">' + texto([r.cantidad, r.unidad].filter(Boolean).join(" ") || "—") + "</td>" +
        '<td class="x-cifra" data-etiqueta="Precio unitario">' + texto(r.precio_unitario || "—") + "</td>" +
        '<td class="x-cifra" data-etiqueta="Total estimado">' + texto(r.total_estimado || (f.importe != null ? "RD$ " + monto.format(f.importe) : "—")) + "</td></tr>";
    }).join("");
    return '<div class="x-renglones" data-renglones>' + resumenDeRenglones(x, filas) + controles +
      '<div class="x-renglones-meta"><span role="status" data-cuenta-renglones></span><span>Montos de referencia de la institución</span></div>' +
      '<div class="x-tabla-marco"><table class="x-tabla"><caption class="b-sr">Renglones publicados del proceso ' + texto(x.codigo) + "</caption>" +
      '<thead><tr><th scope="col">N.º</th><th scope="col">Descripción</th><th scope="col" class="x-cifra">Cantidad</th><th scope="col" class="x-cifra">Precio unitario</th><th scope="col" class="x-cifra">Total estimado</th></tr></thead>' +
      "<tbody>" + cuerpo + "</tbody></table></div>" +
      '<p class="s-note" data-sin-renglones hidden>No hay renglones con esa búsqueda.</p>' +
      (filas.length > TRAMO ? '<div class="x-mas"><button class="b-btn b-secundario b-sm" type="button" data-todos-renglones>Ver los ' + filas.length + " renglones</button></div>" : "") +
      "</div>" + descargas(x, "Descarga los renglones:", [["renglones.xlsx", "Excel"], ["renglones.pdf", "PDF"], ["renglones.docx", "Word"]]);
  }

  function activarRenglones(x) {
    var caja = raiz.querySelector("[data-renglones]");
    if (!caja) return;
    var filas = filasDeRenglones(x);
    var tbody = caja.querySelector("tbody");
    var nodos = {};
    Array.prototype.forEach.call(tbody.querySelectorAll("[data-renglon]"), function (tr) { nodos[tr.getAttribute("data-renglon")] = tr; });
    var buscar = caja.querySelector("[data-buscar-renglones]");
    var orden = caja.querySelector("[data-orden-renglones]");
    var cuenta = caja.querySelector("[data-cuenta-renglones]");
    var vacio = caja.querySelector("[data-sin-renglones]");
    var todos = caja.querySelector("[data-todos-renglones]");
    var limite = filas.length > TRAMO ? TRAMO : filas.length;
    function pintar() {
      var q = normalizar(buscar ? buscar.value.trim() : "");
      var lista = filas.filter(function (f) { return !q || f.palabras.indexOf(q) >= 0; });
      var o = orden ? orden.value : "oficial";
      lista.sort(function (a, b) {
        if (o === "importe") return (b.importe || 0) - (a.importe || 0);
        if (o === "cantidad") return (b.cantidad || 0) - (a.cantidad || 0);
        if (o === "nombre") return String(a.r.descripcion).localeCompare(String(b.r.descripcion), "es");
        return a.i - b.i;
      });
      var visibles = q ? lista.length : Math.min(limite, lista.length);
      filas.forEach(function (f) { nodos[f.i].hidden = true; });
      lista.forEach(function (f, n) { tbody.appendChild(nodos[f.i]); nodos[f.i].hidden = n >= visibles; });
      vacio.hidden = lista.length > 0;
      if (todos) todos.parentNode.hidden = q !== "" || limite >= filas.length;
      cuenta.textContent = q ? lista.length + (lista.length === 1 ? " renglón encontrado" : " renglones encontrados")
        : visibles < filas.length ? visibles + " de " + filas.length + " renglones" : "";
    }
    if (buscar) buscar.addEventListener("input", pintar);
    if (orden) orden.addEventListener("change", pintar);
    if (todos) todos.addEventListener("click", function () { limite = filas.length; pintar(); });
    Array.prototype.forEach.call(caja.querySelectorAll("[data-ir-renglon]"), function (b) {
      b.addEventListener("click", function () {
        var i = b.getAttribute("data-ir-renglon");
        if (buscar && buscar.value) { buscar.value = ""; }
        limite = filas.length; pintar();
        var tr = nodos[i]; tr.scrollIntoView({ block: "center" }); tr.focus({ preventScroll: true });
        tr.classList.add("x-resaltado"); setTimeout(function () { tr.classList.remove("x-resaltado"); }, 1800);
      });
    });
    pintar();
  }

  /* ---------- Qué debes presentar: la misma lectura del pliego que la ficha de la app ---------- */
  function requisitos(x) {
    var q = x.requisitos;
    if (!q || !(q.momentos || []).length) {
      return aviso("Los requisitos de este proceso están en el pliego de condiciones y sus enmiendas. Ábrelos en el SECP antes de preparar tu oferta. " + secp(x, "b-enlace", "Ver el expediente oficial"));
    }
    var sobres = q.presentacion && q.presentacion.texto
      ? '<div class="b-panel x-sobres"><span class="x-sobres-icono">' + SOBRES + "</span><div>" +
        "<h3>Cómo se entrega la oferta</h3><p>" + texto(q.presentacion.texto) + "</p>" +
        ((q.presentacion.canales || []).length ? '<p class="x-sobres-canales">' + q.presentacion.canales.map(texto).join(" · ") + "</p>" : "") +
        ((q.presentacion.citas || []).length ? '<p class="x-citas"><span>Lo dice el pliego en</span>' + q.presentacion.citas.map(cita).join("") + "</p>" : "") +
        "</div></div>"
      : "";
    var momentos = q.momentos.map(function (m) {
      return '<div class="x-momento"><h3 class="x-momento-titulo">' + texto(m.titulo) + (m.cantidad ? " <span>" + texto(m.cantidad) + "</span>" : "") + "</h3>" +
        m.grupos.map(function (g) {
          return '<section class="x-grupo"><header><h4>' + texto(g.titulo) + "</h4>" + (g.explicacion ? "<p>" + texto(g.explicacion) + "</p>" : "") + "</header>" +
            "<ol>" + g.items.map(function (r) {
              var marcas = (r.sobre ? '<span class="x-marca x-marca-sobre">Sobre ' + texto(r.sobre) + "</span>" : "") +
                (r.condicional ? '<span class="x-marca">Solo si aplica</span>' : "");
              // Si el mismo título se repite en el grupo (p. ej. una ficha técnica por partida), se distingue con el
              // comienzo del texto del pliego.
              var repetido = g.items.filter(function (o) { return o.titulo === r.titulo; }).length > 1;
              var detalle = repetido && r.texto ? String(r.texto).replace(/\s+/g, " ").slice(0, 120) + (String(r.texto).length > 120 ? "…" : "") : "";
              return '<li class="x-requisito"><div class="x-requisito-cabeza"><strong>' + texto(r.titulo) + "</strong>" + marcas + "</div>" +
                (detalle ? '<p class="x-requisito-detalle">' + texto(detalle) + "</p>" : "") +
                (r.texto && r.texto !== r.titulo ? '<details><summary>Lo que dice el pliego</summary><p>' + texto(r.texto) + "</p></details>" : "") +
                ((r.citas || []).length ? '<p class="x-citas">' + r.citas.map(cita).join("") + "</p>" : "") + "</li>";
            }).join("") + "</ol></section>";
        }).join("") + "</div>";
    }).join("");
    return (q.resumen ? '<p class="x-lead">' + texto(q.resumen) + "</p>" : "") + sobres + momentos +
      aviso("Lista preparada por Publicola a partir del pliego y sus anexos. Antes de presentar tu oferta, confirma cada documento en la página citada y revisa si hay enmiendas.") +
      descargas(x, "Descarga la lista:", [["requisitos.pdf", "PDF"], ["requisitos.docx", "Word"]]);
  }

  function hitos(x) {
    var ahora = Date.now();
    var lista = (x.fechas || []).filter(function (f) { return f && f.fecha && fecha(f.fecha); });
    if (!lista.length) return aviso("El cronograma no está publicado en los datos abiertos. " + secp(x, "b-enlace", "Consultarlo en el SECP"));
    return '<ol class="x-hitos">' + lista.map(function (f) {
      var pasado = instante(f.fecha) < ahora;
      return '<li class="x-hito' + (pasado ? " x-hito-pasado" : "") + (f.tipo === "cierre" ? " x-hito-clave" : "") + '"><span class="x-hito-marca" aria-hidden="true"></span>' +
        '<span class="x-hito-titulo">' + texto(f.titulo) + (pasado ? '<span class="b-sr"> (ya pasó)</span>' : "") + "</span>" +
        '<time datetime="' + texto(f.fecha) + '">' + texto(fecha(f.fecha)) + "</time></li>";
    }).join("") + "</ol>";
  }

  // «Condiciones publicadas» no se entendía: son los datos con que la institución registró la compra en el SECP.
  var NOMBRES = { "Modalidad": ["Tipo de procedimiento", "La forma de compra que fija la ley según el monto y el objeto."],
    "Tipo de contrato": ["Qué se compra", "Si son bienes, servicios u obras."],
    "Área requirente": ["Quién lo pidió", "El área de la institución que necesita la compra."],
    "Dirigido a": ["Quién puede participar", "Si está abierto a todos o reservado a MIPYMES u otro grupo."] };
  function datosDelProceso(x) {
    var filas = (x.condiciones || []).slice();
    if (x.dirigido_a) filas.push({ titulo: "Dirigido a", valor: x.dirigido_a });
    if (!filas.length) return "";
    return '<dl class="s-kv x-condiciones">' + filas.map(function (c) {
      var n = NOMBRES[c.titulo] || [c.titulo, ""];
      return "<div><dt>" + texto(n[0]) + "</dt><dd>" + texto(c.valor) + "</dd>" + (n[1] ? "<p>" + texto(n[1]) + "</p>" : "") + "</div>";
    }).join("") + "</dl>";
  }

  function documentos(x) {
    var lista = x.documentos || [];
    if (!lista.length) return aviso("Los documentos del proceso se consultan en el expediente oficial. " + secp(x, "b-enlace", "Abrir en el SECP"));
    return '<ul class="x-documentos">' + lista.map(function (d) {
      var url = urlSegura(d.url);
      return '<li class="x-documento"><span>' + texto(d.titulo || "Documento del proceso") + (d.tipo ? "<small>" + texto(d.tipo) + "</small>" : "") + "</span>" +
        (url ? '<a class="b-enlace b-enlace-sm" href="' + texto(url) + '" target="_blank" rel="noopener noreferrer">Abrir en el SECP' + SALIR + "</a>" : "") + "</li>";
    }).join("") + "</ul>";
  }

  function pintar(x) {
    var cierre = fecha(x.cierre);
    var restante = faltan(Date.parse(x.vence_en) - Date.now());
    var cuantos = x.requisitos && x.requisitos.momentos ? x.requisitos.momentos.reduce(function (s, m) { return s + (Number(m.cantidad) || 0); }, 0) : 0;
    var indice = [["bloque-renglones", "Qué se compra"], ["bloque-requisitos", "Qué debes presentar"], ["bloque-fechas", "Fechas"],
      ["bloque-datos", "Datos del proceso"], ["bloque-documentos", "Documentos oficiales"]];
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
            "<div><dt>Qué debes presentar</dt><dd>" + (cuantos ? texto(cuantos) + " documentos" : "Ver el pliego") +
              '<small><a href="#bloque-requisitos">Ver la lista con su página</a></small></dd></div>' +
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
          '<section id="bloque-requisitos" aria-labelledby="bloque-requisitos-titulo">' + cabeza("bloque-requisitos", "02 · Participar", "Qué debes presentar",
            "Cada documento con la página del pliego donde se pide.") + requisitos(x) + "</section>" +
          '<section id="bloque-fechas" aria-labelledby="bloque-fechas-titulo">' + cabeza("bloque-fechas", "03 · Cronograma", "Fechas del proceso",
            "Hora de República Dominicana. Las enmiendas pueden moverlas: confírmalas en el SECP.") + hitos(x) + "</section>" +
          '<section id="bloque-datos" aria-labelledby="bloque-datos-titulo">' + cabeza("bloque-datos", "04 · En pocas palabras", "Datos del proceso",
            "Cómo registró la institución esta compra en el sistema de compras públicas.") + datosDelProceso(x) + "</section>" +
          '<section id="bloque-documentos" aria-labelledby="bloque-documentos-titulo">' + cabeza("bloque-documentos", "05 · Fuentes", "Documentos oficiales",
            "Los abres directamente en el Sistema Electrónico de Contrataciones Públicas.") + documentos(x) +
            descargas(x, "Descarga la ficha completa:", [["ficha.pdf", "PDF"], ["ficha.docx", "Word"]]) + "</section>" +
          '<section class="s-band x-cierre" aria-labelledby="cierre-titulo"><p class="b-antetitulo"><span class="b-guion" aria-hidden="true"></span>Tu próximo paso</p>' +
            '<h2 class="b-h2 b-x" id="cierre-titulo">Sigue este proceso y recibe sus cambios.</h2>' +
            '<p class="b-entrada" style="margin-top: 16px">Crea tu cuenta gratis y te avisamos si cambian las fechas, llegan enmiendas o se adjudica.</p>' +
            '<div class="x-cierre-botones"><a class="b-btn b-primario b-lg" href="' + texto(seguir(x)) + '">' + SEGUIR + "Seguir este proceso</a>" +
            '<a class="b-btn b-secundario b-lg" href="/app/#/oportunidades">Ver más licitaciones' + FLECHA + "</a></div>" +
          "</section>" +
        "</div>" +
      "</div></section>";
    activarRenglones(x);
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
