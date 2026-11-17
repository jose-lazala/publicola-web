(() => {
  const corte = document.querySelector("[data-rubro-corte]");
  const filas = Array.from(document.querySelectorAll("[data-rubro-cierre]"));
  const aviso = document.querySelector(".rubro-vacio");
  const dosDias = 48 * 60 * 60 * 1000;

  function revisarVigencia() {
    const ahora = Date.now();
    const fechaCorte = Date.parse(corte?.getAttribute("datetime"));
    const consultaVencida = !Number.isFinite(fechaCorte) || ahora > fechaCorte + dosDias;
    for (const fila of filas) {
      const cierre = Date.parse(fila.dataset.rubroCierre);
      fila.hidden = consultaVencida || !Number.isFinite(cierre) || cierre <= ahora;
    }
    if (aviso) aviso.hidden = filas.length === 0 || filas.some(fila => !fila.hidden);
  }

  revisarVigencia();
  window.addEventListener("pageshow", revisarVigencia);
  window.setInterval(revisarVigencia, 60_000);
})();
