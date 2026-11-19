// The checkout: what happens after "كمّل الحجز". Three steps on a screen of their own: the visit's rules to agree to,
// the name and the WhatsApp number the confirmation goes to, and the deposit by the method the visitor taps.
// - A wallet or a card: the tap itself goes on to that method on Paymob's page, and the gateway confirms the booking.
// - InstaPay: the amount, the venue's InstaPay address and the booking code to write in the transfer's note, a button
//   that opens the app, and a picture of the transfer to send. The venue checks the transfer arrived, then the
//   confirmation goes out on WhatsApp: a picture alone proves nothing, it can be edited or sent twice.
// Until data-endpoint on the booking counter is set (Phase 2), nothing is booked or sent: the last step says so.
(() => {
  const sheet = document.querySelector('[data-checkout]');
  const form = document.querySelector('.counter');
  if (!sheet || !form || typeof sheet.showModal !== 'function') return;

  const DEPOSIT = +sheet.dataset.deposit || 300;
  const MAX_PROOF = 8 * 1024 * 1024;
  const steps = [...sheet.querySelectorAll('[data-step]')];
  const marks = [...sheet.querySelectorAll('[data-mark]')];
  const $ = (selector) => sheet.querySelector(selector);
  const all = (selector) => sheet.querySelectorAll(selector);
  const helpOf = (name) => sheet.querySelector(`[data-step="${name}"] [data-step-help]`);
  const say = (name, text) => { const help = helpOf(name); if (help) help.textContent = text; };

  const show = (name) => {
    steps.forEach((step) => { step.hidden = step.dataset.step !== name; });
    marks.forEach((mark) => {
      if (mark.dataset.mark === name) mark.setAttribute('aria-current', 'step');
      else mark.removeAttribute('aria-current');
    });
    const heading = sheet.querySelector(`[data-step="${name}"] h3`);
    if (heading) heading.focus();
  };

  // The booking as the counter has it: the house, its age and size, and the line that sums up the pick.
  const open = () => {
    const house = form.elements.house.value;
    const panel = form.querySelector(`.house[data-house="${house}"]`);
    if (!panel) return;
    $('[data-checkout-pick]').textContent = (form.querySelector('[data-pick]') || {}).textContent || '';
    all('[data-rule-age]').forEach((el) => { el.textContent = panel.dataset.age || ''; });
    all('[data-rule-max]').forEach((el) => { el.textContent = panel.dataset.max || ''; });
    all('[data-rule-deposit], [data-deposit-amount]').forEach((el) => { el.textContent = DEPOSIT.toLocaleString('en-US'); });
    steps.forEach((step) => { const help = step.querySelector('[data-step-help]'); if (help) help.textContent = ''; });
    sheet.showModal();
    show('rules');
  };
  document.addEventListener('checkout', open);
  $('[data-checkout-close]').addEventListener('click', () => sheet.close());

  // An Egyptian mobile number, written any common way: 01012345678, +20 101 234 5678, 0020...
  const mobile = (text) => {
    const digits = text.replace(/[\s\-()]/g, '').replace(/^(\+|00)20/, '0');
    return /^01[0125]\d{8}$/.test(digits) ? digits : null;
  };

  const checks = {
    you: () => {
      if (!sheet.querySelector('[name="agree-rules"]').checked) return ['rules', 'لازم توافقوا على التعليمات وقواعد الأمان عشان تحجزوا.'];
      if (!sheet.querySelector('[name="agree-age"]').checked) return ['rules', 'لازم كل اللي جايين يكونوا في السن المطلوب للبيت ده.'];
      return null;
    },
    pay: () => {
      const name = $('#co-name');
      if (name.value.trim().length < 2) { name.focus(); return ['you', 'اكتبوا اسم اللي بيحجز.']; }
      if (!mobile($('#co-phone').value)) { $('#co-phone').focus(); return ['you', 'اكتبوا رقم موبايل مصري عليه واتساب، زي 01012345678.']; }
      return null;
    },
  };
  all('[data-go]').forEach((button) => button.addEventListener('click', () => {
    const to = button.dataset.go;
    const problem = checks[to] && checks[to]();
    if (problem) { say(problem[0], problem[1]); return; }
    say(button.closest('[data-step]').dataset.step, '');
    show(to);
  }));

  const instapay = $('[data-instapay]');
  const finish = (title, text) => {
    $('[data-done-title]').textContent = title;
    $('[data-done-text]').textContent = text;
    const whatsapp = $('[data-done-whatsapp]');
    whatsapp.href = `https://wa.me/${form.dataset.whatsapp || '201118881054'}`;
    show('done');
  };

  // Tapping a method is the choice: a wallet or a card goes on at once, InstaPay opens its own steps.
  all('input[name="method"]').forEach((input) => input.addEventListener('change', () => {
    instapay.hidden = input.value !== 'instapay';
    say('pay', '');
    if (input.value === 'instapay') { instapay.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const label = input.value === 'wallet' ? 'المحفظة' : 'الكارت';
    finish(
      `${label}: صفحة الدفع`,
      `في الموقع الحقيقي الضغطة دي بتنقلكم على طول لصفحة الدفع على ${label}، وأول ما الدفع ينجح الحجز بيتأكد لوحده، وتوصلكم رسالة التأكيد على واتساب على ${mobile($('#co-phone').value)}.`,
    );
  }));

  // The picture of the transfer: an image, not too large, shown back before it is sent.
  const proof = $('#co-proof');
  const preview = $('[data-proof-preview]');
  proof.addEventListener('change', () => {
    const file = proof.files[0];
    say('pay', '');
    const old = preview.querySelector('img');
    if (old) { URL.revokeObjectURL(old.src); old.remove(); }
    preview.hidden = true;
    if (!file) return;
    if (!file.type.startsWith('image/')) { say('pay', 'ارفعوا صورة (سكرين شوت التحويل).'); proof.value = ''; return; }
    if (file.size > MAX_PROOF) { say('pay', 'الصورة كبيرة زيادة: ارفعوا سكرين شوت أصغر من 8 ميجا.'); proof.value = ''; return; }
    const picture = Object.assign(document.createElement('img'), { src: URL.createObjectURL(file), alt: 'صورة التحويل اللي اخترتوها' });
    preview.append(picture);
    preview.hidden = false;
    $('[data-proof-label]').textContent = 'غيّروا الصورة';
  });
  $('[data-send-proof]').addEventListener('click', () => {
    if (!proof.files[0]) { say('pay', 'ارفعوا صورة التحويل الأول.'); proof.focus(); return; }
    finish(
      'استلام صورة التحويل',
      `في الموقع الحقيقي: على طول بتوصلكم رسالة على واتساب على ${mobile($('#co-phone').value)} إن صورة التحويل وصلت، والميعاد بيفضل محجوز لكم. وأول ما المكان يتأكد إن التحويل وصل، بتوصلكم رسالة تأكيد الحجز.`,
    );
  });

  // Closing keeps what was typed, so a visitor who looks back at the times does not start again.
  sheet.addEventListener('close', () => {
    if ($('[data-step="done"]').hidden) return;
    all('input[name="method"]').forEach((input) => { input.checked = false; });
    instapay.hidden = true;
  });
})();
