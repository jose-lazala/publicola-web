/* servicios.js -- pagina de Servicios (4 de octubre de 2026).
   1) Movimiento al bajar: cada elemento con [data-entra] entra UNA sola vez cuando llega a la pantalla;
      los hermanos entran en secuencia (retraso escalonado) y los iconos se dibujan. Nada se mueve despues.
   2) Carrusel de servicios manual (flechas, puntos, deslizar con el dedo o con el teclado). No avanza solo.
   Mejora progresiva: sin JavaScript, sin IntersectionObserver o con prefers-reduced-motion, todo se ve
   completo y quieto. No guarda datos del visitante ni usa cookies o analitica. */
(function () {
  "use strict";

  // ---------------- Configuracion ----------------
  const RETRASO_ENTRE_HERMANOS_S = 0.09;   // separacion entre tarjetas de una misma tanda
  const MAXIMO_RETRASO_S = 0.6;            // ninguna espera mas que esto
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.svListo = true;   // la red de seguridad de la cabecera ya no hace falta

  function registrar(mensaje, error) {
    if (window.console) console.warn("[publicola servicios] " + mensaje, error || "");
  }

  // ---------------- 1) Movimiento al bajar ----------------
  try {
    const elementos = Array.from(document.querySelectorAll("[data-entra]"));
    // Largo real de cada trazo de los iconos, para que se dibujen completos.
    document.querySelectorAll(".sv-icono svg *").forEach((trazo) => {
      try {
        if (typeof trazo.getTotalLength === "function") {
          trazo.style.setProperty("--largo", Math.ceil(trazo.getTotalLength() + 2));
        }
      } catch (e) { /* un trazo sin largo medible se queda con el valor por defecto */ }
    });
    if (sinMovimiento || !("IntersectionObserver" in window)) {
      // Sin movimiento: todo visible y quieto desde el inicio.
      document.documentElement.classList.remove("sv-movimiento");
    } else if (elementos.length) {
      // Retraso escalonado entre hermanos que entran juntos.
      const grupos = new Map();
      elementos.forEach((el) => {
        const padre = el.parentElement;
        const i = grupos.get(padre) || 0;
        grupos.set(padre, i + 1);
        el.style.setProperty("--retraso", Math.min(i * RETRASO_ENTRE_HERMANOS_S, MAXIMO_RETRASO_S) + "s");
      });
      const observador = new IntersectionObserver((entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add("dentro");
            observador.unobserve(entrada.target);   // una sola vez
          }
        });
      }, { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
      elementos.forEach((el) => observador.observe(el));
      // Las tarjetas que quedan fuera de la pista (a la derecha) entran cuando la pista entra.
      document.querySelectorAll(".sv-pista").forEach((pista) => {
        new IntersectionObserver((e, obs) => {
          if (e[0].isIntersecting) {
            pista.querySelectorAll("[data-entra]").forEach((t) => t.classList.add("dentro"));
            obs.disconnect();
          }
        }, { threshold: 0.2 }).observe(pista);
      });
    }
  } catch (e) {
    registrar("movimiento al bajar", e);
    document.documentElement.classList.remove("sv-movimiento");
  }

  // ---------------- 2) Carrusel manual ----------------
  try {
    document.querySelectorAll("[data-sv-carrusel]").forEach((carrusel) => {
      const pista = carrusel.querySelector(".sv-pista");
      const puntos = carrusel.querySelector(".sv-puntos");
      const anterior = carrusel.querySelector("[data-anterior]");
      const siguiente = carrusel.querySelector("[data-siguiente]");
      if (!pista) return;
      const tarjetas = Array.from(pista.children);

      function actual() {
        const borde = pista.getBoundingClientRect().left;
        let mejor = 0, distancia = Infinity;
        tarjetas.forEach((t, i) => {
          const d = Math.abs(t.getBoundingClientRect().left - borde);
          if (d < distancia) { distancia = d; mejor = i; }
        });
        return mejor;
      }
      function ir(i) {
        const destino = tarjetas[Math.max(0, Math.min(i, tarjetas.length - 1))];
        pista.scrollTo({ left: destino.offsetLeft - pista.offsetLeft, behavior: sinMovimiento ? "auto" : "smooth" });
      }
      function marcar() {
        const i = actual();
        const alFinal = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 4;
        if (puntos) Array.from(puntos.children).forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
        if (anterior) anterior.disabled = pista.scrollLeft <= 4;
        if (siguiente) siguiente.disabled = alFinal;
      }
      if (puntos) {
        tarjetas.forEach((t, i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.setAttribute("aria-label", "Ver " + (t.dataset.nombre || "servicio " + (i + 1)));
          b.addEventListener("click", () => ir(i));
          puntos.appendChild(b);
        });
      }
      if (anterior) anterior.addEventListener("click", () => ir(actual() - 1));
      if (siguiente) siguiente.addEventListener("click", () => ir(actual() + 1));
      pista.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowRight") { ev.preventDefault(); ir(actual() + 1); }
        if (ev.key === "ArrowLeft") { ev.preventDefault(); ir(actual() - 1); }
      });
      let espera = null;
      pista.addEventListener("scroll", () => { clearTimeout(espera); espera = setTimeout(marcar, 80); }, { passive: true });
      window.addEventListener("resize", marcar);
      marcar();
    });
  } catch (e) { registrar("carrusel", e); }
}());
