// The house trailer. In the booking counter the picked house shows a still from its trailer; a tap grows the trailer
// out of that still until it fills the screen, with sound, while the house's world darkens behind it. When it ends,
// or is closed, the film, the dark and the trailer's sound fade out slowly and give the page back to the world, whose
// soundtrack comes back meanwhile (sound.js listens for the "trailer" event). Nothing of the film loads before the
// tap, and closing stops the download.
// A house shows its trailer once it is named on the teaser element: data-case="trailer-case" plays
// media/trailer-case.mp4 (media/trailer-case-small.mp4 on phones) and shows images/trailer-case.jpg first.
(() => {
  const root = document.querySelector('[data-teaser]');
  const form = document.querySelector('.counter');
  const screen = document.querySelector('[data-trailer]');
  if (!root || !form || !screen || typeof screen.showModal !== 'function') return;

  const GROW = 1100; // ms, the film growing out of its card
  const FADE = 1600; // ms, the film and the dark fading back into the world

  const wait = root.querySelector('.teaser__wait');
  const card = root.querySelector('.teaser__card');
  const still = card.querySelector('img');
  const time = card.querySelector('.teaser__time');
  const shade = screen.querySelector('.trailer__shade');
  const video = screen.querySelector('video');
  const close = screen.querySelector('.trailer__close');
  const phone = matchMedia('(max-width: 60rem)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const tell = (open) => document.dispatchEvent(new CustomEvent('trailer', { detail: { open } }));
  const ease = () => getComputedStyle(document.documentElement).getPropertyValue('--ease-in-out').trim() || 'ease-in-out';

  const load = () => {
    const house = form.elements.house.value;
    const name = house ? root.dataset[house] : '';
    // Until a house is picked there is nothing to show.
    root.hidden = !house;
    card.hidden = !name;
    wait.hidden = Boolean(name);
    if (!name) return;
    const title = document.getElementById(`title-${house}`);
    card.dataset.name = name;
    still.src = `images/${name}.jpg`;
    time.textContent = root.dataset[`${house}Time`] || '';
    screen.setAttribute('aria-label', `تريلر ${title ? title.textContent : ''}`.trim());
  };

  // Opening: the film starts at the card's place and size and grows to fill the screen as the dark comes up.
  const grow = () => {
    if (calm.matches) {
      shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
      return;
    }
    const from = card.getBoundingClientRect();
    const to = video.getBoundingClientRect();
    const easing = ease();
    video.animate(
      [
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` },
        { transform: 'none' },
      ],
      { duration: GROW, easing },
    );
    shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: GROW, easing });
    close.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: GROW, fill: 'backwards' });
  };

  // Closing: everything fades together, the trailer's sound with it, and only then is the screen put away.
  let closing = false;
  const shut = () => {
    if (closing || !screen.open) return;
    closing = true;
    tell(false);
    const duration = calm.matches ? 250 : FADE;
    const loud = video.volume;
    const from = performance.now();
    const quieten = (now) => {
      if (!closing) return;
      const k = Math.max(0, Math.min((now - from) / duration, 1));
      video.volume = loud * (1 - k);
      if (k < 1) requestAnimationFrame(quieten);
    };
    requestAnimationFrame(quieten);
    const fade = screen.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: ease(), fill: 'forwards' });
    fade.finished.then(() => {
      closing = false;
      screen.close();
      fade.cancel();
      video.volume = loud;
    });
  };

  card.addEventListener('click', () => {
    const name = card.dataset.name;
    if (!name || screen.open) return;
    video.poster = `images/${name}.jpg`;
    video.src = `media/${name}${phone.matches ? '-small' : ''}.mp4`;
    screen.showModal();
    tell(true);
    // Started inside the tap, so the browser lets it play with sound; if it refuses, the controls are there.
    video.play().catch(() => {});
    grow();
  });

  close.addEventListener('click', shut);
  // A tap on the dark around the film closes it too.
  shade.addEventListener('click', shut);
  // Esc fades it out like the button, instead of snapping it shut.
  screen.addEventListener('cancel', (e) => { e.preventDefault(); shut(); });
  // At its end the trailer gives the page back, with the booking where the visitor left it.
  video.addEventListener('ended', shut);
  screen.addEventListener('close', () => {
    closing = false;
    video.pause();
    video.removeAttribute('src');
    video.load();
    tell(false);
  });

  form.addEventListener('change', (e) => { if (e.target.name === 'house') load(); });
  load();
})();
