const DGII = "https://dgii.gov.do/herramientas/consultas/Paginas/RNC.aspx";
const RPE = "https://www.dgcp.gob.do/servicios/registro-de-proveedores/";
const ACTUALIZAR_RPE = "https://www.dgcp.gob.do/servicios/actualizacion-registro-de-proveedores/";
const API_DGCP = "https://datosabiertos.dgcp.gob.do/api-dgcp/v1/proveedores";
const MICM = "https://datos.gob.do/dataset/micro-pequenas-y-medianas-empresas-certificadas";
const VENTANILLA_MICM = "https://ventanillavirtual.micm.gob.do/";
const CAMARAS = "https://app.registromercantil.do/consultas";
const TSS = "https://www.tss.gob.do/servicio/balance-al-dia/";
const VALIDAR_TSS = "https://tss.gob.do/consultas/validar-certificacion/";
const CONSTANCIA_DGII = "https://dgii.gov.do/servicios/Documents/Certificaciones/TRA-CER-Cumplimiento-Obligaciones-Fiscales-Al-Dia-en-la-Declaracion-Pago-de-Impuestos.pdf";
const FORMATO_FECHA = new Intl.DateTimeFormat("es-DO", {dateStyle: "long", timeZone: "UTC"});
const FECHA_DOMINICANA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santo_Domingo", day: "2-digit", month: "2-digit", year: "numeric",
});
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const obtener = (id) => document.getElementById(id);
const form = obtener("consulta");
const campo = obtener("rnc");
const boton = obtener("consultar");
const aviso = obtener("aviso");
const resultados = obtener("diagnostico");

function mensaje(texto, error = false) {
  aviso.textContent = texto;
  aviso.toggleAttribute("data-error", error);
  aviso.hidden = !texto;
}

function isoDominicana() {
  const partes = Object.fromEntries(FECHA_DOMINICANA.formatToParts(new Date()).map(({type, value}) => [type, value]));
  return [partes.year, partes.month, partes.day].join("-");
}

function fechaPublicada(valor) {
  const iso = typeof valor === "string" ? valor.slice(0, 10) : "";
  const fecha = FECHA_ISO.test(iso) ? new Date(iso + "T00:00:00Z") : null;
  return fecha && Number.isFinite(fecha.getTime()) ? FORMATO_FECHA.format(fecha) : "";
}

function normalizarRnc(valor) {
  const texto = valor.trim();
  if (!/^[\d\s-]+$/.test(texto)) return null;
  const digitos = texto.replace(/[\s-]/g, "");
  return /^\d{9}$/.test(digitos) && digitos !== "000000000" ? digitos : null;
}

async function leerJson(url, opciones = {}) {
  const control = new AbortController();
  const cancelar = setTimeout(() => control.abort(), 7500);
  try {
    const respuesta = await fetch(url, {
      ...opciones, credentials: "omit", referrerPolicy: "no-referrer", signal: control.signal,
    });
    if (!respuesta.ok) throw new Error("Fuente temporalmente indisponible");
    return await respuesta.json();
  } finally {
    clearTimeout(cancelar);
  }
}

async function buscarPadrones(rnc) {
  const cortes = await leerJson("datos/cortes.json", {cache: "no-cache"});
  if (!Number.isInteger(cortes.partes) || cortes.partes < 1 || cortes.partes > 128
      || !/^[a-f0-9]{12}$/.test(cortes.version)
      || !FECHA_ISO.test(cortes.dgii) || !FECHA_ISO.test(cortes.micm)) {
    throw new Error("Cortes inválidos");
  }
  const numero = String(Number(rnc) % cortes.partes).padStart(2, "0");
  const datos = await leerJson("datos/" + numero + ".json?v=" + cortes.version);
  if (!datos.dgii || !datos.micm) throw new Error("Padrón inválido");
  return {cortes, dgii: datos.dgii[rnc] ?? null, micm: datos.micm[rnc] ?? null};
}

async function buscarProveedor(rnc) {
  const url = new URL(API_DGCP);
  url.search = new URLSearchParams({numero_documento: rnc, limit: "25"}).toString();
  const respuesta = await leerJson(url, {headers: {Accept: "application/json"}, cache: "no-store"});
  if (respuesta.code !== 200 || respuesta.hasError || !Object.hasOwn(respuesta.payload ?? {}, "content")) {
    throw new Error("Respuesta DGCP inválida");
  }
  const filas = respuesta.payload.content;
  if (filas === null || (Array.isArray(filas) && filas.length === 0)) {
    return {tipo: "ausente"};
  }
  if (!Array.isArray(filas) || Number(respuesta.totalResults) > filas.length) {
    throw new Error("Respuesta DGCP incompleta");
  }
  const proveedores = filas.filter((fila) => fila.tipo_documento === "RNC"
    && String(fila.numero_documento).replace(/[\s-]/g, "") === rnc
    && /^persona jur[ií]dica$/i.test(String(fila.tipo_persona).trim()));
  if (proveedores.length !== 1 || !proveedores[0].rpe || typeof proveedores[0].estado !== "string") {
    throw new Error("La DGCP no devolvió una ficha empresarial única");
  }
  const ficha = proveedores[0];
  const documento = String(ficha.url_certificacion ?? "");
  const rm = String(ficha.numero_registro_mercantil ?? "").trim();
  return {
    tipo: "encontrado",
    numero: String(ficha.rpe),
    estado: ficha.estado.trim(),
    empresa: typeof ficha.razon_social === "string" ? ficha.razon_social.trim() : "",
    registroMercantil: /^[a-z0-9][a-z0-9 -]{0,29}$/i.test(rm) ? rm : "",
    fechaMercantil: fechaPublicada(ficha.fecha_registro_mercantil),
    constancia: /^https:\/\/(?:www\.)?dgcp\.gob\.do\/constancia\/descargar\/[0-9]+$/.test(documento) ? documento : "",
  };
}

function elemento(tipo, contenido, clase = "") {
  const resultado = document.createElement(tipo);
  resultado.textContent = contenido;
  if (clase) resultado.className = clase;
  return resultado;
}

function tarjeta(titulo, estado, tono, detalle, enlaces, fuente = "") {
  const cuerpo = document.createElement("article");
  cuerpo.className = "a-tarjeta";
  const cabecera = elemento("div", "", "a-tarjeta-cabecera");
  const etiqueta = elemento("span", estado, "a-etiqueta");
  etiqueta.dataset.tono = tono;
  cabecera.append(elemento("h3", titulo), etiqueta);
  cuerpo.append(cabecera, elemento("p", detalle, "a-detalle"));
  if (fuente) cuerpo.append(elemento("p", fuente, "a-meta"));
  const lista = elemento("div", "", "a-enlaces");
  for (const [texto, url] of enlaces) {
    const enlace = elemento("a", texto);
    enlace.href = url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    lista.append(enlace);
  }
  cuerpo.append(lista);
  return cuerpo;
}

function tarjetaRnc(datos) {
  const estado = datos?.dgii;
  const activo = estado === "Activo";
  const marca = estado ?? (datos ? "Sin coincidencia" : "Por verificar");
  const detalle = estado
    ? (activo ? "Tu RNC figura activo en el padrón de la DGII." : "Verifica con la DGII el estado de tu registro antes de avanzar.")
    : (datos ? "Revisa los dígitos y confirma el RNC en la consulta oficial." : "Consulta el estado directamente en la DGII.");
  return tarjeta("Estado del RNC", marca, activo ? "ok" : "atencion", detalle,
    [["Consultar en la DGII", DGII]], datos ? "Padrón DGII del " + fechaPublicada(datos.cortes.dgii) : "");
}

function tarjetaRpe(rpe) {
  if (!rpe) {
    return tarjeta("Registro de Proveedores", "Por verificar", "atencion",
      "La consulta automática de la DGCP está temporalmente indisponible.", [["Verificar el RPE", RPE]]);
  }
  if (rpe.tipo === "ausente") {
    return tarjeta("Registro de Proveedores", "RPE no encontrado", "atencion",
      "La consulta de la DGCP no devolvió un RPE para este RNC.", [["Ver cómo inscribirte", RPE]]);
  }
  const activo = rpe.estado.toLowerCase() === "activo";
  const detalle = rpe.estado.toLowerCase() === "desactualizado"
    ? " · Actualiza la documentación antes de la apertura de la oferta económica y de la adjudicación."
    : "";
  const enlaces = [[activo ? "Consultar en la DGCP" : "Ver opciones en la DGCP", activo ? RPE : ACTUALIZAR_RPE]];
  if (rpe.constancia) enlaces.push(["Ver constancia", rpe.constancia]);
  return tarjeta("Registro de Proveedores", rpe.estado, activo ? "ok" : "atencion",
    "RPE n.º " + rpe.numero + detalle, enlaces, "Consulta directa a la DGCP");
}

function tarjetaMipyme(datos, hoy) {
  const enlaces = [["Trámite en el MICM", VENTANILLA_MICM], ["Ver padrón", MICM]];
  if (!datos) {
    return tarjeta("Certificación MIPYME", "Por verificar", "",
      "Consulta tu certificación en el Ministerio de Industria, Comercio y Mipymes.", enlaces);
  }
  const fuente = "Emisiones publicadas hasta el " + fechaPublicada(datos.cortes.micm);
  if (!datos.micm) {
    return tarjeta("Certificación MIPYME", "Sin dato publicado", "",
      "El padrón disponible no muestra una certificación para este RNC. Una certificación vigente te permite participar en compras reservadas a MIPYMES.", enlaces, fuente);
  }
  const [vencimiento, , categoria] = datos.micm;
  const vigente = vencimiento >= hoy;
  return tarjeta("Certificación MIPYME", vigente ? "Vigente según el padrón" : "Última publicada vencida", vigente ? "ok" : "atencion",
    (categoria ? categoria + " · " : "") + (vigente ? "Vence el " : "Venció el ") + fechaPublicada(vencimiento) + ".", enlaces, fuente);
}

function tarjetaMercantil(rpe) {
  const enlaces = [["Validar certificado", CAMARAS]];
  if (rpe?.fechaMercantil) {
    const detalle = (rpe.registroMercantil ? "Registro n.º " + rpe.registroMercantil + " · " : "")
      + "Fecha que figura en el RPE: " + rpe.fechaMercantil + ". Confirma la vigencia con tu cámara de comercio.";
    return tarjeta("Registro Mercantil", "Dato del RPE", "", detalle, enlaces);
  }
  return tarjeta("Registro Mercantil", "Por verificar", "",
    "Verifica la vigencia con tu certificado y su código de validación.", enlaces);
}

function proximoPaso(datos, rpe) {
  if (!datos?.dgii || datos.dgii !== "Activo") {
    return ["Confirma el estado de tu RNC", "Usa la consulta de la DGII para comprobar el registro de tu empresa.", "Consultar RNC", DGII];
  }
  if (!rpe) {
    return ["Confirma tu RPE con la DGCP", "La consulta automática no respondió. Puedes revisar tu registro en la fuente oficial.", "Ir a la DGCP", RPE];
  }
  if (rpe.tipo === "ausente") {
    return ["Solicita tu RPE", "La inscripción como proveedor del Estado es gratuita. Revisa los documentos que te corresponde presentar.", "Ver requisitos de inscripción", RPE];
  }
  if (rpe.estado.toLowerCase() === "desactualizado") {
    return ["Actualiza tu RPE", "Revisa qué documentación debes renovar, incluido el Registro Mercantil cuando corresponda.", "Ver cómo actualizarlo", ACTUALIZAR_RPE];
  }
  if (rpe.estado.toLowerCase() !== "activo") {
    return ["Revisa el estado de tu RPE", "Consulta tu constancia y la vía de regularización con la DGCP.", "Ir a la DGCP", ACTUALIZAR_RPE];
  }
  return ["Confirma tus constancias antes de ofertar", "Tu RNC y tu RPE figuran activos. Revisa tus constancias y los requisitos del proceso que te interesa.", "Ver guía para ofertar", "/recursos/requisitos-para-ofertar-al-estado-dominicano/"];
}

function mostrarResultado(rnc, datos, rpe) {
  const hoy = isoDominicana();
  const formato = [rnc.slice(0, 3), rnc.slice(3, 8), rnc.slice(8)].join("-");
  obtener("empresa").textContent = [rpe?.empresa, "RNC " + formato].filter(Boolean).join(" · ");
  obtener("consultado").textContent = "Consulta del " + fechaPublicada(hoy);
  const [titulo, detalle, texto, url] = proximoPaso(datos, rpe);
  obtener("siguiente-titulo").textContent = titulo;
  obtener("siguiente-detalle").textContent = detalle;
  obtener("siguiente-enlace").href = url;
  obtener("siguiente-enlace").textContent = texto;
  obtener("comprobaciones").replaceChildren(
    tarjetaRnc(datos), tarjetaRpe(rpe), tarjetaMipyme(datos, hoy), tarjetaMercantil(rpe),
    tarjeta("Cumplimiento tributario", "Pendiente de verificar", "",
      "Confirma tus obligaciones fiscales con la certificación oficial de la DGII.", [["Ver cómo obtenerla", CONSTANCIA_DGII]]),
    tarjeta("Seguridad Social (TSS)", "Pendiente de verificar", "",
      "Si tienes nómina, revisa tu certificación de Balance al Día en la TSS.",
      [["Ver el trámite", TSS], ["Validar una certificación", VALIDAR_TSS]]),
  );
  resultados.hidden = false;
  obtener("alcance").hidden = true;
  obtener("titulo-resultado").focus({preventScroll: true});
  resultados.scrollIntoView({block: "start"});
}

campo.addEventListener("input", () => {
  campo.removeAttribute("aria-invalid");
  mensaje("");
  resultados.hidden = true;
  obtener("alcance").hidden = false;
});

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (boton.disabled) return;
  const rnc = normalizarRnc(campo.value);
  if (!rnc) {
    campo.setAttribute("aria-invalid", "true");
    mensaje("Introduce un RNC de empresa de 9 dígitos.", true);
    campo.focus();
    return;
  }

  boton.disabled = true;
  campo.readOnly = true;
  boton.textContent = "Consultando…";
  resultados.hidden = true;
  mensaje("Estamos comprobando tu RNC.");
  try {
    const [padrones, proveedor] = await Promise.allSettled([buscarPadrones(rnc), buscarProveedor(rnc)]);
    const datos = padrones.status === "fulfilled" ? padrones.value : null;
    const rpe = proveedor.status === "fulfilled" ? proveedor.value : null;
    if (!datos && !rpe) {
      mensaje("Las fuentes no respondieron. Intenta consultar de nuevo en unos minutos.", true);
      return;
    }
    mensaje("");
    mostrarResultado(rnc, datos, rpe);
  } finally {
    boton.disabled = false;
    campo.readOnly = false;
    boton.textContent = "Ver mi diagnóstico";
  }
});

boton.disabled = false;
