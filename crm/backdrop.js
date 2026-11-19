// The venue at night behind the panel, under a dark veil a torch opens where the mouse goes (as on the site: the brand's
// own look). At the sign-in the light is wide and the venue shows; inside the panel it is faint, so the work stays easy
// to read. No torch on a touch screen or when the visitor asked for less motion: the light then rests on the sign.
(() => {
  const back = document.querySelector('.backdrop');
  if (!back) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches;
  if (still) return;
  let x = 0;
  let y = 0;
  let queued = false;
  const paint = () => {
    queued = false;
    back.style.setProperty('--tx', `${x}px`);
    back.style.setProperty('--ty', `${y}px`);
  };
  addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  // Off the window, the light goes back to the sign.
  document.documentElement.addEventListener('pointerleave', () => {
    back.style.removeProperty('--tx');
    back.style.removeProperty('--ty');
  });
})();
