// Page motion: each part settles in as it arrives, the nav steps aside on the way down, the venue's figures count up
// once, and on phones a booking bar follows the visitor wherever no other booking button is in view.
// The page reads and works without this script; under reduced motion only the live parts stay.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 60.01rem)');
  const onArrive = (elements, arrive, margin = '0px 0px -10% 0px') => {
    const watch = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      watch.unobserve(entry.target);
      arrive(entry.target);
    }), { rootMargin: margin });
    elements.forEach((el) => watch.observe(el));
  };

  // Reveals, below the first screen only. The .js class on <html> is what holds each part back, so nothing hides if
  // this script never runs. An observer reports once as soon as the page is painted; if it has said nothing after a
  // moment, the page is not being painted (a preview, a background tab), and everything is shown at once.
  const reveals = document.querySelectorAll('[data-reveal]');
  let painted = false;
  onArrive(reveals, (el) => el.classList.add('is-in'));
  new IntersectionObserver((entries, watch) => { painted = true; watch.disconnect(); }).observe(document.body);
  setTimeout(() => { if (!painted) reveals.forEach((el) => el.classList.add('is-in')); }, 1500);

  // Figures the venue gave (90 minutes, 12 players, 4 AM) count up once. The timer covers a page that gets no frames.
  const COUNT_MS = 900;
  onArrive(still ? [] : document.querySelectorAll('[data-count]'), (el) => {
    const to = +el.textContent;
    const start = performance.now();
    const frame = (now) => {
      const progress = Math.min((now - start) / COUNT_MS, 1);
      el.textContent = Math.round(to * (1 - (1 - progress) ** 3));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    setTimeout(() => { el.textContent = to; }, COUNT_MS + 80);
  });

  // The nav leaves on the way down and returns on the way up.
  const nav = document.querySelector('[data-nav]');
  let last = scrollY;
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      nav.classList.toggle('is-away', scrollY > last && scrollY > 240);
      last = scrollY;
      queued = false;
    });
  }, { passive: true });

  // What is in view decides two things: on wide screens the nav's own button turns primary once the hero has gone,
  // and on phones the booking bar shows whenever the hero, the booking counter and the close are all out of view.
  const hero = document.querySelector('.hero');
  const dock = document.querySelector('[data-dock]');
  const navAction = nav.querySelector('.btn');
  const inView = new Set();
  const settle = () => {
    const pastHero = !inView.has(hero);
    const lead = pastHero && wide.matches;
    navAction.classList.toggle('btn--primary', lead);
    navAction.classList.toggle('btn--ghost', !lead);
    dock.classList.toggle('is-on', inView.size === 0);
  };
  const watchButtons = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) inView.add(entry.target); else inView.delete(entry.target); });
    settle();
  });
  [hero, document.querySelector('.counter'), document.querySelector('.band')].forEach((el) => { inView.add(el); watchButtons.observe(el); });
  dock.hidden = false;
  wide.addEventListener('change', settle);

  // Open or closed right now, by the hours on the page: every day from 4 PM to 4 AM, Cairo time.
  const open = document.querySelector('[data-open]');
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hourCycle: 'h23', hour: '2-digit' });
  const tellOpen = () => {
    const h = +hour.format(new Date());
    open.textContent = h >= 16 || h < 4 ? 'مفتوحين دلوقتي.' : 'بنفتح 4 العصر.';
  };
  tellOpen();
  setInterval(tellOpen, 60000);
})();
