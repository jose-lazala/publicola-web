(() => {
  const marco = document.querySelector("iframe[data-analisis-pendiente]");
  if (!marco) return;

  function mostrarAnalisis() {
    const documento = marco.contentDocument;
    if (documento?.readyState === "complete" && documento.querySelector("main.mc")) {
      marco.removeAttribute("data-analisis-pendiente");
    }
  }

  marco.addEventListener("load", mostrarAnalisis);
  mostrarAnalisis();
})();
