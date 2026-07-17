/**
 * licita.js - Chatbot "Licita" + seccion "Licitaciones de la semana".
 *
 * JavaScript puro, sin librerias externas. Lee web/procesos_semana.json
 * (el JSON "probadita" que genera modulos/exportador_web.py) y solo
 * muestra los campos teaser que ese JSON ya trae: institucion, objeto,
 * modalidad, fecha_limite_ofertas y dirigido_a. Este archivo NUNCA debe
 * inventar ni calcular dias habiles, adendas, precios historicos ni
 * montos: esos son diferenciadores del boletin pagado.
 *
 * Licita SOLO dice textos preaprobados (riesgo legal cero): no arma
 * frases libres a partir de lo que el usuario escribe, porque el
 * usuario nunca escribe texto libre, solo elige botones.
 *
 * Privacidad (Ley 172-13): nada de lo que el usuario elige en el chat
 * se guarda en localStorage, cookies ni ningun otro lado. La unica
 * forma en que esos datos salen de esta pagina es si el propio usuario
 * decide, al final, tocar el boton que abre WhatsApp.
 */

// ============================================================
// CONFIGURACION
// ============================================================

// Numero real de WhatsApp de Publicola, en formato internacional sin
// signos "+" ni espacios.
const NUMERO_WHATSAPP_PUBLICOLA = "18297856028";

const RUTA_JSON_PROCESOS = "procesos_semana.json";

// Cuantas tarjetas de muestra se ven en "Licitaciones de la semana".
const MAXIMO_TARJETAS_INICIO = 3;

const MENSAJE_ERROR_CARGA = "En este momento no podemos cargar las licitaciones, intenta más tarde.";

// ============================================================
// CARGA DE DATOS (con manejo de errores)
// ============================================================

async function cargarDatosProcesos() {
  const respuesta = await fetch(RUTA_JSON_PROCESOS);
  if (!respuesta.ok) {
    throw new Error("No se pudo leer " + RUTA_JSON_PROCESOS + " (HTTP " + respuesta.status + ")");
  }
  const datos = await respuesta.json();
  if (!datos || !Array.isArray(datos.rubros)) {
    throw new Error("El JSON de procesos no tiene la forma esperada (falta 'rubros').");
  }
  return datos;
}

// ============================================================
// SECCION "LICITACIONES DE LA SEMANA"
// ============================================================

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

function construirTarjetaLicitacion(nombreRubro, proceso) {
  const tarjeta = crearElemento("article", "tarjeta-licitacion");

  tarjeta.appendChild(crearElemento("span", "rubro-etiqueta", nombreRubro));
  tarjeta.appendChild(crearElemento("p", "institucion", proceso.institucion));
  tarjeta.appendChild(crearElemento("p", "objeto", proceso.objeto));

  const detalle = crearElemento(
    "p",
    "detalle",
    "Modalidad: " + proceso.modalidad + " · Fecha límite de ofertas: " + proceso.fecha_limite_ofertas
  );
  tarjeta.appendChild(detalle);

  return tarjeta;
}

function renderizarLicitacionesSemana(datos) {
  const contenedor = document.getElementById("lista-licitaciones");
  contenedor.innerHTML = "";

  // Toma el primer proceso de la muestra de cada rubro (en el orden que
  // ya viene del JSON) hasta juntar MAXIMO_TARJETAS_INICIO tarjetas, asi
  // se ve variedad de rubros en vez de repetir el mismo.
  const tarjetas = [];
  for (const entradaRubro of datos.rubros) {
    if (tarjetas.length >= MAXIMO_TARJETAS_INICIO) {
      break;
    }
    if (Array.isArray(entradaRubro.muestra) && entradaRubro.muestra.length > 0) {
      tarjetas.push({ rubro: entradaRubro.rubro, proceso: entradaRubro.muestra[0] });
    }
  }

  if (tarjetas.length === 0) {
    contenedor.appendChild(crearElemento("p", "mensaje-estado", MENSAJE_ERROR_CARGA));
    return;
  }

  for (const item of tarjetas) {
    contenedor.appendChild(construirTarjetaLicitacion(item.rubro, item.proceso));
  }
}

function mostrarErrorLicitacionesSemana() {
  const contenedor = document.getElementById("lista-licitaciones");
  contenedor.innerHTML = "";
  contenedor.appendChild(crearElemento("p", "mensaje-estado", MENSAJE_ERROR_CARGA));
}

// ============================================================
// CHATBOT LICITA
// ============================================================

// Estado de la conversacion. Vive solo en memoria: se pierde al
// recargar la pagina y nunca se escribe en cookies ni localStorage.
const estadoChat = {
  rubroElegido: null, // { rubro, total_abiertos, muestra }
  empresaConstituida: null, // true / false
  tieneRpe: null, // true / false
};

let elementoTranscurso = null;
let elementoControles = null;

function inicializarContenedorChat() {
  const contenedor = document.getElementById("licita-chat");
  contenedor.innerHTML = "";

  elementoTranscurso = crearElemento("div", "chat-transcurso");
  elementoControles = crearElemento("div", "chat-controles");

  contenedor.appendChild(elementoTranscurso);
  contenedor.appendChild(elementoControles);
}

function agregarBurbujaBot(texto) {
  elementoTranscurso.appendChild(crearElemento("p", "burbuja burbuja-bot", texto));
  elementoTranscurso.scrollTop = elementoTranscurso.scrollHeight;
}

function agregarBurbujaUsuario(texto) {
  elementoTranscurso.appendChild(crearElemento("p", "burbuja burbuja-usuario", texto));
  elementoTranscurso.scrollTop = elementoTranscurso.scrollHeight;
}

function limpiarControles() {
  elementoControles.innerHTML = "";
}

function agregarBotonControl(texto, claseExtra, alHacerClic) {
  const boton = crearElemento("button", "boton " + (claseExtra || ""), texto);
  boton.type = "button";
  boton.addEventListener("click", alHacerClic);
  elementoControles.appendChild(boton);
  return boton;
}

function mostrarErrorChatbot() {
  inicializarContenedorChat();
  agregarBurbujaBot(MENSAJE_ERROR_CARGA);
}

// --- Paso 1: elegir rubro ---
function mostrarPaso1(datos) {
  inicializarContenedorChat();
  agregarBurbujaBot("¡Hola! Somos el equipo de Publicola. ¿A qué se dedica tu empresa?");

  if (!datos.rubros || datos.rubros.length === 0) {
    agregarBurbujaBot(MENSAJE_ERROR_CARGA);
    return;
  }

  for (const entradaRubro of datos.rubros) {
    agregarBotonControl(entradaRubro.rubro, "boton-secundario", function () {
      estadoChat.rubroElegido = entradaRubro;
      agregarBurbujaUsuario(entradaRubro.rubro);
      limpiarControles();
      mostrarPaso2();
    });
  }
}

// --- Paso 2: mostrar 1 proceso de muestra del rubro elegido ---
function mostrarPaso2() {
  const rubro = estadoChat.rubroElegido;

  agregarBurbujaBot(
    "Esta semana salieron " + rubro.total_abiertos + " procesos en tu rubro. Mira uno:"
  );

  if (Array.isArray(rubro.muestra) && rubro.muestra.length > 0) {
    const proceso = rubro.muestra[0];
    agregarBurbujaBot(
      proceso.institucion + " — " + proceso.objeto + " (fecha límite: " + proceso.fecha_limite_ofertas + ")"
    );
  }

  agregarBotonControl("Continuar", "boton-secundario", function () {
    limpiarControles();
    mostrarPaso3();
  });
}

// --- Paso 3: empresa constituida ---
function mostrarPaso3() {
  agregarBurbujaBot("¿Tu empresa está constituida?");

  agregarBotonControl("Sí", "boton-secundario", function () {
    estadoChat.empresaConstituida = true;
    agregarBurbujaUsuario("Sí");
    limpiarControles();
    mostrarPaso4();
  });

  agregarBotonControl("No", "boton-secundario", function () {
    estadoChat.empresaConstituida = false;
    agregarBurbujaUsuario("No");
    agregarBurbujaBot("Nuestro equipo te puede ayudar a constituir tu SRL.");
    limpiarControles();
    agregarBotonControl("Continuar", "boton-secundario", function () {
      limpiarControles();
      mostrarPaso4();
    });
  });
}

// --- Paso 4: Registro de Proveedores del Estado (RPE) ---
function mostrarPaso4() {
  agregarBurbujaBot(
    "¿Tienes tu Registro de Proveedores del Estado (RPE)? Sin él no se puede ofertar."
  );

  agregarBotonControl("Sí", "boton-secundario", function () {
    estadoChat.tieneRpe = true;
    agregarBurbujaUsuario("Sí");
    limpiarControles();
    mostrarPaso5();
  });

  agregarBotonControl("No", "boton-secundario", function () {
    estadoChat.tieneRpe = false;
    agregarBurbujaUsuario("No");
    agregarBurbujaBot("Nosotros te ayudamos a obtenerlo.");
    limpiarControles();
    agregarBotonControl("Continuar", "boton-secundario", function () {
      limpiarControles();
      mostrarPaso5();
    });
  });
}

// --- Paso 5: oferta del boletin ---
function mostrarPaso5() {
  agregarBurbujaBot(
    "Para recibir cada semana TODAS las licitaciones de tu rubro, con plazos en días " +
      "hábiles y precios de referencia, contáctanos."
  );

  agregarBotonControl("Continuar", "boton-secundario", function () {
    limpiarControles();
    mostrarPaso6();
  });
}

// --- Paso 6: boton final a WhatsApp con mensaje precargado ---
function mostrarPaso6() {
  const rubro = estadoChat.rubroElegido ? estadoChat.rubroElegido.rubro : "(sin especificar)";
  const constituidaTexto = estadoChat.empresaConstituida ? "Sí" : "No";
  const rpeTexto = estadoChat.tieneRpe ? "Sí" : "No";

  const mensajeWhatsApp =
    "Hola, mi empresa se dedica a " + rubro + ". " +
    "Empresa constituida: " + constituidaTexto + ". " +
    "Tengo RPE: " + rpeTexto + ". " +
    "Quiero recibir el boletín completo de Publicola.";

  const enlaceWhatsApp =
    "https://wa.me/" + NUMERO_WHATSAPP_PUBLICOLA + "?text=" + encodeURIComponent(mensajeWhatsApp);

  const boton = document.createElement("a");
  boton.className = "boton boton-whatsapp";
  boton.textContent = "Escribirnos por WhatsApp";
  boton.href = enlaceWhatsApp;
  boton.target = "_blank";
  boton.rel = "noopener noreferrer";
  elementoControles.appendChild(boton);
}

// ============================================================
// ARRANQUE
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  cargarDatosProcesos()
    .then(function (datos) {
      renderizarLicitacionesSemana(datos);
      mostrarPaso1(datos);
    })
    .catch(function (error) {
      console.error("Licita: error cargando procesos_semana.json:", error);
      mostrarErrorLicitacionesSemana();
      mostrarErrorChatbot();
    });
});
