(function () {
  "use strict";
  const salida = document.querySelector("[data-frescura]");
  if (!salida) return;
  fetch("procesos_semana.json", { cache: "no-store" })
    .then((respuesta) => { if (!respuesta.ok) throw new Error("sin_fecha"); return respuesta.json(); })
    .then((datos) => {
      if (!datos.generado) throw new Error("sin_fecha");
      const fecha = new Date(datos.generado);
      if (Number.isNaN(fecha.getTime())) throw new Error("fecha_invalida");
      const formato = new Intl.DateTimeFormat("es-DO", { dateStyle: "long", timeStyle: "short" })
        .format(fecha).replace(/\.+$/, "");
      salida.textContent = "Fuente: DGCP/SECP · corte del conjunto público: " + formato + ".";
    })
    .catch(() => { salida.textContent = "Fuente: DGCP/SECP · fecha de corte no disponible en este momento."; });
}());
