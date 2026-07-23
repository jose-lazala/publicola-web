/**
 * inscripcion.js - Formulario de inscripcion al Radar Publicola (primera
 * edicion gratuita). JavaScript puro, sin librerias externas ni CDN.
 *
 * Privacidad (Ley 172-13): nada de lo que la persona escribe aqui se
 * guarda en localStorage, sessionStorage ni cookies. Los datos solo
 * viven en memoria mientras la pagina esta abierta y se mandan una sola
 * vez, por fetch, al Worker de inscripcion cuando la persona envia el
 * formulario.
 */

// ============================================================
// CONFIGURACION
// ============================================================

const RUTA_JSON_RUBROS = "rubros.json";

// Archivo opcional de sinonimos (palabra comun -> codigo de area de dos
// digitos), para un encargo futuro. Hoy no existe: si el fetch falla (404
// u otro error), la busqueda sigue funcionando igual sobre los nombres
// oficiales, sin romper nada. Formato esperado cuando exista: un objeto
// JSON plano, por ejemplo { "abogado": "80", "construccion": "30" }.
const RUTA_JSON_SINONIMOS = "rubros_sinonimos.json";

// Misma direccion del Worker publicola-inscripcion que usa la ruta
// /lista, cambiando el final por /inscripcion.
const URL_INSCRIPCION_WORKER = "https://publicola-inscripcion.publicola.workers.dev/inscripcion";

// Version vigente de la politica de privacidad (web/politica-de-privacidad.html).
// Si esa pagina cambia de version, actualizar esta constante tambien.
const VERSION_POLITICA_ACTUAL = "1.4";

const MAXIMO_RUBROS = 3;

// Nombre exacto que espera el Worker para el campo trampa (honeypot).
const NOMBRE_CAMPO_TRAMPA = "sitio_web";

const MENSAJE_EXITO =
  "Inscripción registrada. Te enviamos la primera edición del Radar de tu rubro sin costo, en cuanto haya procesos publicados en los rubros que escogiste. No se te escribe por ningún otro motivo.";

const MENSAJE_ERROR_CONEXION =
  "No pudimos enviar tu inscripción. Revisa tu conexión e inténtalo de nuevo.";

const MENSAJE_ERROR_CARGA_RUBROS =
  "En este momento no podemos cargar la lista de rubros. Intenta más tarde.";

// Forma minima de un correo, igual que la validacion del Worker.
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================
// ESTADO
// ============================================================

let areasDisponibles = []; // [{ codigo, nombre }], cargado de rubros.json
let sinonimos = {}; // palabra -> codigo de area (vacio si el archivo no existe)
let rubrosElegidos = []; // [{ codigo, nombre }], orden = prioridad del boletin
let enviandoActualmente = false;

// ============================================================
// UTILIDADES
// ============================================================

function normalizarTexto(texto) {
  return texto
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) {
    elemento.className = clase;
  }
  if (texto !== undefined) {
    elemento.textContent = texto;
  }
  return elemento;
}

// ============================================================
// CARGA DE DATOS
// ============================================================

async function cargarAreas() {
  const respuesta = await fetch(RUTA_JSON_RUBROS);
  if (!respuesta.ok) {
    throw new Error("No se pudo leer " + RUTA_JSON_RUBROS + " (HTTP " + respuesta.status + ")");
  }
  const datos = await respuesta.json();
  if (!datos || !Array.isArray(datos.areas)) {
    throw new Error("rubros.json no tiene la forma esperada (falta 'areas').");
  }
  return datos.areas.map(function (area) {
    return { codigo: area.codigo_segmento, nombre: area.area };
  });
}

async function cargarSinonimos() {
  try {
    const respuesta = await fetch(RUTA_JSON_SINONIMOS);
    if (!respuesta.ok) {
      return {};
    }
    const datos = await respuesta.json();
    return datos && typeof datos === "object" && !Array.isArray(datos) ? datos : {};
  } catch (error) {
    return {};
  }
}

// ============================================================
// ELEMENTOS DEL DOM
// ============================================================

const formulario = document.getElementById("formulario-inscripcion");
const campoCorreo = document.getElementById("campo-correo");
const campoEmpresa = document.getElementById("campo-empresa");
const campoBusquedaRubro = document.getElementById("campo-busqueda-rubro");
const listaSugerencias = document.getElementById("lista-sugerencias-rubro");
const listaRubrosElegidos = document.getElementById("lista-rubros-elegidos");
const campoConsentimiento = document.getElementById("campo-consentimiento");
const campoComunicaciones = document.getElementById("campo-comunicaciones");
const campoTrampa = document.getElementById(NOMBRE_CAMPO_TRAMPA);
const botonEnviar = document.getElementById("boton-enviar-inscripcion");
const mensajeEnvio = document.getElementById("mensaje-envio");

// ============================================================
// ERRORES DE CAMPO
// ============================================================

function mostrarErrorCampo(nombre) {
  const elemento = document.getElementById("error-" + nombre);
  if (elemento) {
    elemento.hidden = false;
  }
}

function ocultarErrorCampo(nombre) {
  const elemento = document.getElementById("error-" + nombre);
  if (elemento) {
    elemento.hidden = true;
  }
}

// ============================================================
// SELECTOR DE RUBROS
// ============================================================

function buscarAreas(consulta) {
  const textoBuscado = normalizarTexto(consulta);
  if (!textoBuscado) {
    return [];
  }

  const codigosElegidos = new Set(rubrosElegidos.map(function (r) { return r.codigo; }));

  // Codigos que coinciden por sinonimo (mapa vacio si el archivo no existe
  // todavia: simplemente no aporta resultados extra).
  const codigosPorSinonimo = new Set();
  Object.keys(sinonimos).forEach(function (palabra) {
    if (normalizarTexto(palabra).includes(textoBuscado)) {
      codigosPorSinonimo.add(sinonimos[palabra]);
    }
  });

  return areasDisponibles
    .filter(function (area) {
      if (codigosElegidos.has(area.codigo)) {
        return false;
      }
      const coincideNombre = normalizarTexto(area.nombre).includes(textoBuscado);
      const coincideSinonimo = codigosPorSinonimo.has(area.codigo);
      return coincideNombre || coincideSinonimo;
    })
    .slice(0, 8);
}

function mostrarSugerencias(areas) {
  listaSugerencias.innerHTML = "";
  if (areas.length === 0) {
    listaSugerencias.hidden = true;
    return;
  }
  areas.forEach(function (area) {
    const item = document.createElement("li");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "inscripcion-sugerencia-boton";
    boton.textContent = area.codigo + " · " + area.nombre;
    boton.addEventListener("click", function () {
      elegirArea(area);
    });
    item.appendChild(boton);
    listaSugerencias.appendChild(item);
  });
  listaSugerencias.hidden = false;
}

function ocultarSugerencias() {
  listaSugerencias.hidden = true;
  listaSugerencias.innerHTML = "";
}

function actualizarEstadoBusquedaRubro() {
  const limiteAlcanzado = rubrosElegidos.length >= MAXIMO_RUBROS;
  campoBusquedaRubro.disabled = limiteAlcanzado;
  if (limiteAlcanzado) {
    ocultarSugerencias();
    campoBusquedaRubro.value = "";
  }
}

function renderizarRubrosElegidos() {
  listaRubrosElegidos.innerHTML = "";
  rubrosElegidos.forEach(function (area, indice) {
    const esPrincipal = indice === 0;
    const item = crearElemento("li", "inscripcion-rubro-elegido" + (esPrincipal ? " inscripcion-rubro-principal" : ""));

    item.appendChild(crearElemento("span", "inscripcion-rubro-elegido-nombre", area.codigo + " · " + area.nombre));

    const botonQuitar = document.createElement("button");
    botonQuitar.type = "button";
    botonQuitar.className = "inscripcion-quitar-rubro";
    botonQuitar.textContent = "Quitar";
    botonQuitar.setAttribute("aria-label", "Quitar " + area.nombre);
    botonQuitar.addEventListener("click", function () {
      quitarArea(area.codigo);
    });
    item.appendChild(botonQuitar);

    if (esPrincipal) {
      item.appendChild(crearElemento("p", "inscripcion-nota-principal", "Este es tu rubro principal."));
    }

    listaRubrosElegidos.appendChild(item);
  });
}

function elegirArea(area) {
  if (rubrosElegidos.length >= MAXIMO_RUBROS) {
    return;
  }
  if (rubrosElegidos.some(function (r) { return r.codigo === area.codigo; })) {
    return;
  }
  rubrosElegidos.push(area);
  renderizarRubrosElegidos();
  ocultarSugerencias();
  campoBusquedaRubro.value = "";
  actualizarEstadoBusquedaRubro();
  ocultarErrorCampo("rubros");
  if (!campoBusquedaRubro.disabled) {
    campoBusquedaRubro.focus();
  }
}

// Al quitar un rubro, el orden del arreglo se recalcula solo: el que
// quede primero pasa a ser el principal automaticamente, porque
// renderizarRubrosElegidos() siempre marca el indice 0 como tal.
function quitarArea(codigo) {
  rubrosElegidos = rubrosElegidos.filter(function (r) { return r.codigo !== codigo; });
  renderizarRubrosElegidos();
  actualizarEstadoBusquedaRubro();
}

function inicializarSelectorRubros() {
  campoBusquedaRubro.addEventListener("input", function () {
    if (campoBusquedaRubro.disabled) {
      return;
    }
    mostrarSugerencias(buscarAreas(campoBusquedaRubro.value));
  });

  // Cierra la lista de sugerencias al tocar fuera de ella o del campo.
  document.addEventListener("click", function (evento) {
    if (listaSugerencias.contains(evento.target) || evento.target === campoBusquedaRubro) {
      return;
    }
    ocultarSugerencias();
  });
}

// ============================================================
// VALIDACION (en el navegador; el Worker vuelve a validar del lado del
// servidor y no confia en esto)
// ============================================================

function validarFormulario() {
  let valido = true;
  let primerCampoInvalido = null;

  const correo = campoCorreo.value.trim();
  if (!PATRON_CORREO.test(correo)) {
    mostrarErrorCampo("correo");
    campoCorreo.setAttribute("aria-invalid", "true");
    valido = false;
    primerCampoInvalido = primerCampoInvalido || campoCorreo;
  } else {
    ocultarErrorCampo("correo");
    campoCorreo.removeAttribute("aria-invalid");
  }

  const empresa = campoEmpresa.value.trim();
  if (!empresa) {
    mostrarErrorCampo("empresa");
    campoEmpresa.setAttribute("aria-invalid", "true");
    valido = false;
    primerCampoInvalido = primerCampoInvalido || campoEmpresa;
  } else {
    ocultarErrorCampo("empresa");
    campoEmpresa.removeAttribute("aria-invalid");
  }

  const mipymeElegido = formulario.querySelector('input[name="mipyme"]:checked');
  if (!mipymeElegido) {
    mostrarErrorCampo("mipyme");
    valido = false;
    primerCampoInvalido = primerCampoInvalido || formulario.querySelector('input[name="mipyme"]');
  } else {
    ocultarErrorCampo("mipyme");
  }

  if (rubrosElegidos.length === 0) {
    mostrarErrorCampo("rubros");
    valido = false;
    primerCampoInvalido = primerCampoInvalido || campoBusquedaRubro;
  } else {
    ocultarErrorCampo("rubros");
  }

  if (!campoConsentimiento.checked) {
    mostrarErrorCampo("consentimiento");
    valido = false;
    primerCampoInvalido = primerCampoInvalido || campoConsentimiento;
  } else {
    ocultarErrorCampo("consentimiento");
  }

  if (primerCampoInvalido) {
    primerCampoInvalido.focus();
  }

  return valido;
}

// ============================================================
// ENVIO
// ============================================================

function restablecerBoton() {
  botonEnviar.disabled = false;
  botonEnviar.textContent = "Enviar inscripción";
}

function mostrarMensajeEnvio(texto) {
  mensajeEnvio.textContent = texto;
  mensajeEnvio.hidden = false;
}

function ocultarMensajeEnvio() {
  mensajeEnvio.hidden = true;
  mensajeEnvio.textContent = "";
}

function mostrarExito() {
  formulario.hidden = true;
  mostrarMensajeEnvio(MENSAJE_EXITO);
}

async function manejarEnvioFormulario(evento) {
  evento.preventDefault();

  if (enviandoActualmente) {
    return;
  }
  if (!validarFormulario()) {
    return;
  }

  enviandoActualmente = true;
  botonEnviar.disabled = true;
  botonEnviar.textContent = "Enviando…";
  ocultarMensajeEnvio();

  const cuerpo = {
    correo: campoCorreo.value.trim(),
    empresa: campoEmpresa.value.trim(),
    mipyme: formulario.querySelector('input[name="mipyme"]:checked').value,
    rubro_estrella: rubrosElegidos[0].codigo,
    rubro_2: rubrosElegidos[1] ? rubrosElegidos[1].codigo : "",
    rubro_3: rubrosElegidos[2] ? rubrosElegidos[2].codigo : "",
    politica_version: VERSION_POLITICA_ACTUAL,
    consentimiento: true,
    consentimiento_comercial: campoComunicaciones.checked ? 1 : 0,
  };
  cuerpo[NOMBRE_CAMPO_TRAMPA] = campoTrampa.value;

  try {
    const respuestaFetch = await fetch(URL_INSCRIPCION_WORKER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const datos = await respuestaFetch.json().catch(function () {
      return null;
    });

    if (datos && datos.ok) {
      mostrarExito();
    } else if (datos && typeof datos.mensaje === "string") {
      // Mensaje de error tal como lo devuelve el Worker, sin cambiarlo.
      mostrarMensajeEnvio(datos.mensaje);
      restablecerBoton();
    } else {
      mostrarMensajeEnvio(MENSAJE_ERROR_CONEXION);
      restablecerBoton();
    }
  } catch (error) {
    console.error("Inscripción: error de conexión con el Worker:", error);
    mostrarMensajeEnvio(MENSAJE_ERROR_CONEXION);
    restablecerBoton();
  } finally {
    enviandoActualmente = false;
  }
}

// ============================================================
// ARRANQUE
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  formulario.addEventListener("submit", manejarEnvioFormulario);
  inicializarSelectorRubros();

  Promise.all([cargarAreas(), cargarSinonimos()])
    .then(function (resultados) {
      areasDisponibles = resultados[0];
      sinonimos = resultados[1];
    })
    .catch(function (error) {
      console.error("Inscripción: error cargando rubros.json:", error);
      campoBusquedaRubro.disabled = true;
      campoBusquedaRubro.placeholder = MENSAJE_ERROR_CARGA_RUBROS;
      mostrarErrorCampo("rubros");
    });
});
