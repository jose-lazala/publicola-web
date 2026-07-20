/*
 * hero.js — comportamiento del hero de video en la portada de PUBLICOLA.
 *
 * Hace dos cosas, sin librerias externas, sin analitica y sin cookies
 * (Ley 172-13):
 *   1) Rota cada 5 segundos la frase debajo del eslogan, con un cambio
 *      de opacidad suave (la transicion de 0.6s vive en estilo.css).
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

  var MILISEGUNDOS_ENTRE_FRASES = 5000;
  var MILISEGUNDOS_TRANSICION = 600;

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
    setInterval(function () {
      elementoFrase.style.opacity = "0";
      setTimeout(function () {
        indiceActual = (indiceActual + 1) % FRASES_ROTATIVAS.length;
        elementoFrase.textContent = FRASES_ROTATIVAS[indiceActual];
        elementoFrase.style.opacity = "1";
      }, MILISEGUNDOS_TRANSICION);
    }, MILISEGUNDOS_ENTRE_FRASES);
  }

  try {
    aplicarPreferenciaDeVideo();
    iniciarFraseRotativa();
  } catch (error) {
    console.error("hero.js: no se pudo iniciar el comportamiento del hero.", error);
  }
})();
