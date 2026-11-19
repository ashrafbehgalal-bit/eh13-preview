// The torch: the scene behind the page waits in the dark, and the visitor's mouse or held finger lights it anywhere on
// the page. On the first screen a finger can also sweep the light sideways without scrolling.
// It is an extra. Without this script, or under reduced motion, the scene simply rests half veiled.
(() => {
  const stage = document.querySelector('.hero__frames');
  const toggle = stage && stage.querySelector('[data-torch-toggle]');
  if (!toggle || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('torch');

  const touchScreen = matchMedia('(hover: none)');
  const lift = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--torch-lift-touch')) || 72;

  // The scene fills the screen and stays put, so the light goes to the pointer's place on the screen. A finger's light
  // stands a little above the fingertip, so the finger does not cover it.
  const aim = (e) => {
    stage.style.setProperty('--torch-x', `${e.clientX}px`);
    stage.style.setProperty('--torch-y', `${e.pointerType === 'mouse' ? e.clientY : Math.max(0, e.clientY - lift)}px`);
  };
  // The first touch also ends the opening sweep, which would otherwise hold the light's position.
  // While the arrival is still coming down there is nothing to light, so a touch then is left alone.
  const hold = (e) => {
    if (stage.classList.contains('is-arriving')) return;
    stage.classList.add('is-touched', 'is-held');
    aim(e);
  };
  const release = () => stage.classList.remove('is-held');
  const onControl = (e) => e.target.closest('a, button, label, input, select, textarea');

  // A mouse lights wherever it is, and lets go when it leaves the window. A finger lights where it is held, except on
  // a control, and follows while it stays down: scrolling lets go.
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') hold(e);
    else if (stage.classList.contains('is-held')) aim(e);
  }, { passive: true });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) release(); });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || onControl(e)) return;
    hold(e);
    // The hint has done its job once a finger has held the light.
    stage.classList.add('is-held-once');
  });
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') release(); });
  addEventListener('pointercancel', release);

  // Once the first screen is mostly gone, the light only thins the veil, and the lights stay on for the first screen.
  new IntersectionObserver(([entry]) => {
    stage.classList.toggle('is-past', entry.intersectionRatio < 0.6);
  }, { threshold: [0, 0.6] }).observe(stage);

  // A newly picked house brings a new picture and a new light, and a sweep of the torch passes over them once. On a
  // touch screen the veil also lifts for a moment, so the house is seen whole, and an Android phone gives two soft
  // knocks, like a heartbeat, when the visitor picked it themselves.
  // The sweep and the veil's lift run again by switching between two copies of each animation (is-swept, styles.css):
  // a new name starts an animation afresh when the page is next drawn. Taking the animation off and forcing the page to
  // work out its layout at once, the old way, stopped a slow phone for about 90 ms in the middle of every change of
  // house (measured 2026-11-18).
  stage.addEventListener('animationend', (e) => { if (e.animationName.startsWith('veil-reveal')) stage.classList.remove('is-revealing'); });
  const sweep = () => {
    stage.classList.remove('is-touched', 'is-held');
    stage.classList.toggle('is-swept');
    if (!touchScreen.matches) return;
    stage.classList.add('is-revealing');
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.isActive) navigator.vibrate([14, 90, 14]);
  };
  new MutationObserver(sweep).observe(document.documentElement, { attributeFilter: ['data-world'] });

  // Tilt: on a phone, leaning it moves the light, as a torch in the hand would. The way the phone is held when the first
  // reading comes is the middle; the middle follows slowly (about six seconds), so a phone left leaning brings the light
  // home. A held finger takes the light from the tilt. Android gives the readings freely; an iPhone asks once, and the
  // question comes after a finger lets go of the scene, never on its own. Readings are used only while the first screen
  // is in view, and a phone that gives none (or a frame that refuses them) keeps the drifting light.
  if (touchScreen.matches && 'DeviceOrientationEvent' in window) {
    const REACH = 2.4; // percent of the screen per degree of lean: about twenty degrees crosses most of it
    const FOLLOW = 1 / 360; // how fast the middle follows the phone, per reading (about 60 readings a second)
    let middle = null;
    let target = null;
    let at = null;
    let frame = 0;
    let moved = false;

    // The phone's lean in screen terms, whichever way up the screen is turned.
    const lean = (e) => {
      const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      const g = e.gamma;
      const b = e.beta;
      if (angle === 90) return { x: b, y: -g };
      if (angle === -90 || angle === 270) return { x: -b, y: g };
      if (angle === 180) return { x: -g, y: -b };
      return { x: g, y: b };
    };
    const clamp = (v) => Math.min(90, Math.max(10, v));

    const draw = () => {
      frame = 0;
      if (!target || stage.classList.contains('is-held') || stage.classList.contains('is-past')) return;
      at = at || { ...target };
      at.x += (target.x - at.x) * 0.18;
      at.y += (target.y - at.y) * 0.18;
      stage.style.setProperty('--torch-x', `${at.x.toFixed(2)}%`);
      stage.style.setProperty('--torch-y', `${at.y.toFixed(2)}%`);
      if (Math.abs(target.x - at.x) + Math.abs(target.y - at.y) > 0.05) frame = requestAnimationFrame(draw);
    };

    const onTilt = (e) => {
      if (e.gamma == null || e.beta == null) return;
      if (stage.classList.contains('is-arriving') || stage.classList.contains('is-past')) return;
      const now = lean(e);
      if (!middle) { middle = { ...now }; return; }
      middle.x += (now.x - middle.x) * FOLLOW;
      middle.y += (now.y - middle.y) * FOLLOW;
      target = { x: clamp(50 + (now.x - middle.x) * REACH), y: clamp(38 + (now.y - middle.y) * REACH) };
      // The light is the tilt's from the first real lean on; until then the drifting light goes on.
      if (!moved && Math.hypot(now.x - middle.x, now.y - middle.y) > 3) {
        moved = true;
        stage.classList.add('is-tilting', 'is-held-once');
      }
      if (moved && !frame) frame = requestAnimationFrame(draw);
    };
    // Listening costs nothing where no readings come. Android sends them at once. An iPhone sends them only once the
    // visitor has said yes, so the question is put after the first touch on the scene ends (never on a control).
    // Chrome has the same question but answers it itself, without asking anyone, once readings already flow.
    addEventListener('deviceorientation', onTilt, { passive: true });
    const ask = DeviceOrientationEvent.requestPermission;
    if (typeof ask === 'function') {
      const askOnce = (e) => {
        if (onControl(e) || stage.classList.contains('is-past') || stage.classList.contains('is-arriving')) return;
        removeEventListener('touchend', askOnce);
        if (!middle) ask.call(DeviceOrientationEvent).catch(() => {});
      };
      addEventListener('touchend', askOnce, { passive: true });
    }
  }

  toggle.addEventListener('click', () => {
    const lit = stage.classList.toggle('is-lit');
    stage.classList.add('is-touched');
    toggle.setAttribute('aria-pressed', String(lit));
    toggle.textContent = lit ? 'طفّوا النور' : 'نوّروا البيت';
  });
})();
