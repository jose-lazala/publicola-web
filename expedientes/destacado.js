(() => {
  const completa = document.querySelector("[data-expediente-completo]");
  const portada = document.querySelector("[data-expediente-portada]");
  const lista = document.querySelector("[data-expediente-lista]");
  const fe = window.FichaEditorial;
  if ((!completa && !portada) || !fe) return;

  const { texto, fecha, enlaceOficial } = fe;
  const ruta = "/expedientes/";
  const cadaCincoMinutos = 5 * 60 * 1000;
  let visible = null;
  let firma = "";
  let vencimiento = 0;
  let timer;
  let consultando = false;

  const cuenta = (n, singular, plural) => n ? `${n} ${n === 1 ? singular : plural}` : "";
  const fechaCierre = (x, conAnio = true) =>
    `<time datetime="${texto(x.vence_en)}">${texto(fecha(x.cierre, conAnio))}</time>`;
  const titulo = (x) => fe.tituloDeMuestra(x.codigo) || x.titulo || "Licitación pública";
  const oferta = (x) => x.cita ? `Pliego · pág. ${x.cita.pagina}` : "";
  const sinDato = (mensaje) => `<p class="fe-nota">${texto(mensaje)}</p>`;
  const siguiente = (x) =>
    `/app/?acceso=crear#/oportunidades?seleccion=${encodeURIComponent(x.codigo)}`;
  const seguir = (x, etiqueta) => `<a class="fe-boton" href="${texto(siguiente(x))}">${texto(etiqueta)} <span aria-hidden="true">→</span></a>`;

  function pintarPortada(x, aviso) {
    if (!portada) return;
    portada.innerHTML = x ? `
      <header class="editorial-expediente-cabecera"><span>${texto(x.codigo)}</span><span>${texto(x.modalidad)}</span></header>
      <div class="editorial-expediente-cuerpo">
        <p class="editorial-expediente-etiqueta"><span aria-hidden="true">●</span> ${texto(x.estado)}</p>
        <h2 id="expediente-portada">${texto(titulo(x))}</h2>
        <p>${[x.institucion, x.dirigido_a].filter(Boolean).map(texto).join(" · ")}</p>
        <dl class="editorial-expediente-datos">
          <div><dt>Cierre publicado</dt><dd>${fechaCierre(x, false)}</dd></div>
          <div><dt>Monto de referencia</dt><dd>${texto(x.monto || "No publicado")}</dd></div>
        </dl>
        <a class="editorial-expediente-fuente" href="${ruta}${x.cita ? "#oferta-tecnica" : ""}">
          <span><small>${x.cita ? "Qué hay que presentar" : "Renglones, requisitos y documentos"}</small><strong>${texto(x.cita?.titulo || "Ver el expediente")}</strong></span>
          <span>${texto(oferta(x))} <span aria-hidden="true">→</span></span>
        </a>
      </div>` : `<div class="editorial-expediente-cuerpo"><h2 id="expediente-portada">Expediente público</h2><p role="status">${texto(aviso)}</p></div>`;
    if (lista) lista.innerHTML = x ? `<li><a href="${ruta}">
      <span><strong>${texto(titulo(x))}</strong><small>${texto(x.institucion)} · ${texto(x.codigo)}</small></span>
      <span>${fechaCierre(x, false)} <span aria-hidden="true">→</span></span>
    </a></li>` : `<li>${texto(aviso)}</li>`;
  }

  function tabla(filas, encabezado = true) {
    const celda = (etiqueta, valor, clase = "fe-cifra") =>
      `<td class="${clase}" data-etiqueta="${etiqueta}">${texto(valor || "—")}</td>`;
    return `<table class="fe-renglones" aria-label="${encabezado ? "Renglones principales" : "Otros renglones"}">
      <thead><tr><th scope="col" class="fe-cifra">N.º</th><th scope="col">Descripción</th>
        <th scope="col" class="fe-cifra">Cant.</th><th scope="col" class="fe-cifra">Precio unitario</th>
        <th scope="col" class="fe-cifra">Total estimado</th></tr></thead>
      <tbody>${filas.map((l) => `<tr>${celda("Renglón", l.numero)}${celda("Descripción", l.descripcion, "")}
        ${celda("Cantidad", [l.cantidad, l.unidad].filter(Boolean).join(" "))}
        ${celda("Precio unitario", l.precio_unitario)}${celda("Total estimado", l.total_estimado, "fe-cifra fe-total")}</tr>`).join("")}</tbody>
    </table>`;
  }

  function pintarCompleta(x, aviso) {
    if (!completa) return;
    const migas = '<a href="/?publico">← Volver a la vitrina</a>';
    if (!x) {
      completa.innerHTML = `<div class="fe-wrap fe-top">${migas}<h1>Expediente público</h1><p role="status">${texto(aviso)}</p></div>`;
      return;
    }
    const oficial = enlaceOficial(x.url_oficial, "Ver expediente oficial");
    const renglones = fe.ordenarRenglones(x.renglones);
    const documentos = x.documentos;
    const nRenglones = cuenta(renglones.length, "renglón publicado", "renglones publicados");
    const nHitos = cuenta(x.fechas.length, "hito publicado", "hitos publicados");
    const nDocumentos = cuenta(documentos.length, "documento oficial", "documentos oficiales");
    const pintarDocumento = (d) => fe.fila({
      titulo: d.titulo || "Documento del proceso",
      lateral: enlaceOficial(d.url, "Abrir en el SECP"),
    });
    const formularios = documentos.filter((d) => /formulario|sncc[ _.-]|debida diligencia|antisoborno/i.test(`${d.tipo || ""} ${d.titulo || ""}`));
    const cita = x.cita ? fe.detalleCita(x.cita, { abierto: true }) : "";
    const otros = renglones.slice(6);
    completa.innerHTML = fe.resumen({
      codigo: x.codigo, modalidad: x.modalidad, estado: x.estado, titulo: titulo(x),
      institucion: texto(x.institucion), migas: migas + "<span>Expediente público · Licitación vigente</span>",
      datos: [
        { titulo: "Dirigido a", valor: texto(x.dirigido_a || "No indicado") },
        { titulo: "Cierre publicado", valor: fechaCierre(x), nota: x.cierre_tiene_hora ? "Hora de República Dominicana" : "" },
        { titulo: "Monto de referencia publicado", valor: texto(x.monto || "No publicado") },
      ],
      evidencia: x.cita ? fe.evidencia(x.cita.titulo, oferta(x)) : "",
      fuente: `<p class="fe-origen">Consulta el SECP para comprobar el estado, las fechas vigentes y las enmiendas. ${oficial}</p>`,
      aclaraciones: x.titulo && x.titulo !== titulo(x)
        ? `<details class="full-title"><summary>Ver título oficial completo</summary><p>${texto(x.titulo)}</p></details>` : "",
      acciones: `<p>Sigue este proceso y recibe sus cambios en tu campana de avisos.</p>${seguir(x, "Seguir este proceso")}`,
    }) + fe.indice({ pistas: {
      contratacion: nRenglones, fechas: nHitos, fuentes: nDocumentos,
    } }) + fe.cuerpo({
      contratacion: renglones.length
        ? `<p class="fe-nota">${texto(nRenglones)} · Montos de referencia de la institución</p>${tabla(renglones.slice(0, 6))}
          ${otros.length ? `<details class="fe-mas"><summary><span class="fe-ver-mas">Ver los ${renglones.length} renglones</span><span class="fe-ver-menos">Mostrar solo los seis primeros</span></summary>${tabla(otros, false)}</details>` : ""}`
        : sinDato("Todavía no tenemos los renglones publicados para este proceso.") + oficial,
      participar: cita + (formularios.length ? `<h3>Formularios publicados</h3>${formularios.map(pintarDocumento).join("")}` : "")
        + sinDato(x.cita ? "Consulta el pliego para ver todos los requisitos de la oferta." : "Consulta el pliego oficial para comprobar qué exige la institución.") + oficial,
      fechas: `<p class="fe-nota">Hora de República Dominicana</p>${fe.cronograma(x.fechas)}`,
      "informacion-general": fe.condiciones(x.condiciones.map((c) => ({ titulo: c.titulo, valor: texto(c.valor) })))
        + sinDato("Consulta el pliego para comprobar los canales de presentación, la entrega y las garantías."),
      fuentes: documentos.length
        ? fe.filas(documentos, 5, `los ${documentos.length} documentos`, pintarDocumento)
        : sinDato("Los documentos del proceso se pueden consultar en el expediente oficial.") + oficial,
    }, { titulos: /servicio|obra/i.test(x.condiciones.find((c) => c.titulo === "Tipo de contrato")?.valor || "")
      ? { contratacion: "Qué se contrata" } : {} }) + `
      <section class="fe-cierre"><div class="fe-wrap fe-cierre-interior">
        <div><div class="fe-antetitulo">Tu próximo paso</div><h2>Ya viste qué pide este proceso.<br>Ahora síguelo.</h2></div>
        <div class="fe-cierre-acciones">${seguir(x, "Seguir este proceso")}${enlaceOficial(x.url_oficial, "Ver expediente oficial", "fe-boton fe-boton-secundario")}</div>
      </div></section>
      <div class="fe-barra"><span><small>Cierre publicado</small><strong>${fechaCierre(x, false)}</strong></span>${seguir(x, "Seguir")}</div>`;
  }

  function pintar(x, aviso = "") {
    const nuevaFirma = JSON.stringify([x, aviso]);
    if (nuevaFirma === firma) return;
    const primeraVez = !visible;
    visible = x;
    firma = nuevaFirma;
    pintarPortada(x, aviso);
    pintarCompleta(x, aviso);
    if (completa && x && primeraVez && location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }

  async function actualizar() {
    if (consultando) return;
    clearTimeout(timer);
    consultando = true;
    let siguienteIntento = cadaCincoMinutos;
    try {
      const respuesta = await fetch("/api/v1/expedientes/destacado", { credentials: "omit", cache: "no-store" });
      if (!respuesta.ok) throw new Error("expediente_no_disponible");
      const { expediente, servido_en: servido } = await respuesta.json();
      const tiempoVigente = expediente && Date.parse(expediente.vence_en) - (Date.parse(servido) || Date.now());
      if (tiempoVigente > 0) {
        vencimiento = Date.now() + tiempoVigente;
        pintar(expediente);
        siguienteIntento = Math.min(cadaCincoMinutos, tiempoVigente + 200);
      } else {
        pintar(null, "Ahora mismo no hay un expediente vigente destacado. Vuelve en unos minutos.");
        siguienteIntento = 60_000;
      }
    } catch {
      if (!visible || Date.now() >= vencimiento) {
        pintar(null, "El expediente no está disponible en este momento. Vuelve en unos minutos.");
      }
      siguienteIntento = visible ? Math.min(30_000, Math.max(250, vencimiento - Date.now())) : 30_000;
    } finally {
      consultando = false;
      timer = setTimeout(actualizar, siguienteIntento);
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) actualizar();
  });
  actualizar();
})();
