// The arrival: the page opens high over Cairo and comes down on the venue, and then the hero frames show.
// The map is not live. tools/map-flight/bake.mjs draws one picture for each zoom level, all centred on the venue, and
// this script scales and turns them, so no visitor's phone ever calls a map service. It is an extra: without this
// script, under reduced motion, on a data-saving phone or away from the top of the page, the hero opens as it always has.
(() => {
  const stage = document.querySelector('.hero__frames');
  const root = stage && stage.querySelector('[data-arrival]');
  if (!root) return;
  const saving = navigator.connection && navigator.connection.saveData;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || saving || scrollY > 40 || location.hash.length > 1) return;

  // The path, as tools/map-flight/flight.json draws it: a picture for each zoom from FROM to TO, the map turning by
  // SWING degrees on the way down and north-up at TO. The camera stops at STOP, between the last two pictures.
  const FROM = +root.dataset.from;
  const TO = +root.dataset.to;
  const STOP = +root.dataset.stop;
  const SWING = +root.dataset.swing;
  const FLIGHT_MS = 4200;
  const HOLD_MS = 900;
  const LEAVE_MS = 700;
  // The pictures get this long to load. On a slower line the hero opens without the arrival.
  const WAIT_MS = 3000;
  // What the visitor is over, by the camera's zoom.
  const PLACES = [[14.5, 'جولف سيتي مول'], [11, 'مدينة العبور'], [0, 'القاهرة الكبرى']];

  const sky = root.querySelector('.arrival__sky');
  const place = root.querySelector('.arrival__place');
  const skip = stage.querySelector('[data-arrival-skip]');
  const shape = matchMedia('(min-width: 60.01rem)').matches ? 'wide' : 'tall';
  const bearing = (zoom) => SWING * (TO - zoom) / (TO - FROM);
  const ease = (t) => (1 - Math.cos(Math.PI * t)) / 2;

  const frames = [];
  for (let zoom = FROM; zoom <= TO; zoom += 1) {
    const img = Object.assign(new Image(), { alt: '', hidden: true, src: `images/flight/${shape}-${String(zoom).padStart(2, '0')}.webp` });
    frames.push({ zoom, img });
  }

  // A picture drawn for zoom z shows at its own size when the camera is at z, and at twice that one zoom further down.
  // Two show at a time: the one the camera has passed, filling the frame, and the next one growing inside it.
  const draw = (zoom) => {
    frames.forEach(({ zoom: own, img }) => {
      const depth = zoom - own;
      img.hidden = depth <= -1 || depth >= 1;
      if (img.hidden) return;
      img.style.scale = 2 ** depth;
      img.style.rotate = `${bearing(own) - bearing(zoom)}deg`;
    });
    const name = PLACES.find(([from]) => zoom >= from)[1];
    if (place.textContent !== name) place.textContent = name;
  };

  // The map gives way to the frames, and the torch's opening sweep starts.
  let flying = false;
  let over = false;
  const leave = () => {
    if (over) return;
    over = true;
    // Pictures still on their way are no longer wanted.
    if (!flying) frames.forEach(({ img }) => img.removeAttribute('src'));
    const held = document.activeElement === skip;
    stage.classList.remove('is-arriving');
    root.classList.add('is-leaving');
    skip.hidden = true;
    const toggle = stage.querySelector('[data-torch-toggle]');
    if (held && toggle) toggle.focus();
    setTimeout(() => { root.hidden = true; sky.replaceChildren(); }, LEAVE_MS);
  };

  const fly = () => {
    if (over) return;
    flying = true;
    draw(FROM);
    root.classList.add('is-flying');
    const start = performance.now();
    const step = (now) => {
      if (over) return;
      const progress = Math.min(Math.max(now - start, 0) / FLIGHT_MS, 1);
      draw(FROM + (STOP - FROM) * ease(progress));
      if (progress < 1) { requestAnimationFrame(step); return; }
      root.classList.add('is-landed');
      setTimeout(leave, HOLD_MS);
    };
    requestAnimationFrame(step);
    // A page that is not being painted gets no frames, so the arrival also ends on a timer.
    setTimeout(leave, FLIGHT_MS + HOLD_MS + 500);
  };

  stage.classList.add('is-arriving');
  sky.append(...frames.map(({ img }) => img));
  root.hidden = false;
  skip.hidden = false;
  skip.addEventListener('click', leave);
  const waiting = setTimeout(leave, WAIT_MS);
  Promise.all(frames.map(({ img }) => img.decode())).then(() => { clearTimeout(waiting); fly(); }, leave);
})();
