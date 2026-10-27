/* recursos.js — Buscador de Recursos. Filtra en el navegador sobre /recursos/indice.json: no envía lo que se escribe a ningún
   servidor, no guarda nada y no usa servicios externos. Si el archivo no carga, la lista completa sigue ahí. */
(function () {
  "use strict";
  var campo = document.getElementById("rec-q");
  var rejilla = document.getElementById("rec-rejilla");
  if (!campo || !rejilla) return;

  var original = rejilla.innerHTML;
  var indice = null;
  var cargando = false;
  var ocultables = document.querySelectorAll(".rec-destacados, .rec-subtitulo, .rec-paginacion, .rec-categorias");

  function normalizar(texto) {
    return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function tarjeta(a) {
    var art = document.createElement("article");
    art.className = "rec-tarjeta";
    var cont = document.createElement("div");
    cont.className = "rec-tarjeta-img";
    var img = document.createElement("img");
    img.src = a.imagen; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
    cont.appendChild(img);
    var cuerpo = document.createElement("div");
    cuerpo.className = "rec-tarjeta-cuerpo";
    var chip = document.createElement("span");
    chip.className = "rec-chip"; chip.textContent = a.categoria;
    var h3 = document.createElement("h3");
    var enlace = document.createElement("a");
    enlace.href = "/recursos/" + a.slug + "/"; enlace.textContent = a.titulo;
    h3.appendChild(enlace);
    var p = document.createElement("p"); p.textContent = a.extracto;
    var t = document.createElement("time"); t.setAttribute("datetime", a.fecha); t.textContent = a.fecha_larga;
    cuerpo.appendChild(chip); cuerpo.appendChild(h3); cuerpo.appendChild(p); cuerpo.appendChild(t);
    art.appendChild(cont); art.appendChild(cuerpo);
    return art;
  }

  function mostrar(resultados, consulta) {
    rejilla.textContent = "";
    if (!resultados.length) {
      var vacio = document.createElement("p");
      vacio.className = "rec-vacio";
      vacio.textContent = "No encontramos guías para «" + consulta + "». Prueba con otra palabra, por ejemplo «pliego», «RPE» o «oferta».";
      rejilla.appendChild(vacio);
      return;
    }
    resultados.forEach(function (a) { rejilla.appendChild(tarjeta(a)); });
  }

  function buscar() {
    var consulta = campo.value.trim();
    var vacia = consulta.length === 0;
    ocultables.forEach(function (e) { e.style.display = vacia ? "" : "none"; });
    if (vacia) { rejilla.innerHTML = original; return; }
    if (!indice) return;
    var terminos = normalizar(consulta).split(/\s+/).filter(Boolean);
    var resultados = indice.filter(function (a) {
      var pajar = normalizar([a.titulo, a.extracto, a.categoria, a.palabra_clave].join(" "));
      return terminos.every(function (t) { return pajar.indexOf(t) !== -1; });
    });
    mostrar(resultados, consulta);
  }

  function cargarIndice() {
    if (indice || cargando) return;
    cargando = true;
    fetch("/recursos/indice.json", { credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) { indice = d.articulos || []; buscar(); })
      .catch(function () { cargando = false; });
  }

  campo.addEventListener("focus", cargarIndice);
  campo.addEventListener("input", function () { cargarIndice(); buscar(); });
})();
