"use strict";
(() => {
  const panel = document.querySelector("[data-explorador-informes]");
  if (!panel) return;

  const id = clave => document.getElementById(clave);
  const portada = panel.dataset.exploradorInformes === "portada";
  const ruta = "/solicitar-informe/";
  const limite = portada ? 2 : 10;
  const formato = new Intl.NumberFormat("es-DO");
  const consulta = id("consulta"), fase = id("fase"), buscador = id("buscador");
  const historico = id("historico"), resumen = id("resumen-publico");
  const opciones = Array.from(buscador.querySelectorAll("[name=tipo_compra]"));
  const tipos = opciones.map(boton => boton.value);
  const lista = id("lista"), estado = id("estado"), mas = id("mas-resultados");
  const solicitud = id("solicitud"), envio = id("envio"), entrega = id("entrega");
  const mensajes = {
    consentimiento_requerido: "Actualiza la página y acepta el texto vigente para solicitar el informe.",
    correo_invalido: "Revisa la dirección de correo.",
    correo_no_disponible: "El servicio de correo no pudo entregar el informe. Puedes volver a intentarlo más tarde.",
    licitacion_no_encontrada: "Esta licitación ya no está disponible. Vuelve al buscador.",
    limite_temporal: "Se alcanzó el límite de solicitudes. Vuelve a intentarlo dentro de una hora.",
    envio_en_proceso: "Tu solicitud sigue en proceso. Revisa tu correo dentro de unos minutos.",
    envio_por_confirmar: "El servicio de correo todavía no ha confirmado el envío. Revisa tu buzón antes de volver a intentarlo."
  };
  let tipo = "", pagina = 1, consentimiento, seleccion, pendiente;
  let cargando, reloj, ultimoCodigo = "", devolverFoco = false;
  let resultados = new Map();

  function elemento(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto;
    return nodo;
  }

  function leerUrl() {
    const params = new URLSearchParams(portada ? "" : location.search);
    consulta.value = (params.get("q") || "").slice(0,160);
    tipo = tipos.includes(params.get("tipo_compra")) ? params.get("tipo_compra") : "";
    const numero = Number(params.get("pagina"));
    pagina = Number.isSafeInteger(numero) && numero >= 1 && numero <= 2147483647 ? numero : 1;
    if (fase) {
      fase.value = params.get("fase") || "todas";
      if (!fase.value) fase.value = "todas";
      if (fase.value !== "todas") fase.closest("details").open = true;
    }
    historico.checked = params.get("etapa") === "todas" || Boolean(fase && !["todas", "abierta"].includes(fase.value));
  }

  function urlCompleta(numero = 1, codigo = "", accion = "solicitar") {
    const params = new URLSearchParams();
    if (consulta.value.trim()) params.set("q",consulta.value.trim());
    if (tipo) params.set("tipo_compra",tipo);
    if (fase && fase.value !== "todas") params.set("fase",fase.value);
    if (historico.checked) params.set("etapa","todas");
    if (numero > 1) params.set("pagina",String(numero));
    if (codigo) params.set(accion,codigo);
    return ruta + (params.size ? "?" + params : "");
  }

  function historial(destino, reemplazar = false, desdeFila = false) {
    if (location.pathname + location.search !== destino) {
      history[reemplazar ? "replaceState" : "pushState"]({desdeFila}, "", destino);
    }
  }

  function pintarOpciones(conteos) {
    for (const boton of opciones) {
      boton.setAttribute("aria-pressed",String(boton.value === tipo));
      const n = conteos?.[boton.value];
      boton.querySelector("small").textContent = Number.isInteger(n) ? formato.format(n) : "";
      boton.setAttribute("aria-label",Number.isInteger(n) ? boton.value + ", " + formato.format(n) + (n === 1 ? " licitación" : " licitaciones") : boton.value);
    }
    id("borrar-consulta").hidden = !consulta.value;
  }

  function devolverAlListado() {
    if (resumen) resumen.hidden = true;
    if (solicitud && !solicitud.hidden) {
      solicitud.hidden = true;
      envio.reset();
    }
    id("explorar-informes").hidden = false;
    seleccion = null;
  }

  function montoDe(item) {
    if (item.monto == null || item.monto === "") return "";
    const monto = Number(item.monto);
    if (!Number.isFinite(monto)) return "";
    const unidad = {DOP:"RD$", USD:"US$"}[item.moneda] || item.moneda || "";
    return unidad + " " + monto.toLocaleString("es-DO", {minimumFractionDigits:2, maximumFractionDigits:2});
  }

  function importe(monto) {
    return elemento("span", monto ? "ir-importe" : "", monto || "Sin dato publicado");
  }

  function abrirSolicitud(item) {
    if (!solicitud || !consentimiento || !item) return;
    seleccion = item;
    ultimoCodigo = item.codigo;
    id("explorar-informes").hidden = true;
    resumen.hidden = true;
    solicitud.hidden = false;
    envio.reset();
    envio.hidden = false;
    id("cerrar").disabled = false;
    id("enviar").disabled = false;
    id("titulo-solicitud").textContent = "Recibir el informe por correo";
    id("ref").textContent = [item.tipo, item.codigo].filter(Boolean).join(" · ");
    id("objeto").textContent = item.titulo || "Licitación pública";
    const monto = montoDe(item);
    const entidad = id("entidad-elegida");
    entidad.textContent = item.institucion || "";
    if (monto) entidad.append(item.institucion ? " · Monto estimado " : "Monto estimado ", importe(monto));
    id("consentimiento").textContent = consentimiento.texto;
    entrega.textContent = "";
    delete entrega.dataset.error;
    id("titulo-solicitud").focus();
  }

  function fila(item) {
    const tarjeta = elemento("li","ir-lista-fila"), datos = elemento("div");
    const meta = elemento("div","ir-metadatos");
    if (item.tipo) meta.append(elemento("span","ir-categoria",item.tipo));
    meta.append(elemento("span","ir-codigo",item.codigo));
    const titulo = elemento("h3");
    const ver = elemento("a", "ir-ver", item.titulo || "Licitación pública");
    ver.href = urlCompleta(pagina,item.codigo,"ver");
    titulo.append(ver);
    datos.append(meta,titulo);
    if (item.institucion) datos.append(elemento("p","ir-entidad",item.institucion));
    const detalle = elemento("p","ir-detalles");
    const presupuesto = elemento("strong","","Monto estimado · ");
    presupuesto.append(importe(montoDe(item)));
    detalle.append(presupuesto);
    if (item.modalidad) detalle.append(elemento("span","",item.modalidad));
    if (item.cierre) detalle.append(elemento("span","","Cierre · " + item.cierre));
    datos.append(detalle);
    const enlace = elemento("a","ir-pedir","Solicitar informe");
    enlace.href = urlCompleta(pagina,item.codigo);
    enlace.dataset.codigo = item.codigo;
    enlace.setAttribute("aria-label","Solicitar informe de " + item.codigo);
    tarjeta.append(datos, enlace);
    return tarjeta;
  }

  async function pedirLista(params, signal) {
    const res = await fetch("/api/v1/expedientes/buscar?" + params, {credentials:"omit", cache:"no-store", signal});
    if (!res.ok) throw new Error("catalogo");
    return res.json();
  }

  function pintarResumen(item) {
    id("tipo-resumen").textContent = item.tipo || "Licitación";
    id("titulo-resumen").textContent = item.titulo || "Licitación pública";
    id("institucion-resumen").textContent = item.institucion || "";
    id("monto-resumen").replaceChildren(importe(montoDe(item)));
    id("modalidad-resumen").textContent = item.modalidad || "Sin dato publicado";
    const ejemplos = item.ejemplos || [];
    const descripcion = item.descripcion || item.titulo || "Sin descripción publicada";
    const texto = id("descripcion-resumen");
    texto.textContent = descripcion;
    texto.hidden = ejemplos.length > 0 && descripcion === item.titulo;
    id("ejemplos-resumen").replaceChildren(...ejemplos.map(e => elemento("li","",e)));
    id("inicio-resumen").textContent = item.inicio || "Fecha por confirmar";
    id("cierre-resumen").textContent = item.cierre || "Fecha por confirmar";
    id("pedir-desde-resumen").href = urlCompleta(pagina, item.codigo);
    id("contenido-resumen").hidden = false;
  }

  async function cargarFicha(codigo, accion, signal) {
    ultimoCodigo = codigo;
    solicitud.hidden = true;
    id("explorar-informes").hidden = true;
    resumen.hidden = false;
    id("volver-resumen").href = urlCompleta(pagina);
    id("contenido-resumen").hidden = true;
    id("reintentar-resumen").hidden = true;
    id("codigo-resumen").textContent = codigo;
    id("tipo-resumen").textContent = id("institucion-resumen").textContent = "";
    id("titulo-resumen").textContent = "Consultando licitación…";
    try {
      const res = await fetch("/api/v1/expedientes/resumen?" + new URLSearchParams({codigo}),
        {credentials:"omit", cache:"no-store", signal});
      if (!res.ok) throw new Error(String(res.status));
      const datos = await res.json();
      if (signal.aborted) return;
      consentimiento = datos.consentimiento;
      if (accion === "solicitar") { abrirSolicitud(datos.item); return; }
      seleccion = datos.item;
      pintarResumen(datos.item);
    } catch (error) {
      if (signal.aborted) return;
      const ausente = error.message === "404";
      id("titulo-resumen").textContent = ausente ? "Esta licitación ya no está disponible" : "No pudimos cargar esta licitación";
      id("reintentar-resumen").hidden = ausente;
    }
    id("titulo-resumen").focus({preventScroll:true});
  }

  async function cargar(enfocar = false) {
    clearTimeout(reloj);
    cargando?.abort();
    const control = new AbortController();
    cargando = control;
    devolverAlListado();
    const direccion = new URLSearchParams(portada ? "" : location.search);
    const accion = direccion.has("solicitar") ? "solicitar" : "ver";
    const codigo = (direccion.get(accion) || "").slice(0,160);
    if (codigo) return cargarFicha(codigo, accion, control.signal);
    resultados = new Map();
    lista.replaceChildren();
    mas.hidden = id("paginacion").hidden = id("reintentar").hidden = id("limpiar-filtros").hidden = true;
    pintarOpciones();
    const q = consulta.value.trim();
    if (q && q.length < 3) {
      estado.textContent = "Escribe al menos tres caracteres o borra el texto y elige un tipo de compra.";
      id("limpiar-filtros").hidden = false;
      return;
    }
    if (enfocar) estado.focus({preventScroll:true});
    estado.textContent = "Buscando licitaciones…";
    const parametros = new URLSearchParams({q, etapa:historico.checked ? "todas" : "abierta", pagina:String(pagina), limite:String(limite)});
    if (tipo) parametros.set("tipo_compra",tipo);
    if (fase && fase.value !== "todas") parametros.set("fase",fase.value);
    try {
      const datos = await pedirLista(parametros,control.signal);
      if (control.signal.aborted) return;
      consentimiento = datos.consentimiento;
      const paginas = Math.max(1,Math.ceil(datos.total / limite));
      if (pagina > paginas) {
        pagina = paginas;
        historial(urlCompleta(pagina),true);
        return cargar();
      }
      pintarOpciones(datos.conteos_tipo_compra);
      const items = datos.items.map(item => ({...item,tipo:datos.tipo_compra_por_item?.[item.codigo] || ""}));
      resultados = new Map(items.map(item => [item.codigo,item]));
      lista.replaceChildren(...items.map(fila));
      estado.textContent = datos.total ? formato.format(datos.total) + (datos.total === 1 ? " licitación" : " licitaciones") +
        (tipo ? " de " + tipo.toLowerCase() : "") : "Sin coincidencias. Prueba otra palabra o cambia los filtros.";
      id("limpiar-filtros").hidden = Boolean(datos.total);
      if (portada && datos.total > limite) {
        const enlace = mas.querySelector("a");
        enlace.href = urlCompleta();
        enlace.textContent = "Ver las " + formato.format(datos.total) + " licitaciones →";
        mas.hidden = false;
      } else if (!portada && paginas > 1) {
        id("paginacion").hidden = false;
        id("anterior").disabled = pagina === 1;
        id("siguiente").disabled = pagina === paginas;
        id("pagina").textContent = "Página " + formato.format(pagina) + " de " + formato.format(paginas);
      }
      if (devolverFoco) {
        const anterior = Array.from(lista.querySelectorAll("[data-codigo]")).find(link => link.dataset.codigo === ultimoCodigo);
        (anterior || consulta).focus({preventScroll:true});
      }
      devolverFoco = false;
    } catch {
      if (control.signal.aborted) return;
      estado.textContent = "No pudimos cargar el catálogo. Vuelve a intentarlo.";
      id("reintentar").hidden = false;
    }
  }

  function aplicar(numero = 1, reemplazar = false, enfocar = false) {
    pagina = numero;
    if (!portada) historial(urlCompleta(pagina),reemplazar);
    cargar(enfocar);
  }

  buscador.addEventListener("submit", evento => {
    evento.preventDefault();
    if (evento.submitter?.name === "tipo_compra") {
      tipo = tipo === evento.submitter.value ? "" : evento.submitter.value;
      aplicar();
    } else if (portada) {
      location.assign(urlCompleta());
    } else {
      aplicar(1,false,true);
    }
  });
  consulta.addEventListener("input", () => {
    clearTimeout(reloj);
    cargando?.abort();
    id("borrar-consulta").hidden = !consulta.value;
    lista.replaceChildren();
    estado.textContent = "Buscando licitaciones…";
    mas.hidden = id("paginacion").hidden = id("reintentar").hidden = id("limpiar-filtros").hidden = true;
    pintarOpciones();
    reloj = setTimeout(() => aplicar(1,true),350);
  });
  id("borrar-consulta").addEventListener("click", () => { consulta.value = ""; aplicar(); consulta.focus(); });
  id("limpiar-filtros").addEventListener("click", () => {
    consulta.value = ""; tipo = ""; historico.checked = false; if (fase) fase.value = "todas"; aplicar(); consulta.focus();
  });
  historico.addEventListener("change", () => {
    if (!historico.checked && fase && fase.value !== "abierta") fase.value = "todas";
    aplicar();
  });
  fase?.addEventListener("change", () => {
    if (!["todas","abierta"].includes(fase.value)) historico.checked = true;
    aplicar();
  });
  id("anterior").addEventListener("click", () => aplicar(pagina-1,false,true));
  id("siguiente").addEventListener("click", () => aplicar(pagina+1,false,true));
  id("reintentar").addEventListener("click", () => cargar());
  id("reintentar-resumen")?.addEventListener("click", () => cargar());
  window.addEventListener("pageshow", e => { if (e.persisted && !seleccion) cargar(); });
  if (!portada) {
    lista.addEventListener("click", evento => {
      const enlace = evento.target.closest("a[data-codigo]");
      if (!enlace || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey || evento.button !== 0) return;
      evento.preventDefault();
      historial(enlace.href.slice(location.origin.length),false,true);
      abrirSolicitud(resultados.get(enlace.dataset.codigo));
    });
    window.addEventListener("popstate", () => {
      devolverFoco = Boolean(seleccion);
      leerUrl();
      cargar();
    });
    id("cerrar").addEventListener("click", () => {
      if (history.state?.desdeFila) history.back();
      else {
        devolverFoco = true;
        historial(urlCompleta(pagina),true);
        cargar();
      }
    });
    envio.addEventListener("submit", async evento => {
      evento.preventDefault();
      if (!seleccion || pendiente || !envio.reportValidity()) return;
      const item = seleccion;
      const correo = id("correo").value.trim();
      pendiente = item;
      id("enviar").disabled = id("cerrar").disabled = true;
      delete entrega.dataset.error;
      entrega.textContent = "Preparando tu PDF y enviándolo por correo…";
      try {
        const res = await fetch("/api/v1/expedientes/solicitar-informe", {method:"POST", credentials:"omit",
          headers:{"Content-Type":"application/json"}, body:JSON.stringify({codigo:item.codigo, correo,
            acepta_publicidad:id("acepta").checked, version_consentimiento:consentimiento.version})});
        const datos = await res.json();
        if (!res.ok || datos.estado !== "enviado") throw new Error(mensajes[datos.error || datos.detail] || "");
        if (seleccion !== item) return;
        envio.reset();
        envio.hidden = true;
        id("titulo-solicitud").textContent = "Informe enviado";
        entrega.textContent = "Enviamos el PDF a " + correo + ". Si no aparece en tu bandeja de entrada, revisa el correo no deseado.";
        id("titulo-solicitud").focus();
      } catch (error) {
        if (seleccion !== item) return;
        entrega.dataset.error = "";
        entrega.textContent = Object.values(mensajes).includes(error.message) ? error.message : "No pudimos confirmar el envío. Revisa tu correo antes de intentarlo de nuevo.";
        if (error.message === mensajes.correo_no_disponible) {
          const enlace = elemento("a","","Descargar desde mi cuenta Gratis");
          enlace.href = "/app/#/licitacion/" + encodeURIComponent(item.codigo);
          entrega.append(document.createElement("br"),enlace);
        }
      } finally {
        pendiente = null;
        id("enviar").disabled = id("cerrar").disabled = false;
      }
    });
  }
  leerUrl();
  cargar();
})();
