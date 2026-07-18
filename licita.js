/**
 * licita.js - Menu de navegacion + chatbot "Licita" + seccion "Licitaciones
 * de la semana".
 *
 * JavaScript puro, sin librerias externas.
 *
 * OJO - dos partes independientes de este archivo, con datos distintos:
 *   1. La seccion "Licitaciones de la semana" (mas abajo en la pagina) SI
 *      lee web/rubros.json (lista permanente de areas/rubros UNSPSC) y
 *      web/procesos_semana.json (cuantos procesos abiertos hay por rubro,
 *      generado a diario por modulos/exportador_web.py) para mostrar la
 *      probadita de 2-3 procesos.
 *   2. El chatbot Licita YA NO muestra procesos ni rubros: es un
 *      orientador de servicios (constituir empresa, registros, ofertar,
 *      preguntas frecuentes) que siempre termina, si aplica, en un boton
 *      de WhatsApp. No depende de ningun JSON, por eso arranca de
 *      inmediato sin esperar ninguna carga de datos.
 *
 * Licita SOLO dice textos preaprobados (riesgo legal cero): el unico
 * campo de texto libre es "¿A qué se dedica tu empresa?", que se pregunta
 * UNA sola vez por conversacion y solo se usa para redactar el mensaje
 * de WhatsApp -- nunca se guarda ni se envia a ningun otro lado.
 *
 * Privacidad (Ley 172-13): nada de lo que el usuario elige o escribe en
 * el chat se guarda en localStorage, cookies ni ningun otro lado. La
 * unica forma en que esos datos salen de esta pagina es si el propio
 * usuario decide, al final, tocar el boton que abre WhatsApp.
 */

// ============================================================
// CONFIGURACION
// ============================================================

// Numero real de WhatsApp de Publicola, en formato internacional sin
// signos "+" ni espacios.
const NUMERO_WHATSAPP_PUBLICOLA = "18297856028";

const RUTA_JSON_RUBROS = "rubros.json";
const RUTA_JSON_PROCESOS = "procesos_semana.json";
const RUTA_FORMULARIO = "formulario-publicola.docx";

// Cuantas tarjetas de muestra se ven en "Licitaciones de la semana".
const MAXIMO_TARJETAS_INICIO = 3;

const MENSAJE_ERROR_CARGA = "En este momento no podemos cargar las licitaciones, intenta más tarde.";

const MENSAJE_RADAR_PUBLICOLA = "Hola, quiero inscribirme en Radar Publicola, nuestro boletín semanal.";

// Preguntas frecuentes, agrupadas tal como las pidio Jose. "nombreInline"
// es como se menciona el grupo dentro de una frase ("tengo una pregunta
// sobre mis registros"), para el mensaje de WhatsApp del grupo D.
const GRUPOS_FAQ = [
  {
    id: "constituir",
    nombre: "Constituir mi empresa",
    nombreInline: "constituir mi empresa",
    preguntas: [
      {
        pregunta: "¿Qué es una SRL?",
        respuesta:
          "Es la Sociedad de Responsabilidad Limitada, el tipo de empresa más usado en el " +
          "país por su equilibrio: es sencilla de administrar y separa tu patrimonio " +
          "personal del de la empresa. Es la figura que recomendamos para la mayoría de " +
          "quienes empiezan a venderle al Estado.",
      },
      {
        pregunta: "¿Cuántos socios necesito?",
        respuesta:
          "Una SRL se constituye con un mínimo de dos socios. Si prefieres emprender " +
          "solo, existe la Empresa Individual de Responsabilidad Limitada (EIRL). En " +
          "nuestra conversación te orientamos sobre cuál conviene a tu caso.",
      },
      {
        pregunta: "¿Qué es el capital social?",
        respuesta:
          "Es el monto con el que se constituye la empresa y que sus socios se " +
          "comprometen a aportar. Se divide en cuotas sociales entre los socios según el " +
          "porcentaje que cada uno tenga. Su monto también incide en el costo de algunos " +
          "trámites de registro.",
      },
      {
        pregunta: "¿Qué es el registro mercantil?",
        respuesta:
          "Es la inscripción de tu empresa en la Cámara de Comercio y Producción de tu " +
          "jurisdicción. Es lo que le da existencia formal frente a terceros y es " +
          "requisito para obtener tu RNC y operar legalmente. Debe mantenerse renovado.",
      },
      {
        pregunta: "¿Cuánto tarda el proceso?",
        respuesta:
          "El proceso completo depende de los tiempos de respuesta de cada institución. " +
          "Si necesitas empezar antes, tenemos empresas semi-constituidas: tú escoges el " +
          "nombre y te entregamos la empresa lista para operar en 5 a 6 días laborables. " +
          "Escríbenos y te damos el tiempo estimado de tu caso.",
      },
      {
        pregunta: "¿Qué son las empresas semi-constituidas?",
        respuesta:
          "Son empresas que ya tenemos preparadas hasta la etapa final del proceso. Tú " +
          "escoges el nombre de la lista disponible, nosotros completamos el registro a " +
          "tu nombre y te la entregamos lista para operar y abrir su cuenta bancaria en " +
          "5 a 6 días laborables. Es la vía más rápida cuando hay una licitación en camino.",
        extra: "semiconstituidas",
      },
    ],
  },
  {
    id: "registros",
    nombre: "Mis registros",
    nombreInline: "mis registros",
    preguntas: [
      {
        pregunta: "¿Qué es el RNC y para qué sirve?",
        respuesta:
          "Es el Registro Nacional del Contribuyente, el número que la DGII asigna a tu " +
          "empresa y que la identifica ante el fisco. Sin RNC tu empresa no puede " +
          "facturar, emitir comprobantes fiscales ni contratar con el Estado.",
      },
      {
        pregunta: "¿Qué es el RPE y por qué lo necesito?",
        respuesta:
          "Es el Registro de Proveedores del Estado, administrado por la Dirección " +
          "General de Contrataciones Públicas (DGCP). Es el registro que habilita a tu " +
          "empresa para participar en las compras públicas: sin él, tu oferta no puede " +
          "ser considerada. Nosotros lo gestionamos por ti.",
      },
      {
        pregunta: "¿Qué es el registro MIPYME y qué beneficios da?",
        respuesta:
          "Es la clasificación oficial de tu empresa como micro, pequeña o mediana. Su " +
          "gran ventaja está en las compras públicas: la ley reserva procesos " +
          "exclusivamente para MIPYMES y otorga preferencias en otros. Para muchas " +
          "empresas pequeñas, es la puerta de entrada real al mercado estatal.",
      },
      {
        pregunta: "¿Qué es la TSS?",
        respuesta:
          "Es la Tesorería de la Seguridad Social, donde se registran los empleadores y " +
          "sus trabajadores. Tu empresa debe estar inscrita y al día cuando tenga " +
          "personal, y es parte de la documentación que suele exigirse en los procesos " +
          "de compras públicas.",
      },
    ],
  },
  {
    id: "vender",
    nombre: "Venderle al Estado",
    nombreInline: "venderle al Estado",
    preguntas: [
      {
        pregunta: "¿Qué necesito para venderle al Estado?",
        respuesta:
          "Tu empresa formalmente constituida, tu RNC activo, tu Registro de " +
          "Proveedores del Estado (RPE) y estar al día con tus obligaciones. A partir de " +
          "ahí ya puedes presentar ofertas. Nosotros te acompañamos en cada paso.",
      },
      {
        pregunta: "¿Qué es un pliego de condiciones?",
        respuesta:
          "Es el documento oficial donde la institución que compra define qué necesita, " +
          "qué requisitos debe cumplir tu oferta, el cronograma del proceso y los " +
          "criterios de evaluación. Es la regla del juego de cada licitación: leerlo " +
          "bien es la diferencia entre una oferta válida y una descalificada.",
      },
    ],
  },
  {
    id: "publicola",
    nombre: "Sobre Publicola",
    nombreInline: "Publicola",
    preguntas: [
      {
        pregunta: "¿De dónde salen sus datos?",
        respuesta:
          "De fuentes oficiales y registros públicos. Nuestra fuente principal es la " +
          "Dirección General de Contrataciones Públicas (DGCP) y su Portal " +
          "Transaccional, bajo licencia de datos abiertos con atribución. También " +
          "consultamos la información pública de otras instituciones pertinentes y de " +
          "los registros públicos, como el Registro Mercantil de las Cámaras de " +
          "Comercio. Todo lo que te mostramos es información pública, obtenida en fiel " +
          "cumplimiento de la ley y con su fuente citada.",
      },
      {
        pregunta: "¿Guardan mis datos?",
        respuesta:
          "No. No recopilamos ni almacenamos datos de quienes visitan esta página, y no " +
          "hacemos ningún tipo de identificación oculta de visitantes. Cuando nos " +
          "escribes por WhatsApp, lo haces por tu propia voluntad. Trabajamos " +
          "únicamente con datos públicos de empresas e instituciones, en cumplimiento " +
          "de la Ley 172-13 de Protección de Datos.",
      },
    ],
  },
  {
    id: "boletin",
    nombre: "Radar Publicola",
    preguntas: [
      {
        pregunta: "¿Qué incluye Radar Publicola?",
        respuesta:
          "Cada lunes te enviamos todas las licitaciones de tu rubro, con los plazos " +
          "contados en días hábiles, vigilancia de adendas y cambios de fecha, y precios " +
          "de referencia de procesos anteriores. Además, alertas cuando un proceso de tu " +
          "rubro cierra en 5 días hábiles o menos. RD$1,000 al mes, con cupos de " +
          "fundadores disponibles.",
      },
    ],
  },
];

function grupoFaqPorId(idGrupo) {
  return GRUPOS_FAQ.find(function (grupo) {
    return grupo.id === idGrupo;
  });
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

  boton.addEventListener("click", function () {
    const abierto = enlaces.classList.toggle("nav-enlaces-abierto");
    boton.setAttribute("aria-expanded", abierto ? "true" : "false");
  });

  // Al tocar un enlace en movil, cerramos el menu para ver la seccion.
  enlaces.querySelectorAll("a").forEach(function (enlace) {
    enlace.addEventListener("click", function () {
      enlaces.classList.remove("nav-enlaces-abierto");
      boton.setAttribute("aria-expanded", "false");
    });
  });
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

  // Recorre las areas y rubros en el orden de la lista permanente hasta
  // juntar MAXIMO_TARJETAS_INICIO rubros que si tengan muestra esta
  // semana, asi se ve variedad en vez de rubros vacios.
  const tarjetas = [];
  for (const entradaArea of datosAreas) {
    if (tarjetas.length >= MAXIMO_TARJETAS_INICIO) {
      break;
    }
    for (const entradaRubro of entradaArea.rubros) {
      if (tarjetas.length >= MAXIMO_TARJETAS_INICIO) {
        break;
      }
      const datosRubro = mapaProcesosPorFamilia.get(entradaRubro.codigo_familia);
      if (datosRubro && Array.isArray(datosRubro.muestra) && datosRubro.muestra.length > 0) {
        tarjetas.push({ rubro: entradaRubro.rubro, proceso: datosRubro.muestra[0] });
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
// CHATBOT LICITA - nucleo generico de la conversacion
// ============================================================

// Estado de la conversacion. Vive solo en memoria: se pierde al
// recargar la pagina y nunca se escribe en cookies ni localStorage.
const estadoChat = {
  actividadPreguntada: false, // si ya se hizo la pregunta "¿A qué se dedica tu empresa?"
  actividadTexto: "", // lo que el usuario escribio (puede quedar vacio)
};

let elementoTranscurso = null;
let elementoControles = null;

// Pila de navegacion para el boton "Atras": cada elemento es una funcion
// SIN bubujas (solo redibuja los controles de una pantalla anterior).
// Vive solo en memoria, igual que el resto del estado del chat.
let pilaHistorial = [];

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

// Burbujas con formato (negrita, listas) dentro del texto: el HTML es
// siempre texto propio preaprobado, nunca algo escrito por el usuario.
// Usa <div> (no <p>) porque el contenido puede incluir listas <ul>/<ol>,
// que un <p> no puede contener valido.
function agregarBurbujaBotHtml(html) {
  const burbuja = crearElemento("div", "burbuja burbuja-bot");
  burbuja.innerHTML = html;
  elementoTranscurso.appendChild(burbuja);
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

// ---- Navegacion "Atras" ----
// Cada pantalla que se abre hacia adelante empuja a la pila la funcion
// que redibuja los CONTROLES (sin bubujas nuevas) de la pantalla desde
// la que se navego. "Atras" saca esa funcion y la ejecuta.
function empujarHistorial(funcionControlesAnteriores) {
  pilaHistorial.push(funcionControlesAnteriores);
}

function regresarAtras() {
  const funcionAnterior = pilaHistorial.pop();
  if (funcionAnterior) {
    funcionAnterior();
  }
}

// Agrega el boton "Atras" a la pantalla actual. La unica pantalla que NO
// lo lleva es el menu principal, porque ahi la pila esta vacia.
function mostrarBotonAtras() {
  if (pilaHistorial.length === 0) {
    return;
  }
  agregarBotonControl("⬅ Atrás", "boton-secundario", regresarAtras);
}

function mostrarControlesWhatsapp(mensaje, texto) {
  limpiarControles();
  const boton = document.createElement("a");
  boton.className = "boton boton-whatsapp";
  boton.textContent = texto || "Escribirnos por WhatsApp";
  boton.href = "https://wa.me/" + NUMERO_WHATSAPP_PUBLICOLA + "?text=" + encodeURIComponent(mensaje);
  boton.target = "_blank";
  boton.rel = "noopener noreferrer";
  elementoControles.appendChild(boton);
  mostrarBotonAtras();
}

// Descarga directa del formulario (no es un cierre de WhatsApp, no pasa
// por la pregunta de actividad).
function descargarFormulario() {
  const enlace = document.createElement("a");
  enlace.href = RUTA_FORMULARIO;
  enlace.setAttribute("download", "");
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
}

// Baja la pagina hasta la lista de empresas semi-constituidas, en la
// seccion Servicios (no es un cierre de WhatsApp).
function irAEmpresasDisponibles() {
  const destino = document.getElementById("empresas-disponibles");
  if (destino) {
    destino.scrollIntoView({ behavior: "smooth" });
  }
}

// Pantalla del campo "¿A qué se dedica tu empresa?" (solo los
// controles: la bubuja de la pregunta la agrega iniciarCierreWhatsapp la
// primera vez, para no duplicarla si se vuelve aqui con "Atras").
function mostrarControlesActividad(construirMensaje) {
  limpiarControles();

  const campo = document.createElement("input");
  campo.type = "text";
  campo.autocomplete = "off";
  campo.className = "campo-texto-libre";
  campo.placeholder = "Ej.: venta de alimentos, construcción, servicios de limpieza…";
  campo.setAttribute("aria-label", "¿A qué se dedica tu empresa?");
  elementoControles.appendChild(campo);

  agregarBotonControl("Continuar", "boton-secundario", function () {
    estadoChat.actividadTexto = campo.value.trim();
    estadoChat.actividadPreguntada = true;
    if (estadoChat.actividadTexto) {
      agregarBurbujaUsuario(estadoChat.actividadTexto);
    }
    empujarHistorial(function () {
      mostrarControlesActividad(construirMensaje);
    });
    mostrarControlesWhatsapp(construirMensaje(estadoChat.actividadTexto));
  });

  mostrarBotonAtras();
}

// Puerta unica antes de cualquier cierre por WhatsApp: pregunta "¿A qué
// se dedica tu empresa?" la PRIMERA vez que se necesita en la
// conversacion. Las veces siguientes usa directamente lo que ya
// respondio, sin volver a preguntar.
function iniciarCierreWhatsapp(construirMensaje) {
  if (estadoChat.actividadPreguntada) {
    mostrarControlesWhatsapp(construirMensaje(estadoChat.actividadTexto));
    return;
  }

  agregarBurbujaBot("¿A qué se dedica tu empresa?");
  mostrarControlesActividad(construirMensaje);
}

// ============================================================
// MENSAJES DE WHATSAPP (siempre en primera persona, preaprobados; la
// unica parte libre es la actividad que el propio usuario escribio)
// ============================================================

function mensajeRegistros(actividad) {
  if (actividad) {
    return (
      "Hola, mi empresa se dedica a " + actividad +
      " y necesito ayuda con mis registros (RNC, RPE, MIPYME o TSS)."
    );
  }
  return "Hola, necesito ayuda con mis registros (RNC, RPE, MIPYME o TSS).";
}

function mensajeOfertar(actividad) {
  if (actividad) {
    return (
      "Hola, mi empresa se dedica a " + actividad +
      ", ya está constituida y quiero ofertar en licitaciones."
    );
  }
  return "Hola, ya mi empresa está constituida y quiero ofertar en licitaciones.";
}

function mensajeFaq(nombreInlineGrupo, actividad) {
  if (actividad) {
    return "Hola, mi empresa se dedica a " + actividad + ". Tengo una pregunta sobre " + nombreInlineGrupo + ".";
  }
  return "Hola, tengo una pregunta sobre " + nombreInlineGrupo + ".";
}

// ============================================================
// CHATBOT LICITA - guion
// ============================================================

// --- Menu principal (raiz: nunca lleva boton "Atras") ---
function mostrarControlesMenuPrincipal() {
  limpiarControles();

  agregarBotonControl("Quiero constituir mi empresa", "boton-secundario", function () {
    agregarBurbujaUsuario("Quiero constituir mi empresa");
    empujarHistorial(mostrarControlesMenuPrincipal);
    mostrarRamaConstituir();
  });

  agregarBotonControl("Necesito mis registros", "boton-secundario", function () {
    agregarBurbujaUsuario("Necesito mis registros");
    empujarHistorial(mostrarControlesMenuPrincipal);
    mostrarRamaRegistros();
  });

  agregarBotonControl("Quiero ofertar en una licitación", "boton-secundario", function () {
    agregarBurbujaUsuario("Quiero ofertar en una licitación");
    empujarHistorial(mostrarControlesMenuPrincipal);
    mostrarRamaOfertar();
  });

  agregarBotonControl("Tengo preguntas", "boton-secundario", function () {
    agregarBurbujaUsuario("Tengo preguntas");
    empujarHistorial(mostrarControlesMenuPrincipal);
    mostrarMenuFaq();
  });
}

function mostrarMenuPrincipal() {
  inicializarContenedorChat();
  pilaHistorial = [];
  agregarBurbujaBot(
    "¡Hola! Soy Licita, del equipo de Publicola. Te acompañamos en todo el camino para " +
      "venderle al Estado dominicano. ¿En qué podemos ayudarte?"
  );
  mostrarControlesMenuPrincipal();
}

// --- Rama A: constituir empresa ---

// Mensaje precargado del boton "Enviar formulario por WhatsApp": el
// usuario ya descargo y lleno el formulario por su cuenta, aqui solo
// avisa que lo va a enviar -- no pasa por la pregunta de actividad
// porque el mensaje ya es especifico y completo.
const MENSAJE_ENVIAR_FORMULARIO = "Hola, quiero constituir mi empresa, aquí está el formulario.";

function mostrarControlesRamaConstituir() {
  limpiarControles();

  agregarBotonControl("Descargar el formulario", "boton-secundario", function () {
    agregarBurbujaUsuario("Descargar el formulario");
    descargarFormulario();
  });

  const botonEnviarFormulario = document.createElement("a");
  botonEnviarFormulario.className = "boton boton-whatsapp";
  botonEnviarFormulario.textContent = "Enviar formulario por WhatsApp";
  botonEnviarFormulario.href =
    "https://wa.me/" + NUMERO_WHATSAPP_PUBLICOLA + "?text=" + encodeURIComponent(MENSAJE_ENVIAR_FORMULARIO);
  botonEnviarFormulario.target = "_blank";
  botonEnviarFormulario.rel = "noopener noreferrer";
  botonEnviarFormulario.addEventListener("click", function () {
    agregarBurbujaUsuario("Enviar formulario por WhatsApp");
  });
  elementoControles.appendChild(botonEnviarFormulario);

  mostrarBotonAtras();
}

function mostrarRamaConstituir() {
  agregarBurbujaBot(
    "Constituir tu empresa es el primer paso para venderle al Estado. Nosotros nos " +
      "encargamos de todo el proceso y te entregamos la empresa lista para operar y " +
      "abrir su cuenta bancaria. Y si necesitas empezar cuanto antes, tenemos empresas " +
      "semi-constituidas: tú escoges el nombre y te la entregamos lista en 5 a 6 días " +
      "laborables."
  );

  agregarBurbujaBotHtml(
    "La constitución de tu empresa tiene un costo de RD$37,950 e incluye todo lo " +
      "necesario para operar y venderle al Estado:" +
      "<ul>" +
      "<li>Certificado de Registro Mercantil</li>" +
      "<li>Estatutos Sociales Registrados</li>" +
      "<li>Acta de Asamblea General Constitutiva Registrada</li>" +
      "<li>Certificado de Pago de Impuestos Constitutivos</li>" +
      "<li>Certificación de Registro de Acciones (Cuotas Sociales)</li>" +
      "<li>Certificado de Registro Nacional del Contribuyente</li>" +
      "<li>Sello Gomígrafo de la Empresa</li>" +
      "<li>Números de Comprobantes Fiscales</li>" +
      "<li>Expediente Implementado para Apertura de Cuenta Bancaria</li>" +
      "<li>Clave y Usuario de la DGII</li>" +
      "<li>Email Corporativo Registrado en la DGII</li>" +
      "<li>Acciones o Cuotas Sociales Impresas</li>" +
      "</ul>"
  );

  agregarBurbujaBotHtml(
    "Cómo funciona:" +
      "<ol>" +
      "<li>Elige uno de los nombres disponibles de nuestra lista.</li>" +
      "<li>Descarga el formulario y llénalo con los datos de todos los socios y el " +
      "nombre de la empresa que elegiste.</li>" +
      "<li>Envíanos el formulario por WhatsApp.</li>" +
      "<li>Nuestro equipo te envía la orden de pago. Una vez la pagues, comenzamos de " +
      "inmediato a constituir tu empresa.</li>" +
      "<li>Te la entregamos lista en 5 a 6 días laborables.</li>" +
      "</ol>"
  );

  agregarBurbujaBot(
    "Nombres disponibles: Alessa SRL, Vicari SRL, Ultramax Group SRL, Inversiones " +
      "Bravaterra SRL, Aravind SRL, Teramind SRL."
  );

  mostrarControlesRamaConstituir();
}

// --- Rama B: registros ---
function mostrarControlesRamaRegistros() {
  limpiarControles();

  agregarBotonControl("Tengo preguntas", "boton-secundario", function () {
    agregarBurbujaUsuario("Tengo preguntas");
    empujarHistorial(mostrarControlesRamaRegistros);
    mostrarListaPreguntas(grupoFaqPorId("registros"));
  });

  agregarBotonControl("Escríbenos", "boton-secundario", function () {
    agregarBurbujaUsuario("Escríbenos");
    empujarHistorial(mostrarControlesRamaRegistros);
    iniciarCierreWhatsapp(mensajeRegistros);
  });

  mostrarBotonAtras();
}

function mostrarRamaRegistros() {
  agregarBurbujaBot(
    "Para venderle al Estado tu empresa necesita sus registros en orden: el RNC ante la " +
      "DGII, el Registro de Proveedores del Estado (RPE) ante la DGCP, tu clasificación " +
      "MIPYME si aplica, y tu inscripción en la TSS. Nosotros los gestionamos por ti."
  );
  mostrarControlesRamaRegistros();
}

// --- Rama C: ofertar (servicios de asesoria, sin precios, un solo mensaje) ---
function mostrarControlesRamaOfertar() {
  limpiarControles();

  agregarBotonControl("Escríbenos", "boton-secundario", function () {
    agregarBurbujaUsuario("Escríbenos");
    empujarHistorial(mostrarControlesRamaOfertar);
    iniciarCierreWhatsapp(mensajeOfertar);
  });

  mostrarBotonAtras();
}

function mostrarRamaOfertar() {
  agregarBurbujaBotHtml(
    "Nuestro equipo te acompaña en todo el espectro de las compras públicas: compras " +
      "menores, comparaciones de precios, licitaciones públicas nacionales, licitaciones " +
      "abreviadas y subastas inversas. Te ofrecemos: <strong>Revisión de expediente de " +
      "oferta</strong>: auditamos tu oferta completa antes de presentarla, identificando " +
      "errores de forma, documentos faltantes y requisitos que causarían descalificación. " +
      "<strong>Preparación y sometimiento de licitaciones</strong>: nos encargamos " +
      "del expediente completo, desde el análisis del pliego de condiciones hasta la " +
      "presentación de la oferta, en la modalidad que corresponda a tu proceso. " +
      "<strong>Plan mensual para proveedores recurrentes</strong>: monitoreo continuo de " +
      "tu rubro y preparación de ofertas cada mes. Honorarios bajo cotización. Nuestros " +
      "servicios garantizan el rigor y la conformidad documental de tu oferta, no la " +
      "adjudicación del proceso."
  );
  mostrarControlesRamaOfertar();
}

// --- Rama D: preguntas frecuentes ---
function mostrarControlesMenuFaq() {
  limpiarControles();

  for (const grupo of GRUPOS_FAQ) {
    agregarBotonControl(grupo.nombre, "boton-secundario", function () {
      agregarBurbujaUsuario(grupo.nombre);
      empujarHistorial(mostrarControlesMenuFaq);
      if (grupo.id === "boletin") {
        mostrarGrupoBoletin(grupo);
      } else {
        mostrarListaPreguntas(grupo);
      }
    });
  }

  mostrarBotonAtras();
}

function mostrarMenuFaq() {
  agregarBurbujaBot("¿Sobre qué tema tienes preguntas?");
  mostrarControlesMenuFaq();
}

function mostrarControlesListaPreguntas(grupo) {
  limpiarControles();

  for (const item of grupo.preguntas) {
    agregarBotonControl(item.pregunta, "boton-secundario", function () {
      agregarBurbujaUsuario(item.pregunta);
      empujarHistorial(function () {
        mostrarControlesListaPreguntas(grupo);
      });
      mostrarRespuestaFaq(grupo, item);
    });
  }

  mostrarBotonAtras();
}

function mostrarListaPreguntas(grupo) {
  agregarBurbujaBot("¿Sobre qué tienes dudas?");
  mostrarControlesListaPreguntas(grupo);
}

function mostrarControlesRespuestaFaq(grupo, item) {
  limpiarControles();

  // "Otra pregunta" lleva exactamente al mismo lugar que "Atras" en esta
  // pantalla: la lista de preguntas del grupo.
  agregarBotonControl("Otra pregunta", "boton-secundario", regresarAtras);

  // Solo la pregunta sobre empresas semi-constituidas trae estos 2
  // botones extra (ver Grupo A en las instrucciones de Jose).
  if (item.extra === "semiconstituidas") {
    agregarBotonControl("Ver empresas disponibles", "boton-secundario", function () {
      agregarBurbujaUsuario("Ver empresas disponibles");
      irAEmpresasDisponibles();
    });
    agregarBotonControl("Descargar el formulario", "boton-secundario", function () {
      agregarBurbujaUsuario("Descargar el formulario");
      descargarFormulario();
    });
  }

  agregarBotonControl("Escríbenos", "boton-secundario", function () {
    agregarBurbujaUsuario("Escríbenos");
    empujarHistorial(function () {
      mostrarControlesRespuestaFaq(grupo, item);
    });
    iniciarCierreWhatsapp(function (actividad) {
      return mensajeFaq(grupo.nombreInline, actividad);
    });
  });

  mostrarBotonAtras();
}

function mostrarRespuestaFaq(grupo, item) {
  agregarBurbujaBot(item.respuesta);
  mostrarControlesRespuestaFaq(grupo, item);
}

// El grupo de Radar Publicola no tiene lista de preguntas para elegir
// (solo trae una) ni sigue el patron "Otra pregunta"/"Escribenos":
// termina en su propio boton fijo (con su Atras), sin pasar por la
// pregunta de actividad.
function mostrarGrupoBoletin(grupo) {
  agregarBurbujaBot(grupo.preguntas[0].respuesta);
  mostrarControlesWhatsapp(MENSAJE_RADAR_PUBLICOLA, "Quiero Radar Publicola");
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

  function abrirPanel() {
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
}

// ============================================================
// ARRANQUE
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  inicializarMenuNavegacion();
  inicializarLicitaFlotante();

  // El chatbot no depende de ningun JSON: arranca de inmediato.
  mostrarMenuPrincipal();

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
});
