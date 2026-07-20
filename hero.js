/*
 * hero.js — comportamiento del hero de video en la portada de PUBLICOLA.
 *
 * Hace dos cosas, sin librerias externas, sin analitica y sin cookies
 * (Ley 172-13):
 *   1) Rota el texto de la frase debajo del eslogan, en un ciclo de 6
 *      pasos que hace IMPOSIBLE que se vean dos frases a la vez (ver
 *      "iniciarFraseRotativa" mas abajo para el detalle de cada paso).
 *   2) Respeta prefers-reduced-motion: si el visitante lo tiene activo,
 *      pausa el video (se queda solo el poster) y deja la frase fija en
 *      la primera, sin rotar.
 *
 * Si algo falla, se registra en la consola y el resto de la pagina
 * sigue funcionando con normalidad (el hero ya tiene su texto inicial
 * escrito directo en el HTML).
 */

(function () {
  "use strict";

  var FRASES_ROTATIVAS = [
    "En Publicola convertimos las compras públicas dominicanas en oportunidades claras para tu empresa.",
    "Vigilamos los procesos, te explicamos qué exigen y te acompañamos en cada paso.",
    "Cada semana, las licitaciones de tu rubro con sus plazos en días hábiles."
  ];

  var MILISEGUNDOS_VISIBLE = 5000;
  var MILISEGUNDOS_TRANSICION = 500;
  var MILISEGUNDOS_PAUSA_EN_BLANCO = 500;
  // Margen de seguridad sobre la duracion real declarada en estilo.css
  // (ver mas abajo, "alTerminarTransicionDeOpacidad"): sirve solo de
  // respaldo por si el evento "transitionend" no llegara a disparar.
  var MARGEN_SEGURIDAD_TRANSICION = 200;

  function prefiereMovimientoReducido() {
    return Boolean(
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function aplicarPreferenciaDeVideo() {
    var video = document.getElementById("hero-video");
    if (!video) {
      return;
    }
    if (prefiereMovimientoReducido()) {
      // No reproducir nada: se queda solo la imagen de respaldo (poster).
      video.pause();
      video.removeAttribute("autoplay");
    }
  }

  /*
   * Espera a que termine de verdad la transicion de "opacity" del
   * elemento (evento "transitionend"), en vez de asumir que un
   * setTimeout con la misma duracion que el CSS va a coincidir por
   * casualidad. Ademas, por si ese evento no llegara a disparar en
   * algun caso raro (el sistema nunca debe quedarse trabado), hay un
   * temporizador de respaldo con margen de sobra: se ejecuta la
   * funcion UNA sola vez, gane quien gane.
   */
  function alTerminarTransicionDeOpacidad(elemento, callback) {
    var yaEjecutado = false;

    function ejecutarUnaVez() {
      if (yaEjecutado) {
        return;
      }
      yaEjecutado = true;
      elemento.removeEventListener("transitionend", manejarEvento);
      clearTimeout(temporizadorDeRespaldo);
      callback();
    }

    function manejarEvento(evento) {
      if (evento.target === elemento && evento.propertyName === "opacity") {
        ejecutarUnaVez();
      }
    }

    elemento.addEventListener("transitionend", manejarEvento);
    var temporizadorDeRespaldo = setTimeout(
      ejecutarUnaVez,
      MILISEGUNDOS_TRANSICION + MARGEN_SEGURIDAD_TRANSICION
    );
  }

  /*
   * Rota el texto de "#hero-frase" en un ciclo de 6 pasos, con UN SOLO
   * elemento de texto en el DOM en todo momento (nunca hay una frase
   * "saliendo" y otra "entrando" superpuestas):
   *
   *   1. La frase actual queda quieta y visible 5 segundos completos.
   *   2. Se desvanece a opacidad 0 en 0.5s (junto con "visibility",
   *      que por como el navegador anima esa propiedad, recien pasa a
   *      "hidden" en el instante exacto en que la opacidad llega a 0 --
   *      nunca antes).
   *   3. Pausa en blanco obligatoria de 0.5s, con el elemento en
   *      opacity:0 + visibility:hidden -- no se toca nada en este paso.
   *   4. Recien ahi, con el texto totalmente invisible, se cambia el
   *      contenido por la frase siguiente.
   *   5. Se desvanece de vuelta a opacidad 1 en 0.5s (y "visibility"
   *      vuelve a "visible" de inmediato, al arrancar este paso, para
   *      que la frase nueva sea interactuable/legible desde el inicio
   *      del desvanecido).
   *   6. Vuelve al paso 1.
   */
  function iniciarFraseRotativa() {
    var elementoFrase = document.getElementById("hero-frase");
    if (!elementoFrase || FRASES_ROTATIVAS.length === 0) {
      return;
    }

    // Con movimiento reducido, la frase se queda fija en la primera.
    if (prefiereMovimientoReducido()) {
      return;
    }

    var indiceActual = 0;

    function paso1_visible() {
      setTimeout(paso2_desvanecer, MILISEGUNDOS_VISIBLE);
    }

    function paso2_desvanecer() {
      elementoFrase.style.opacity = "0";
      elementoFrase.style.visibility = "hidden";
      alTerminarTransicionDeOpacidad(elementoFrase, paso3_pausaEnBlanco);
    }

    function paso3_pausaEnBlanco() {
      // Medio segundo mas, completamente invisible. Este respiro es
      // obligatorio: no se cambia nada del elemento durante esta espera.
      setTimeout(paso4_cambiarTexto, MILISEGUNDOS_PAUSA_EN_BLANCO);
    }

    function paso4_cambiarTexto() {
      indiceActual = (indiceActual + 1) % FRASES_ROTATIVAS.length;
      elementoFrase.textContent = FRASES_ROTATIVAS[indiceActual];
      paso5_aparecer();
    }

    function paso5_aparecer() {
      // Fuerza al navegador a "confirmar" el opacity:0 actual antes de
      // cambiarlo: sin este reflow, un cambio de opacity de 0 a 1 hecho
      // en el mismo tick que el cambio de texto podria no disparar la
      // transicion en algunos navegadores (y la frase aparecería de
      // golpe, sin desvanecido).
      void elementoFrase.offsetWidth;
      elementoFrase.style.visibility = "visible";
      elementoFrase.style.opacity = "1";
      alTerminarTransicionDeOpacidad(elementoFrase, paso1_visible);
    }

    // Arranque: la primera frase ya esta escrita en el HTML con
    // opacity:1 desde el principio, asi que el ciclo empieza
    // directamente en el paso 1 (quieta 5 segundos), sin desvanecerla
    // de entrada.
    paso1_visible();
  }

  try {
    aplicarPreferenciaDeVideo();
    iniciarFraseRotativa();
  } catch (error) {
    console.error("hero.js: no se pudo iniciar el comportamiento del hero.", error);
  }
})();
