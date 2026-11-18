/* Atribución propia de Facebook. La pestaña conserva solo un código temporal. */
(() => {
  "use strict";
  if (window.publicolaVisitaFacebook || window.top !== window.self) return;

  const clave = "publicola.captacion.facebook";
  const vigencia = 24 * 60 * 60 * 1000;
  const esVigente = (visita) => visita && /^[0-9a-f]{32}$/.test(visita.codigo) && visita.vence > Date.now();

  function vieneDeFacebook() {
    const fuente = new URLSearchParams(location.search).get("utm_source");
    if (fuente && fuente.trim().toLowerCase() === "facebook") return true;
    try {
      const dominio = new URL(document.referrer).hostname;
      return dominio === "facebook.com" || dominio.endsWith(".facebook.com") || dominio === "fb.me";
    } catch {
      return false;
    }
  }

  function guardar(visita) {
    try {
      sessionStorage.setItem(clave, JSON.stringify(visita));
    } catch {
      // La visita puede contarse en esta página con el código en memoria.
    }
  }

  let visita;
  try {
    visita = JSON.parse(sessionStorage.getItem(clave));
    if (!esVigente(visita)) sessionStorage.removeItem(clave);
  } catch {
    visita = null;
  }
  if (!esVigente(visita)) {
    if (!vieneDeFacebook()) return;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const codigo = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    visita = { codigo, vence: Date.now() + vigencia, contada: false };
    guardar(visita);
  }

  async function enviarVisita() {
    const control = new AbortController();
    const limite = setTimeout(() => control.abort(), 1500);
    try {
      const respuesta = await fetch("/api/v1/captacion/facebook/visitas", {
        method: "POST",
        mode: "same-origin",
        credentials: "omit",
        referrerPolicy: "origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: visita.codigo }),
        keepalive: true,
        signal: control.signal,
      });
      if (respuesta.status !== 204) return false;
      visita.contada = true;
      guardar(visita);
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
    if (!envioPendiente) {
      envioPendiente = enviarVisita().finally(() => { envioPendiente = null; });
    }
    return envioPendiente;
  }

  window.publicolaVisitaFacebook = async () => {
    if (esVigente(visita) && await registrar()) return visita.codigo;
    return undefined;
  };
  registrar();
})();
