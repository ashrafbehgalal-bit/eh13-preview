// The booking counter: pick a house, a day, a time and a team size, and the price for each player follows the team.
(() => {
  const form = document.querySelector('.counter');
  if (!form) return;

  // EGP for each player by team size, from docs/00-business-brief.md section 3. Five and over pay 300.
  const PRICE = { 3: 400, 4: 350 };
  const priceFor = (n) => PRICE[n] ?? 300;
  // The venue's evening runs past midnight, so a 1:30 AM journey belongs to the day before. Its day turns at 4 AM in Cairo.
  const ZONE = 'Africa/Cairo';
  const DAY_TURNS_AT = 4 * 60;
  const DAY_MS = 864e5;
  const DAYS_SHOWN = 7;
  const TWEEN_MS = 320;

  const root = document.documentElement;
  const houses = [...form.querySelectorAll('.house')];
  // The scene's sets of pictures, and how long one takes to give way to the next (--dur-world in tokens.css).
  const sets = [...document.querySelectorAll('.scene__set')];
  const WORLD_MS = parseFloat(getComputedStyle(root).getPropertyValue('--dur-world')) * 1000 || 3200;
  const unpicked = form.querySelector('[data-unpicked]');
  const team = form.elements.team;
  const help = form.querySelector('.help');
  const nudge = form.querySelector('[data-nudge]');
  const pick = form.querySelector('[data-pick]');
  const next = form.querySelector('[data-next]');
  const daysStep = form.querySelector('[data-days]');
  const whatsapp = form.querySelector('[data-whatsapp-link]');
  const dockPrice = document.querySelector('[data-dock-price]');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The house on show. There is none until a door is picked.
  const current = () => houses.find((h) => !h.hidden);
  const checked = (name) => form.querySelector(`input[name="${name}"]:checked`);
  const clamp = (n) => Math.min(Math.max(n || +team.min, +team.min), +team.max);
  const format = (n) => n.toLocaleString('en-US');

  // Now in Cairo as the venue counts it: its day (UTC midnight of that date) and the minutes since that day began.
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const venueNow = () => {
    const at = Object.fromEntries(clock.formatToParts(new Date()).map((part) => [part.type, +part.value]));
    const minutes = at.hour * 60 + at.minute;
    const day = Date.UTC(at.year, at.month - 1, at.day);
    return minutes < DAY_TURNS_AT ? { day: day - DAY_MS, minutes: minutes + 24 * 60 } : { day, minutes };
  };
  // "12:30 ص" is half past midnight of the same evening, so the morning hours count past 24.
  const slotMinutes = (value) => {
    const [time, half] = value.split(' ');
    const [h, m] = time.split(':').map(Number);
    return ((h % 12) + (half === 'م' ? 12 : 24)) * 60 + m;
  };

  const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'UTC' });
  const dayOfMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const fullDay = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const NEAR = ['النهارده', 'بكرة'];
  const pickedDay = () => { const day = checked('day'); return day ? { index: +day.dataset.index, date: new Date(+day.value) } : null; };
  const dayName = ({ index, date }) => NEAR[index] ?? `${weekday.format(date)} ${dayOfMonth.format(date)}`;

  const buildDays = () => {
    const { day } = venueNow();
    const rail = daysStep.querySelector('.days');
    for (let index = 0; index < DAYS_SHOWN; index += 1) {
      const date = new Date(day + index * DAY_MS);
      const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'day', id: `day-${index}`, value: String(date.getTime()), checked: index === 0 });
      input.dataset.index = index;
      const label = Object.assign(document.createElement('label'), { htmlFor: input.id });
      if (NEAR[index]) label.textContent = NEAR[index];
      else label.append(weekday.format(date), Object.assign(document.createElement('small'), { textContent: dayOfMonth.format(date) }));
      rail.append(input, label);
    }
    daysStep.hidden = false;
  };

  // "بعد ساعة و20 دقيقة": Arabic counts one, two, three to ten, and eleven up differently.
  const count = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : `${n} ${n <= 10 ? few : many}`);
  const wait = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return [h && count(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة'), m && count(m, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة')].filter(Boolean).join(' و') || 'دقيقة';
  };

  // Today, a journey that has already started cannot be picked, and the line under the days says how far off the next one is.
  const refreshTimes = () => {
    const day = pickedDay();
    const today = day && day.index === 0;
    const now = venueNow().minutes;
    const shown = current();
    const slots = shown ? [...shown.querySelectorAll('input[name="time"]')] : [];
    slots.forEach((slot) => {
      slot.disabled = Boolean(today) && slotMinutes(slot.value) <= now;
      if (slot.disabled) slot.checked = false;
    });
    const first = slots.find((slot) => !slot.disabled);
    next.textContent = !today || !shown ? '' : first ? `الأقرب ${first.value}، بعد ${wait(slotMinutes(first.value) - now)}.` : 'مواعيد النهارده خلصت، اختاروا بكرة.';
  };

  // Figures roll to their new value. A page that is not being painted gets no frames, so the value is also set on a timer.
  const rolling = new WeakMap();
  const write = (el, n) => { if (el instanceof HTMLOutputElement) el.value = format(n); else el.textContent = format(n); };
  const roll = (el, to) => {
    if (!el) return;
    const from = +(el instanceof HTMLOutputElement ? el.value : el.textContent).replace(/,/g, '');
    const run = (rolling.get(el) || 0) + 1;
    rolling.set(el, run);
    if (still || !from || from === to) { write(el, to); return; }
    const start = performance.now();
    const frame = (now) => {
      if (rolling.get(el) !== run) return;
      const progress = Math.min((now - start) / TWEEN_MS, 1);
      write(el, Math.round(from + (to - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    setTimeout(() => { if (rolling.get(el) === run) write(el, to); }, TWEEN_MS + 80);
  };

  const updatePrice = () => {
    const n = clamp(+team.value);
    const each = priceFor(n);
    const nextPrice = priceFor(n + 1);
    roll(form.elements.per, each);
    roll(form.elements.total, each * n);
    roll(dockPrice, each);
    nudge.textContent = n < +team.max && nextPrice < each ? `لو جبتوا واحد كمان، الفرد يدفع ${nextPrice} بدل ${each}.` : '';
  };

  // The ticket names what is picked so far, and the WhatsApp message carries the same choice.
  const updatePick = () => {
    const shown = current();
    const house = shown && shown.querySelector('h3').textContent;
    const day = pickedDay();
    const time = checked('time');
    pick.textContent = house ? [house, day && dayName(day), time && time.value].filter(Boolean).join('، ') : 'اختاروا بيت';
    const text = `عايزين نحجز ${house || 'رحلة'}${day ? ` يوم ${fullDay.format(day.date)}` : ''}${time ? `، ميعاد ${time.value}` : ''}، وعددنا ${team.value}.${form.elements.area.value ? ` ساكنين في ${form.elements.area.value}.` : ''}`;
    whatsapp.href = `https://wa.me/${form.dataset.whatsapp}?text=${encodeURIComponent(text)}`;
  };

  const update = () => { refreshTimes(); updatePrice(); updatePick(); };

  // The scene behind the page shows the picked house's own pictures if it has a set of them (data-for names the
  // house), and the venue's own picture if not. One set fades out as the next fades in. A set that has faded out is
  // taken out of the page, so its pictures are fetched only once its house is picked.
  const fading = new WeakMap();
  const showSet = (set, on) => {
    clearTimeout(fading.get(set));
    if (!on) {
      if (set.hidden) return;
      set.classList.remove('is-on');
      fading.set(set, setTimeout(() => { set.hidden = true; }, root.classList.contains('no-fade') ? 0 : WORLD_MS));
      return;
    }
    set.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
    set.hidden = false;
    // A set just put back has its styles worked out once before it lights, so it fades in rather than appearing.
    // Inside a view transition (no-fade on the root) the change is instant anyway, so the page is not made to work
    // its layout out early there: each such stop cost a slow phone tens of milliseconds (measured 2026-11-18).
    if (!root.classList.contains('no-fade')) void set.offsetWidth;
    set.classList.add('is-on');
  };

  // Once the doors come into view, every house's pictures are fetched and decoded, so a pick does not stop to wait for
  // its picture before the page fades into it (a phone stopped for about a second, measured 2026-11-17).
  const doors = form.querySelector('.doors');
  if (doors && 'IntersectionObserver' in window) {
    const warm = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      warm.disconnect();
      sets.forEach((set) => set.querySelectorAll('img').forEach((img) => {
        img.loading = 'eager';
        if (img.decode) img.decode().catch(() => {});
      }));
    }, { rootMargin: '0px 0px 50% 0px' });
    warm.observe(doors);
  }

  // opening is true for the call as the page loads: a link that opens on a house opens in its world at once.
  // After that, a newly picked house is entered slowly.
  // settleLater: a view transition gives the page its fades back itself, once the new world has been drawn.
  const showHouse = (opening = false, settleLater = false) => {
    const picked = form.elements.house.value;
    if (opening) root.classList.add('no-fade');
    // The whole page moves into the picked house's world: its light, its ground and the voice of its name.
    if (picked) root.dataset.world = picked;
    const own = sets.some((set) => set.dataset.for === picked);
    sets.forEach((set) => showSet(set, set.dataset.for ? set.dataset.for === picked : !own));
    houses.forEach((h) => { h.hidden = h.dataset.house !== picked; });
    unpicked.hidden = Boolean(picked);
    // A time belongs to its house, so one picked for another house is dropped.
    form.querySelectorAll('input[name="time"]:checked').forEach((r) => { if (r.closest('.house').hidden) r.checked = false; });
    help.textContent = '';
    whatsapp.hidden = true;
    const shown = current();
    if (shown) {
      team.max = shown.dataset.max;
      team.value = clamp(+team.value);
      // The panel's entrance runs again by itself: the panel was hidden until now, and a hidden element's animation
      // starts afresh when it is shown (forcing it with a reflow stopped a slow phone for no reason).
      shown.classList.add('is-entering');
    }
    update();
    if (opening && !settleLater) {
      void root.offsetWidth;
      root.classList.remove('no-fade');
    }
  };

  // A newly picked house: the browser takes a picture of the page as it is, the page moves into the new world at once
  // underneath, and the old picture fades away over --dur-world (a view transition, styles.css). Gliding the page's
  // colours themselves made the browser rework the whole page on every frame (about 11 frames a second, measured
  // 2026-11-17); the two pictures fade on the graphics card. Where the browser has no view transitions, or under
  // reduced motion, the colours change at once and the scene, its light and its tint still fade.
  // The page stays without its own fades until the browser has drawn the new world for the crossfade, and gets them
  // back then: waiting for that, instead of forcing an early working-out of the whole page, took about a quarter of a
  // second off the pause at the start of a change on a slow phone (measured 2026-11-18). Only the latest change
  // gives them back, so two quick picks cannot undo each other.
  let changes = 0;
  let fade = null;
  const enterHouse = () => {
    if (!document.startViewTransition || still) { showHouse(); return; }
    const mine = ++changes;
    const change = document.startViewTransition(() => showHouse(true, true));
    const settle = () => { if (mine === changes) root.classList.remove('no-fade'); };
    change.ready.then(settle, settle);
    fade = change;
    const over = () => { if (fade === change) fade = null; };
    change.finished.then(over, over);
  };

  // While the crossfade runs, the whole page is one picture and the browser gives a tap to nothing under it: a visitor
  // who picked a house and went straight on to a day was ignored for the 3.2 s of the fade (measured 2026-11-18).
  // So a touch during the fade hurries the rest of it (about a quarter of a second at most), and the tap then goes to
  // what was under the finger. A visitor who only watches still sees the whole slow fade.
  const HURRY = 12;
  let hurriedAt = 0;
  addEventListener('pointerdown', () => {
    if (!fade) return;
    hurriedAt = performance.now();
    document.getAnimations().forEach((a) => {
      if (String(a.effect && a.effect.pseudoElement).startsWith('::view-transition')) a.updatePlaybackRate(HURRY);
    });
  }, true);
  addEventListener('click', (e) => {
    if (e.target !== root || performance.now() - hurriedAt > 2000) return;
    hurriedAt = 0;
    const { clientX: x, clientY: y } = e;
    const deliver = () => {
      const under = document.elementFromPoint(x, y);
      const control = under && under.closest('label, button, a, input, select, textarea, summary');
      if (!control) return;
      if (control.matches('select, textarea, input:not([type="radio"], [type="checkbox"], [type="button"], [type="submit"])')) control.focus();
      else control.click();
    };
    if (fade) fade.finished.then(deliver, deliver); else deliver();
  }, true);

  form.addEventListener('change', (e) => { if (e.target.name === 'house') enterHouse(); else update(); });
  team.addEventListener('input', update);
  team.addEventListener('blur', () => { team.value = clamp(+team.value); update(); });
  form.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
    team.value = clamp((+team.value || +team.min) + +button.dataset.step);
    update();
  }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!current()) {
      help.textContent = 'اختاروا بيت الأول.';
      form.elements.house[0].focus();
      return;
    }
    if (!checked('time')) {
      help.textContent = 'اختاروا ميعاد الأول.';
      const first = current().querySelector('input[name="time"]:not(:disabled)');
      if (first) first.focus();
      return;
    }
    // The checkout (checkout.js) takes it from here: the rules, the name and number, and the deposit.
    const checkout = document.querySelector('[data-checkout]');
    if (checkout && typeof checkout.showModal === 'function') {
      help.textContent = '';
      document.dispatchEvent(new CustomEvent('checkout'));
      return;
    }
    if (!form.dataset.endpoint) {
      help.textContent = 'الحجز الأونلاين لسه مش متوصل، ومفيش حاجة اتبعتت. ابعتوا اختياركم على واتساب.';
      whatsapp.hidden = false;
      return;
    }
    // The checkout takes over from here once the endpoint exists.
    form.action = form.dataset.endpoint;
    form.submit();
  });

  // A link can open the page with a house already picked, the way an ad for one house will: the address ends in
  // #tomb, #case or #morgue.
  const asked = [...form.elements.house].find((door) => door.value === location.hash.slice(1));
  if (asked) asked.checked = true;

  buildDays();
  showHouse(true);
  // The clock moves on while the page is open.
  setInterval(() => { refreshTimes(); updatePick(); }, 30000);
})();
