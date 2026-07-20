/**
 * licita.js - Menu de navegacion + chatbot "Licita" (chat libre conectado
 * a un Worker de IA) + seccion "Licitaciones de la semana".
 *
 * JavaScript puro, sin librerias externas.
 *
 * OJO - dos partes independientes de este archivo, con datos distintos:
 *   1. La seccion "Licitaciones de la semana" (mas abajo en la pagina) SI
 *      lee web/rubros.json (lista permanente de areas/rubros UNSPSC) y
 *      web/procesos_semana.json (cuantos procesos abiertos hay por rubro,
 *      generado a diario por modulos/exportador_web.py) para mostrar la
 *      probadita de 2-3 procesos.
 *   2. El chatbot Licita es un chat de texto libre: cada mensaje del
 *      visitante se manda a un Worker de Cloudflare (licita-ia, ya
 *      desplegado aparte) que responde con la IA. Esta pagina NO conoce
 *      ni le importa como el Worker arma esa respuesta; solo le manda el
 *      historial de la conversacion y muestra lo que el Worker devuelva.
 *
 * Privacidad (Ley 172-13): nada de lo que el usuario escribe o recibe en
 * el chat se guarda en localStorage, sessionStorage, cookies ni ningun
 * otro lado. El historial de la conversacion vive SOLO en memoria
 * (variable de JavaScript) mientras la ventana del chat esta abierta, y
 * se pierde al recargar la pagina. La pagina no pide, guarda ni registra
 * nombre, telefono ni correo del visitante.
 */

// ============================================================
// CONFIGURACION
// ============================================================

// Numero real de WhatsApp de Publicola, en formato internacional sin
// signos "+" ni espacios.
const NUMERO_WHATSAPP_PUBLICOLA = "18297856028";

const RUTA_JSON_RUBROS = "rubros.json";
const RUTA_JSON_PROCESOS = "procesos_semana.json";

// Fuente UNICA de los nombres de empresas semi-constituidas
// disponibles: alimenta tanto la seccion "Empresas semi-constituidas
// disponibles" de esta pagina (mas abajo) como la lista que usa Alicia
// en el chat (el Worker de IA lee este mismo archivo). Para vender una
// empresa y quitarla de la lista (o agregar una nueva), se edita
// UNICAMENTE web/empresas_disponibles.json.
const RUTA_JSON_EMPRESAS = "empresas_disponibles.json";

// Cuantas tarjetas de muestra se ven en "Licitaciones de la semana".
const MAXIMO_TARJETAS_INICIO = 3;

const MENSAJE_ERROR_CARGA = "En este momento no podemos cargar las licitaciones, intenta más tarde.";
const MENSAJE_ERROR_EMPRESAS = "En este momento no podemos mostrar las empresas disponibles, escríbenos por WhatsApp.";

// --- Chat de Licita: Worker de IA ---

const URL_WORKER_LICITA = "https://licita-ia.publicola.workers.dev";

// Limites del lado de la pagina (el Worker tambien los aplica, pero acá
// nos aseguramos de nunca mandarle algo que el Worker vaya a rechazar,
// para que el visitante nunca vea un error feo).
const MAXIMO_CARACTERES_MENSAJE = 1000;
const MAXIMO_MENSAJES_HISTORIAL = 20;

// Tiempo maximo de espera por la respuesta del Worker antes de mostrar
// el mensaje de respaldo (en milisegundos). Se sube de 20 a 60 segundos:
// al ampliar el guion del Worker (regla de precios + personalidad de
// Alicia) las respuestas de Gemini empezaron a tardar mas de 20
// segundos con regularidad (se midieron respuestas correctas de hasta
// 47 segundos), y con 20 segundos el chat mostraba el respaldo aunque
// el Worker terminara respondiendo bien poco despues.
const TIEMPO_ESPERA_WORKER_MS = 60000;

const MENSAJE_SALUDO_LICITA =
  "¡Hola! Soy Alicia, del equipo de Publicola. Cuéntame qué necesita tu empresa y te digo cómo te puedo ayudar.";

const MENSAJE_RESPALDO_FALLA_WORKER =
  "Disculpa, en este momento no podemos responderte por aquí. Con mucho gusto te atendemos directamente: toca el botón 'Hablar con el equipo' y conversamos.";

// Mensaje precargado del boton verde "Hablar con el equipo" que aparece
// dentro de la burbuja de respaldo. Usa el mismo enlace wa.me (misma
// funcion construirEnlaceWhatsapp, mismo numero) que el boton de
// WhatsApp del encabezado, con su propio texto precargado.
const MENSAJE_WHATSAPP_BOTON_RESPALDO = "Hola, les escribo desde la página de Publicola";

// Mensaje del boton fijo de WhatsApp del encabezado del panel (siempre
// visible, no es un chip de sugerencia).
const MENSAJE_WHATSAPP_FIJO = "Hola, quiero hablar con el equipo de Publicola.";

// ============================================================
// UTILIDADES GENERALES
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

function construirEnlaceWhatsapp(mensaje) {
  return "https://wa.me/" + NUMERO_WHATSAPP_PUBLICOLA + "?text=" + encodeURIComponent(mensaje);
}

// Quita el marcado Markdown (negrita, cursiva, codigo, encabezados) del
// texto que devuelve el Worker de IA, para que nunca se vean asteriscos,
// guiones bajos ni comillas invertidas crudos en pantalla. Se limpia el
// texto en vez de convertirlo a HTML real a proposito: las burbujas usan
// textContent (nunca innerHTML) porque el texto viene de la IA y no debe
// interpretarse como HTML.
function limpiarMarkdown(texto) {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

// ============================================================
// CARGA DE DATOS (solo para "Licitaciones de la semana"; el chatbot no
// depende de esto)
// ============================================================

async function cargarJson(ruta) {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) {
    throw new Error("No se pudo leer " + ruta + " (HTTP " + respuesta.status + ")");
  }
  return respuesta.json();
}

async function cargarDatosLicitaciones() {
  const [datosRubros, datosProcesos] = await Promise.all([
    cargarJson(RUTA_JSON_RUBROS),
    cargarJson(RUTA_JSON_PROCESOS),
  ]);

  if (!datosRubros || !Array.isArray(datosRubros.areas)) {
    throw new Error("rubros.json no tiene la forma esperada (falta 'areas').");
  }
  if (!datosProcesos || !Array.isArray(datosProcesos.rubros)) {
    throw new Error("procesos_semana.json no tiene la forma esperada (falta 'rubros').");
  }

  const mapaProcesosPorFamilia = new Map();
  for (const entrada of datosProcesos.rubros) {
    if (entrada && entrada.codigo_familia) {
      mapaProcesosPorFamilia.set(entrada.codigo_familia, entrada);
    }
  }

  return { areas: datosRubros.areas, mapaProcesosPorFamilia: mapaProcesosPorFamilia };
}

let datosAreas = [];
let mapaProcesosPorFamilia = new Map();

// ============================================================
// MENU DE NAVEGACION (hamburguesa en movil)
// ============================================================

function inicializarMenuNavegacion() {
  const boton = document.getElementById("boton-menu");
  const enlaces = document.getElementById("nav-enlaces");
  if (!boton || !enlaces) {
    return;
  }

  function cerrarMenu() {
    enlaces.classList.remove("nav-enlaces-abierto");
    boton.setAttribute("aria-expanded", "false");
  }

  boton.addEventListener("click", function (evento) {
    // Evita que este mismo clic llegue al listener de "clic afuera" de
    // abajo y cierre el menu en el mismo instante en que se abre.
    evento.stopPropagation();
    const abierto = enlaces.classList.toggle("nav-enlaces-abierto");
    boton.setAttribute("aria-expanded", abierto ? "true" : "false");
  });

  // Al tocar un enlace en movil, cerramos el menu para ver la seccion.
  enlaces.querySelectorAll("a").forEach(function (enlace) {
    enlace.addEventListener("click", cerrarMenu);
  });

  // Un clic o toque fuera del menu (y fuera del boton que lo abre) tambien
  // lo cierra. Se escucha en todo el documento y se filtra por si el clic
  // cayo dentro del menu o del boton, para no interferir con esos casos.
  document.addEventListener("click", function (evento) {
    if (!enlaces.classList.contains("nav-enlaces-abierto")) {
      return;
    }
    if (enlaces.contains(evento.target) || boton.contains(evento.target)) {
      return;
    }
    cerrarMenu();
  });
}

// ============================================================
// SECCION "LICITACIONES DE LA SEMANA"
// ============================================================

function construirTarjetaLicitacion(nombreRubro, proceso) {
  const tarjeta = crearElemento("article", "tarjeta-licitacion");

  tarjeta.appendChild(crearElemento("span", "rubro-etiqueta", nombreRubro));
  tarjeta.appendChild(crearElemento("p", "institucion", proceso.institucion));
  tarjeta.appendChild(crearElemento("p", "objeto", proceso.objeto));

  // El monto ya viene formateado desde exportador_web.py (o el texto de
  // respaldo "Monto de referencia: ver pliego" si el dato no esta
  // disponible en la fuente oficial). Aqui solo se muestra, nunca se
  // calcula ni se inventa.
  if (proceso.monto_referencia_formateado) {
    tarjeta.appendChild(crearElemento("p", "monto-referencia", proceso.monto_referencia_formateado));
  }

  const detalle = crearElemento(
    "p",
    "detalle",
    "Modalidad: " + proceso.modalidad + " · Fecha límite de ofertas: " + proceso.fecha_limite_ofertas
  );
  tarjeta.appendChild(detalle);

  // El enlace es opcional: si el proceso no trae "url" (dato faltante en
  // la fuente oficial), la tarjeta igual se muestra, solo sin el enlace.
  if (proceso.url) {
    const enlace = document.createElement("a");
    enlace.className = "enlace-portal";
    enlace.href = proceso.url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.textContent = "Ver en el Portal Transaccional →";
    tarjeta.appendChild(enlace);
  }

  return tarjeta;
}

function renderizarLicitacionesSemana() {
  const contenedor = document.getElementById("lista-licitaciones");
  contenedor.innerHTML = "";

  // La deduplicacion es por codigo_proceso (identificador unico del
  // proceso), no por rubro: un mismo proceso puede caer en varios rubros
  // (items de familias UNSPSC distintas) y no debe repetirse como
  // tarjeta solo porque aparece en la muestra de mas de un rubro. Desde
  // 2026-07-19 el propio exportador_web.py ya deduplica esto en el JSON;
  // este Set se deja ademas como segunda barrera, por si algun dato
  // viejo o parcial todavia trae repetidos.
  const tarjetas = [];
  const codigosUsados = new Set();

  // Primera pasada: hasta MAXIMO_TARJETAS_INICIO procesos, prefiriendo
  // rubros distintos entre si (recorre las areas/rubros en el orden de
  // la lista permanente y toma el primer proceso de cada rubro que aun
  // no se haya usado).
  for (const entradaArea of datosAreas) {
    if (tarjetas.length >= MAXIMO_TARJETAS_INICIO) {
      break;
    }
    for (const entradaRubro of entradaArea.rubros) {
      if (tarjetas.length >= MAXIMO_TARJETAS_INICIO) {
        break;
      }
      const datosRubro = mapaProcesosPorFamilia.get(entradaRubro.codigo_familia);
      if (!datosRubro || !Array.isArray(datosRubro.muestra)) {
        continue;
      }
      const proceso = datosRubro.muestra.find(function (candidato) {
        return !codigosUsados.has(candidato.codigo_proceso);
      });
      if (proceso) {
        tarjetas.push({ rubro: entradaRubro.rubro, proceso: proceso });
        codigosUsados.add(proceso.codigo_proceso);
      }
    }
  }

  // Segunda pasada: si no hubo suficientes rubros distintos con proceso
  // propio, completa con cualquier otro proceso diferente de la semana
  // (aunque su rubro ya se haya usado en la primera pasada) en vez de
  // repetir. Si en total solo existen 1 o 2 procesos distintos, esta
  // pasada no encuentra mas y la pagina muestra solo esas tarjetas.
  if (tarjetas.length < MAXIMO_TARJETAS_INICIO) {
    for (const entradaArea of datosAreas) {
      if (tarjetas.length >= MAXIMO_TARJETAS_INICIO) {
        break;
      }
      for (const entradaRubro of entradaArea.rubros) {
        if (tarjetas.length >= MAXIMO_TARJETAS_INICIO) {
          break;
        }
        const datosRubro = mapaProcesosPorFamilia.get(entradaRubro.codigo_familia);
        if (!datosRubro || !Array.isArray(datosRubro.muestra)) {
          continue;
        }
        for (const proceso of datosRubro.muestra) {
          if (tarjetas.length >= MAXIMO_TARJETAS_INICIO) {
            break;
          }
          if (codigosUsados.has(proceso.codigo_proceso)) {
            continue;
          }
          tarjetas.push({ rubro: entradaRubro.rubro, proceso: proceso });
          codigosUsados.add(proceso.codigo_proceso);
        }
      }
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
// SECCION "EMPRESAS SEMI-CONSTITUIDAS DISPONIBLES"
// ============================================================

function construirItemEmpresaDisponible(nombre) {
  const item = document.createElement("li");
  item.appendChild(crearElemento("span", "empresa-nombre", nombre));

  const enlace = document.createElement("a");
  enlace.className = "boton boton-whatsapp boton-chico";
  enlace.target = "_blank";
  enlace.rel = "noopener noreferrer";
  enlace.href = construirEnlaceWhatsapp("Hola, me interesa la empresa " + nombre + ".");
  enlace.textContent = "WhatsApp";
  item.appendChild(enlace);

  return item;
}

function renderizarEmpresasDisponibles(nombres) {
  const contenedor = document.getElementById("lista-empresas-disponibles");
  if (!contenedor) {
    return;
  }
  contenedor.innerHTML = "";

  if (!Array.isArray(nombres) || nombres.length === 0) {
    mostrarErrorEmpresasDisponibles();
    return;
  }

  for (const nombre of nombres) {
    contenedor.appendChild(construirItemEmpresaDisponible(nombre));
  }
}

function mostrarErrorEmpresasDisponibles() {
  const contenedor = document.getElementById("lista-empresas-disponibles");
  if (!contenedor) {
    return;
  }
  contenedor.innerHTML = "";
  const item = document.createElement("li");
  item.appendChild(crearElemento("p", "mensaje-estado", MENSAJE_ERROR_EMPRESAS));
  contenedor.appendChild(item);
}

// ============================================================
// CHATBOT LICITA - chat libre conectado al Worker de IA
// ============================================================

// Historial de la conversacion. Vive SOLO en memoria (Ley 172-13): se
// pierde al recargar la pagina y nunca se escribe en cookies,
// localStorage ni sessionStorage. Cada entrada es { rol: "usuario" |
// "licita", texto: "..." }.
const estadoChatLicita = {
  historial: [],
};

let elementoTranscursoChat = null;
let elementoControlesChat = null;
let elementoCampoMensaje = null;
let elementoBotonEnviarChat = null;
let elementoEscribiendo = null;
let enviandoMensajeActualmente = false;

function agregarBurbujaBotChat(texto) {
  // textContent a proposito (nunca innerHTML): el texto puede venir del
  // Worker de IA, y no debe interpretarse como HTML. limpiarMarkdown
  // quita asteriscos/guiones bajos/comillas invertidas antes de mostrarlo.
  elementoTranscursoChat.appendChild(crearElemento("p", "burbuja burbuja-bot", limpiarMarkdown(texto)));
  elementoTranscursoChat.scrollTop = elementoTranscursoChat.scrollHeight;
}

function agregarBurbujaUsuarioChat(texto) {
  elementoTranscursoChat.appendChild(crearElemento("p", "burbuja burbuja-usuario", texto));
  elementoTranscursoChat.scrollTop = elementoTranscursoChat.scrollHeight;
}

function mostrarEscribiendo() {
  if (elementoEscribiendo) {
    return;
  }
  elementoEscribiendo = crearElemento("p", "burbuja burbuja-bot burbuja-escribiendo", "Escribiendo…");
  elementoTranscursoChat.appendChild(elementoEscribiendo);
  elementoTranscursoChat.scrollTop = elementoTranscursoChat.scrollHeight;
}

function quitarEscribiendo() {
  if (elementoEscribiendo) {
    elementoEscribiendo.remove();
    elementoEscribiendo = null;
  }
}

function agregarAlHistorialChat(rol, texto) {
  estadoChatLicita.historial.push({ rol: rol, texto: texto });
  // Maximo MAXIMO_MENSAJES_HISTORIAL mensajes: si se pasa, se descartan
  // los mas viejos y solo se conservan (y se mandan al Worker) los mas
  // recientes.
  if (estadoChatLicita.historial.length > MAXIMO_MENSAJES_HISTORIAL) {
    estadoChatLicita.historial = estadoChatLicita.historial.slice(-MAXIMO_MENSAJES_HISTORIAL);
  }
}

// Burbuja de respaldo: mismo estilo que una burbuja normal del bot, pero
// con el boton verde "Hablar con el equipo" DENTRO de la misma burbuja
// (no en la fila de controles aparte), para que el visitante lo vea
// pegado al mensaje que le explica por que no hay respuesta de la IA.
function agregarBurbujaRespaldoChat(texto) {
  const burbuja = crearElemento("div", "burbuja burbuja-bot burbuja-respaldo");
  burbuja.appendChild(crearElemento("p", null, limpiarMarkdown(texto)));

  const boton = document.createElement("a");
  boton.className = "boton boton-whatsapp boton-respaldo-whatsapp";
  boton.textContent = "Hablar con el equipo";
  boton.href = construirEnlaceWhatsapp(MENSAJE_WHATSAPP_BOTON_RESPALDO);
  boton.target = "_blank";
  boton.rel = "noopener noreferrer";
  burbuja.appendChild(boton);

  elementoTranscursoChat.appendChild(burbuja);
  elementoTranscursoChat.scrollTop = elementoTranscursoChat.scrollHeight;
}

// Cuando el guion de Alicia indica invitar a hablar con el equipo, el
// Worker de IA lo marca con "[[BOTON_WHATSAPP]]" al final del texto (ver
// worker.js) en vez de escribir la palabra "boton" o corchetes visibles
// -- eso causaba que la etiqueta literal "[Hablar con el equipo]"
// apareciera en pantalla (bug reportado). Esta funcion quita esa marca
// (o cualquier variante entre corchetes que mencione "hablar con el
// equipo", por si el modelo se desvia del formato exacto) del texto
// visible y avisa si corresponde mostrar el boton verde real.
function extraerMarcaBotonWhatsapp(texto) {
  const patron = /\[\[?\s*(?:BOTON_WHATSAPP|hablar con el equipo)\s*\]?\]/gi;
  const mostrarBoton = patron.test(texto);
  const textoLimpio = texto.replace(patron, "").replace(/[ \t]{2,}/g, " ").trim();
  return { textoLimpio: textoLimpio, mostrarBoton: mostrarBoton };
}

// Ahorro local (sin llamar al Worker de IA): detecta mensajes triviales
// -- saludos solos, agradecimientos o despedidas, SIN contenido real -- y
// devuelve una respuesta fija en el tono calido de Alicia, en singular
// (ella habla de si misma en singular; ver worker.js). Cualquier mensaje
// con contenido real (aunque incluya un saludo pegado a una pregunta) no
// hace match aqui y sigue de largo hacia la IA. Maximo 3 patrones a
// proposito, conservadores: coinciden solo si el mensaje ENTERO (ya
// limpio de acentos y signos) es uno de estos casos.
//
// esPrimerMensajeUsuario: la burbuja de apertura (MENSAJE_SALUDO_LICITA)
// ya saluda al abrir el chat. Si el visitante saluda en su PRIMER
// mensaje, no se le saluda de nuevo -- se responde con algo breve que
// continue la conversacion. Si ya hubo intercambio previo, el saludo
// local responde con un saludo normal.
function detectarRespuestaLocalTrivial(texto, esPrimerMensajeUsuario) {
  const normalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^[¡!¿?.,\s]+|[¡!¿?.,\s]+$/g, "");

  if (/^(hola+|hey|buenas|buenos dias|buenas tardes|buenas noches|que tal)$/.test(normalizado)) {
    if (esPrimerMensajeUsuario) {
      return "Cuéntame, ¿qué necesita tu empresa?";
    }
    return "¡Hola de nuevo! Cuéntame, ¿en qué te puedo ayudar?";
  }

  if (/^(gracias|muchas gracias|mil gracias|ok|okay|okey|vale|perfecto)$/.test(normalizado)) {
    return "¡Con mucho gusto! Aquí estamos para lo que necesites.";
  }

  if (/^(adios|chao|nos vemos|hasta luego|bye)$/.test(normalizado)) {
    return "¡Un gusto conversar contigo! Cuando quieras, aquí estamos para ayudarte.";
  }

  return null;
}

function habilitarEntradaChat(habilitada) {
  elementoCampoMensaje.disabled = !habilitada;
  elementoBotonEnviarChat.disabled = !habilitada;
  if (habilitada) {
    elementoCampoMensaje.focus();
  }
}

// Le pide una respuesta al Worker de IA con el historial actual de la
// conversacion. Nunca deja pasar una excepcion sin controlar: cualquier
// falla de red, timeout o formato inesperado termina en un error que
// quien llama atrapa y convierte en el mensaje de respaldo.
async function pedirRespuestaAlWorker() {
  const controlador = new AbortController();
  const temporizador = setTimeout(function () {
    controlador.abort();
  }, TIEMPO_ESPERA_WORKER_MS);

  try {
    const respuestaFetch = await fetch(URL_WORKER_LICITA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajes: estadoChatLicita.historial }),
      signal: controlador.signal,
    });

    if (!respuestaFetch.ok) {
      throw new Error("El Worker de Licita respondio con error HTTP " + respuestaFetch.status);
    }

    const datos = await respuestaFetch.json();
    if (!datos || typeof datos.respuesta !== "string" || !datos.respuesta.trim()) {
      throw new Error("El Worker de Licita respondio con un formato inesperado.");
    }

    return datos.respuesta.trim();
  } finally {
    clearTimeout(temporizador);
  }
}

// Nucleo del chat: manda un mensaje del visitante y muestra la
// respuesta, o el mensaje de respaldo si algo falla. El chat nunca se
// rompe ni se queda congelado: cualquier error termina liberando de
// nuevo el campo de texto.
async function enviarMensajeChat(textoOriginal) {
  if (enviandoMensajeActualmente) {
    return;
  }

  let texto = (textoOriginal || "").trim();
  if (!texto) {
    return;
  }

  if (texto.length > MAXIMO_CARACTERES_MENSAJE) {
    texto = texto.slice(0, MAXIMO_CARACTERES_MENSAJE);
    agregarBurbujaBotChat(
      "Acortamos tu mensaje a " + MAXIMO_CARACTERES_MENSAJE + " caracteres para poder enviarlo."
    );
  }

  elementoControlesChat.innerHTML = ""; // limpia el boton de respaldo de un error anterior, si habia

  // Se calcula ANTES de agregar este mensaje al historial: "primer
  // mensaje" significa que el visitante todavia no habia escrito nada
  // (el historial solo tiene la burbuja de apertura de Alicia).
  const esPrimerMensajeUsuario = !estadoChatLicita.historial.some(function (mensaje) {
    return mensaje.rol === "usuario";
  });

  agregarBurbujaUsuarioChat(texto);
  agregarAlHistorialChat("usuario", texto);

  // Ahorro local: saludos, agradecimientos y despedidas sin contenido
  // real se responden aqui mismo, sin llamar al Worker de IA.
  const respuestaLocal = detectarRespuestaLocalTrivial(texto, esPrimerMensajeUsuario);
  if (respuestaLocal) {
    agregarBurbujaBotChat(respuestaLocal);
    agregarAlHistorialChat("licita", respuestaLocal);
    return;
  }

  enviandoMensajeActualmente = true;
  habilitarEntradaChat(false);
  mostrarEscribiendo();

  try {
    const respuesta = await pedirRespuestaAlWorker();
    quitarEscribiendo();
    let textoParaHistorial = respuesta;
    if (respuesta === MENSAJE_RESPALDO_FALLA_WORKER) {
      // El propio Worker no pudo obtener respuesta de la IA y devolvio
      // su mensaje de respaldo: se muestra igual que una falla local,
      // con el boton verde dentro de la burbuja.
      agregarBurbujaRespaldoChat(respuesta);
    } else {
      const deteccion = extraerMarcaBotonWhatsapp(respuesta);
      textoParaHistorial = deteccion.textoLimpio;
      if (deteccion.mostrarBoton) {
        agregarBurbujaRespaldoChat(deteccion.textoLimpio);
      } else {
        agregarBurbujaBotChat(deteccion.textoLimpio);
      }
    }
    agregarAlHistorialChat("licita", textoParaHistorial);
  } catch (error) {
    console.error("Licita: error consultando el Worker de IA:", error);
    quitarEscribiendo();
    agregarBurbujaRespaldoChat(MENSAJE_RESPALDO_FALLA_WORKER);
  } finally {
    enviandoMensajeActualmente = false;
    habilitarEntradaChat(true);
  }
}

// Arma el chat desde cero dentro de "#licita-chat": historial, zona de
// respaldo y la fila de entrada de texto. Se llama una sola vez, al
// cargar la pagina (el chat no depende de rubros.json ni de
// procesos_semana.json, por eso arranca de inmediato).
function inicializarChatLicita() {
  const contenedor = document.getElementById("licita-chat");
  contenedor.innerHTML = "";

  elementoTranscursoChat = crearElemento("div", "chat-transcurso");
  elementoControlesChat = crearElemento("div", "chat-controles");

  const formulario = document.createElement("form");
  formulario.className = "chat-entrada";

  elementoCampoMensaje = document.createElement("input");
  elementoCampoMensaje.type = "text";
  elementoCampoMensaje.className = "campo-texto-libre chat-campo-mensaje";
  elementoCampoMensaje.placeholder = "Escribe tu mensaje…";
  elementoCampoMensaje.maxLength = MAXIMO_CARACTERES_MENSAJE;
  elementoCampoMensaje.autocomplete = "off";
  elementoCampoMensaje.setAttribute("aria-label", "Escribe tu mensaje para Alicia");

  elementoBotonEnviarChat = document.createElement("button");
  elementoBotonEnviarChat.type = "submit";
  elementoBotonEnviarChat.className = "boton chat-boton-enviar";
  elementoBotonEnviarChat.textContent = "Enviar";

  formulario.appendChild(elementoCampoMensaje);
  formulario.appendChild(elementoBotonEnviarChat);

  // El "Enter" ya envia por si solo al ser un <form>: no hace falta
  // logica aparte para la tecla Enter.
  formulario.addEventListener("submit", function (evento) {
    evento.preventDefault();
    const texto = elementoCampoMensaje.value;
    elementoCampoMensaje.value = "";
    enviarMensajeChat(texto);
  });

  contenedor.appendChild(elementoTranscursoChat);
  contenedor.appendChild(elementoControlesChat);
  contenedor.appendChild(formulario);

  agregarBurbujaBotChat(MENSAJE_SALUDO_LICITA);
  agregarAlHistorialChat("licita", MENSAJE_SALUDO_LICITA);

  // Boton fijo de WhatsApp del encabezado del panel: siempre visible,
  // no es un chip de sugerencia y no pasa por la IA.
  const botonWhatsappFijo = document.getElementById("licita-boton-whatsapp-fijo");
  if (botonWhatsappFijo) {
    botonWhatsappFijo.href = construirEnlaceWhatsapp(MENSAJE_WHATSAPP_FIJO);
  }
}

// ============================================================
// LICITA FLOTANTE (abrir/cerrar el panel) -- solo maneja visibilidad,
// no toca en nada la logica ni los textos de la conversacion de arriba.
// ============================================================

function inicializarLicitaFlotante() {
  const burbuja = document.getElementById("licita-burbuja");
  const panel = document.getElementById("licita-panel");
  const botonAbrir = document.getElementById("licita-boton-abrir");
  const botonCerrar = document.getElementById("licita-boton-cerrar");

  if (!burbuja || !panel) {
    return;
  }

  function abrirPanel(evento) {
    // Evita que este mismo clic llegue al listener de "clic afuera" de
    // abajo y cierre el panel en el mismo instante en que se abre.
    if (evento) {
      evento.stopPropagation();
    }
    panel.hidden = false;
    burbuja.hidden = true;
  }

  function cerrarPanel() {
    panel.hidden = true;
    burbuja.hidden = false;
  }

  if (botonAbrir) {
    botonAbrir.addEventListener("click", abrirPanel);
  }
  if (botonCerrar) {
    botonCerrar.addEventListener("click", cerrarPanel);
  }

  // Un clic o toque fuera del panel (mientras esta abierto) tambien lo
  // cierra. La X (botonCerrar) sigue funcionando igual, esto es ademas.
  document.addEventListener("click", function (evento) {
    if (panel.hidden) {
      return;
    }
    if (panel.contains(evento.target)) {
      return;
    }
    cerrarPanel();
  });
}

// ============================================================
// ARRANQUE
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  inicializarMenuNavegacion();
  inicializarLicitaFlotante();

  // El chatbot no depende de ningun JSON: arranca de inmediato.
  inicializarChatLicita();

  // "Licitaciones de la semana" si depende de los datos; se carga aparte
  // y no bloquea ni afecta al chatbot si falla.
  cargarDatosLicitaciones()
    .then(function (datos) {
      datosAreas = datos.areas;
      mapaProcesosPorFamilia = datos.mapaProcesosPorFamilia;
      renderizarLicitacionesSemana();
    })
    .catch(function (error) {
      console.error("Licita: error cargando rubros.json / procesos_semana.json:", error);
      mostrarErrorLicitacionesSemana();
    });

  // "Empresas semi-constituidas disponibles" tambien se carga aparte,
  // desde la misma fuente unica (empresas_disponibles.json) que usa
  // Alicia en el chat.
  cargarJson(RUTA_JSON_EMPRESAS)
    .then(function (datos) {
      renderizarEmpresasDisponibles(datos && datos.empresas);
    })
    .catch(function (error) {
      console.error("Licita: error cargando empresas_disponibles.json:", error);
      mostrarErrorEmpresasDisponibles();
    });
});
