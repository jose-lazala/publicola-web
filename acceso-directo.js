/* Acceso directo a Mi PUBLICOLA (Owner, 10-oct-2026).

   «Si yo me quedé dentro de la sesión y vuelvo a entrar a publicola.com.do, tengo que entrar directamente a
   mi Publicola, a menos que yo cierre la sesión.» Quien tiene la sesión abierta no tiene nada que hacer en la
   portada pública: se le lleva a su cuenta. Quien no la tiene (o la cerró) ve la web pública, sin cambio.

   Cómo funciona, sin tocar nada de la persona:
     1. Pregunta al servidor, con la cookie de la propia persona, si la sesión sigue abierta
        (`/api/v1/mi-publicola/contexto`: 200 = abierta, 401 = no). No envía ni guarda ningún dato.
     2. Si está abierta, abre /app/ (con `replace`, para que «Atrás» no regrese a la portada).
     3. Si no, o si algo falla, o si tarda, se queda en la portada: nunca deja la página en blanco.

   Para ver la portada pública con la sesión abierta basta añadir «?publico» a la dirección.

   La clase `comprobando-sesion` oculta la portada SOLO a quien ya se sabe que tenía sesión (una marca en
   este navegador, sin datos personales), para que no vea un parpadeo antes de pasar a su cuenta. */
(function () {
  "use strict";
  var MARCA = "publicola_con_sesion";
  var DESTINO = "/app/";
  var RUTA_SESION = "/api/v1/mi-publicola/contexto";
  var ESPERA_MAXIMA_MS = 1500;

  var raiz = document.documentElement;

  function mostrarPortada() {
    raiz.classList.remove("comprobando-sesion");
  }

  function guardarMarca(valor) {
    try {
      if (valor) { window.localStorage.setItem(MARCA, "1"); }
      else { window.localStorage.removeItem(MARCA); }
    } catch (error) { /* sin almacenamiento no pasa nada: sólo habrá un parpadeo */ }
  }

  try {
    if (new URLSearchParams(window.location.search).has("publico")) { return; }
  } catch (error) { /* navegador antiguo: se comprueba igual */ }

  var teniaSesion = false;
  try { teniaSesion = window.localStorage.getItem(MARCA) === "1"; } catch (error) { /* ignorar */ }
  if (teniaSesion) { raiz.classList.add("comprobando-sesion"); }

  // Pase lo que pase, la portada se muestra pasado este tiempo.
  var temporizador = window.setTimeout(mostrarPortada, ESPERA_MAXIMA_MS);

  if (typeof window.fetch !== "function") { mostrarPortada(); return; }

  window.fetch(RUTA_SESION, {
    credentials: "same-origin",
    headers: { "Accept": "application/json" },
    cache: "no-store"
  }).then(function (respuesta) {
    window.clearTimeout(temporizador);
    if (respuesta.ok) {
      guardarMarca(true);
      window.location.replace(DESTINO);
      return;
    }
    guardarMarca(false);
    mostrarPortada();
  }).catch(function () {
    window.clearTimeout(temporizador);
    mostrarPortada();
  });
})();
