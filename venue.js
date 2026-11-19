// The venue's film: once the map has landed, the owner's ten-second film plays once over his picture: the camera
// comes round from the side of the building to its front and rests there. Phones get a lighter copy.
// It is an extra, so it costs nothing where it would not be seen or where the line is slow (measured 2026-11-18 on a
// mid-range phone over slow 4G: started early, it took the line from the page's own picture and fonts, and kept
// downloading after it had given up):
// - it plays only on a visit that opens with the arrival (the top of the page, no house, no link to a section), not
//   under reduced motion, with data saver on, or on a 2G or 3G line;
// - it starts downloading only after the page itself has loaded, and is let go if the map lands before that;
// - a house picked before it plays, or a start later than 2.5 s after the map has gone, keeps the picture instead,
//   and the download stops at once.
(() => {
  const stage = document.querySelector('.hero__frames');
  const figure = stage && stage.querySelector('.photo--venue');
  const film = figure && figure.querySelector('video');
  if (!film) return;
  const line = navigator.connection || {};
  const slow = line.saveData || /(^|-)(2g|3g)$/.test(line.effectiveType || '');
  const away = scrollY > 40 || location.hash.length > 1 || document.documentElement.dataset.world;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || slow || away) { film.remove(); return; }

  // How long the film may take to start once the map has gone, before the picture is kept instead: starting later
  // would show the side of the building after the visitor has already been looking at its front.
  const START_MS = 2500;
  const small = matchMedia('(max-width: 60rem)').matches;
  film.muted = true;

  let gone = false;
  const giveUp = () => {
    if (gone) return;
    gone = true;
    film.pause();
    // Removing the element alone lets the browser go on downloading; emptying it stops the download now.
    film.removeAttribute('src');
    film.load();
    film.remove();
    figure.classList.remove('is-film', 'is-film-done');
  };
  film.addEventListener('playing', () => figure.classList.add('is-film'), { once: true });
  film.addEventListener('ended', () => figure.classList.add('is-film-done'));
  film.addEventListener('error', giveUp);

  // A house picked takes the venue off the screen: the film would play unseen.
  new MutationObserver(() => { if (document.documentElement.dataset.world) giveUp(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-world'] });

  // The film's download waits for the page itself, so it never takes the line from the first picture and the fonts.
  let fetched = false;
  const fetchFilm = () => {
    if (fetched || gone) return;
    fetched = true;
    film.src = small ? film.dataset.srcSmall : film.dataset.src;
    film.preload = 'auto';
  };
  if (document.readyState === 'complete') fetchFilm();
  else addEventListener('load', fetchFilm, { once: true });

  let started = false;
  const start = () => {
    if (started || gone) return;
    started = true;
    // The map landed before the page had even finished loading: the line is slow, so the picture stays.
    if (!fetched) { giveUp(); return; }
    const late = setTimeout(() => { if (!figure.classList.contains('is-film')) giveUp(); }, START_MS);
    film.addEventListener('playing', () => clearTimeout(late), { once: true });
    const playing = film.play();
    if (playing) playing.catch(giveUp);
  };

  if (!stage.classList.contains('is-arriving')) { start(); return; }
  const watch = new MutationObserver(() => {
    if (stage.classList.contains('is-arriving')) return;
    watch.disconnect();
    start();
  });
  watch.observe(stage, { attributes: true, attributeFilter: ['class'] });
})();
