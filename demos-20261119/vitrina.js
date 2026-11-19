(() => {
  'use strict';

  const videos = document.querySelectorAll('video[data-demo-vitrina]');
  if (!videos.length || !('IntersectionObserver' in window)) return;

  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const parteVisible = 0.45;

  const observador = new IntersectionObserver((entradas) => {
    if (movimientoReducido.matches) return;

    for (const { target: video, isIntersecting, intersectionRatio } of entradas) {
      if (document.fullscreenElement === video || video.webkitDisplayingFullscreen) continue;

      if (isIntersecting && intersectionRatio >= parteVisible) {
        if (video.paused && !video.ended) {
          video.play().catch(() => {});
        }
      } else if (!video.paused) {
        video.pause();
      }
    }
  }, { threshold: parteVisible });

  videos.forEach(video => observador.observe(video));
})();
