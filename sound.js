// A house's soundtrack plays while the page stands in that house's world, and before any house is picked a heart
// beats (the owner, 2026-11-18): data-sound on <main>, the owner's own heartbeat made into a seamless loop by
// tools/audio/heart-loop.mjs (audio/heart.mp4).
// A house's track is data-sound on its panel in the booking counter; every file loops with no seam. Browsers play
// sound only after a tap or a click, so the heart starts on the visitor's first tap anywhere (not one that picks a
// house, whose own track then starts), and a house's track when the visitor picks the house themselves (a door, or
// the finder's answer), never on a page that merely opens on #case: there the switch in the nav shows, off, and waits
// to be pressed. Picking a house fades the heart out as the house's track comes in. The visitor's choice to keep the
// sound off is remembered on this browser only.
(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('[data-sound-toggle]');
  const label = document.querySelector('[data-sound-label]');
  if (!toggle || !window.AudioContext && !window.webkitAudioContext) return;

  const VOLUME = 0.6;
  const FADE_IN = 3.2; // seconds, the same as the page's crossfade into a world (--dur-world)
  const FADE_OUT = 1.2;
  const KEY = 'eh13-sound';

  const remembered = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const remember = (value) => { try { localStorage.setItem(KEY, value); } catch { /* private window: forget it */ } };

  let ctx = null;
  let master = null;
  let playing = null; // { url, source, gain }
  const buffers = new Map();

  const make = () => {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.connect(ctx.destination);
  };

  // A tap or a key in the last second counts as the visitor's own act (userActivation where the browser has it).
  // A phone lets the sound's engine start only inside the visitor's own tap, so a tap on a door, an answer of the
  // finder or the switch wakes the engine there and then, ready for the house's track.
  let lastAct = 0;
  ['pointerdown', 'keydown'].forEach((type) => addEventListener(type, (e) => {
    lastAct = performance.now();
    const picking = e.target instanceof Element && e.target.closest('.doors, #finder, [data-sound-toggle]');
    if (picking && ctx && ctx.state === 'suspended' && remembered() !== 'off') ctx.resume();
  }, true));
  const byVisitor = () => (navigator.userActivation ? navigator.userActivation.isActive : performance.now() - lastAct < 1000);

  const context = () => {
    make();
    // Must be called inside the tap itself on phones, before any waiting.
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  // Making the engine costs a slow phone a tenth to a quarter of a second (136 to 267 ms, measured 2026-11-18): too
  // much at the moment a house is picked, in the middle of the page's change of world, or on the first tap, and too
  // much during the arrival, whose every frame is drawn by script. So it is made ahead, in an idle moment once the
  // page has loaded and the arrival has landed; it stays silent until a tap.
  const stage = document.querySelector('.hero__frames');
  if (remembered() !== 'off') {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    const ahead = () => {
      if (!stage || !stage.classList.contains('is-arriving')) { idle(make, { timeout: 2000 }); return; }
      const landed = new MutationObserver(() => {
        if (stage.classList.contains('is-arriving')) return;
        landed.disconnect();
        idle(make, { timeout: 2000 });
      });
      landed.observe(stage, { attributes: true, attributeFilter: ['class'] });
    };
    if (document.readyState === 'complete') ahead(); else addEventListener('load', ahead, { once: true });
  }

  // The encoder pads the start and the end with a few milliseconds of silence; looping between the first and the
  // last sound sample keeps that pad out of the loop.
  const edges = (buffer) => {
    const quiet = 1e-4;
    let first = buffer.length;
    let last = 0;
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const data = buffer.getChannelData(c);
      let i = 0;
      while (i < data.length && Math.abs(data[i]) < quiet) i += 1;
      let j = data.length - 1;
      while (j > i && Math.abs(data[j]) < quiet) j -= 1;
      first = Math.min(first, i);
      last = Math.max(last, j);
    }
    return { start: first / buffer.sampleRate, end: (last + 1) / buffer.sampleRate };
  };

  const load = (url) => {
    if (!buffers.has(url)) {
      buffers.set(url, fetch(url)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((bytes) => new Promise((ok, fail) => ctx.decodeAudioData(bytes, ok, fail)))
        .catch((e) => { buffers.delete(url); throw e; }));
    }
    return buffers.get(url);
  };

  const fadeOut = () => {
    if (!playing) return;
    // Still loading (a house picked while the heart downloads): nothing sounds yet, so it is simply dropped, and the
    // load, when it lands, sees it is no longer wanted.
    if (!playing.source) { playing = null; return; }
    const { source, gain } = playing;
    playing = null;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + FADE_OUT);
    source.stop(t + FADE_OUT + 0.05);
  };

  const play = async (url) => {
    context();
    if (playing && playing.url === url) return;
    fadeOut();
    const mine = { url, source: null, gain: null };
    playing = mine;
    let buffer;
    try {
      buffer = await load(url);
    } catch {
      if (playing === mine) playing = null;
      setPressed(false);
      return;
    }
    // Another house, or the switch, may have come in while the track loaded.
    if (playing !== mine) return;
    const { start, end } = edges(buffer);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = start;
    source.loopEnd = end;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + FADE_IN);
    source.connect(gain).connect(master);
    source.start(0, start);
    mine.source = source;
    mine.gain = gain;
  };

  const stop = () => { if (playing && playing.source) fadeOut(); else playing = null; };

  const setPressed = (on) => {
    toggle.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'اقفل الصوت' : 'شغّل الصوت';
  };

  // The heart before a house is picked: <main data-sound>.
  const main = document.querySelector('main[data-sound]');
  const heart = (main && main.dataset.sound) || null;

  const trackOf = (world) => {
    if (!world) return heart;
    const panel = document.querySelector(`.house[data-house="${world}"][data-sound]`);
    return panel ? panel.dataset.sound : null;
  };

  // The heart starts on the visitor's first tap or key, inside it (a phone allows sound only there). Not on a tap that
  // picks a house (its own track starts with the change), nor on the switch, which decides for itself.
  const firstTap = (e) => {
    if (playing || root.dataset.world || !heart || remembered() === 'off') return;
    if (e.target instanceof Element && e.target.closest('.doors, #finder, [data-sound-toggle]')) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    ['pointerup', 'keydown'].forEach((type) => removeEventListener(type, firstTap, true));
    setPressed(true);
    play(heart);
  };
  ['pointerup', 'keydown'].forEach((type) => addEventListener(type, firstTap, true));

  // The page moved into another world: show the switch where there is a track, and start it if the visitor
  // picked the house themselves and has not turned the sound off before.
  const onWorld = () => {
    const url = trackOf(root.dataset.world);
    toggle.hidden = !url;
    if (!url) { stop(); setPressed(false); return; }
    if (byVisitor() && remembered() !== 'off') {
      setPressed(true);
      play(url);
    } else if (!playing || playing.url !== url) {
      stop();
      setPressed(false);
    }
  };

  toggle.addEventListener('click', () => {
    const url = trackOf(root.dataset.world);
    if (!url) return;
    const on = toggle.getAttribute('aria-pressed') !== 'true';
    setPressed(on);
    remember(on ? 'on' : 'off');
    if (on) play(url); else stop();
  });

  // A trailer has its own sound: the house's track gives way while it plays, and comes back slowly after.
  document.addEventListener('trailer', (e) => {
    if (!master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(e.detail.open ? 0 : 1, t + (e.detail.open ? 0.4 : FADE_IN));
  });

  // A hidden tab goes quiet and comes back where it was.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (playing) ctx.resume();
  });

  new MutationObserver(onWorld).observe(root, { attributes: true, attributeFilter: ['data-world'] });
  onWorld();
})();
