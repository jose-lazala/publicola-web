(function () {
  "use strict";
  // Capacidades "Lo que viene": recorrido vertical, un capitulo por
  // capacidad. Este script solo agrega una aparicion discreta (fundido +
  // desplazamiento corto) cuando cada capitulo entra en pantalla.
  //
  // Mejora progresiva: la clase que oculta los capitulos antes de aparecer
  // (.revelado-listo) la agrega este mismo script. Sin JS, sin
  // IntersectionObserver o con prefers-reduced-motion, los capitulos se ven
  // completos desde el inicio y no hay ninguna animacion.
  const contenedor = document.querySelector("[data-capitulos]");
  if (!contenedor) return;
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const capitulos = Array.from(contenedor.querySelectorAll("[data-capitulo]"));
  if (capitulos.length === 0) return;

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("es-visible");
          // Aparece una sola vez: no se vuelve a ocultar al subir.
          observador.unobserve(entrada.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  contenedor.classList.add("revelado-listo");
  capitulos.forEach((capitulo) => observador.observe(capitulo));
}());
