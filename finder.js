// The finder: three questions, and the house that fits the team. The answer picks that house's door in the booking
// counter, so the whole page moves into its world (booking.js), and the button under it goes up to the booking.
(() => {
  const finder = document.querySelector('[data-finder]');
  const counter = document.querySelector('.counter');
  if (!finder || !counter) return;

  const ask = finder.querySelector('form');
  const verdict = finder.querySelector('[data-verdict]');
  const answers = [...verdict.querySelectorAll('[data-house]')];
  const waiting = verdict.querySelectorAll('[data-wait]');
  const why = verdict.querySelector('[data-why]');
  const go = verdict.querySelector('[data-go]');

  // Each house's name, largest team and youngest player, from its own panel in the booking counter.
  const houses = Object.fromEntries([...counter.querySelectorAll('.house')].map((panel) => [panel.dataset.house, {
    name: panel.querySelector('h3').textContent,
    max: +panel.dataset.max,
    age: +panel.dataset.age,
  }]));
  const youngest = Math.min(...Object.values(houses).map((house) => house.age));
  // When the house the team fears most cannot take it, the closest that can, in this order.
  const NEAREST = { tomb: ['case', 'morgue'], case: ['morgue', 'tomb'], morgue: ['case', 'tomb'] };

  const answer = (name) => ask.elements[name].value;

  // What the answers come to: a house, and why it is not the one feared most when it is not. Nothing until the first
  // question is answered, unless no house takes the youngest.
  const decide = () => {
    const fear = answer('fear');
    const size = +answer('size') || 0;
    const age = +answer('age') || Infinity;
    if (age < youngest) return { reason: `مفيش بيت عندنا لأقل من ${youngest} سنة.` };
    if (!fear) return null;
    const fits = (key) => houses[key].max >= size && houses[key].age <= age;
    if (fits(fear)) return { house: fear };
    const feared = houses[fear];
    const reason = feared.max < size ? `${feared.name} آخرها ${feared.max} لاعبين` : `${feared.name} من ${feared.age} سنة`;
    return { house: NEAREST[fear].find(fits), reason: `${reason}، فده أقرب بيت ليكم:` };
  };

  const pickDoor = (house) => {
    const door = counter.querySelector(`input[name="house"][value="${house}"]`);
    if (!door || door.checked) return;
    door.checked = true;
    door.dispatchEvent(new Event('change', { bubbles: true }));
  };

  let shown = null;

  // Opens one house in the verdict (its picture, name and facts), or none, with the reason line above it.
  const open = (house, reason) => {
    shown = house || null;
    waiting.forEach((el) => { el.hidden = Boolean(house || reason); });
    why.textContent = reason || '';
    go.hidden = !house;
    answers.forEach((block) => {
      const on = block.dataset.house === house;
      if (on && block.hidden) {
        block.hidden = false;
        // The house that opens settles in: it was hidden until now, so its entrance runs afresh by itself. Forcing it
        // with a reflow stopped a slow phone for about 85 ms on every pick of a house (measured 2026-11-18).
        block.classList.add('is-entering');
      } else if (!on) {
        block.hidden = true;
      }
    });
  };

  // On a phone the verdict stands under the questions, out of sight: once all three are answered it is brought up,
  // so the visitor sees the door open.
  const narrow = matchMedia('(max-width: 60rem)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const allAnswered = () => ['fear', 'size', 'age'].every((name) => !ask.elements[name] || answer(name));
  const bringUp = () => {
    if (!narrow.matches || !allAnswered()) return;
    const box = verdict.getBoundingClientRect();
    if (box.top > innerHeight * 0.6) verdict.scrollIntoView({ block: 'nearest', behavior: still.matches ? 'auto' : 'smooth' });
  };

  const show = () => {
    const result = decide();
    const house = result && result.house;
    open(house, result && result.reason);
    if (house) pickDoor(house);
    if (house || (result && result.reason)) bringUp();
  };

  // A house picked in the booking counter opens here too, so the picture below follows the page into its world, and
  // the first question takes that house as the answer.
  counter.addEventListener('change', (event) => {
    if (event.target.name !== 'house' || event.target.value === shown) return;
    const fear = ask.querySelector(`input[name="fear"][value="${event.target.value}"]`);
    if (fear) fear.checked = true;
    open(event.target.value, '');
  });

  ask.addEventListener('change', show);

  // A page opened on a house (#tomb, #case or #morgue) has its door picked before this runs.
  const picked = counter.querySelector('input[name="house"]:checked');
  if (picked) {
    const fear = ask.querySelector(`input[name="fear"][value="${picked.value}"]`);
    if (fear) fear.checked = true;
    open(picked.value, '');
  }
})();
