"use strict";
(() => {
  const id = (clave) => document.getElementById(clave);
  const lista = id("lista"), dialogo = id("solicitud"), envio = id("envio"), entrega = id("entrega");
  const formato = new Intl.NumberFormat("es-DO");
  const mensajes = {
    consentimiento_requerido: "Actualiza la página y acepta el texto vigente para solicitar el informe.",
    correo_invalido: "Revisa la dirección de correo.",
    licitacion_no_encontrada: "Esta licitación ya no está disponible. Vuelve al buscador.",
    limite_temporal: "Se alcanzó el límite de solicitudes. Vuelve a intentarlo dentro de una hora.",
    envio_en_proceso: "Tu solicitud sigue en proceso. Revisa tu correo dentro de unos minutos.",
    envio_por_confirmar: "El servicio de correo todavía no ha confirmado el envío. Revisa tu buzón antes de volver a intentarlo."
  };
  let actual, seleccion, consentimiento, busqueda, enviando = false, pagina = 1;
  function elemento(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto) nodo.textContent = texto;
    return nodo;
  }
  function abrir(item) {
    if (!consentimiento || enviando) return;
    seleccion = item;
    envio.reset();
    envio.hidden = false;
    id("titulo-solicitud").textContent = "Recibir informe por correo";
    id("ref").textContent = item.codigo;
    id("objeto").textContent = item.titulo;
    id("consentimiento").textContent = consentimiento.texto;
    entrega.textContent = "";
    delete entrega.dataset.error;
    dialogo.showModal();
    id("correo").focus();
  }
  function fila(item) {
    const tarjeta = elemento("li", "fila"), datos = elemento("div");
    datos.append(elemento("span", "referencia", item.codigo), elemento("h3", "", item.titulo || "Licitación pública"));
    if (item.institucion) datos.append(elemento("p", "entidad", item.institucion));
    const detalles = elemento("div", "detalles");
    const monto = item.monto == null || item.monto === "" ? NaN : Number(item.monto);
    const referencia = Number.isFinite(monto) ? (item.moneda === "DOP" ? "RD$" : item.moneda || "") + " " +
      monto.toLocaleString("es-DO", {minimumFractionDigits:2, maximumFractionDigits:2}) : "";
    for (const valor of [item.modalidad, item.estado, item.cierre && "Cierre · " + item.cierre, referencia]) {
      if (valor) detalles.append(elemento("span", "", valor));
    }
    datos.append(detalles);
    const boton = elemento("button", "secundario", "Solicitar informe");
    boton.type = "button";
    boton.setAttribute("aria-label", "Solicitar informe de " + item.codigo);
    boton.addEventListener("click", () => abrir(item));
    tarjeta.append(datos, boton);
    return tarjeta;
  }
  function parametros() {
    const parametros = new URLSearchParams(location.search);
    id("consulta").value = (parametros.get("q") || "").slice(0,160);
    id("fase").value = parametros.get("fase") || "todas";
    if (!id("fase").value) id("fase").value = "todas";
    pagina = Number(parametros.get("pagina")) || 1;
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 2147483647) pagina = 1;
    return {q:id("consulta").value.trim(), fase:id("fase").value};
  }
  function navegar(nueva, desdeFormulario = false) {
    const filtros = desdeFormulario ? {q:id("consulta").value.trim(), fase:id("fase").value} : actual;
    const params = new URLSearchParams();
    if (filtros.q) params.set("q", filtros.q);
    if (filtros.fase !== "todas") params.set("fase", filtros.fase);
    if (nueva !== 1) params.set("pagina", nueva);
    const url = location.pathname + (params.size ? "?" + params : "");
    if (url !== location.pathname + location.search) history.pushState(null, "", url);
    cargar(true);
  }
  async function cargar(enfocar = false) {
    busqueda?.abort();
    const control = new AbortController();
    busqueda = control;
    actual = parametros();
    const estado = id("estado"), q = actual.q;
    lista.replaceChildren();
    id("paginacion").hidden = true;
    id("reintentar").hidden = true;
    if (enfocar) id("titulo-resultados").focus({preventScroll:false});
    if (q && q.length < 3) {
      estado.textContent = "Escribe al menos tres caracteres para buscar.";
      return;
    }
    estado.textContent = "Buscando licitaciones…";
    const params = new URLSearchParams({...actual, pagina:String(pagina), limite:"10"});
    try {
      const res = await fetch("/api/v1/expedientes/buscar?" + params, {credentials:"omit", signal:control.signal});
      if (!res.ok) throw new Error();
      const datos = await res.json();
      if (control.signal.aborted) return;
      consentimiento = datos.consentimiento;
      const paginas = Math.ceil(datos.total / datos.limite);
      if (pagina > Math.max(1, paginas)) {
        const url = new URL(location.href);
        url.searchParams.set("pagina", String(Math.max(1, paginas)));
        history.replaceState(null, "", url);
        return cargar();
      }
      lista.replaceChildren(...datos.items.map(fila));
      if (!datos.total) {
        estado.textContent = "No encontramos licitaciones con esos criterios. Prueba otra palabra o cambia la fase.";
        return;
      }
      const inicio = (pagina - 1) * datos.limite + 1;
      estado.textContent = formato.format(inicio) + "–" + formato.format(inicio + datos.items.length - 1) +
        " de " + formato.format(datos.total) + (datos.total === 1 ? " licitación" : " licitaciones");
      id("pagina").textContent = "Página " + formato.format(pagina) + " de " + formato.format(paginas);
      id("anterior").disabled = pagina === 1;
      id("siguiente").disabled = pagina === paginas;
      id("paginacion").hidden = paginas < 2;
    } catch (error) {
      if (control.signal.aborted) return;
      estado.textContent = "No pudimos cargar el catálogo. Inténtalo de nuevo.";
      id("reintentar").hidden = false;
    }
  }
  envio.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (enviando || !envio.reportValidity() || !id("acepta").checked) return;
    enviando = true;
    id("enviar").disabled = true;
    delete entrega.dataset.error;
    entrega.textContent = "Preparando tu PDF y enviándolo por correo…";
    const correo = id("correo").value.trim();
    try {
      const res = await fetch("/api/v1/expedientes/solicitar-informe", {method:"POST", credentials:"omit",
        headers:{"Content-Type":"application/json"}, body:JSON.stringify({codigo:seleccion.codigo, correo,
          acepta_publicidad:id("acepta").checked, version_consentimiento:consentimiento.version})});
      const datos = await res.json();
      if (!res.ok || datos.estado !== "enviado") throw new Error(mensajes[datos.error || datos.detail] || "");
      envio.hidden = true;
      id("titulo-solicitud").textContent = "Informe enviado";
      entrega.textContent = "Enviamos el PDF a " + correo + ". Si no lo ves en tu bandeja de entrada, revisa la carpeta de correo no deseado.";
      id("cerrar").focus();
    } catch (error) {
      entrega.dataset.error = "";
      entrega.textContent = Object.values(mensajes).includes(error.message) ? error.message :
        "No pudimos confirmar el envío. Revisa tu correo antes de intentarlo de nuevo.";
    } finally {
      enviando = false;
      id("enviar").disabled = false;
    }
  });
  id("cerrar").addEventListener("click", () => dialogo.close());
  id("buscador").addEventListener("submit", (e) => { e.preventDefault(); navegar(1, true); });
  id("anterior").addEventListener("click", () => navegar(pagina-1));
  id("siguiente").addEventListener("click", () => navegar(pagina+1));
  id("reintentar").addEventListener("click", () => cargar());
  window.addEventListener("popstate", () => cargar());
  cargar();
})();
