/* sitio.js -- comportamiento del sitio publico de Publicola (rediseño del 4 de octubre de 2026).
   Mejora progresiva: sin JavaScript todo el contenido se ve y los carruseles se recorren deslizando.
   Nada de esto guarda datos del visitante ni usa cookies, analitica o almacenamiento del navegador. */
(function () {
  "use strict";

  // ---------------- Configuracion ----------------
  const RUTA_EMPRESAS = "/empresas_disponibles.json";   // fuente unica de nombres disponibles (CLAUDE.md)
  const INTERVALO_VENTANA_MS = 5200;                    // capturas del producto en la portada
  const INTERVALO_CARRUSEL_MS = 6500;                   // carruseles con avance automatico
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function registrar(mensaje, error) {
    // Un fallo de una pieza se anota en la consola y el resto de la pagina sigue funcionando.
    if (window.console) console.warn("[publicola] " + mensaje, error || "");
  }

  // ---------------- Cabecera: sombra al bajar y menu en celular ----------------
  try {
    const cabecera = document.querySelector(".cabecera");
    const boton = document.querySelector(".menu-boton");
    const nav = document.querySelector(".nav");
    if (cabecera) {
      const sombra = () => cabecera.classList.toggle("con-sombra", window.scrollY > 8);
      sombra();
      window.addEventListener("scroll", sombra, { passive: true });
    }
    if (boton && nav) {
      boton.addEventListener("click", () => {
        const abierta = nav.classList.toggle("abierta");
        boton.setAttribute("aria-expanded", abierta ? "true" : "false");
      });
      nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
        nav.classList.remove("abierta");
        boton.setAttribute("aria-expanded", "false");
      }));
    }
  } catch (e) { registrar("cabecera", e); }

  // ---------------- Revelado al desplazarse ----------------
  try {
    const elementos = document.querySelectorAll("[data-revelar], .recorrido");
    if (!sinMovimiento && "IntersectionObserver" in window && elementos.length) {
      document.documentElement.classList.add("revelado-listo");
      const observador = new IntersectionObserver((entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add("es-visible");
            observador.unobserve(entrada.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      elementos.forEach((el) => observador.observe(el));
    } else {
      elementos.forEach((el) => el.classList.add("es-visible"));
    }
  } catch (e) { registrar("revelado", e); }

  // ---------------- Ventana de producto (capturas que se relevan) ----------------
  try {
    document.querySelectorAll("[data-ventana]").forEach((ventana) => {
      const escenas = Array.from(ventana.querySelectorAll(".ventana-escena figure"));
      const titulo = ventana.querySelector("[data-ventana-titulo]");
      const pasos = ventana.querySelector(".ventana-pie .pasos");
      if (!escenas.length || !pasos) return;
      let actual = 0;
      let reloj = null;
      ventana.style.setProperty("--duracion", INTERVALO_VENTANA_MS + "ms");
      const botones = escenas.map((escena, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Ver: " + (escena.dataset.titulo || "pantalla " + (i + 1)));
        b.addEventListener("click", () => { mostrar(i); reiniciar(); });
        pasos.appendChild(b);
        return b;
      });
      function mostrar(i) {
        actual = (i + escenas.length) % escenas.length;
        escenas.forEach((e, j) => e.classList.toggle("activa", j === actual));
        botones.forEach((b, j) => {
          b.classList.remove("activa");
          if (j === actual) { void b.offsetWidth; b.classList.add("activa"); }
        });
        if (titulo) titulo.textContent = escenas[actual].dataset.titulo || "";
      }
      function reiniciar() {
        if (sinMovimiento) return;
        clearInterval(reloj);
        reloj = setInterval(() => mostrar(actual + 1), INTERVALO_VENTANA_MS);
      }
      mostrar(0);
      reiniciar();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) clearInterval(reloj); else reiniciar();
      });
    });
  } catch (e) { registrar("ventana de producto", e); }

  // ---------------- Carruseles ----------------
  function prepararCarrusel(carrusel) {
    const pista = carrusel.querySelector(".carrusel-pista");
    const puntos = carrusel.querySelector(".carrusel-puntos");
    const anterior = carrusel.querySelector("[data-anterior]");
    const siguiente = carrusel.querySelector("[data-siguiente]");
    if (!pista) return;
    const intervalo = Number(carrusel.dataset.intervalo || INTERVALO_CARRUSEL_MS);
    const automatico = carrusel.hasAttribute("data-automatico") && !sinMovimiento;
    carrusel.style.setProperty("--duracion", intervalo + "ms");
    if (!automatico) carrusel.classList.add("sin-auto");
    let reloj = null;
    let enPausa = false;
    let visible = true;

    const diapositivas = () => Array.from(pista.children).filter((d) => !d.hidden);
    function indiceActual() {
      const lista = diapositivas();
      const borde = pista.getBoundingClientRect().left;
      let mejor = 0, distancia = Infinity;
      lista.forEach((d, i) => {
        const dist = Math.abs(d.getBoundingClientRect().left - borde);
        if (dist < distancia) { distancia = dist; mejor = i; }
      });
      return mejor;
    }
    function ir(i) {
      const lista = diapositivas();
      if (!lista.length) return;
      const destino = lista[(i + lista.length) % lista.length];
      pista.scrollTo({ left: destino.offsetLeft - pista.offsetLeft, behavior: sinMovimiento ? "auto" : "smooth" });
    }
    function pintarPuntos() {
      if (!puntos) return;
      const lista = diapositivas();
      puntos.innerHTML = "";
      lista.forEach((d, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Ir a " + (d.dataset.nombre || "la diapositiva " + (i + 1)));
        b.addEventListener("click", () => { ir(i); reiniciar(); });
        puntos.appendChild(b);
      });
      marcar();
    }
    function marcar() {
      const i = indiceActual();
      const lista = diapositivas();
      lista.forEach((d, j) => d.classList.toggle("activa", j === i));
      if (!puntos) return;
      Array.from(puntos.children).forEach((b, j) => {
        if (j === i && b.getAttribute("aria-current") !== "true") {
          b.removeAttribute("aria-current"); void b.offsetWidth; b.setAttribute("aria-current", "true");
        } else if (j !== i) {
          b.removeAttribute("aria-current");
        }
      });
    }
    function cabeTodo() {
      // Si no hay nada que desplazar, no tiene sentido avanzar solo ni mostrar flechas.
      const cabe = pista.scrollWidth <= pista.clientWidth + 4;
      carrusel.classList.toggle("cabe-todo", cabe);
      return cabe;
    }
    function reiniciar() {
      clearInterval(reloj);
      if (!automatico || enPausa || !visible || cabeTodo()) return;
      reloj = setInterval(() => {
        const lista = diapositivas();
        const i = indiceActual();
        ir(i + 1 >= lista.length ? 0 : i + 1);
      }, intervalo);
    }
    function pausar(valor) {
      enPausa = valor;
      carrusel.classList.toggle("en-pausa", valor);
      reiniciar();
    }

    let espera = null;
    pista.addEventListener("scroll", () => { clearTimeout(espera); espera = setTimeout(marcar, 90); }, { passive: true });
    if (anterior) anterior.addEventListener("click", () => { ir(indiceActual() - 1); reiniciar(); });
    if (siguiente) siguiente.addEventListener("click", () => { ir(indiceActual() + 1); reiniciar(); });
    carrusel.addEventListener("mouseenter", () => pausar(true));
    carrusel.addEventListener("mouseleave", () => pausar(false));
    carrusel.addEventListener("focusin", () => pausar(true));
    carrusel.addEventListener("focusout", () => pausar(false));
    pista.addEventListener("touchstart", () => pausar(true), { passive: true });
    pista.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight") { ev.preventDefault(); ir(indiceActual() + 1); }
      if (ev.key === "ArrowLeft") { ev.preventDefault(); ir(indiceActual() - 1); }
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; reiniciar(); }, { threshold: 0.25 }).observe(carrusel);
    }
    document.addEventListener("visibilitychange", () => { visible = !document.hidden; reiniciar(); });
    carrusel.addEventListener("carrusel:filtrado", () => { pista.scrollTo({ left: 0 }); pintarPuntos(); reiniciar(); });
    window.addEventListener("resize", () => { clearTimeout(espera); espera = setTimeout(reiniciar, 200); });
    pintarPuntos();
    reiniciar();
  }
  try { document.querySelectorAll("[data-carrusel]").forEach(prepararCarrusel); } catch (e) { registrar("carruseles", e); }

  // ---------------- Filtros de servicios ----------------
  try {
    const filtros = document.querySelector("[data-filtros]");
    const carrusel = document.querySelector("[data-carrusel-servicios]");
    if (filtros && carrusel) {
      filtros.addEventListener("click", (ev) => {
        const boton = ev.target.closest("button[data-familia]");
        if (!boton) return;
        const familia = boton.dataset.familia;
        filtros.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === boton ? "true" : "false"));
        carrusel.querySelectorAll(".servicio").forEach((s) => {
          s.hidden = familia !== "todas" && s.dataset.familia !== familia;
        });
        carrusel.dispatchEvent(new Event("carrusel:filtrado"));
      });
    }
  } catch (e) { registrar("filtros de servicios", e); }

  // ---------------- Nombres de empresas disponibles ----------------
  try {
    const lista = document.querySelector("[data-nombres-empresas]");
    if (lista && window.fetch) {
      fetch(RUTA_EMPRESAS, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
        .then((datos) => {
          const nombres = Array.isArray(datos.empresas) ? datos.empresas.filter((n) => typeof n === "string" && n.trim()) : [];
          if (!nombres.length) return;
          lista.innerHTML = "";
          nombres.forEach((nombre, i) => {
            const li = document.createElement("li");
            li.textContent = nombre;
            li.style.animationDelay = (i * 0.09) + "s";
            lista.appendChild(li);
          });
          const bloque = lista.closest("[data-bloque-nombres]");
          if (bloque) bloque.hidden = false;
        })
        .catch((e) => registrar("empresas disponibles", e));
    }
  } catch (e) { registrar("empresas disponibles", e); }

  // ---------------- Indice de la privacidad: seccion activa ----------------
  try {
    const enlaces = Array.from(document.querySelectorAll(".indice a[href^='#']"));
    if (enlaces.length && "IntersectionObserver" in window) {
      const porId = new Map(enlaces.map((a) => [a.getAttribute("href").slice(1), a]));
      const observador = new IntersectionObserver((entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            enlaces.forEach((a) => a.classList.remove("activo"));
            const a = porId.get(entrada.target.id);
            if (a) a.classList.add("activo");
          }
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      porId.forEach((_, id) => { const s = document.getElementById(id); if (s) observador.observe(s); });
    }
  } catch (e) { registrar("indice", e); }
}());
