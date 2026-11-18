/* Medición propia de visitas de Facebook y de enlaces de campaña. */
(() => {
  "use strict";
  if (window.top !== window.self) return;

  const parametros = new URLSearchParams(location.search);
  const origen = (parametros.get("utm_source") || "").trim().toLowerCase();
  const vigencia = 24 * 60 * 60 * 1000;
  const esVigente = (visita) => visita && /^[0-9a-f]{32}$/.test(visita.codigo) && visita.vence > Date.now();

  function vieneDeFacebook() {
    if (origen === "facebook") return true;
    try {
      const dominio = new URL(document.referrer).hostname;
      return dominio === "facebook.com" || dominio.endsWith(".facebook.com") || dominio === "fb.me";
    } catch {
      return false;
    }
  }

  function registrarVisita(clave, ruta, origenActual, datosActuales = {}) {
    const identificador = JSON.stringify(datosActuales);
    let visita;
    try {
      visita = JSON.parse(sessionStorage.getItem(clave));
      if (!esVigente(visita)) sessionStorage.removeItem(clave);
    } catch {
      visita = null;
    }

    function guardar() {
      try {
        sessionStorage.setItem(clave, JSON.stringify(visita));
      } catch {
        // La visita de esta página conserva el código en memoria.
      }
    }

    if (!esVigente(visita) || (origenActual && visita.datos && JSON.stringify(visita.datos) !== identificador)) {
      if (!origenActual) return undefined;
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const codigo = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      visita = { codigo, vence: Date.now() + vigencia, contada: false, datos: datosActuales };
      guardar();
    }

    async function enviar() {
      const control = new AbortController();
      const limite = setTimeout(() => control.abort(), 1500);
      try {
        const respuesta = await fetch(ruta, {
          method: "POST",
          mode: "same-origin",
          credentials: "omit",
          referrerPolicy: "origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...visita.datos, codigo: visita.codigo }),
          keepalive: true,
          signal: control.signal,
        });
        if (respuesta.status !== 204) return false;
        visita.contada = true;
        guardar();
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(limite);
      }
    }

    let envioPendiente;
    function registrar() {
      if (visita.contada) return Promise.resolve(true);
      if (!envioPendiente) envioPendiente = enviar().finally(() => { envioPendiente = null; });
      return envioPendiente;
    }

    registrar();
    return async () => {
      if (esVigente(visita) && await registrar()) return visita.codigo;
      return undefined;
    };
  }

  if (!window.publicolaVisitaFacebook) {
    window.publicolaVisitaFacebook = registrarVisita(
      "publicola.captacion.facebook", "/api/v1/captacion/facebook/visitas", vieneDeFacebook(),
    );
  }
  const campana = parametros.get("utm_campaign");
  const pieza = parametros.get("utm_content");
  const enlaceDeCampana = campana === "equipos-informaticos-202611"
    && /^(instagram|facebook)$/.test(origen) && /^(imagen-01|reel-0[1-3])$/.test(pieza);
  if (!window.publicolaVisitaCampana) {
    window.publicolaVisitaCampana = registrarVisita(
      "publicola.captacion.campana", "/api/v1/captacion/campanas/visitas", enlaceDeCampana,
      { campana, canal: origen, pieza },
    );
  }
})();
