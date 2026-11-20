const API = "https://datosabiertos.dgcp.gob.do/api-dgcp/v1/";
const LIMITE = 1000;
const MAX_PROCESOS_NUEVOS = 6;
const MAX_PAGINAS_POR_PROCESO = 4;
const FORMATO_CIERRE = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Santo_Domingo",
});

// Familias UNSPSC del catálogo de la DGCP. Las reglas exigen que la
// descripción de la DGII identifique el bien o servicio de cada familia.
const COMERCIO = /^(venta|fabricacion|elaboracion|produccion|comercializacion)\b/;
const RUBROS = [
  [/^(servicios? (de )?)?inmobiliari[oa]s\b/, [["8013", "servicios inmobiliarios"]]],
  [/^servicios? juridicos\b/, [["8012", "servicios legales"]]],
  [/^servicios? de (asesoramiento, direccion y gestion empresarial|consultoria (de gestion|empresarial))\b/, [["8010", "asesoría de gestión"]]],
  [/^servicios? de (contabilidad|auditoria)\b/, [["8411", "contabilidad y auditoría"]]],
  [/^servicios? de (arquitectura|ingenieria)\b/, [["8110", "ingeniería y arquitectura"]]],
  [/^(servicios? de publicidad|agencias de publicidad)\b/, [["8210", "publicidad"]]],
  [/^(servicios? (relacionados con la|de) impresion|impresion)\b/, [["8212", "impresión y reproducción"]]],
  [/^edicion\b/, [["5510", "medios impresos"]]],
  [/^servicios? (de )?(fotografi[ac]|fotograficos)\b/, [["8213", "servicios fotográficos"]]],
  [/^(servicios? de )?diseno grafico\b/, [["8214", "diseño gráfico"]]],
  [/^(diseno y desarrollo de software|servicios? (de consultores en informatica|informaticos))\b/, [["8111", "servicios informáticos"]]],
  [/^servicios? de (aseo|limpieza)\b/, [["7611", "servicios de limpieza"]]],
  [/^(recoleccion|tratamiento|eliminacion) de (desechos|residuos)\b/, [["7612", "gestión de desechos"]]],
  [/^servicios? de (seguridad|vigilancia) (privada|personal)\b/, [["9212", "seguridad privada"]]],
  [/^(provision de comidas|servicios? de (catering|restaurantes|expendio de comidas))\b/, [["9010", "alimentación y catering"]]],
  [/^(servicios? de (alojamiento|hoteles)|alojamiento en hoteles)\b/, [["9011", "alojamiento"]]],
  [/^servicios? (minoristas |mayoristas )?de agencias de viajes\b/, [["9012", "servicios de viajes"]]],
  [/^(servicios? de )?transporte\b.*\bpasajeros\b/, [["7811", "transporte de pasajeros"]]],
  [/^(servicios? de )?transporte\b.*\b(cargas?|mercancias|mercaderias)\b/, [["7810", "transporte de carga"]]],
  [/^mantenimiento y reparacion\b.*\b(vehiculos|automotor|del motor)\b/, [["7818", "mantenimiento de vehículos"]]],
  [/^(constr\.?|construccion|obras)\b.*\b(edificios|edificaciones)\b/, [["7213", "construcción de edificios"]]],
  [/^(obras de ingenieria civil|construccion de carreteras)\b/, [["7214", "obras civiles"]]],
  [/^(fabricacion|venta)\b.*\bequipo[s]? electric[oa]s?\b/, [["3912", "equipos y componentes eléctricos"]]],
  [/\belectrodomesticos y electronica de consumo\b/, [["5214", "electrodomésticos"], ["5216", "electrónica de consumo"]], COMERCIO],
  [/\belectrodomesticos\b|\bartefactos para el hogar electricos\b/, [["5214", "electrodomésticos"]], COMERCIO],
  [/\bcomputadoras\b|\bequipos? informaticos\b/, [["4321", "equipos informáticos"]], COMERCIO],
  [/\b(programas informaticos|software)\b/, [["4323", "software"]], COMERCIO],
  [/\b(articulos de (libreria y )?papeleria|suministros de oficina)\b/, [["4412", "suministros de oficina"]], COMERCIO],
  [/\barticulos de ferreteria\b/, [["2711", "herramientas de mano"], ["3018", "instalaciones de plomería"]], COMERCIO],
  [/\b(cosmeticos|articulos de tocador)\b/, [["5313", "artículos de cuidado personal"]], COMERCIO],
  [/\bmuebles\b/, [["5610", "muebles de alojamiento"], ["5611", "muebles comerciales"], ["5612", "mobiliario institucional"]], COMERCIO],
  [/\bproductos de (aseo|limpieza)\b/, [["4713", "suministros de limpieza"]], COMERCIO],
  [/\b(gasolina|combustibles liquidos)\b/, [["1510", "combustibles"]], COMERCIO],
  [/\b(hormigon|cemento|yeso)\b/, [["3011", "hormigón, cemento y yeso"]], COMERCIO],
  [/\b(puertas y ventanas|aberturas de madera)\b/, [["3017", "puertas, ventanas y vidrio"]], COMERCIO],
  [/\bpartes\b.*\b(accesorios|piezas)\b.*\bvehiculos\b/, [["2517", "partes y accesorios de vehículos"]], COMERCIO],
  [/^venta de vehiculos automotores\b/, [["2510", "vehículos de motor"]]],
  [/\bprendas de vestir\b/, [["5310", "ropa"]], COMERCIO],
  [/\bcalzado\b/, [["5311", "calzado"]], COMERCIO],
  [/\b(productos de panaderia|panaderia y pasteleria)\b/, [["5018", "productos de panadería"]], COMERCIO],
  [/\b(productos carnicos|carnes)\b/, [["5011", "carnes y aves"]], COMERCIO],
  [/\b(pescados|mariscos)\b/, [["5012", "pescados y mariscos"]], COMERCIO],
  [/\b(productos lacteos|leche y derivados)\b/, [["5013", "productos lácteos"]], COMERCIO],
  [/\bbebidas (alcoholicas|no alcoholicas)\b/, [["5020", "bebidas"]], COMERCIO],
];

export function rubrosDeActividad(actividad) {
  if (!actividad) return [];
  const texto = actividad.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return RUBROS.find(([patron, , sector]) => patron.test(texto) && (!sector || sector.test(texto)))?.[1] ?? [];
}

function fechaAst(valor) {
  // El SECP publica horas de pared dominicanas aunque la API agregue una Z.
  // Coincide con el criterio de recepción que ya emplea el Explorador.
  const iso = typeof valor === "string" ? valor.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/)?.[0] : null;
  return iso ? Date.parse(iso.replace(" ", "T") + "-04:00") : NaN;
}

function expedienteOficial(valor) {
  if (typeof valor !== "string") return "";
  try {
    const url = new URL(valor);
    if (url.origin === "https://comunidad.comprasdominicana.gob.do"
        && url.pathname.replace(/^\/+/, "") === "Public/Tendering/OpportunityDetail/Index"
        && /^DO1\.NTC\.\d+$/.test(url.searchParams.get("noticeUID") ?? "")) return url.href;
  } catch {
    // La coincidencia del renglón permanece utilizable sin un enlace.
  }
  return "";
}

async function obtenerPagina(ruta, parametros, leerJson) {
  const url = new URL(ruta, API);
  url.search = new URLSearchParams({limit: LIMITE, ...parametros}).toString();
  const respuesta = await leerJson(url, {headers: {Accept: "application/json"}});
  const filas = respuesta?.payload?.content;
  if (respuesta?.code !== 200 || respuesta.hasError || (!Array.isArray(filas) && filas !== null)) {
    throw new Error("Respuesta de procesos inválida");
  }
  if ((!filas || !filas.length) && !respuesta.totalResults) return {filas: [], paginas: 1};
  if (!Array.isArray(filas) || !Number.isInteger(respuesta.pages) || respuesta.pages < 1
      || respuesta.page !== parametros.page) {
    throw new Error("Paginación de procesos inválida");
  }
  return {filas, paginas: respuesta.pages};
}

export async function rubrosInscritos(rpe, leerJson) {
  const rubros = new Map();
  let paginas = 1;
  for (let page = 1; page <= paginas; page++) {
    const respuesta = await obtenerPagina("proveedores/rubro", {rpe, page}, leerJson);
    paginas = respuesta.paginas;
    for (const fila of respuesta.filas) {
      const codigo = String(fila.familia_unspsc);
      if (String(fila.rpe) === rpe && /^\d{4}0000$/.test(codigo) && fila.descripcion?.trim()) {
        rubros.set(codigo.slice(0, 4), fila.descripcion.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-DO"));
      }
    }
  }
  return [...rubros];
}

async function procesosAbiertos(leerJson, ahora) {
  const procesos = new Map();
  let paginas = 1;
  for (let page = 1; page <= paginas; page++) {
    const respuesta = await obtenerPagina("procesos", {estado: "Proceso publicado", page}, leerJson);
    paginas = respuesta.paginas;
    for (const fila of respuesta.filas) {
      const cierre = fechaAst(fila.fecha_fin_recepcion_ofertas);
      const publicada = fechaAst(fila.fecha_publicacion);
      if (!(cierre > ahora && publicada <= ahora && fila.codigo_proceso
          && fila.estado_proceso === "Proceso publicado")) continue;
      procesos.set(fila.codigo_proceso, {
        codigo: fila.codigo_proceso,
        titulo: String(fila.titulo || fila.codigo_proceso).trim(),
        publicada,
        cierre,
        url: expedienteOficial(fila.url),
      });
    }
  }
  return procesos;
}

async function coincideProcesoNuevo(proceso, familias, leerJson) {
  for (let page = 1; page <= MAX_PAGINAS_POR_PROCESO; page++) {
    const {filas, paginas} = await obtenerPagina("procesos/articulos", {proceso: proceso.codigo, page}, leerJson);
    const coincidencia = filas.find(({codigo_proceso, familia_unspsc}) => codigo_proceso === proceso.codigo
        && familias.has(String(familia_unspsc).slice(0, 4)));
    if (coincidencia) return String(coincidencia.familia_unspsc).slice(0, 4);
    if (page >= paginas) return null;
  }
  throw new Error("El proceso tiene más renglones que la consulta revisada");
}

export async function buscarLicitaciones(rubros, leerJson, ahora = Date.now()) {
  const [abiertos, indice] = await Promise.all([
    procesosAbiertos(leerJson, ahora),
    leerJson("datos/renglones.json", {cache: "no-cache"}),
  ]);
  if (!indice.familias || !Number.isFinite(Date.parse(indice.corte))) {
    throw new Error("Índice de renglones inválido");
  }
  const familias = new Map(rubros);
  const encontrados = [];
  const nuevos = [];
  for (const proceso of abiertos.values()) {
    const renglones = indice.familias[proceso.codigo];
    if (!Array.isArray(renglones)) nuevos.push(proceso);
    else {
      const coincidencia = familias.get(renglones.find((familia) => familias.has(familia)));
      if (coincidencia) encontrados.push({...proceso, coincidencia});
    }
  }
  const revisar = nuevos.sort((a, b) => b.publicada - a.publicada).slice(0, MAX_PROCESOS_NUEVOS);
  const verificaciones = await Promise.allSettled(revisar.map((proceso) => coincideProcesoNuevo(proceso, familias, leerJson)));
  for (const [i, resultado] of verificaciones.entries()) {
    if (resultado.status === "fulfilled" && resultado.value) {
      encontrados.push({...revisar[i], coincidencia: familias.get(resultado.value)});
    }
  }
  const completo = revisar.length === nuevos.length && verificaciones.every((resultado) => resultado.status === "fulfilled");
  const procesos = encontrados
    .sort((a, b) => a.cierre - b.cierre || a.codigo.localeCompare(b.codigo))
    .map(({codigo, titulo, url, cierre, coincidencia}) => ({codigo, titulo, url, cierre: FORMATO_CIERRE.format(cierre), coincidencia}));
  return {procesos, completo};
}
