import {buscarLicitaciones, rubrosDeActividad, rubrosInscritos} from "./oportunidades.js?v=2";

const DGII = "https://dgii.gov.do/herramientas/consultas/Paginas/RNC.aspx";
const RPE = "https://www.dgcp.gob.do/servicios/registro-de-proveedores/";
const ACTUALIZAR_RPE = "https://www.dgcp.gob.do/servicios/actualizacion-registro-de-proveedores/";
const API_DGCP = "https://datosabiertos.dgcp.gob.do/api-dgcp/v1/proveedores";
const MICM = "https://datos.gob.do/dataset/micro-pequenas-y-medianas-empresas-certificadas";
const VENTANILLA_MICM = "https://ventanillavirtual.micm.gob.do/";
const COMPRAS = "https://datosabiertos.dgcp.gob.do/";
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
    const respuesta = await fetch(new URL(url, import.meta.url), {
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
  const version = "?v=" + cortes.version;
  const [datos, actividades] = await Promise.all([
    leerJson("datos/" + numero + ".json" + version),
    leerJson("datos/actividades.json" + version).catch(() => []),
  ]);
  if (!datos.dgii || !datos.micm) throw new Error("Padrón inválido");
  const posicion = datos.actividad?.[rnc];
  return {
    cortes,
    dgii: datos.dgii[rnc] ?? null,
    micm: datos.micm[rnc] ?? null,
    actividad: Number.isInteger(posicion) && typeof actividades[posicion] === "string" ? actividades[posicion] : "",
  };
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
  return {
    tipo: "encontrado",
    numero: String(ficha.rpe),
    estado: ficha.estado.trim(),
    empresa: typeof ficha.razon_social === "string" ? ficha.razon_social.trim() : "",
    constancia: /^https:\/\/(?:www\.)?dgcp\.gob\.do\/constancia\/descargar\/[0-9]+$/.test(documento) ? documento : "",
  };
}

function elemento(tipo, contenido, clase = "") {
  const resultado = document.createElement(tipo);
  resultado.textContent = contenido;
  if (clase) resultado.className = clase;
  return resultado;
}

function enlaceExterno(texto, url) {
  const enlace = elemento("a", texto);
  enlace.href = url;
  enlace.target = "_blank";
  enlace.rel = "noopener noreferrer";
  return enlace;
}

function fila(titulo, texto, fuente = "", enlaces = []) {
  const fila = elemento("div", "", "a-fila");
  const cuerpo = elemento("dd", "");
  cuerpo.append(elemento("p", texto));
  if (fuente) cuerpo.append(elemento("p", fuente, "a-meta"));
  if (enlaces.length) {
    const lista = elemento("div", "", "a-enlaces");
    lista.append(...enlaces.map(([texto, url]) => enlaceExterno(texto, url)));
    cuerpo.append(lista);
  }
  fila.append(elemento("dt", titulo), cuerpo);
  return fila;
}

function filaRnc(datos) {
  const estado = datos.dgii?.toLowerCase();
  let texto = "Este RNC no figura en el padrón consultado.";
  if (estado === "por confirmar") texto = "El padrón de la DGII publica estados distintos para este RNC.";
  else if (estado) texto = "Figura " + (estado === "cese temporal" ? "en " : "") + estado + ".";
  return fila("Estado del RNC", texto, "DGII · " + fechaPublicada(datos.cortes.dgii), [["Consultar en la DGII", DGII]]);
}

function filaRpe(rpe) {
  if (rpe.tipo === "ausente") {
    return fila("Registro de Proveedores del Estado", "No tiene RPE registrado en la consulta de la DGCP.",
      "", [["Ver cómo inscribirte", RPE]]);
  }
  const estado = rpe.estado.toLowerCase();
  const enlaces = [];
  if (estado === "desactualizado") enlaces.push(["Ver cómo actualizar el RPE", ACTUALIZAR_RPE]);
  else if (estado !== "activo") enlaces.push(["Consultar en la DGCP", RPE]);
  if (rpe.constancia) enlaces.push(["Ver constancia", rpe.constancia]);
  return fila("Registro de Proveedores del Estado",
    "Figura " + estado + ". RPE n.º " + rpe.numero + ".", "Consulta directa a la DGCP", enlaces);
}

function filaMipyme(datos, hoy) {
  const enlaces = [["Trámite en el MICM", VENTANILLA_MICM], ["Ver padrón", MICM]];
  const fuente = "MICM · Emisiones publicadas hasta el " + fechaPublicada(datos.cortes.micm);
  if (!datos.micm) {
    return fila("Certificación MIPYME", "No cuenta con certificación MIPYME en el padrón consultado.", fuente, enlaces);
  }
  const [vencimiento, , categoria] = datos.micm;
  const vigente = vencimiento >= hoy;
  const texto = vigente
    ? "Cuenta con certificación vigente hasta el " + fechaPublicada(vencimiento) + (categoria ? " · " + categoria : "") + "."
    : "La última certificación publicada venció el " + fechaPublicada(vencimiento) + ".";
  return fila("Certificación MIPYME", texto, fuente, enlaces);
}

function filaLicitaciones({procesos, completo}, fuente) {
  if (!procesos.length && !completo) return null;
  const cantidad = procesos.length;
  const licitaciones = cantidad === 1 ? " licitación abierta relacionada" : " licitaciones abiertas relacionadas";
  const titulo = cantidad
    ? "Encontramos " + (completo ? "" : "al menos ") + cantidad + licitaciones + "."
    : "No encontramos licitaciones abiertas en los rubros consultados.";
  const resultado = fila("Licitaciones abiertas", titulo, fuente,
    cantidad ? [] : [["Explorar en la DGCP", COMPRAS]]);
  resultado.classList.add("a-fila-licitaciones");
  if (cantidad) {
    const detalles = elemento("details", "", "a-oportunidades");
    detalles.append(elemento("summary", cantidad > 12 ? "Ver los 12 próximos cierres" : "Ver " + (cantidad === 1 ? "la licitación" : "las licitaciones")));
    const lista = elemento("ul", "");
    for (const proceso of procesos.slice(0, 12)) {
      const item = elemento("li", "");
      item.append(proceso.url ? enlaceExterno(proceso.titulo, proceso.url) : elemento("span", proceso.titulo));
      item.append(elemento("p", proceso.codigo + " · Cierre " + proceso.cierre, "a-meta"));
      item.append(elemento("p", "Renglón relacionado con " + proceso.coincidencia, "a-meta"));
      lista.append(item);
    }
    detalles.append(lista);
    resultado.querySelector("dd").append(detalles);
  }
  return resultado;
}

function mostrarResultado(rnc, datos, rpe) {
  const hoy = isoDominicana();
  const formato = [rnc.slice(0, 3), rnc.slice(3, 8), rnc.slice(8)].join("-");
  obtener("empresa").textContent = [rpe?.empresa, "RNC " + formato].filter(Boolean).join(" · ");
  obtener("consultado").textContent = "Consulta del " + fechaPublicada(hoy);
  const hallazgos = [];
  if (datos) hallazgos.push(filaRnc(datos));
  if (rpe) hallazgos.push(filaRpe(rpe));
  if (datos) hallazgos.push(filaMipyme(datos, hoy));
  if (datos?.actividad) {
    const actividad = datos.actividad.toLocaleLowerCase("es-DO");
    hallazgos.push(fila("Actividad económica principal", actividad[0].toLocaleUpperCase("es-DO") + actividad.slice(1), "Registrada en la DGII"));
  }
  obtener("comprobaciones").replaceChildren(...hallazgos);
  estadoFuentes(datos, rpe);
  resultados.hidden = false;
  obtener("titulo-resultado").focus({preventScroll: true});
  resultados.scrollIntoView({block: "start"});
}

function estadoFuentes(datos, rpe, mensajeExtra = "") {
  const estado = obtener("aviso-fuentes");
  estado.textContent = [
    datos ? "" : "Los padrones de la DGII y del MICM están temporalmente indisponibles.",
    rpe ? "" : "La DGCP no respondió a la consulta del RPE.",
    mensajeExtra,
  ].filter(Boolean).join(" ");
  estado.hidden = !estado.textContent;
}

campo.addEventListener("input", () => {
  campo.removeAttribute("aria-invalid");
  mensaje("");
  resultados.hidden = true;
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
    let rubros = rubrosDeActividad(datos?.actividad);
    let fuente = "";
    if (rubros.length) {
      const lista = new Intl.ListFormat("es-DO", {style: "long", type: "conjunction"});
      fuente = "DGCP · " + lista.format(rubros.map(([, nombre]) => nombre));
    } else if (rpe?.tipo === "encontrado") {
      rubros = await rubrosInscritos(rpe.numero, leerJson).catch(() => []);
      fuente = "DGCP · Rubros inscritos en el RPE";
    }
    if (rubros.length) {
      estadoFuentes(datos, rpe, "Buscando licitaciones abiertas relacionadas…");
      const oportunidades = await buscarLicitaciones(rubros, leerJson).catch(() => null);
      const hallazgo = oportunidades ? filaLicitaciones(oportunidades, fuente) : null;
      if (hallazgo) obtener("comprobaciones").append(hallazgo);
      estadoFuentes(datos, rpe, hallazgo ? "" : "El conteo de licitaciones no se pudo comprobar en esta consulta.");
    }
  } finally {
    boton.disabled = false;
    campo.readOnly = false;
    boton.textContent = "Ver mi diagnóstico";
  }
});

boton.disabled = false;
