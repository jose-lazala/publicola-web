/*
 * hero.js — comportamiento del hero de video en la portada de PUBLICOLA.
 *
 * Hace dos cosas, sin librerias externas, sin analitica y sin cookies
 * (Ley 172-13):
 *   1) Rota el texto de la frase debajo del eslogan: cada frase queda
 *      visible 5 segundos completos, luego se desvanece a 0 en medio
 *      segundo, se cambia el texto, y se desvanece de vuelta a 1 en
 *      otro medio segundo.
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

    // Encadenamos un solo setTimeout tras otro (en vez de setInterval)
    // a proposito: con setInterval, si el hilo principal se demora un
    // instante (por ejemplo por el video de fondo), se pueden acumular
    // varios "ticks" pendientes que despues disparan casi al mismo
    // tiempo, y sus respectivos setTimeout internos terminan pisandose
    // -- eso es lo que causaba que se vieran dos frases superpuestas.
    // Con la cadena de abajo solo hay UN temporizador activo a la vez:
    // el siguiente paso no se programa hasta que el anterior ya
    // termino, asi que nunca puede haber dos transiciones a la vez.
    function programarSiguienteCiclo() {
      setTimeout(function () {
        // Paso 1: la frase actual, que ya estuvo visible el tiempo
        // completo, se desvanece a 0.
        elementoFrase.style.opacity = "0";

        setTimeout(function () {
          // Paso 2: con la frase ya invisible (opacidad en 0), recien
          // ahi se cambia el texto y se desvanece de vuelta a 1.
          indiceActual = (indiceActual + 1) % FRASES_ROTATIVAS.length;
          elementoFrase.textContent = FRASES_ROTATIVAS[indiceActual];
          elementoFrase.style.opacity = "1";

          programarSiguienteCiclo();
        }, MILISEGUNDOS_TRANSICION);
      }, MILISEGUNDOS_VISIBLE);
    }

    programarSiguienteCiclo();
  }

  try {
    aplicarPreferenciaDeVideo();
    iniciarFraseRotativa();
  } catch (error) {
    console.error("hero.js: no se pudo iniciar el comportamiento del hero.", error);
  }
})();
