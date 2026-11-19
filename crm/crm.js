// The CRM prototype: the staff panel's customer side, on demo data (crm/demo.js). Every screen reads the same people
// and trips, and what staff do here (a team arrives, the rest is paid, the Game Master logs a trip) changes them for
// the visit, so the screens can be tried, not only looked at. Nothing is saved or sent: the real panel will call the
// engine (app/db) for every one of these acts, and the engine checks the role again (docs/plan.md, section 7).
(() => {
  const D = window.EH13_CRM;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const money = (n) => `${fmt(n)} ج`;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const pad = (n) => String(n).padStart(2, '0');

  // ------------------------------------------------------------------------------------------------------------------
  // Dates and times, in the way the desk says them
  // ------------------------------------------------------------------------------------------------------------------
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const DAYS = ['الحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysFrom = (s) => Math.round((parse(D.TODAY) - parse(s)) / 864e5);
  const dateAr = (s, day = false) => { const d = parse(s); return `${day ? DAYS[d.getDay()] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const nDays = (n) => (n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? `${n} أيام` : `${n} يوم`);
  const nMonths = (n) => (n === 1 ? 'شهر' : n === 2 ? 'شهرين' : n <= 10 ? `${n} شهور` : `${n} شهر`);
  const ago = (s) => {
    if (!s) return '—';
    const n = daysFrom(s);
    if (n === 0) return 'النهارده';
    if (n === 1) return 'امبارح';
    if (n === -1) return 'بكرة';
    if (n < 0) return `بعد ${nDays(-n)}`;
    if (n < 30) return `من ${nDays(n)}`;
    return `من ${nMonths(Math.round(n / 30))}`;
  };
  const t12 = (t) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'م' : 'ص'}`; };
  const clockAr = (min) => t12(`${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`);

  // ------------------------------------------------------------------------------------------------------------------
  // Who can do what. The owner's word, 2026-11-18: the owner and the CEO see and do everything (only the owner removes
  // an account); the marketer and the media buyer read every insight and run everything about ads: campaigns, promo
  // codes and the ad audiences, without the customers' personal files; the reception books and works the door
  // (arrivals, the rest of the money, the waiver link, the drawer); the Game Master sees the day and logs the trips.
  // ------------------------------------------------------------------------------------------------------------------
  const ALL = ['owner', 'manager', 'marketer', 'media_buyer', 'front_desk', 'game_master'];
  const INSIGHT = ['owner', 'manager', 'marketer', 'media_buyer'];
  const SEE = {
    today: ALL,
    customers: ['owner', 'manager'],
    games: ['owner', 'manager', 'game_master'],
    campaigns: INSIGHT,
    feedback: INSIGHT,
    loyalty: INSIGHT,
    codes: INSIGHT,
    shift: ['owner', 'manager', 'front_desk'],
    inbox: ['owner', 'manager', 'front_desk'],
    numbers: INSIGHT,
    team: ['owner', 'manager'],
  };
  const DO = {
    money: ['owner', 'manager', 'front_desk'],
    checkIn: ['owner', 'manager', 'front_desk', 'game_master'],
    collect: ['owner', 'manager', 'front_desk'],
    book: ['owner', 'manager', 'front_desk'],
    bookFree: ['owner', 'manager'],
    log: ['owner', 'manager', 'game_master'],
    editCustomer: ['owner', 'manager'],
    export: INSIGHT,
    follow: ['owner', 'manager'],
    makeCode: INSIGHT,
    sellGift: ['owner', 'manager'],
    names: ['owner', 'manager', 'front_desk', 'game_master'],
    removeAccount: ['owner'],
  };
  const ROLE_NAME = { owner: 'الأونر', manager: 'الـ CEO', marketer: 'الماركتير', media_buyer: 'الميديا باير', front_desk: 'الاستقبال', game_master: 'الـ Game Master' };
  // The signed-in account (crm/accounts.js). The owner can also look at the panel through any role's eyes.
  let account = null;
  let role = 'owner';
  const can = (act) => (DO[act] || SEE[act] || []).includes(role);
  const STAND_IN = { owner: 'الأونر', manager: 'الـ CEO', marketer: 'نادين ك.', media_buyer: 'عمر ط.', front_desk: 'منة ع.', game_master: 'كريم س.' };
  const me = () => (account && account.role === role ? account.name : STAND_IN[role]);
  const staffName = (id) => (D.STAFF.find((s) => s.id === id) || {}).name || me();

  // ------------------------------------------------------------------------------------------------------------------
  // People: tags and segments
  // ------------------------------------------------------------------------------------------------------------------
  const month = parse(D.TODAY).getMonth() + 1;
  const bdaySoon = (p) => {
    if (!p.birthday) return false;
    const t = parse(D.TODAY);
    for (let i = 0; i <= 14; i++) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
      if (d.getMonth() + 1 === p.birthday.m && d.getDate() === p.birthday.d) return true;
    }
    return false;
  };
  const isVip = (p) => p.spent >= 4500 || p.visitCount >= 3 || p.brought >= 15;
  const tagsOf = (p) => {
    const t = [];
    if (isVip(p)) t.push(['VIP', 'vip']);
    if (p.visitCount >= 2) t.push([p.visitCount === 2 ? 'زار مرتين' : `زار ${p.visitCount} مرات`, 'back']);
    if (p.visitCount === 0) t.push(['أول مرة', 'new']);
    if (bdaySoon(p)) t.push(['عيد ميلاده قرب', 'bday']);
    if (p.lastScore != null && p.lastScore <= 2) t.push(['زعلان آخر مرة', 'warn']);
    if (p.noShows) t.push(['ما جاش قبل كده', 'warn']);
    for (const x of p.tags) t.push([x, 'co']);
    return t;
  };
  // On the board, "first time" is left out: most teams are, so it says nothing there.
  const tagsHtml = (p, limit = 9, skip = []) => `<span class="tags">${tagsOf(p).filter(([, k]) => !skip.includes(k)).slice(0, limit).map(([n, k]) => `<span class="tag tag--${k}">${esc(n)}</span>`).join('')}</span>`;
  const SEGMENTS = [
    { key: 'all', name: 'الكل', test: () => true },
    { key: 'back', name: 'رجعوا تاني', test: (p) => p.visitCount >= 2 },
    { key: 'vip', name: 'VIP', test: isVip },
    { key: 'one', name: 'لعبوا بيت واحد', test: (p) => p.houses.size === 1 },
    { key: 'two', name: 'فاضلهم بيت', test: (p) => p.houses.size === 2 },
    { key: 'three', name: 'كمّلوا التلاتة', test: (p) => p.houses.size === 3 },
    { key: 'lost', name: 'ما جوش من 90 يوم', test: (p) => p.lastVisit && daysFrom(p.lastVisit) >= 90 },
    { key: 'bday', name: 'عيد ميلادهم الشهر ده', test: (p) => p.birthday && p.birthday.m === month },
    { key: 'upset', name: 'زعلانين', test: (p) => p.lastScore != null && p.lastScore <= 2 },
    { key: 'co', name: 'شركات', test: (p) => p.tags.includes('شركة') },
    { key: 'upcoming', name: 'جايين قريب', test: (p) => !!p.upcoming },
  ];
  const SEG = Object.fromEntries(SEGMENTS.map((s) => [s.key, s]));
  const known = () => D.people.filter((p) => p.visitCount > 0 || p.booked.length > 0);
  const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join(' ');
  const houseDots = (p) => `<span class="houses3" aria-label="${p.houses.size} من 3 بيوت">${D.HOUSES.map((h) => `<span class="house-dot house-dot--${p.houses.has(h.slug) ? h.slug : 'off'}" title="${esc(h.short)}"></span>`).join('')}</span>`;
  const STATUS = { confirmed: 'متأكد', awaiting: 'مستني مراجعة التحويل', arrived: 'وصلوا', playing: 'جوه دلوقتي', completed: 'خلصت', no_show: 'ما جوش', cancelled: 'اتلغى' };
  const badge = (s) => `<span class="badge badge--${s}">${STATUS[s]}</span>`;
  const signed = (b) => b.players.filter((x) => x.signed).length;

  // ------------------------------------------------------------------------------------------------------------------
  // Icons
  // ------------------------------------------------------------------------------------------------------------------
  const I = {
    today: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
    customers: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 3 3 6"/></svg>',
    games: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
    campaigns: '<svg viewBox="0 0 24 24"><path d="M4 10v4h3l6 4V6L7 10H4z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg>',
    feedback: '<svg viewBox="0 0 24 24"><path d="m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16l-5 2.9 1.2-5.5L4 9.6 9.6 9z"/></svg>',
    loyalty: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="8" cy="12.5" r="1.6"/><circle cx="12" cy="12.5" r="1.6"/><circle cx="16" cy="12.5" r="1.6"/></svg>',
    codes: '<svg viewBox="0 0 24 24"><path d="M20 12v8H4v-8M2 8h20v4H2zM12 20V8M12 8H8a2 2 0 1 1 2-3l2 3 2-3a2 2 0 1 1 2 3h-4"/></svg>',
    shift: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="2.5"/><path d="M6 7V5h12v2"/></svg>',
    inbox: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    numbers: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
    msg: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/></svg>',
    door: '<svg viewBox="0 0 24 24"><path d="M5 21V4h11v17M16 21h3M12 12h.01"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16l-5 2.9 1.2-5.5L4 9.6 9.6 9z"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 9h6M9 13h6"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 4 2 20h20L12 4zM12 10v4M12 17h.01"/></svg>',
    cake: '<svg viewBox="0 0 24 24"><path d="M4 21h16v-8H4zM4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0M12 13V9M12 6v.01"/></svg>',
    crown: '<svg viewBox="0 0 24 24"><path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/></svg>',
    team: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  };
  const NAV = [
    { key: 'today', name: 'النهارده', tab: true },
    { key: 'customers', name: 'العملاء', tab: true },
    { key: 'games', name: 'سجل الرحلات', tab: true },
    { key: 'shift', name: 'الوردية والخزنة', tab: true },
    { sep: true },
    { key: 'campaigns', name: 'الرسايل والحملات' },
    { key: 'feedback', name: 'الآراء والتقييمات' },
    { key: 'loyalty', name: 'بيت ورا بيت' },
    { key: 'codes', name: 'الكروت والأكواد' },
    { key: 'inbox', name: 'واتساب', soon: 'شكل بس' },
    { sep: true },
    { key: 'team', name: 'الحسابات' },
    { key: 'numbers', name: 'لوحة الأرقام', href: '../dashboard/' },
  ];

  // ------------------------------------------------------------------------------------------------------------------
  // The shell: nav, role, drawer, sheet, toast, find
  // ------------------------------------------------------------------------------------------------------------------
  const view = $('[data-view]');
  const side = $('[data-side]');
  const scrim = $('[data-scrim]');
  const menu = $('[data-menu]');
  const toastEl = $('[data-toast]');
  let toastTimer = 0;
  const toast = (text) => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  };
  const drawer = (open) => {
    side.classList.toggle('is-open', open);
    scrim.hidden = !open;
    menu.setAttribute('aria-expanded', String(open));
  };
  menu.addEventListener('click', () => drawer(!side.classList.contains('is-open')));
  scrim.addEventListener('click', () => drawer(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && side.classList.contains('is-open')) drawer(false); });

  const counts = () => ({
    today: D.bookings.filter((b) => b.k === 0 && (b.status === 'awaiting' || (b.status === 'completed' && !b.gm))).length,
    feedback: D.bookings.filter((b) => b.feedback && b.feedback.follow && b.feedback.follow.status === 'open').length,
  });
  const navLinks = (current) => {
    const c = counts();
    const items = NAV.filter((n) => n.sep || SEE[n.key].includes(role));
    $('[data-nav]').innerHTML = items.map((n) => {
      if (n.sep) return '<div class="nav__sep" role="separator"></div>';
      const extra = n.soon ? `<span class="tag-soon">${n.soon}</span>` : c[n.key] && (n.key !== 'feedback' || can('follow')) ? `<span class="count num">${c[n.key]}</span>` : '';
      return `<a href="${n.href || '#/' + n.key}"${n.key === current ? ' aria-current="page"' : ''}>${I[n.key]}<span>${n.name}</span>${extra}</a>`;
    }).join('').replace(/^(<div class="nav__sep"[^>]*><\/div>)+|(<div class="nav__sep"[^>]*><\/div>)+$/g, '');
    const tabs = items.filter((n) => n.tab).slice(0, 4);
    $('[data-tabs]').innerHTML = tabs.map((n) => `<a href="#/${n.key}"${n.key === current ? ' aria-current="page"' : ''}>${I[n.key]}<span>${n.name.split(' ')[0] === 'سجل' ? 'الرحلات' : n.name.split(' ')[0]}</span></a>`).join('')
      + `<a href="#" data-more>${I.more}<span>المزيد</span></a>`;
    $('[data-more]').addEventListener('click', (e) => { e.preventDefault(); drawer(true); });
  };
  const roleSelect = $('[data-role]');
  roleSelect.innerHTML = ALL.map((r) => `<option value="${r}">${ROLE_NAME[r]}</option>`).join('');
  roleSelect.addEventListener('change', () => {
    role = roleSelect.value;
    try { sessionStorage.setItem('eh13-crm-role', role); } catch { /* fine */ }
    drawer(false);
    route();
    toast(role === 'owner' ? 'رجعت لحسابك.' : `دلوقتي بتشوف اللوحة بعين ${ROLE_NAME[role]}، زي ما هيشوفها بالظبط.`);
  });

  const sheet = $('[data-sheet]');
  const sheetForm = $('[data-sheet-form]');
  let sheetSubmit = null;
  const openSheet = ({ title, body, foot = '', onOpen, onSubmit }) => {
    $('[data-sheet-title]').textContent = title;
    // A fresh body each time, so no listener of an earlier sheet stays on it.
    const old = $('[data-sheet-body]');
    const fresh = old.cloneNode(false);
    old.replaceWith(fresh);
    fresh.innerHTML = body;
    $('[data-sheet-foot]').innerHTML = foot;
    sheetSubmit = onSubmit || null;
    sheet.showModal();
    if (onOpen) onOpen($('[data-sheet-body]'));
  };
  sheetForm.addEventListener('submit', (e) => {
    const by = e.submitter;
    if (by && by.value === 'cancel') return;
    if (sheetSubmit) {
      e.preventDefault();
      const ok = sheetSubmit(new FormData(sheetForm), sheetForm);
      if (ok !== false) sheet.close();
    }
  });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
  // A stepper: − and + around a number, its value in a hidden input of the same name.
  const stepper = (name, value, min, max, label) => `
    <div class="field"><span>${label}</span>
      <div class="stepper" data-stepper data-min="${min}" data-max="${max}">
        <button type="button" data-step="-1" aria-label="أقل">−</button>
        <output class="num">${value}</output>
        <button type="button" data-step="1" aria-label="أكتر">+</button>
        <input type="hidden" name="${name}" value="${value}">
      </div></div>`;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const box = b.closest('[data-stepper]');
    const input = $('input', box);
    const next = Math.max(+box.dataset.min, Math.min(+box.dataset.max, +input.value + +b.dataset.step));
    input.value = next;
    $('output', box).textContent = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Find: a person by name or number, or a booking by its code.
  const find = $('[data-find]');
  const findList = $('[data-find-list]');
  const people = () => D.people.filter((p) => p.visitCount > 0 || p.booked.length > 0);
  find.addEventListener('submit', (e) => { e.preventDefault(); const a = $('a', findList); if (a) a.click(); });
  find.q.addEventListener('input', () => {
    const q = find.q.value.trim();
    if (q.length < 2) { findList.hidden = true; return; }
    const digits = q.replace(/\D/g, '');
    const code = q.toUpperCase().replace(/^EH-?/, '');
    const hits = [];
    if (/^[A-Z0-9]{3,5}$/.test(code)) {
      for (const b of D.bookings) if (b.code.slice(3).startsWith(code)) hits.push(['b', b]);
    }
    for (const p of people()) {
      if (hits.length >= 8) break;
      if (p.name.includes(q) || (digits.length >= 2 && p.phone.replace(/\D/g, '').includes(digits))) hits.push(['p', p]);
    }
    findList.innerHTML = hits.length ? hits.slice(0, 8).map(([k, x]) => {
      if (k === 'b') {
        const p = D.byId(x.booker);
        return `<a href="#/customer/${p.id}"><span class="house-dot house-dot--${x.house}"></span><span><b class="ltr">${x.code}</b> · ${esc(p.name)}<br><span class="muted small">${D.HOUSE[x.house].short} · ${dateAr(x.date)} · ${t12(x.time)}</span></span></a>`;
      }
      return `<a href="#/customer/${x.id}"><span class="avatar">${esc(initials(x.name))}</span><span>${esc(x.name)}<br><span class="muted small ltr">${x.phone}</span> <span class="muted small">· ${x.visitCount} زيارة</span></span></a>`;
    }).join('') : '<p class="find__empty">مفيش حد بالاسم أو الرقم ده.</p>';
    findList.hidden = false;
  });
  findList.addEventListener('click', () => { findList.hidden = true; find.q.value = ''; });
  document.addEventListener('click', (e) => { if (!find.contains(e.target)) findList.hidden = true; });

  // ------------------------------------------------------------------------------------------------------------------
  // Today: the shift's board
  // ------------------------------------------------------------------------------------------------------------------
  const todays = () => D.bookings.filter((b) => b.k === 0);
  const due = (b) => (['cancelled', 'no_show', 'completed'].includes(b.status) ? 0 : Math.max(0, b.rest - b.restPaid));

  function viewToday() {
    const list = todays();
    const live = list.filter((b) => !['cancelled', 'no_show'].includes(b.status));
    const players = live.reduce((s, b) => s + b.size, 0);
    const sign = live.reduce((s, b) => s + signed(b), 0);
    const left = live.reduce((s, b) => s + due(b), 0);
    const took = list.reduce((s, b) => s + b.restPaid + b.drinksPaid, 0);
    const done = list.filter((b) => b.status === 'completed').length;

    // What the desk should know, the most pressing first: money waiting, logs waiting, a guest who was unhappy, the
    // regulars, the birthdays, and the teams that have not signed, gathered into one line.
    const alerts = [];
    const add = (rank, icon, text, act = '') => alerts.push({ rank, icon, text, act });
    const unsigned = [];
    for (const b of live.slice().sort((a, b2) => a.start - b2.start)) {
      const p = D.byId(b.booker);
      const at = `${D.HOUSE[b.house].short} ${t12(b.time)}`;
      const who = !can('names') ? 'فريق' : SEE.customers.includes(role) ? `<a href="#/customer/${p.id}">${esc(p.name)}</a>` : `<b>${esc(p.name)}</b>`;
      if (b.status === 'awaiting') add(0, I.alert, `${who} بعت صورة تحويل InstaPay لحجز ${at}: محتاج حد يتأكد إن الفلوس وصلت.`, can('collect') ? `<button class="btn btn--small" data-act="transfer" data-id="${b.id}">راجع التحويل</button>` : '');
      if (b.status === 'completed' && !b.gm) add(1, I.pen, `رحلة ${at} خلصت ومستنية الـ Game Master يسجّلها.`, can('log') ? `<button class="btn btn--small" data-act="log" data-id="${b.id}">سجّل</button>` : '');
      if (b.status === 'completed' || b.status === 'playing') continue;
      if (p.lastScore != null && p.lastScore <= 2) add(2, I.alert, `${who} جاي ${at}، وآخر مرة إدّى ${p.lastScore} من 5. حد من الإدارة يرحب بيه بنفسه.`);
      if (isVip(p)) add(3, I.crown, `${who} جاي ${at}: VIP، زار ${p.visitCount} مرات${can('money') ? ` وصرف ${money(p.spent)}` : ''}.`);
      else if (p.visitCount >= 1) add(4, I.star, `${who} جاي ${at}: راجع تاني، لعب قبل كده ${[...p.houses].map((h) => D.HOUSE[h].short).join(' و')}.`);
      if (b.birthday) add(5, I.cake, `حجز ${at} فيه عيد ميلاد: جهزوا المفاجأة.`);
      if (b.start - D.CLOCK <= 120 && signed(b) < b.size) unsigned.push(b);
    }
    if (unsigned.length) add(6, I.note, `${unsigned.length === 1 ? 'فريق' : `${unsigned.length} فرق`} في الساعتين الجايين ناقصهم إقرارات: ${unsigned.map((b) => `${D.HOUSE[b.house].short} ${t12(b.time)} (${signed(b)} من ${b.size})`).join('، ')}. لينك كل فريق جنب ميعاده تحت.`);
    alerts.sort((a, b) => a.rank - b.rank);

    const lanes = D.HOUSES.map((h) => {
      const rows = h.starts.map((time, slot) => {
        const b = list.find((x) => x.house === h.slug && x.slot === slot && x.status !== 'cancelled');
        const start = D.minutes(time);
        if (!b) {
          const gone = start <= D.CLOCK;
          return `<div class="trip trip--free${gone ? ' trip--past' : ''}"><div class="trip__time">${t12(time)}</div><div class="split"><span>فاضي</span>${!gone && can('book') ? `<button class="btn btn--small btn--ghost" data-act="book" data-house="${h.slug}" data-slot="${slot}">+ حجز يدوي</button>` : ''}</div></div>`;
        }
        return tripCard(b);
      }).join('');
      const n = list.filter((x) => x.house === h.slug && x.status !== 'cancelled').length;
      return `<section class="lane lane--${h.slug}"><header class="lane__head"><span class="house-dot house-dot--${h.slug}"></span><h2>${h.name}</h2><span class="note num">${n} من ${h.starts.length} محجوز</span></header>${rows}</section>`;
    }).join('');

    return {
      title: 'النهارده',
      sub: `${dateAr(D.TODAY, true)} · الساعة ${clockAr(D.CLOCK)}`,
      html: `<div class="stack">
        <div class="kpis">
          ${kpi('رحلات النهارده', `${live.length}`, `<b>${done}</b> خلصت · <b>${live.filter((b) => b.status === 'playing').length}</b> جوه دلوقتي`)}
          ${kpi('لاعبين جايين', fmt(players), `${fmt(live.filter((b) => b.status !== 'completed').reduce((s, b) => s + b.size, 0))} لسه ما خلصوش`)}
          ${kpi('مضوا الإقرار', `${pct(sign, players)}%`, `<b>${sign}</b> من ${players} لاعب`)}
          ${can('money') ? kpi('الباقي يتحصّل', money(left), 'بعد العربون، في المكان') + kpi('اتحصّل النهارده', money(took), 'الباقي والمشروبات') : ''}
        </div>
        ${alerts.length ? `<section class="card"><div class="card__head"><h2>خلّي بالك</h2><p class="note">من ملفات العملاء وحالة الحجوزات</p></div><div class="alerts">${alerts.slice(0, 8).map(({ icon, text, act }) => `<div class="alert"><span class="alert__icon">${icon}</span><div style="flex:1">${text}</div>${act}</div>`).join('')}</div></section>` : ''}
        <div class="board">${lanes}</div>
      </div>`,
    };
  }

  function tripCard(b) {
    const p = D.byId(b.booker);
    const now = b.status === 'playing';
    const past = ['completed', 'no_show'].includes(b.status);
    const s = signed(b);
    const left = due(b);
    const acts = [];
    if (b.status === 'confirmed' && can('checkIn')) acts.push(`<button class="btn btn--small" data-act="arrive" data-id="${b.id}">وصلوا</button>`);
    if (b.status === 'arrived' && can('checkIn')) acts.push(`<button class="btn btn--small" data-act="start" data-id="${b.id}">دخلوا البيت</button>`);
    if (['confirmed', 'arrived', 'playing'].includes(b.status) && left && can('collect')) acts.push(`<button class="btn btn--small ${b.status === 'confirmed' ? 'btn--ghost' : ''}" data-act="collect" data-id="${b.id}">حصّل ${money(left)}</button>`);
    if (b.status === 'playing' && can('log')) acts.push(`<button class="btn btn--small btn--ghost" data-act="log" data-id="${b.id}">خلصت: سجّل</button>`);
    if (b.status === 'completed' && !b.gm && can('log')) acts.push(`<button class="btn btn--small" data-act="log" data-id="${b.id}">سجّل الرحلة</button>`);
    if (b.status === 'awaiting' && can('collect')) acts.push(`<button class="btn btn--small" data-act="transfer" data-id="${b.id}">راجع التحويل</button>`);
    const result = b.gm ? `<span>${b.gm.escaped ? `هربوا في <b class="num">${b.gm.minutes}</b> دقيقة` : 'ما هربوش'} · <b class="num">${b.gm.hints}</b> hint</span>` : '';
    const name = !can('names') ? `<span class="trip__name">فريق ${b.size}</span>` : SEE.customers.includes(role) ? `<a class="trip__name" href="#/customer/${p.id}">${esc(p.name)}</a>` : `<span class="trip__name">${esc(p.name)}</span>`;
    return `<article class="trip${now ? ' trip--now' : ''}${past ? ' trip--past' : ''}">
      <div class="trip__time">${t12(b.time)}<small class="ltr">${b.code}</small></div>
      <div class="trip__body">
        <div class="trip__top">${name}${badge(b.status)}${can('names') ? tagsHtml(p, 3, ['new']) : ''}${b.birthday ? '<span class="tag tag--bday">عيد ميلاد</span>' : ''}</div>
        <div class="trip__facts"><span><b class="num">${b.size}</b> لاعبين</span><span>${D.SOURCES[b.source]}</span>${can('money') && left ? `<span>الباقي <b class="num">${money(left)}</b></span>` : ''}${result}</div>
        ${['completed', 'no_show'].includes(b.status) ? '' : `<div class="meter${s < b.size ? ' meter--low' : ''}"><span>الإقرار</span><span class="meter__bar"><i style="width:${pct(s, b.size)}%"></i></span><span class="num">${s}/${b.size}</span>${s < b.size && can('book') ? `<button class="link" type="button" data-act="waiver" data-id="${b.id}">انسخ اللينك</button>` : ''}</div>`}
        ${acts.length ? `<div class="trip__acts">${acts.join('')}</div>` : ''}
      </div></article>`;
  }

  const kpi = (label, value, hint = '') => `<div class="kpi"><p class="kpi__label">${label}</p><p class="kpi__value">${value}</p>${hint ? `<p class="kpi__hint">${hint}</p>` : ''}</div>`;

  // The acts on a trip, wherever its button is.
  view.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const b = btn.dataset.id ? D.booking(+btn.dataset.id) : null;
    const act = btn.dataset.act;
    if (act === 'arrive') { b.status = 'arrived'; toast(`فريق ${D.byId(b.booker).name} وصل. اتسجل باسم ${me()}.`); route(); }
    else if (act === 'start') { b.status = 'playing'; toast('الفريق دخل، والوقت بدأ يتحسب.'); route(); }
    else if (act === 'collect') collectSheet(b);
    else if (act === 'log') logSheet(b);
    else if (act === 'waiver') waiverLink(b);
    else if (act === 'transfer') transferSheet(b);
    else if (act === 'book') bookSheet(btn.dataset.house, +btn.dataset.slot);
    else if (act === 'follow') { b.feedback.follow = { status: 'closed', by: me() }; toast('اتقفلت: اتسجل إنك كلمته.'); route(); }
  });

  function waiverLink(b) {
    const url = new URL(`waiver.html?b=${b.code}`, location.href).href;
    const done = () => toast('اتنسخ لينك الإقرار: ابعته للي حجز يوزعه على الفريق.');
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url));
    else toast(url);
  }

  function collectSheet(b) {
    const left = due(b);
    openSheet({
      title: `تحصيل: ${D.byId(b.booker).name}`,
      body: `<dl class="sum">
          <dt>${b.size} لاعبين × ${money(b.per)}${b.birthday ? ' + عيد ميلاد' : ''}</dt><dd>${money(b.price)}</dd>
          ${b.discount ? `<dt>خصم ${esc(b.promo)}</dt><dd>− ${money(b.discount)}</dd>` : ''}
          <dt>العربون (${D.METHODS[b.depositMethod]})</dt><dd>− ${money(b.deposit)}</dd>
          <dt class="total">الباقي</dt><dd class="total" data-total>${money(left)}</dd>
        </dl>
        ${stepper('drinks', 0, 0, 30, `مشروبات (${money(D.DRINK)} للواحد، سعر تجريبي)`)}
        <div class="field"><span>اتدفع إزاي؟</span>
          <div class="seg" role="radiogroup">${[['cash', 'كاش'], ['wallet', 'محفظة'], ['instapay', 'InstaPay'], ['gift', 'كارت هدية']].map(([v, n], i) => `<label><input type="radio" name="method" value="${v}"${i === 0 ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div>
        </div>
        <label class="field" data-gift hidden><span>كود الكارت</span><input class="input ltr" name="gift" placeholder="GC-XXXX-XXXX" autocomplete="off"></label>
        <p class="note">بيتسجل باسم ${me()} والساعة، ويدخل في تقفيل الخزنة آخر الوردية.</p>`,
      foot: `<button class="btn" value="ok">اتحصّل <span data-pay>${money(left)}</span></button><button class="btn btn--ghost" value="cancel" formnovalidate>رجوع</button>`,
      onOpen: (body) => {
        body.addEventListener('input', () => {
          const total = left + (+body.querySelector('[name=drinks]').value) * D.DRINK;
          $('[data-total]', body).textContent = money(total);
          $('[data-pay]').textContent = money(total);
          $('[data-gift]', body).hidden = sheetForm.method.value !== 'gift';
        });
      },
      onSubmit: (f) => {
        b.restPaid = b.rest;
        b.restMethod = f.get('method');
        b.drinks += +f.get('drinks');
        b.drinksPaid += +f.get('drinks') * D.DRINK;
        b.collectedBy = null;
        b.collectedByName = me();
        toast(`اتحصّل ${money(left + +f.get('drinks') * D.DRINK)} ${D.METHODS[b.restMethod]}.`);
        route();
      },
    });
  }

  function logSheet(b) {
    const h = D.HOUSE[b.house];
    const photoOk = b.players.filter((x) => x.signed && x.id && D.byId(x.id).photo).length;
    openSheet({
      title: `سجل الرحلة: ${h.short} ${t12(b.time)}`,
      body: `<div class="field"><span>هربوا؟</span>
          <div class="seg" role="radiogroup"><label><input type="radio" name="escaped" value="1"><span>أيوه، هربوا</span></label><label><input type="radio" name="escaped" value="0" checked><span>لأ، الوقت خلص</span></label></div></div>
        <div data-mins hidden>${stepper('minutes', 80, 30, 89, 'خلصوا في كام دقيقة؟')}</div>
        ${stepper('hints', 3, 0, 15, 'خدوا كام hint؟')}
        <label class="check"><input type="checkbox" name="left"><span>حد طلب يخرج قبل الآخر (خاف أو تعب)</span></label>
        <label class="field"><span>حصل حاجة؟ (عطل، حاجة اتكسرت، تصرف غلط)</span><textarea name="incident" placeholder="اكتب اللي حصل، ولو مفيش سيبها فاضية"></textarea><small>أي حاجة هنا بتوصل للمدير، وبتظهر في ملف العميل.</small></label>
        <label class="field"><span>صورة الفريق</span><input class="input" type="file" name="photo" accept="image/*" capture="environment"><small>${photoOk} من ${signed(b)} وافقوا على التصوير في الإقرار: الصورة بتتبعت للي وافق بس.</small></label>`,
      foot: '<button class="btn" value="ok">احفظ السجل</button><button class="btn btn--ghost" value="cancel" formnovalidate>رجوع</button>',
      onOpen: (body) => body.addEventListener('change', () => { $('[data-mins]', body).hidden = sheetForm.escaped.value !== '1'; }),
      onSubmit: (f) => {
        const escaped = f.get('escaped') === '1';
        b.status = 'completed';
        b.gm = { by: null, byName: me(), escaped, minutes: escaped ? +f.get('minutes') : 90, hints: +f.get('hints'), left: f.get('left') ? 1 : 0, incident: String(f.get('incident') || '').trim(), photo: !!(f.get('photo') && f.get('photo').size) };
        toast(escaped ? `اتسجل: هربوا في ${b.gm.minutes} دقيقة.` : 'اتسجل: ما هربوش. رسالة «إزاي كانت الرحلة؟» هتتبعت بعد ساعتين.');
        route();
      },
    });
  }

  function transferSheet(b) {
    const p = D.byId(b.booker);
    openSheet({
      title: `تحويل InstaPay: ${p.name}`,
      body: `<div class="card" style="aspect-ratio:3/4;display:grid;place-items:center;text-align:center;background:var(--well)"><p class="muted">هنا صورة التحويل اللي العميل بعتها<br><span class="small">(قرار T32: الصورة لوحدها ما بتأكدش الحجز)</span></p></div>
        <dl class="facts"><dt>الحجز</dt><dd>${D.HOUSE[b.house].short} · ${dateAr(b.date)} · ${t12(b.time)}</dd><dt>الكود</dt><dd class="ltr">${b.code}</dd><dt>المفروض يوصل</dt><dd>${money(D.DEPOSIT)}</dd></dl>
        <p class="note">افتح تطبيق البنك، ودوّر على تحويل بنفس المبلغ والكود. لو لقيته أكّد، ولو مش موجود سيب الحجز يروح.</p>`,
      foot: '<button class="btn" value="ok">الفلوس وصلت: أكّد الحجز</button><button class="btn btn--ghost" value="cancel" formnovalidate>لسه</button>',
      onSubmit: () => { b.status = 'confirmed'; b.deposit = D.DEPOSIT; b.depositMethod = 'instapay'; toast('الحجز اتأكد. (لما اللوحة تتربط: رسالة التأكيد بتروح على الواتساب لوحدها)'); route(); },
    });
  }

  function bookSheet(house, slot) {
    const h = D.HOUSE[house];
    openSheet({
      title: `حجز يدوي: ${h.short} ${t12(h.starts[slot])}`,
      body: `<label class="field"><span>الاسم</span><input class="input" name="name" required minlength="2" autocomplete="off"></label>
        <label class="field"><span>رقم الواتساب</span><input class="input ltr" name="phone" required inputmode="tel" pattern="01[0125][0-9]{8}" placeholder="01xxxxxxxxx" autocomplete="off"><small>لو الرقم عندنا، الحجز بيتضاف على ملفه.</small></label>
        ${stepper('size', 5, 3, h.max, `عدد الفريق (من 3 لـ ${h.max})`)}
        <label class="field"><span>ساكنين فين؟ (اختياري)</span><select name="area"><option value="">—</option>${D.AREAS.map((a) => `<option>${esc(a)}</option>`).join('')}</select></label>
        <div class="field"><span>العربون (${money(D.DEPOSIT)})</span>
          <div class="seg" role="radiogroup">${[['cash', 'كاش'], ['wallet', 'محفظة'], ['instapay', 'InstaPay']].map(([v, n], i) => `<label><input type="radio" name="dep" value="${v}"${i === 0 ? ' checked' : ''}><span>${n}</span></label>`).join('')}${can('bookFree') ? '<label><input type="radio" name="dep" value="none"><span>من غير</span></label>' : ''}</div>
          <small>${can('bookFree') ? 'من غير عربون: للأونرز والمدير بس، وبيبان «ما دفعش» (قرار B15).' : 'الاستقبال لازم ياخد العربون عشان الحجز يتحفظ (قرار B15).'}</small></div>`,
      foot: '<button class="btn" value="ok">احجز</button><button class="btn btn--ghost" value="cancel" formnovalidate>رجوع</button>',
      onSubmit: (f) => {
        const size = +f.get('size');
        const p = {
          id: D.people.length + 1, name: String(f.get('name')).trim(), phone: String(f.get('phone')).replace(/^(\d{3})\d{4}/, '$1••••'),
          area: f.get('area') || '', source: 'whatsapp', created: D.TODAY, age: null, birthday: null, marketing: false, photo: false,
          referral: 'R-NEW1', referredBy: null, referrals: 0, tags: [], notes: '', visits: [], booked: [], houses: new Set(),
          visitCount: 0, firstVisit: null, lastVisit: null, spent: 0, brought: 0, lastScore: null, upcoming: null, noShows: 0,
        };
        D.people.push(p);
        const per = D.perPerson(size);
        const dep = f.get('dep');
        const b = {
          id: D.bookings.length + 1, code: `EH-${Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[01IO]/g, '7')}`,
          date: D.TODAY, k: 0, dow: parse(D.TODAY).getDay(), house, slot, time: h.starts[slot], start: D.minutes(h.starts[slot]), size,
          channel: 'staff', source: 'whatsapp', status: 'confirmed', booker: p.id, players: [{ id: p.id, signed: false }, ...Array.from({ length: size - 1 }, () => ({ id: null, signed: false }))],
          birthday: false, promo: null, discount: 0, referral: null, price: per * size, per, deposit: dep === 'none' ? 0 : D.DEPOSIT, depositMethod: dep === 'none' ? 'cash' : dep,
          rest: per * size - (dep === 'none' ? 0 : D.DEPOSIT), restPaid: 0, restMethod: null, drinks: 0, drinksPaid: 0, gm: null, feedback: null, messages: [{ kind: 'confirm', day: 0 }],
        };
        D.bookings.push(b);
        p.booked.push(b.id);
        p.upcoming = b;
        toast(`اتحجز ${h.short} ${t12(b.time)} لـ ${p.name}${dep === 'none' ? '، من غير عربون' : ''}. (لما اللوحة تتربط: التأكيد بيروح على الواتساب لوحده)`);
        route();
      },
    });
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Customers: the list, the segments, the export
  // ------------------------------------------------------------------------------------------------------------------
  let custSeg = 'all';
  let custSort = 'last';
  let custShown = 50;
  function viewCustomers(params) {
    if (params.get('seg') && SEG[params.get('seg')]) custSeg = params.get('seg');
    const base = known();
    const seg = SEG[custSeg];
    const sorters = {
      last: (a, b) => (b.lastVisit || '0').localeCompare(a.lastVisit || '0') || b.visitCount - a.visitCount,
      spent: (a, b) => b.spent - a.spent,
      visits: (a, b) => b.visitCount - a.visitCount || b.spent - a.spent,
      brought: (a, b) => b.brought - a.brought,
    };
    const list = base.filter(seg.test).sort(sorters[custSort]);
    const consent = list.filter((p) => p.marketing).length;
    const rows = list.slice(0, custShown).map((p) => `
      <tr data-href="#/customer/${p.id}">
        <td class="main-cell"><a class="who" href="#/customer/${p.id}" style="text-decoration:none"><span class="avatar">${esc(initials(p.name))}</span><span><span class="who__name">${esc(p.name)}</span><br><span class="who__sub ltr">${p.phone}</span></span></a></td>
        <td data-label="زيارات" class="num">${p.visitCount}</td>
        <td data-label="البيوت">${houseDots(p)}</td>
        ${can('money') ? `<td data-label="صرف" class="num">${money(p.spent)}</td>` : ''}
        <td data-label="آخر زيارة">${p.upcoming ? `<span class="badge badge--confirmed">جاي ${ago(p.upcoming.date)}</span>` : ago(p.lastVisit)}</td>
        <td class="hide-sm">${tagsHtml(p, 3)}</td>
        <td data-label="جه منين" class="hide-sm muted small">${D.SOURCES[p.source]}</td>
      </tr>`).join('');
    return {
      title: 'العملاء',
      sub: `${fmt(base.length)} عميل في الملفات: اللي حجز، وكل لاعب مضى الإقرار`,
      html: `<div class="stack">
        <div class="scroll-x"><div class="chips" role="group" aria-label="الشرايح">${SEGMENTS.map((s) => `<button class="chip" type="button" data-seg="${s.key}" aria-pressed="${s.key === custSeg}">${s.name} <span class="n">${fmt(base.filter(s.test).length)}</span></button>`).join('')}</div></div>
        <section class="card">
          <div class="card__head">
            <h2>${seg.name} <span class="muted num">(${fmt(list.length)})</span></h2>
            <div class="tools">
              <label class="small muted">رتّب <select data-sort>${[['last', 'آخر زيارة'], ['spent', 'الأكتر صرفاً'], ['visits', 'الأكتر زيارات'], ['brought', 'جاب ناس أكتر']].map(([v, n]) => `<option value="${v}"${v === custSort ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
              ${can('export') ? `<button class="btn btn--small btn--ghost" type="button" data-export>صدّر للإعلانات (${fmt(consent)} وافقوا)</button>` : ''}
              ${can('campaigns') && custSeg !== 'all' ? `<a class="btn btn--small" href="#/campaigns?seg=${custSeg}">ابعتلهم رسالة</a>` : ''}
            </div>
          </div>
          ${list.length ? `<table class="table table--cards"><thead><tr><th>العميل</th><th>زيارات</th><th>البيوت</th>${can('money') ? '<th>صرف</th>' : ''}<th>آخر زيارة</th><th class="hide-sm">علامات</th><th class="hide-sm">جه منين</th></tr></thead><tbody>${rows}</tbody></table>` : (base.length ? '<p class="empty">مفيش حد في الشريحة دي دلوقتي.</p>' : '<p class="empty">لسه مفيش عملاء. أول ما حد يحجز من الموقع، أو يتعمل حجز يدوي، أو لاعب يمضي الإقرار، بيتعمل له ملف هنا لوحده.</p>')}
          ${list.length > custShown ? `<div class="more"><button class="btn btn--ghost" type="button" data-more-rows>اعرض ${Math.min(50, list.length - custShown)} كمان</button></div>` : ''}
        </section>
        <p class="note">التصدير للإعلانات (Custom Audiences) بياخد اللي وافقوا على رسايل العروض بس، والأرقام بتتعمل hash قبل ما تطلع (قرار T21). الـ CSV هنا تجريبي من غير أرقام.</p>
      </div>`,
      after: (el) => {
        $$('[data-seg]', el).forEach((b) => b.addEventListener('click', () => { custSeg = b.dataset.seg; custShown = 50; location.hash = '#/customers'; route(); }));
        $('[data-sort]', el).addEventListener('change', (e) => { custSort = e.target.value; route(); });
        const more = $('[data-more-rows]', el);
        if (more) more.addEventListener('click', () => { custShown += 50; route(); });
        $$('tr[data-href]', el).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
        const ex = $('[data-export]', el);
        if (ex) ex.addEventListener('click', () => exportAudience(list, custSeg));
      },
    };
  }

  // The ad audience (Meta and TikTok Custom Audiences): only those who agreed to offers. The real file carries the
  // numbers hashed (SHA-256), the way the platforms take them; this demo file carries no numbers at all.
  function exportAudience(list, segKey) {
    const ok = list.filter((p) => p.marketing);
    const lines = [['id', 'name', 'visits', 'houses', 'spent', 'last_visit', 'area'].join(',')]
      .concat(ok.map((p) => [p.id, `"${p.name}"`, p.visitCount, p.houses.size, p.spent, p.lastVisit || '', `"${p.area}"`].join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `eh13-audience-${segKey}-${D.TODAY}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`اتصدّر ${fmt(ok.length)} عميل وافقوا على العروض.`);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // One customer
  // ------------------------------------------------------------------------------------------------------------------
  function viewCustomer(id) {
    const p = D.byId(id);
    if (!p) return { title: 'العملاء', html: '<p class="empty">العميل ده مش موجود.</p>' };
    const own = new Set(p.booked);
    const trips = [...new Set([...p.booked, ...p.visits])].map(D.booking).sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
    const events = [];
    for (const b of trips) {
      const h = D.HOUSE[b.house];
      const mine = own.has(b.id);
      const booker = D.byId(b.booker);
      let what = mine ? `حجز ${h.name} لـ ${b.size} لاعبين` : `لعب ${h.name} مع فريق <a href="#/customer/${booker.id}">${esc(booker.name)}</a>`;
      const more = [];
      more.push(`${badge(b.status)} · ${t12(b.time)} · <span class="ltr">${b.code}</span>`);
      if (b.gm) more.push(`${b.gm.escaped ? `هربوا في ${b.gm.minutes} دقيقة` : 'ما هربوش'}، ${b.gm.hints} hint${b.gm.left ? '، وحد خرج قبل الآخر' : ''}`);
      if (b.gm && b.gm.incident) more.push(`<span style="color:var(--bad)">حصل: ${esc(b.gm.incident)}</span>`);
      if (mine && can('money') && b.status !== 'cancelled') more.push(`دفع ${money(b.deposit + b.restPaid + b.drinksPaid)}${b.promo ? ` بكود ${esc(b.promo)}` : ''}`);
      events.push({ date: b.date, start: b.start, icon: `<span class="house-dot house-dot--${b.house}"></span>`, what, more: more.join('<br>') });
      if (mine && b.feedback) {
        const f = b.feedback;
        events.push({ date: b.date, start: b.start + 300, icon: I.star, what: `قال رأيه: <span class="stars">${'★'.repeat(f.score)}${'☆'.repeat(5 - f.score)}</span>`, more: [f.comment ? `«${esc(f.comment)}»` : '', f.google ? (f.google.clicked ? 'اتطلب منه تقييم جوجل، وداس على اللينك' : 'اتطلب منه تقييم جوجل') : '', f.follow ? `المتابعة: ${f.follow.status === 'open' ? 'لسه محدش كلمه' : 'اتكلّم واتقفلت'}` : ''].filter(Boolean).join('<br>') });
      }
      if (mine) for (const m of b.messages) {
        const words = { confirm: 'رسالة تأكيد الحجز على الواتساب', reminder: 'تذكير قبل الرحلة بيوم، ومعاه لينك الإقرار', ask: 'رسالة «إزاي كانت الرحلة؟»' };
        const d = D.iso(D.dayAt(m.day));
        events.push({ date: d, start: m.kind === 'ask' ? b.start + 200 : 600, icon: I.msg, what: words[m.kind], more: '', quiet: true });
      }
    }
    events.sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
    const ref = D.people.filter((x) => x.referredBy === p.id);
    const by = p.referredBy ? D.byId(p.referredBy) : null;
    const scores = p.booked.map(D.booking).filter((b) => b.feedback).map((b) => b.feedback.score);
    const avg = scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : '—';
    const missing = D.HOUSES.filter((h) => !p.houses.has(h.slug));
    return {
      title: p.name,
      sub: `عميل من ${dateAr(p.created)} · ${D.SOURCES[p.source]}`,
      html: `<div class="stack">
        <section class="card"><div class="person">
          <span class="avatar avatar--big">${esc(initials(p.name))}</span>
          <div style="display:grid;gap:6px;min-width:0">
            <h2 class="person__name">${esc(p.name)}</h2>
            <p class="person__meta"><span class="ltr">${p.phone}</span>${p.area ? `<span>${esc(p.area)}</span>` : ''}${p.age ? `<span>${p.age} سنة</span>` : ''}${p.birthday ? `<span>عيد ميلاده ${p.birthday.d} ${MONTHS[p.birthday.m - 1]}</span>` : ''}</p>
            ${tagsHtml(p)}
          </div>
          <div class="person__acts">
            <a class="btn btn--ghost btn--small" href="#" data-wa>${I.msg} واتساب</a>
            ${can('book') ? '<a class="btn btn--small" href="#/today">+ حجز جديد</a>' : ''}
          </div>
        </div></section>
        <div class="kpis">
          ${kpi('زيارات', p.visitCount, p.lastVisit ? `آخرها ${ago(p.lastVisit)}` : 'لسه ما جاش')}
          ${kpi('حجوزات باسمه', p.booked.length, `${p.noShows ? `<b>${p.noShows}</b> ما جاش` : 'كلها اتحضرت'}`)}
          ${can('money') ? kpi('صرف', money(p.spent), 'عرابين وباقي ومشروبات') : ''}
          ${kpi('جاب معاه', `${p.brought}`, 'لاعب في حجوزاته')}
          ${kpi('تقييمه', avg, scores.length ? `من ${scores.length} رأي` : 'ما قالش رأيه لسه')}
        </div>
        <div class="profile">
          <section class="card"><div class="card__head"><h2>كل اللي حصل</h2><p class="note">الحجوزات، والرحلات، والرسايل، والآراء</p></div>
            ${events.length ? `<ol class="timeline">${events.map((e) => `<li><span class="timeline__dot">${e.icon}</span><div><p class="timeline__when">${dateAr(e.date)} · ${ago(e.date)}</p><p class="timeline__what"${e.quiet ? ' style="color:var(--muted);font-size:0.875rem"' : ''}>${e.what}</p>${e.more ? `<p class="timeline__more">${e.more}</p>` : ''}</div></li>`).join('')}</ol>` : '<p class="empty">لسه مفيش حاجة.</p>'}
          </section>
          <div class="stack">
            <section class="stamp-card">
              <div class="split"><h2 class="stamp-card__title">بيت ورا بيت</h2><span class="num muted">${p.houses.size} من 3</span></div>
              <div class="stamps">${D.HOUSES.map((h) => `<div class="stamp${p.houses.has(h.slug) ? ` stamp--on stamp--${h.slug}` : ''}">${h.short}</div>`).join('')}</div>
              <p class="small">${p.houses.size === 3 ? 'كمّل التلاتة: المكافأة مستنياه في الحجز الجاي.' : missing.length === 1 ? `فاضله ${missing[0].short} بس ويكمّل الكارت.` : `فاضله ${missing.map((h) => h.short).join(' و')}.`}</p>
            </section>
            <section class="card"><h2 style="margin-bottom:10px">الترشيح</h2>
              <dl class="facts"><dt>كوده</dt><dd class="ltr"><b>${p.referral}</b></dd><dt>رشّح</dt><dd>${ref.length ? ref.map((x) => `<a href="#/customer/${x.id}">${esc(x.name)}</a>`).join('، ') : 'لسه محدش'}</dd>${by ? `<dt>جه بترشيح</dt><dd><a href="#/customer/${by.id}">${esc(by.name)}</a></dd>` : ''}</dl>
            </section>
            <section class="card"><h2 style="margin-bottom:10px">الموافقات</h2>
              <dl class="facts"><dt>رسايل العروض</dt><dd>${p.marketing ? 'وافق' : '<span class="muted">ما وافقش: مش بيدخل في أي حملة</span>'}</dd><dt>التصوير</dt><dd>${p.photo ? 'وافق' : '<span class="muted">ما وافقش: صوره ما تتنشرش</span>'}</dd></dl>
              <p class="note" style="margin-top:8px">من الإقرار اللي مضاه، بتاريخه. لو طلب يتشال، بيتشال من هنا.</p>
            </section>
            <section class="card"><div class="card__head"><h2>ملاحظات الفريق</h2></div>
              ${can('editCustomer') ? `<textarea data-notes placeholder="اكتب ملاحظة تفيد اللي جاي (مثلاً: بيحب آخر الليل)">${esc(p.notes)}</textarea>
                <div class="split" style="margin-top:8px"><input class="input" data-newtag placeholder="علامة جديدة (مثلاً: شركة)" style="flex:1"><button class="btn btn--small btn--ghost" type="button" data-addtag>ضيف</button><button class="btn btn--small" type="button" data-save>احفظ</button></div>`
                : `<p>${p.notes ? esc(p.notes) : '<span class="muted">مفيش ملاحظات.</span>'}</p><p class="note" style="margin-top:6px">الملاحظات والعلامات بيعدّلها الأونرز والمدير بس.</p>`}
            </section>
          </div>
        </div>
      </div>`,
      after: (el) => {
        $('[data-wa]', el).addEventListener('click', (e) => { e.preventDefault(); toast('في النسخة الحقيقية: بيفتح المحادثة معاه على واتساب الموبايل.'); });
        const save = $('[data-save]', el);
        if (save) {
          save.addEventListener('click', () => { p.notes = $('[data-notes]', el).value.trim(); toast('اتحفظت الملاحظة، واتسجل مين كتبها.'); });
          $('[data-addtag]', el).addEventListener('click', () => {
            const t = $('[data-newtag]', el).value.trim();
            if (t && !p.tags.includes(t)) { p.tags.push(t); route(); toast(`اتضافت علامة «${t}».`); }
          });
        }
      },
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Trips: the Game Masters' log
  // ------------------------------------------------------------------------------------------------------------------
  let gamesSpan = 90;
  function viewGames() {
    const logged = D.bookings.filter((b) => b.gm && daysFrom(b.date) < gamesSpan && daysFrom(b.date) >= 0);
    const waiting = D.bookings.filter((b) => b.k === 0 && (b.status === 'playing' || (b.status === 'completed' && !b.gm)));
    const per = D.HOUSES.map((h) => {
      const g = logged.filter((b) => b.house === h.slug);
      const out = g.filter((b) => b.gm.escaped);
      return {
        h, games: g.length, rate: pct(out.length, g.length),
        mins: out.length ? Math.round(out.reduce((s, b) => s + b.gm.minutes, 0) / out.length) : null,
        hints: g.length ? (g.reduce((s, b) => s + b.gm.hints, 0) / g.length).toFixed(1) : '—',
        best: out.length ? Math.min(...out.map((b) => b.gm.minutes)) : null,
        left: g.filter((b) => b.gm.left).length,
      };
    });
    const sizes = [[3, 4], [5, 6], [7, 9], [10, 12]].map(([a, z]) => {
      const g = logged.filter((b) => b.size >= a && b.size <= z);
      return { name: `${a} لـ ${z} لاعبين`, rate: pct(g.filter((b) => b.gm.escaped).length, g.length), n: g.length };
    });
    const top = Math.max(...sizes.map((s) => s.rate), 1);
    const incidents = logged.filter((b) => b.gm.incident).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const recent = logged.slice().sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start).slice(0, 12);
    return {
      title: 'سجل الرحلات',
      sub: 'اللي الـ Game Master بيسجله بعد كل رحلة، ومنه نسبة الهروب لكل بيت',
      html: `<div class="stack">
        <div class="split"><div class="seg" role="radiogroup" aria-label="الفترة">${[[30, 'آخر 30 يوم'], [90, 'آخر 90 يوم'], [180, 'آخر 6 شهور']].map(([v, n]) => `<label><input type="radio" name="span" value="${v}"${v === gamesSpan ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div>
        <p class="note">${fmt(logged.length)} رحلة متسجلة</p></div>
        ${waiting.length ? `<section class="card"><div class="card__head"><h2>مستني تسجيل</h2><p class="note">رحلات النهارده اللي لسه ما اتسجلتش</p></div><div class="alerts">${waiting.map((b) => `<div class="alert"><span class="alert__icon"><span class="house-dot house-dot--${b.house}"></span></span><div style="flex:1">${D.HOUSE[b.house].short} ${t12(b.time)} · ${b.size} لاعبين · ${badge(b.status)}</div>${can('log') ? `<button class="btn btn--small" data-act="log" data-id="${b.id}">سجّل</button>` : ''}</div>`).join('')}</div></section>` : ''}
        <div class="grid">${per.map((x) => `<section class="card span-4"><div class="card__head"><h2><span class="house-dot house-dot--${x.h.slug}"></span> ${x.h.name}</h2><p class="note num">${x.games} رحلة</p></div>
          <div class="kpis" style="grid-template-columns:1fr 1fr">${kpi('نسبة الهروب', `${x.rate}%`)}${kpi('متوسط الـ hints', x.hints)}${kpi('الهاربين خلصوا في', x.mins ? `${x.mins} د` : '—', 'متوسط')}${kpi('أسرع هروب', x.best ? `${x.best} د` : '—', `${x.left} مرة حد خرج قبل الآخر`)}</div></section>`).join('')}</div>
        <div class="grid">
          <section class="card span-6"><div class="card__head"><h2>الهروب حسب حجم الفريق</h2><p class="note">كل البيوت</p></div>
            <div class="bars">${sizes.map((s) => `<div class="barrow"><span>${s.name}</span><span class="barrow__track"><i class="good" style="width:${(s.rate / top) * 100}%"></i></span><span class="barrow__val">${s.rate}%</span></div>`).join('')}</div>
            <p class="note" style="margin-top:12px">${!logged.length ? 'لسه مفيش رحلات متسجلة.' : sizes[3].rate > sizes[0].rate ? 'الفرق الكبيرة بتهرب أكتر: ينفع يتقال للي بيحجز 3 أو 4 إن «كل ما تكتروا، فرصتكم أحسن».' : 'حجم الفريق مش فارق كتير في الهروب.'}</p></section>
          <section class="card span-6"><div class="card__head"><h2>حصل إيه جوه؟</h2><p class="note">أي حاجة الـ Game Master كتبها</p></div>
            ${incidents.length ? `<div class="alerts">${incidents.map((b) => `<div class="alert"><span class="alert__icon"><span class="house-dot house-dot--${b.house}"></span></span><div><p>${esc(b.gm.incident)}</p><p class="muted small">${D.HOUSE[b.house].short} · ${dateAr(b.date)} · ${staffName(b.gm.by)}</p></div></div>`).join('')}</div>` : '<p class="empty">مفيش حاجة اتسجلت في الفترة دي.</p>'}</section>
        </div>
        <section class="card"><div class="card__head"><h2>آخر اللي اتسجل</h2></div>
          ${recent.length ? '' : '<p class="empty">أول ما الـ Game Master يسجّل رحلة، بتظهر هنا.</p>'}<table class="table table--cards"${recent.length ? '' : ' hidden'}><thead><tr><th>الرحلة</th><th>هربوا؟</th><th>الوقت</th><th>hints</th><th>صورة</th><th>سجّلها</th></tr></thead><tbody>
          ${recent.map((b) => `<tr><td class="main-cell"><span class="house-dot house-dot--${b.house}"></span> ${D.HOUSE[b.house].short} · ${dateAr(b.date)} ${t12(b.time)} · ${b.size} لاعبين</td><td data-label="هربوا؟">${b.gm.escaped ? '<span style="color:var(--good)">هربوا</span>' : '<span class="muted">لأ</span>'}</td><td data-label="الوقت" class="num">${b.gm.minutes} د</td><td data-label="hints" class="num">${b.gm.hints}</td><td data-label="صورة">${b.gm.photo ? 'اتبعتت' : '—'}</td><td data-label="سجّلها" class="muted">${b.gm.byName || staffName(b.gm.by)}</td></tr>`).join('')}
          </tbody></table></section>
      </div>`,
      after: (el) => $$('[name=span]', el).forEach((r) => r.addEventListener('change', () => { gamesSpan = +r.value; route(); })),
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Messages and campaigns (WhatsApp, through the outbox; marketing only to those who agreed)
  // ------------------------------------------------------------------------------------------------------------------
  let campTab = 'auto';
  const autos = (() => {
    const last30 = D.bookings.filter((b) => daysFrom(b.date) >= 0 && daysFrom(b.date) < 30);
    const asked = last30.filter((b) => b.status === 'completed');
    const replied = asked.filter((b) => b.feedback);
    const google = replied.filter((b) => b.feedback.google);
    return [
      { key: 'confirm', name: 'تأكيد الحجز', when: 'أول ما الحجز يتأكد', kind: 'خدمة', locked: true, on: true,
        stats: [`${fmt(last30.filter((b) => b.status !== 'awaiting').length)} اتبعتت في 30 يوم`],
        text: 'أهلاً {الاسم} 👋\nحجزك في {البيت} اتأكد: {اليوم} الساعة {الميعاد}، لـ {العدد} لاعبين.\nكود الحجز {الكود}. تعالوا قبل الميعاد بـ 15 دقيقة.\nرحلة سعيدة 🕯️', btn: 'الموقع على الخريطة' },
      { key: 'remind', name: 'تذكير قبلها بيوم، ولينك الإقرار', when: 'قبل الرحلة بـ 24 ساعة', kind: 'خدمة', locked: true, on: true,
        stats: [`${fmt(last30.filter((b) => b.status !== 'cancelled').length)} اتبعتت`, `${pct(last30.reduce((s, b) => s + signed(b), 0), last30.reduce((s, b) => s + b.size, 0))}% من اللاعبين مضوا قبل ما يوصلوا`],
        text: 'فاضل يوم يا {الاسم} 👀\nبكرة الساعة {الميعاد} في {البيت}.\nابعت اللينك ده لصحابك عشان كل واحد يمضي قبل ما تيجوا، وتدخلوا على طول:', btn: 'امضي الإقرار' },
      { key: 'ask', name: '«إزاي كانت الرحلة؟»', when: 'بعد الرحلة بساعتين', kind: 'خدمة', on: true,
        stats: [`${fmt(asked.length)} اتبعتت`, `${pct(replied.length, asked.length)}% ردّوا`, `متوسط ${(replied.reduce((s, b) => s + b.feedback.score, 0) / (replied.length || 1)).toFixed(1)} من 5`],
        text: 'إزيك يا {الاسم}، خرجتوا ولا الملك لحقكم؟ 😅\nقيّموا رحلة {البيت} من 1 لـ 5:', btn: 'قيّم الرحلة' },
      { key: 'google', name: 'طلب تقييم على جوجل', when: 'للي إدّى 4 أو 5 بس', kind: 'خدمة', on: true,
        stats: [`${fmt(google.length)} اتطلب منهم`, `${pct(google.filter((b) => b.feedback.google.clicked).length, google.length)}% داسوا على اللينك`],
        text: 'مبسوطين إنها عجبتكم 🙏\nلو عندك دقيقة، كلمتين منك على جوجل بيفرقوا معانا جداً:', btn: 'قيّمنا على جوجل' },
      { key: 'next', name: 'فاضلك بيت', when: 'بعد 21 يوم للي لعب بيت أو اتنين', kind: 'تسويق', on: true,
        stats: [`${fmt(known().filter((p) => p.marketing && p.houses.size && p.houses.size < 3).length)} في الشريحة ووافقوا`, ...(D.DEMO ? ['رجع منهم 6.1% في 30 يوم (تجريبي)'] : [])],
        text: 'يا {الاسم}، خلّصت {البيت اللي لعبته}… بس {البيت الجاي} لسه مستنيك 👁️\nكمّل كارت «بيت ورا بيت» وخد مكافأتك:', btn: 'احجز البيت الجاي' },
      { key: 'miss', name: 'وحشتونا', when: 'بعد 90 يوم من غير زيارة', kind: 'تسويق', on: false,
        stats: [`${fmt(known().filter((p) => p.marketing && p.lastVisit && daysFrom(p.lastVisit) >= 90).length)} في الشريحة ووافقوا`],
        text: 'بقالك كتير يا {الاسم} 🕯️\nالبيوت لسه مستنياك. فيه مواعيد فاضية الأسبوع ده:', btn: 'شوف المواعيد' },
      { key: 'bday', name: 'عيد ميلاد', when: 'قبل عيد الميلاد بأسبوع', kind: 'تسويق', on: false,
        stats: [`${fmt(known().filter((p) => p.marketing && p.birthday && p.birthday.m === month).length)} عيد ميلادهم الشهر ده`],
        text: 'كل سنة وانت طيب يا {الاسم} 🎂\nاحتفل مع صحابك جوه بيت من بيوتنا، وتورتة عيد الميلاد علينا:', btn: 'احجز الاحتفال' },
    ];
  })();
  const CAMPAIGNS = (() => {
    const uses = (code) => D.bookings.filter((b) => b.promo === code && b.status !== 'cancelled');
    const h = uses('HALLOWEEN20');
    const n = uses('NOUR10');
    const consent = known().filter((p) => p.marketing).length;
    return !D.DEMO ? [] : [
      { name: 'عرض الهالوين: خصم 20% للمجموعات من 5', date: '2026-10-25', seg: 'كل اللي وافقوا', sent: Math.round(consent * 0.62), read: 0.84, booked: h.length, revenue: h.reduce((s, b) => s + b.price - b.discount, 0) },
      { name: 'المشرحة 13 فتحت: أول 50 فريق', date: '2026-09-12', seg: 'كمّلوا بيت أو اتنين', sent: Math.round(consent * 0.31), read: 0.81, booked: 23, revenue: 23 * 1680 },
      { name: 'كود نور: خصم 10%', date: D.iso(D.dayAt(-44)), seg: 'ما جوش من 90 يوم', sent: Math.round(consent * 0.18), read: 0.73, booked: n.length, revenue: n.reduce((s, b) => s + b.price - b.discount, 0) },
    ];
  })();
  const TEMPLATES = [
    { key: 'offer', name: 'عرض بخصم', text: 'يا {الاسم} 🕯️ عرض لحد {آخر يوم}: خصم {الخصم} على أي بيت لفرق من {أقل عدد} وطالع.\nاستخدم الكود {الكود} وانت بتحجز. لو مش قدها… متلعبهاش.', btn: 'احجز دلوقتي' },
    { key: 'next', name: 'كمّل البيوت', text: 'يا {الاسم}، {البيت الجاي} مستنيك 👁️ كمّل كارت «بيت ورا بيت» وخد مكافأتك.', btn: 'احجز البيت الجاي' },
    { key: 'news', name: 'خبر جديد', text: 'جديد في Escape Hub 13 🔦\n{الخبر}', btn: 'اعرف أكتر' },
  ];
  const fillTemplate = (t, p) => t.replace('{الاسم}', p ? p.name.split(' ')[0] : 'أحمد').replace('{آخر يوم}', 'آخر الشهر').replace('{الخصم}', '20%').replace('{أقل عدد}', '5').replace('{الكود}', 'WINTER20').replace('{البيت الجاي}', 'المشرحة 13').replace('{الخبر}', 'مواعيد جديدة بعد 3 الفجر يوم الخميس والجمعة.');
  const phone = (text, btn) => `<div class="phone"><div class="phone__bubble">${esc(text)}<div class="phone__time">9:41 م</div></div>${btn ? `<div class="phone__btn">${esc(btn)}</div>` : ''}</div>`;

  function viewCampaigns(params) {
    if (params.get('seg')) campTab = 'new';
    const startSeg = params.get('seg') && SEG[params.get('seg')] ? params.get('seg') : 'two';
    const tabs = `<div class="seg" role="radiogroup" aria-label="الرسايل">${[['auto', 'الأوتوماتيك'], ['new', 'حملة جديدة'], ['sent', 'اللي اتبعت'], ['aud', 'جماهير الإعلانات']].map(([v, n]) => `<label><input type="radio" name="ctab" value="${v}"${v === campTab ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div>`;
    let body = '';
    if (campTab === 'auto') {
      body = `<section class="card"><div class="card__head"><h2>رسايل بتتبعت لوحدها</h2><p class="note">على رقم الواتساب بتاع المكان، من الطابور (قرار T25)</p></div>
        ${autos.map((a) => `<div class="auto"><div><p class="auto__name">${a.name} <span class="tag ${a.kind === 'تسويق' ? 'tag--bday' : 'tag--new'}">${a.kind}</span></p><p class="auto__when">${a.when}${a.kind === 'تسويق' ? ' · للي وافقوا على العروض بس' : ''}</p></div>
          <div class="tools"><button class="btn btn--small btn--ghost" type="button" data-preview="${a.key}">شوف الرسالة</button><label class="switch" title="${a.locked ? 'دي لازم تفضل شغالة' : 'شغّل أو وقّف'}"><input type="checkbox" data-auto="${a.key}"${a.on ? ' checked' : ''}${a.locked ? ' disabled' : ''} aria-label="${a.name}"><span></span></label></div>
          <p class="auto__stats">${a.stats.map((s) => `<span>${s}</span>`).join('')}</p></div>`).join('')}</section>
        <div class="banner banner--info"><span aria-hidden="true">ⓘ</span><p>رسايل «الخدمة» بتتبعت لكل اللي حجز. رسايل «التسويق» للي وافق في الإقرار بس، وكل قالب لازم Meta توافق عليه الأول، وMeta بتحاسب على كل رسالة تسويق حسب جدول أسعارها لمصر.</p></div>`;
    } else if (campTab === 'new') {
      body = `<div class="grid">
        <section class="card span-8"><form class="steps" data-camp>
          <p class="step-title"><i>1</i> لمين؟</p>
          <select name="seg">${SEGMENTS.filter((s) => s.key !== 'upset').map((s) => `<option value="${s.key}"${s.key === startSeg ? ' selected' : ''}>${s.name}</option>`).join('')}</select>
          <p class="note" data-reach></p>
          <p class="step-title"><i>2</i> الرسالة</p>
          <select name="tpl">${TEMPLATES.map((t) => `<option value="${t.key}">${t.name}</option>`).join('')}</select>
          <textarea name="text" rows="5"></textarea>
          <p class="note">{الاسم} بيتبدّل باسم كل واحد. القالب بيروح لـ Meta تراجعه قبل أول إرسال (ساعات لحد يوم).</p>
          <p class="step-title"><i>3</i> إمتى؟</p>
          <div class="row2"><label class="field"><span>اليوم</span><input class="input" type="date" name="day" value="${D.iso(D.dayAt(1))}"></label><label class="field"><span>الساعة</span><input class="input" type="time" name="time" value="19:00"></label></div>
          <p class="note">أحسن وقت من رسايلنا اللي فاتت: 7 بالليل، قبل الخميس والجمعة (تجريبي).</p>
          <div class="tools"><button class="btn" type="submit">جدول الحملة</button><button class="btn btn--ghost" type="button" data-test>ابعتها ليا الأول</button></div>
        </form></section>
        <section class="card span-4"><div class="card__head"><h2>هتوصل كده</h2></div><div data-phone></div></section></div>`;
    } else if (campTab === 'aud') {
      const base = known();
      body = `<section class="card"><div class="card__head"><h2>جماهير الإعلانات</h2><p class="note">لـ Meta وTikTok (Custom Audiences ومنها Lookalike)</p></div>
        <div class="stack">
          <table class="table table--cards"><thead><tr><th>الشريحة</th><th>فيها</th><th>وافقوا على العروض</th><th></th></tr></thead><tbody>
          ${SEGMENTS.filter((x) => x.key !== 'upset').map((x) => { const l = base.filter(x.test); return `<tr><td class="main-cell"><b>${x.name}</b></td><td data-label="فيها" class="num">${fmt(l.length)}</td><td data-label="وافقوا" class="num">${fmt(l.filter((q) => q.marketing).length)}</td><td class="end"><button class="btn btn--small btn--ghost" type="button" data-aud="${x.key}">صدّر</button></td></tr>`; }).join('')}
          </tbody></table>
          <p class="note">الملف بياخد اللي وافقوا على رسايل العروض بس، والأرقام بتطلع hash (SHA-256) زي ما المنصات بتطلبها، فمحدش بيشوف رقم حد. أحسن شرايح لـ Lookalike: «رجعوا تاني» و«VIP». واللي «ما جوش من 90 يوم» تنفع لإعلان «وحشتونا».</p>
        </div></section>`;
    } else {
      body = `<section class="card"><div class="card__head"><h2>الحملات اللي اتبعتت</h2><p class="note">الحجز بيتحسب للحملة لو جه بكودها، أو من لينكها في 7 أيام</p></div>
        <table class="table table--cards"><thead><tr><th>الحملة</th><th>اتبعتت</th><th>اتقرت</th><th>حجزوا</th><th>دخلت</th></tr></thead><tbody>
        ${CAMPAIGNS.length ? '' : '<tr><td colspan="5" class="empty">لسه مفيش حملات اتبعتت.</td></tr>'}${CAMPAIGNS.map((c) => `<tr><td class="main-cell"><b>${esc(c.name)}</b><br><span class="muted small">${dateAr(c.date)} · ${esc(c.seg)}</span></td><td data-label="اتبعتت" class="num">${fmt(c.sent)}</td><td data-label="اتقرت" class="num">${Math.round(c.read * 100)}%</td><td data-label="حجزوا" class="num">${fmt(c.booked)} <span class="muted small">(${(c.booked / c.sent * 100).toFixed(1)}%)</span></td><td data-label="دخلت" class="num">${money(c.revenue)}</td></tr>`).join('')}
        </tbody></table></section>`;
    }
    return {
      title: 'الرسايل والحملات',
      sub: 'كل رسالة بتروح على الواتساب، ومتسجلة في ملف العميل',
      html: `<div class="stack">${tabs}${body}</div>`,
      after: (el) => {
        $$('[name=ctab]', el).forEach((r) => r.addEventListener('change', () => { campTab = r.value; if (location.hash.includes('?')) location.hash = '#/campaigns'; else route(); }));
        $$('[data-aud]', el).forEach((b) => b.addEventListener('click', () => exportAudience(known().filter(SEG[b.dataset.aud].test), b.dataset.aud)));
        $$('[data-preview]', el).forEach((b) => b.addEventListener('click', () => {
          const a = autos.find((x) => x.key === b.dataset.preview);
          openSheet({ title: a.name, body: `${phone(fillTemplate(a.text.replace('{البيت}', 'مقبرة الملك الحي').replace('{اليوم}', 'الخميس').replace('{الميعاد}', '10 بالليل').replace('{العدد}', '6').replace('{الكود}', 'EH-7KQ2M').replace('{البيت اللي لعبته}', 'المقبرة'), null), a.btn)}<p class="note">${a.when}.</p>` });
        }));
        $$('[data-auto]', el).forEach((c) => c.addEventListener('change', () => {
          const a = autos.find((x) => x.key === c.dataset.auto);
          a.on = c.checked;
          toast(`${a.name}: ${a.on ? 'اشتغلت' : 'اتوقفت'}.`);
        }));
        const f = $('[data-camp]', el);
        if (f) {
          const reach = () => {
            const list = known().filter(SEG[f.seg.value].test);
            const ok = list.filter((p) => p.marketing).length;
            $('[data-reach]', f).innerHTML = `${fmt(list.length)} في الشريحة، <b>${fmt(ok)}</b> منهم وافقوا على العروض، ودول بس اللي هتوصلهم.`;
            return ok;
          };
          const tpl = () => { const t = TEMPLATES.find((x) => x.key === f.tpl.value); f.text.value = t.text; show(); };
          const show = () => { const t = TEMPLATES.find((x) => x.key === f.tpl.value); $('[data-phone]', el).innerHTML = phone(fillTemplate(f.text.value), t.btn); };
          f.seg.addEventListener('change', reach);
          f.tpl.addEventListener('change', tpl);
          f.text.addEventListener('input', show);
          reach(); tpl();
          $('[data-test]', f).addEventListener('click', () => toast('في النسخة الحقيقية: بتوصلك على رقمك الأول تشوفها.'));
          f.addEventListener('submit', (e) => { e.preventDefault(); toast(`اتجدولت لـ ${fmt(reach())} عميل يوم ${dateAr(f.day.value)}، بعد موافقة Meta على القالب. (تجريبي: ما اتبعتش حاجة)`); });
        }
      },
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Feedback and reviews
  // ------------------------------------------------------------------------------------------------------------------
  function viewFeedback() {
    const span = 90;
    const done = D.bookings.filter((b) => b.status === 'completed' && daysFrom(b.date) > 0 && daysFrom(b.date) <= span);
    const fb = done.filter((b) => b.feedback);
    const avg = fb.reduce((s, b) => s + b.feedback.score, 0) / (fb.length || 1);
    const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: fb.filter((b) => b.feedback.score === s).length }));
    const topN = Math.max(...dist.map((d) => d.n), 1);
    const google = fb.filter((b) => b.feedback.google);
    const open = D.bookings.filter((b) => b.feedback && b.feedback.follow && b.feedback.follow.status === 'open');
    const byHouse = D.HOUSES.map((h) => { const g = fb.filter((b) => b.house === h.slug); return { h, avg: g.reduce((s, b) => s + b.feedback.score, 0) / (g.length || 1), n: g.length }; });
    const words = fb.filter((b) => b.feedback.comment).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    return {
      title: 'الآراء والتقييمات',
      sub: 'آخر 90 يوم · من رسالة «إزاي كانت الرحلة؟»',
      html: `<div class="stack">
        <div class="kpis">
          ${kpi('ردّوا', `${pct(fb.length, done.length)}%`, `<b>${fmt(fb.length)}</b> من ${fmt(done.length)} رحلة`)}
          ${kpi('المتوسط', `${avg.toFixed(1)} <span class="stars" style="font-size:1rem">★</span>`, `${pct(dist[0].n, fb.length)}% إدّوا 5`)}
          ${kpi('اتطلب منهم جوجل', fmt(google.length), `<b>${pct(google.filter((b) => b.feedback.google.clicked).length, google.length)}%</b> داسوا على اللينك`)}
          ${kpi('مستني حد يكلمه', fmt(open.length), 'اللي إدّى 3 أو أقل')}
        </div>
        ${open.length ? `<section class="card"><div class="card__head"><h2>لازم حد يكلمهم</h2><p class="note">اللي زعلان ما بيتطلبش منه تقييم جوجل، بيوصل هنا للمدير</p></div><div class="alerts">${open.map((b) => { const p = D.byId(b.booker); return `<div class="alert"><span class="alert__icon"><span class="stars">${b.feedback.score}★</span></span><div style="flex:1"><a href="#/customer/${p.id}">${esc(p.name)}</a> · ${D.HOUSE[b.house].short} · ${ago(b.date)}<br><span class="muted">${b.feedback.comment ? `«${esc(b.feedback.comment)}»` : 'من غير كلام'}</span>${b.gm && b.gm.incident ? `<br><span class="small" style="color:var(--bad)">الـ GM كتب: ${esc(b.gm.incident)}</span>` : ''}</div>${can('follow') ? `<button class="btn btn--small" data-act="follow" data-id="${b.id}">كلّمته</button>` : ''}</div>`; }).join('')}</div></section>` : ''}
        <div class="grid">
          <section class="card span-6"><div class="card__head"><h2>التقييمات</h2></div><div class="bars">${dist.map((d) => `<div class="barrow"><span><span class="stars">${'★'.repeat(d.s)}</span></span><span class="barrow__track"><i class="${d.s >= 4 ? 'good' : d.s === 3 ? 'warn' : 'bad'}" style="width:${(d.n / topN) * 100}%"></i></span><span class="barrow__val">${fmt(d.n)}</span></div>`).join('')}</div></section>
          <section class="card span-6"><div class="card__head"><h2>حسب البيت</h2></div><div class="bars">${byHouse.map((x) => `<div class="barrow"><span>${x.h.short}</span><span class="barrow__track"><i class="${x.h.slug}" style="width:${(x.avg / 5) * 100}%"></i></span><span class="barrow__val">${x.avg.toFixed(1)}</span></div>`).join('')}</div>
            <p class="note" style="margin-top:12px">على جوجل ماب دلوقتي 4.4 من 59 تقييم. لو ربع اللي بيدّوا 5 كتبوا، الرقم ده بيكبر بسرعة.</p></section>
        </div>
        <section class="card"><div class="card__head"><h2>آخر الكلام</h2></div>
          ${words.length ? '' : '<p class="empty">لسه محدش قال رأيه. الرسالة بتتبعت لوحدها بعد كل رحلة بساعتين.</p>'}<ol class="timeline">${words.map((b) => { const p = D.byId(b.booker); return `<li><span class="timeline__dot"><span class="house-dot house-dot--${b.house}"></span></span><div><p class="timeline__when"><span class="stars">${'★'.repeat(b.feedback.score)}</span> · <a href="#/customer/${p.id}">${esc(p.name)}</a> · ${D.HOUSE[b.house].short} · ${ago(b.date)}</p><p class="timeline__what">«${esc(b.feedback.comment)}»</p></div></li>`; }).join('')}</ol></section>
      </div>`,
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // House after house: the loyalty card and the referrals
  // ------------------------------------------------------------------------------------------------------------------
  function viewLoyalty() {
    const k = known().filter((p) => p.visitCount > 0);
    const by = [1, 2, 3].map((n) => k.filter((p) => p.houses.size === n).length);
    const near = k.filter((p) => p.houses.size === 2).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit)).slice(0, 10);
    const refs = k.filter((p) => p.referrals > 0).sort((a, b) => b.referrals - a.referrals).slice(0, 8);
    const refBookings = D.bookings.filter((b) => b.referral);
    const top = Math.max(...by, 1);
    return {
      title: 'بيت ورا بيت',
      sub: 'كارت الولاء: كل بيت تلعبه يتختم، واللي يكمّل التلاتة ياخد مكافأة',
      html: `<div class="stack">
        <div class="grid">
          <section class="card span-8"><div class="card__head"><h2>العملاء على الكارت</h2><p class="note">اللي لعبوا</p></div>
            <div class="bars">${['بيت واحد', 'بيتين', 'التلاتة'].map((n, i) => `<div class="barrow"><span>${n}</span><span class="barrow__track"><i style="width:${(by[i] / top) * 100}%"></i></span><span class="barrow__val">${fmt(by[i])}</span></div>`).join('')}</div>
            <p class="note" style="margin-top:12px">${fmt(by[1])} عميل فاضلهم بيت واحد: دول أقرب ناس يرجعوا. رسالة «فاضلك بيت» شغالة ليهم لوحدها.</p>
            ${can('campaigns') ? '<div class="tools" style="margin-top:12px"><a class="btn btn--small" href="#/campaigns?seg=two">ابعتلهم حملة دلوقتي</a><a class="btn btn--small btn--ghost" href="#/customers?seg=two">شوفهم</a></div>' : ''}</section>
          <section class="card span-4"><div class="card__head"><h2>القواعد</h2><span class="tag tag--warn">مقترح: الأونر يحدد</span></div>
            <dl class="facts"><dt>الختم</dt><dd>بعد رحلة خلصت، لكل لاعب مضى الإقرار، مش للي حجز بس</dd><dt>المكافأة</dt><dd>خصم 25% على الرحلة الجاية لصاحب الكارت</dd><dt>الترشيح</dt><dd>صاحبك يحجز بكودك وياخد 10%، وانت تاخد 100 ج على رحلتك الجاية</dd><dt>الصلاحية</dt><dd>الكارت مالوش آخر</dd></dl></section>
        </div>
        <div class="grid">
          <section class="card span-6"><div class="card__head"><h2>فاضلهم بيت</h2><p class="note">آخر اللي لعبوا</p></div>
            ${near.length ? '' : '<p class="empty">لسه مفيش حد.</p>'}<table class="table"><tbody>${near.map((p) => { const miss = D.HOUSES.find((h) => !p.houses.has(h.slug)); return `<tr data-href="#/customer/${p.id}"><td><a href="#/customer/${p.id}">${esc(p.name)}</a></td><td>${houseDots(p)}</td><td class="muted small">فاضل ${miss.short}</td><td class="muted small">${ago(p.lastVisit)}</td></tr>`; }).join('')}</tbody></table></section>
          <section class="card span-6"><div class="card__head"><h2>أكتر ناس رشّحوا</h2><p class="note">${fmt(refBookings.length)} حجز جه بكود ترشيح</p></div>
            ${refs.length ? '' : '<p class="empty">لسه محدش رشّح حد.</p>'}<table class="table"><tbody>${refs.map((p) => `<tr data-href="#/customer/${p.id}"><td><a href="#/customer/${p.id}">${esc(p.name)}</a></td><td class="ltr muted small">${p.referral}</td><td class="num">${p.referrals} ${p.referrals === 1 ? 'صاحب' : 'صحاب'}</td></tr>`).join('')}</tbody></table></section>
        </div>
      </div>`,
      after: (el) => $$('tr[data-href]', el).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.href; })),
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Gift cards and promo codes
  // ------------------------------------------------------------------------------------------------------------------
  const GIFT = { active: 'شغال', part: 'اتصرف جزء', used: 'اتصرف كله', expired: 'خلصت مدته' };
  function viewCodes() {
    const g = D.giftcards;
    const sold90 = g.filter((c) => daysFrom(c.sold) <= 90);
    const owed = g.filter((c) => c.status === 'active' || c.status === 'part').reduce((s, c) => s + c.balance, 0);
    const promos = D.PROMOS.map((p) => {
      const u = D.bookings.filter((b) => b.promo === p.code && b.status !== 'cancelled');
      const live = D.TODAY >= p.from && D.TODAY <= p.to;
      return { ...p, uses: u.length, revenue: u.reduce((s, b) => s + b.price - b.discount, 0), given: u.reduce((s, b) => s + b.discount, 0), live };
    });
    const KIND = { offer: 'عرض', influencer: 'مؤثر', corporate: 'شركات', contest: 'مسابقة' };
    const deskOnly = role === 'front_desk';
    return {
      title: 'الكروت والأكواد',
      sub: 'كروت الهدايا، وأكواد الخصم للعروض والمؤثرين والمسابقات',
      html: `<div class="stack">
        <div class="kpis">
          ${kpi('كروت اتباعت (90 يوم)', fmt(sold90.length), `بـ <b>${money(sold90.reduce((s, c) => s + c.value, 0))}</b>`)}
          ${kpi('رصيد على الكروت', money(owed), 'لسه ما اتصرفش: علينا للعملاء')}
          ${deskOnly ? '' : kpi('حجوزات بأكواد', fmt(promos.reduce((s, p) => s + p.uses, 0)), `خصم <b>${money(promos.reduce((s, p) => s + p.given, 0))}</b>`)}
        </div>
        <section class="card"><div class="card__head"><h2>كروت الهدايا</h2>
          <div class="tools"><form class="tools" data-redeem><input class="input ltr" name="code" placeholder="GC-XXXX-XXXX" style="width:180px" aria-label="كود الكارت"><button class="btn btn--small btn--ghost">شوف الرصيد</button></form>${can('sellGift') ? '<button class="btn btn--small" type="button" data-sell>بيع كارت</button>' : ''}</div></div>
          <table class="table table--cards"><thead><tr><th>الكود</th><th>القيمة</th><th>الباقي</th><th>اشتراه</th><th>هدية لـ</th><th>الحالة</th><th>لحد</th></tr></thead><tbody>
          ${g.length ? '' : '<tr><td colspan="7" class="empty">لسه مفيش كروت اتباعت.</td></tr>'}${g.slice(0, 14).map((c) => { const p = c.buyer ? D.byId(c.buyer) : null; const bn = p ? p.name : c.buyerName; return `<tr><td class="main-cell ltr"><b>${c.code}</b></td><td data-label="القيمة" class="num">${money(c.value)}</td><td data-label="الباقي" class="num">${money(c.balance)}</td><td data-label="اشتراه">${p && SEE.customers.includes(role) ? `<a href="#/customer/${p.id}">${esc(bn)}</a>` : esc(bn)}</td><td data-label="هدية لـ">${esc(c.to)}</td><td data-label="الحالة"><span class="tag ${c.status === 'active' ? 'tag--back' : c.status === 'expired' ? 'tag--warn' : ''}">${GIFT[c.status]}</span></td><td data-label="لحد" class="muted small">${dateAr(c.expires)}</td></tr>`; }).join('')}
          </tbody></table></section>
        ${deskOnly ? '<p class="note">أكواد الخصم بيعملها الأونرز والمدير والماركتير. الاستقبال بيبيع ويصرف كروت الهدايا بس.</p>' : `<section class="card"><div class="card__head"><h2>أكواد الخصم</h2>${can('makeCode') ? '<button class="btn btn--small" type="button" data-newcode>كود جديد</button>' : ''}</div>
          <table class="table table--cards"><thead><tr><th>الكود</th><th>لمين</th><th>الخصم</th><th>من لحد</th><th>استُخدم</th><th>دخل</th><th>خصمنا</th></tr></thead><tbody>
          ${promos.length ? '' : '<tr><td colspan="7" class="empty">لسه مفيش أكواد. «كود جديد» يعمل أول واحد.</td></tr>'}${promos.map((p) => `<tr><td class="main-cell"><b class="ltr">${p.code}</b> ${p.live ? '<span class="tag tag--back">شغال</span>' : '<span class="tag">خلص</span>'}</td><td data-label="لمين">${esc(p.label)} <span class="muted small">(${KIND[p.kind]})</span></td><td data-label="الخصم" class="num">${p.pct}%${p.minTeam > 3 ? ` <span class="muted small">من ${p.minTeam}</span>` : ''}</td><td data-label="من لحد" class="small">${dateAr(p.from)} ← ${dateAr(p.to)}</td><td data-label="استُخدم" class="num">${p.uses}</td><td data-label="دخل" class="num">${money(p.revenue)}</td><td data-label="خصمنا" class="num">${money(p.given)}</td></tr>`).join('')}
          </tbody></table>
          <p class="note" style="margin-top:10px">كود المؤثر بيقول كام حجز جابه وكام دخل منه: ده اللي بيتحاسب عليه.</p></section>`}
      </div>`,
      after: (el) => {
        $('[data-redeem]', el).addEventListener('submit', (e) => {
          e.preventDefault();
          const q = e.target.code.value.trim().toUpperCase();
          const c = D.giftcards.find((x) => x.code === q);
          toast(c ? `${c.code}: باقي ${money(c.balance)} · ${GIFT[c.status]} · لحد ${dateAr(c.expires)}` : 'الكود ده مش موجود. اتأكد منه تاني.');
        });
        const sell = $('[data-sell]', el);
        if (sell) sell.addEventListener('click', () => openSheet({
          title: 'بيع كارت هدية',
          body: `<div class="field"><span>القيمة</span><div class="seg" role="radiogroup">${[1000, 1500, 2000, 3000].map((v, i) => `<label><input type="radio" name="value" value="${v}"${i === 1 ? ' checked' : ''}><span>${fmt(v)}</span></label>`).join('')}</div></div>
            <label class="field"><span>اسم اللي اشتراه</span><input class="input" name="buyer" required></label>
            <label class="field"><span>رقمه</span><input class="input ltr" name="phone" required inputmode="tel" pattern="01[0125][0-9]{8}" placeholder="01xxxxxxxxx"></label>
            <label class="field"><span>هدية لـ (اختياري)</span><input class="input" name="to"></label>
            <div class="field"><span>اتدفع إزاي؟</span><div class="seg" role="radiogroup">${[['cash', 'كاش'], ['wallet', 'محفظة'], ['instapay', 'InstaPay']].map(([v, n], i) => `<label><input type="radio" name="m" value="${v}"${i === 0 ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
            <p class="note">الكود بيتبعت على واتساب اللي اشتراه، وصالح 6 شهور (مقترح).</p>`,
          foot: '<button class="btn" value="ok">بيع الكارت</button><button class="btn btn--ghost" value="cancel" formnovalidate>رجوع</button>',
          onSubmit: (f) => {
            const code = `GC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
            D.giftcards.unshift({ code, value: +f.get('value'), balance: +f.get('value'), status: 'active', sold: D.TODAY, expires: D.iso(D.dayAt(180)), buyer: null, buyerName: String(f.get('buyer')).trim(), to: f.get('to') || '—', soldBy: null });
            toast(`اتباع ${code} بـ ${money(+f.get('value'))}. (لما اللوحة تتربط: الكود بيروح على واتساب اللي اشتراه)`);
            route();
          },
        }));
        const nc = $('[data-newcode]', el);
        if (nc) nc.addEventListener('click', () => openSheet({
          title: 'كود خصم جديد',
          body: `<label class="field"><span>الكود</span><input class="input ltr" name="code" required pattern="[A-Za-z0-9]{4,16}" placeholder="WINTER20"></label>
            <label class="field"><span>لمين؟</span><input class="input" name="label" required placeholder="مثلاً: سلمى، إنستجرام"></label>
            <div class="field"><span>النوع</span><div class="seg" role="radiogroup">${Object.entries(KIND).map(([v, n], i) => `<label><input type="radio" name="kind" value="${v}"${i === 1 ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
            <div class="row2">${stepper('pct', 10, 5, 100, 'الخصم %')}${stepper('min', 3, 3, 12, 'أقل عدد للفريق')}</div>
            <div class="row2"><label class="field"><span>من</span><input class="input" type="date" name="from" value="${D.TODAY}"></label><label class="field"><span>لحد</span><input class="input" type="date" name="to" value="${D.iso(D.dayAt(30))}"></label></div>
            <p class="note">الخصم بيتحسب على السعر قبل العربون، والعربون نفسه ما بيتخصمش.</p>`,
          foot: '<button class="btn" value="ok">اعمل الكود</button><button class="btn btn--ghost" value="cancel" formnovalidate>رجوع</button>',
          onSubmit: (f) => {
            D.PROMOS.unshift({ code: String(f.get('code')).toUpperCase(), kind: f.get('kind'), label: f.get('label'), pct: +f.get('pct'), minTeam: +f.get('min'), from: f.get('from'), to: f.get('to'), share: 0 });
            toast(`الكود ${String(f.get('code')).toUpperCase()} اشتغل.`);
            route();
          },
        }));
      },
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The shift and the cash drawer
  // ------------------------------------------------------------------------------------------------------------------
  let float = 500;
  let counted = null;
  let closed = null;
  function viewShift() {
    const list = todays().filter((b) => b.status !== 'cancelled').sort((a, b) => a.start - b.start);
    const byMethod = { cash: 0, wallet: 0, instapay: 0, gift: 0 };
    for (const b of list) {
      if (b.restPaid && b.restMethod) byMethod[b.restMethod] += b.restPaid;
      if (b.drinksPaid) byMethod[b.restMethod || 'cash'] += b.drinksPaid;
    }
    const online = list.filter((b) => b.channel === 'web').reduce((s, b) => s + b.deposit, 0);
    const expected = float + byMethod.cash;
    const diff = counted == null ? null : counted - expected;
    return {
      title: 'الوردية والخزنة',
      sub: `${dateAr(D.TODAY, true)} · وردية ${role === 'front_desk' ? me() : 'منة ع.'} من 3 العصر`,
      html: `<div class="stack">
        <div class="kpis">
          ${kpi('كاش اتحصّل', money(byMethod.cash), 'الباقي والمشروبات')}
          ${kpi('محافظ', money(byMethod.wallet))}
          ${kpi('InstaPay', money(byMethod.instapay))}
          ${kpi('عرابين أونلاين', money(online), 'دخلت قبل كده على Paymob أو InstaPay')}
        </div>
        <div class="grid">
          <section class="card span-8"><div class="card__head"><h2>رحلات الوردية</h2></div>
            <table class="table table--cards"><thead><tr><th>الرحلة</th><th>السعر</th><th>العربون</th><th>الباقي</th><th>مشروبات</th><th>حصّلها</th></tr></thead><tbody>
            ${list.length ? '' : '<tr><td colspan="6" class="empty">مفيش رحلات النهارده لسه.</td></tr>'}${list.map((b) => { const p = D.byId(b.booker); const left = due(b); return `<tr><td class="main-cell"><span class="house-dot house-dot--${b.house}"></span> ${t12(b.time)} · <a href="#/customer/${p.id}">${esc(p.name)}</a> · ${b.size}</td><td data-label="السعر" class="num">${money(b.price - b.discount)}</td><td data-label="العربون" class="small">${b.deposit ? `${money(b.deposit)} ${D.METHODS[b.depositMethod]}` : '<span style="color:var(--bad)">ما دفعش</span>'}</td><td data-label="الباقي">${b.restPaid ? `<span class="num">${money(b.restPaid)}</span> <span class="muted small">${D.METHODS[b.restMethod]}</span>` : b.status === 'no_show' ? '<span class="muted">ما جوش</span>' : left ? `<button class="btn btn--small btn--ghost" data-act="collect" data-id="${b.id}">حصّل ${money(left)}</button>` : '—'}</td><td data-label="مشروبات" class="num">${b.drinksPaid ? money(b.drinksPaid) : '—'}</td><td data-label="حصّلها" class="muted small">${b.collectedByName || (b.collectedBy ? staffName(b.collectedBy) : '')}</td></tr>`; }).join('')}
            </tbody></table></section>
          <section class="card span-4"><div class="card__head"><h2>تقفيل الخزنة</h2></div>
            ${closed ? `<p>اتقفلت الساعة ${closed.at} باسم ${closed.by}.</p><dl class="sum" style="margin-top:10px"><dt>المفروض</dt><dd>${money(closed.expected)}</dd><dt>اتعد</dt><dd>${money(closed.counted)}</dd><dt class="total">الفرق</dt><dd class="total ${closed.counted - closed.expected === 0 ? 'diff-ok' : 'diff-bad'}">${money(closed.counted - closed.expected)}</dd></dl><p class="note" style="margin-top:10px">التقفيل بيوصل للمدير والأونر على طول، ولو فيه فرق بيتعلّم.</p>`
              : `<form class="stack" data-close>
              <label class="field"><span>كاش في الدرج أول الوردية</span><input class="input num" name="float" inputmode="numeric" value="${float}"></label>
              <dl class="sum"><dt>أول الوردية</dt><dd>${money(float)}</dd><dt>كاش اتحصّل</dt><dd>${money(byMethod.cash)}</dd><dt class="total">المفروض في الدرج</dt><dd class="total">${money(expected)}</dd></dl>
              <label class="field"><span>عدّيت كام؟</span><input class="input num" name="counted" inputmode="numeric" placeholder="${expected}" value="${counted ?? ''}"></label>
              ${diff != null ? `<p class="${diff === 0 ? 'diff-ok' : 'diff-bad'}">${diff === 0 ? 'مظبوط.' : `فيه فرق ${money(Math.abs(diff))} ${diff > 0 ? 'زيادة' : 'ناقص'}.`}</p>` : ''}
              <button class="btn" type="submit">قفّل الوردية</button></form>`}
          </section>
        </div>
      </div>`,
      after: (el) => {
        const f = $('[data-close]', el);
        if (!f) return;
        f.float.addEventListener('change', () => { float = +f.float.value || 0; route(); });
        f.counted.addEventListener('change', () => { counted = f.counted.value === '' ? null : +f.counted.value; route(); });
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          counted = f.counted.value === '' ? null : +f.counted.value;
          if (counted == null) { toast('اكتب الكاش اللي عدّيته الأول.'); f.counted.focus(); return; }
          closed = { at: clockAr(D.CLOCK), by: me(), expected: float + byMethod.cash, counted };
          toast('الوردية اتقفلت. (لما اللوحة تتربط: التقفيل بيوصل للمدير والأونر)');
          route();
        });
      },
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // WhatsApp inbox: a look only, until the owner decides (2026-11-18)
  // ------------------------------------------------------------------------------------------------------------------
  let convAt = 0;
  function viewInbox() {
    const up = D.bookings.filter((b) => b.k >= 0 && b.k <= 3 && b.status !== 'cancelled').slice(0, 5);
    const convs = up.map((b, i) => {
      const p = D.byId(b.booker);
      const h = D.HOUSE[b.house];
      const msgs = [
        [0, `السلام عليكم، ${h.short} فيه ميعاد ${['بكرة', 'النهارده', 'الخميس', 'الجمعة', 'بكرة'][i]} بالليل؟`],
        [1, `أهلاً يا ${p.name.split(' ')[0]} 👋 فيه ${t12(b.time)}. كام واحد هتكونوا؟`],
        [0, `${b.size} إن شاء الله`],
        [1, `تمام، ابعتلك لينك الحجز والعربون ${money(D.DEPOSIT)}؟`],
        [0, i % 2 ? 'ابعت' : 'هو ينفع اللي عنده 15 سنة يدخل؟'],
      ];
      return { b, p, msgs, unread: i === 0 ? 2 : i === 3 ? 1 : 0 };
    });
    const c = convs[Math.min(convAt, convs.length - 1)];
    if (!c) {
      return {
        title: 'واتساب',
        sub: 'رقم المكان 0111 888 1054',
        html: `<div class="stack"><div class="banner"><span aria-hidden="true">◆</span><p><b>شكل بس، مستني قرار الأونر.</b> لو اشتغل: كل محادثات الرقم تبان هنا، كل واحدة على ملف صاحبها وعليها اسم الموظف اللي بيرد، والحجز يتعمل من جوه المحادثة. لو لأ: الرد يفضل من الموبايل، والتأكيدات والتذكير بس بيتبعتوا من اللوحة.</p></div>
          <section class="card"><p class="empty">مفيش محادثات. اعرض البيانات التجريبية من القايمة عشان تشوف شكل الصندوق وفيه محادثات.</p></section></div>`,
      };
    }
    return {
      title: 'واتساب',
      sub: 'رقم المكان 0111 888 1054',
      html: `<div class="stack">
        <div class="banner"><span aria-hidden="true">◆</span><p><b>شكل بس، مستني قرار الأونر.</b> لو اشتغل: كل محادثات الرقم تبان هنا، كل واحدة على ملف صاحبها وعليها اسم الموظف اللي بيرد، والحجز يتعمل من جوه المحادثة. لو لأ: الرد يفضل من الموبايل زي دلوقتي، والتأكيدات والتذكير بس بيتبعتوا من اللوحة.</p></div>
        <div class="inbox">
          <div class="inbox__list">${convs.map((x, i) => `<button class="conv" type="button" data-conv="${i}" aria-current="${x === c}"><span class="avatar">${esc(initials(x.p.name))}</span><span><b>${esc(x.p.name)}</b></span><span class="small muted">${x.unread ? `<span class="count tag tag--vip">${x.unread}</span>` : '9:3' + i + ' م'}</span><span class="conv__last">${esc(x.msgs[x.msgs.length - 1][1])}</span></button>`).join('')}</div>
          <div class="chat"><div class="chat__msgs">${c.msgs.map(([us, t]) => `<p class="msg${us ? ' msg--us' : ''}">${esc(t)}<small>9:2${us} م${us ? ' · منة' : ''}</small></p>`).join('')}</div>
            <form class="chat__compose" data-compose><input placeholder="اكتب رد" aria-label="الرد"><button class="btn btn--small">ابعت</button></form></div>
          <aside class="inbox__side"><a class="who" href="#/customer/${c.p.id}" style="text-decoration:none"><span class="avatar">${esc(initials(c.p.name))}</span><span><span class="who__name">${esc(c.p.name)}</span><br><span class="who__sub">${c.p.visitCount} زيارة</span></span></a>
            ${tagsHtml(c.p, 4)}
            <dl class="facts"><dt>حجزه</dt><dd>${D.HOUSE[c.b.house].short} · ${dateAr(c.b.date)} · ${t12(c.b.time)}</dd><dt>الحالة</dt><dd>${badge(c.b.status)}</dd><dt>الإقرار</dt><dd>${signed(c.b)} من ${c.b.size}</dd></dl>
            <button class="btn btn--small" type="button" data-fake>اعمل حجز من المحادثة</button>
            <button class="btn btn--small btn--ghost" type="button" data-fake>ابعت لينك الدفع</button>
            <button class="btn btn--small btn--ghost" type="button" data-fake>رد جاهز: السن المسموح</button></aside>
        </div></div>`,
      after: (el) => {
        $$('[data-conv]', el).forEach((b) => b.addEventListener('click', () => { convAt = +b.dataset.conv; route(); }));
        $$('[data-fake]', el).forEach((b) => b.addEventListener('click', () => toast('ده شكل بس، لحد ما الأونر يقرر الصندوق.')));
        $('[data-compose]', el).addEventListener('submit', (e) => { e.preventDefault(); toast('ده شكل بس، لحد ما الأونر يقرر الصندوق.'); });
      },
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Accounts: who signs in, and what each one sees and does
  // ------------------------------------------------------------------------------------------------------------------
  function viewTeam() {
    const accounts = window.EH13_ACCOUNTS || [];
    const WHAT = {
      owner: 'كل حاجة، وهو بس اللي يشيل أي حساب',
      manager: 'كل حاجة، ماعدا شيل الحسابات',
      marketer: 'كل الأرقام والـ insights، والحملات، وأكواد الخصم، وجماهير الإعلانات. من غير ملفات العملاء الشخصية',
      media_buyer: 'زي الماركتير: كل الأرقام، والإعلانات، وأكواد الخصم، وجماهير الإعلانات',
      front_desk: 'الحجز وشغل الباب: جدول اليوم، والحجز اليدوي، ووصلوا، وتحصيل الباقي، ولينك الإقرار، والخزنة',
      game_master: 'جدول اليوم، ودخول الفريق، وتسجيل كل رحلة',
    };
    const ROWS = [
      ['جدول النهارده', (r) => SEE.today.includes(r)], ['حجز يدوي', (r) => DO.book.includes(r)], ['حجز من غير عربون', (r) => DO.bookFree.includes(r)],
      ['وصلوا وتحصيل الباقي', (r) => DO.collect.includes(r)], ['تسجيل الرحلات', (r) => DO.log.includes(r)], ['ملفات العملاء', (r) => SEE.customers.includes(r)],
      ['الحملات والرسايل', (r) => SEE.campaigns.includes(r)], ['أكواد الخصم', (r) => DO.makeCode.includes(r)], ['جماهير الإعلانات', (r) => DO.export.includes(r)],
      ['الأرقام والآراء والولاء', (r) => SEE.numbers.includes(r)], ['الوردية والخزنة', (r) => SEE.shift.includes(r)], ['كروت الهدايا', (r) => DO.sellGift.includes(r)],
      ['الحسابات', (r) => SEE.team.includes(r)], ['شيل حساب', (r) => DO.removeAccount.includes(r)],
    ];
    return {
      title: 'الحسابات',
      sub: 'كل واحد بيدخل باسمه، وكل حاجة بيعملها بتتسجل باسمه',
      html: `<div class="stack">
        <section class="card"><div class="card__head"><h2>الحسابات</h2>${can('removeAccount') ? '<button class="btn btn--small" type="button" data-newacc>+ حساب جديد</button>' : ''}</div>
          <table class="table table--cards"><thead><tr><th>الحساب</th><th>اسم الدخول</th><th>يقدر يعمل إيه</th><th></th></tr></thead><tbody>
          ${accounts.map((a) => `<tr><td class="main-cell"><b>${esc(a.name)}</b></td><td data-label="اسم الدخول"><span class="ltr">${esc(a.user)}</span></td><td data-label="يقدر" class="small">${WHAT[a.role]}</td><td class="end">${can('removeAccount') && a.role !== 'owner' ? `<button class="btn btn--small btn--ghost" type="button" data-remove="${esc(a.user)}">شيل الحساب</button>` : ''}</td></tr>`).join('')}
          </tbody></table></section>
        <section class="card"><div class="card__head"><h2>مين يعمل إيه</h2><p class="note">نفس القاعدة هتتطبق في السيرفر، مش في الشاشة بس</p></div>
          <div class="scroll-x"><table class="table"><thead><tr><th></th>${ALL.map((r) => `<th>${ROLE_NAME[r]}</th>`).join('')}</tr></thead><tbody>
          ${ROWS.map(([n, ok]) => `<tr><td>${n}</td>${ALL.map((r) => `<td>${ok(r) ? '<span style="color:var(--good)">✓</span>' : '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div></section>
      </div>`,
      after: (el) => {
        $$('[data-remove]', el).forEach((b) => b.addEventListener('click', () => toast(`في النسخة الحقيقية: حساب «${b.dataset.remove}» بيتقفل على طول، وكل اللي عمله بيفضل متسجل.`)));
        const n = $('[data-newacc]', el);
        if (n) n.addEventListener('click', () => toast('في النسخة الحقيقية: الأونر يكتب الاسم والإيميل والدور، والموظف ياخد لينك يعمل منه الباسورد والتحقق بخطوتين.'));
      },
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The router
  // ------------------------------------------------------------------------------------------------------------------
  const VIEWS = { today: viewToday, customers: viewCustomers, games: viewGames, campaigns: viewCampaigns, feedback: viewFeedback, loyalty: viewLoyalty, codes: viewCodes, shift: viewShift, inbox: viewInbox, team: viewTeam };
  let lastPath = '';
  function route() {
    const raw = (location.hash || '#/today').slice(2);
    const [path, query = ''] = raw.split('?');
    const params = new URLSearchParams(query);
    const [section, id] = path.split('/');
    const key = section === 'customer' ? 'customers' : VIEWS[section] ? section : 'today';
    navLinks(key);
    let v;
    if (!SEE[key].includes(role)) {
      v = { title: NAV.find((n) => n.key === key).name, html: `<div class="locked">${I.key}<h2>القسم ده مش ضمن صلاحية ${ROLE_NAME[role]}</h2><p>${account && account.role === 'owner' ? 'غيّر «جرّب اللوحة بعين» من القايمة، أو ارجع' : 'ارجع'} <a href="#/today">للنهارده</a>.</p></div>` };
    } else v = section === 'customer' ? viewCustomer(+id) : VIEWS[key](params);
    $('[data-title]').textContent = v.title;
    $('[data-sub]').textContent = v.sub || '';
    document.title = `Escape Hub 13 · ${v.title}`;
    find.hidden = !SEE.customers.includes(role);
    view.innerHTML = v.html;
    if (v.after) v.after(view);
    drawer(false);
    if (raw !== lastPath) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); lastPath = raw; }
  }
  window.addEventListener('hashchange', route);

  // ------------------------------------------------------------------------------------------------------------------
  // Signing in: a name and a password per account (crm/accounts.js keeps a hash of each). Still a curtain over demo
  // data, checked in the browser: the real panel signs in through Supabase Auth with a second step (decision T11).
  // ------------------------------------------------------------------------------------------------------------------
  // What the tour (crm/tour.js) needs from the panel.
  window.EH13_CRM_UI = {
    sees: (key) => SEE[key].includes(role),
    owner: () => !!account && account.role === 'owner',
    user: () => (account ? account.user : ''),
    signedIn: () => !!account,
    drawer,
  };
  const gate = $('[data-gate]');
  const app = $('[data-app]');
  // The accounts to pick from, so nobody has to remember a sign-in name.
  $('[data-users]').append(...(window.EH13_ACCOUNTS || []).map((x) => new Option(`${x.name} (${x.user})`, x.user)));
  const sha = async (text) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const open = (a) => {
    account = a;
    role = a.role;
    if (a.role === 'owner') {
      try { const r = sessionStorage.getItem('eh13-crm-role'); if (ALL.includes(r)) role = r; } catch { /* fine */ }
    }
    roleSelect.value = role;
    $('[data-preview]').hidden = a.role !== 'owner';
    $('[data-demo-note]').innerHTML = D.DEMO ? '<span aria-hidden="true">◆</span> بيانات تجريبية' : '<span aria-hidden="true">◆</span> مش متوصلة لسه';
    $('[data-demo-note]').title = D.DEMO ? 'كل اللي هنا متألف عشان تشوف الشكل' : 'اللوحة لسه مش متوصلة بالـ database: أي حاجة تعملها بتتمسح لما تقفل الصفحة';
    const sw = $('[data-demo-switch]');
    sw.hidden = a.role !== 'owner';
    sw.textContent = D.DEMO ? 'امسح البيانات التجريبية' : 'املا ببيانات تجريبية';
    sw.onclick = () => {
      try { if (D.DEMO) localStorage.removeItem('eh13-demo'); else localStorage.setItem('eh13-demo', '1'); } catch { /* fine */ }
      location.reload();
    };
    $('[data-me]').innerHTML = `<span class="avatar">${esc(initials(a.name))}</span><span><b>${esc(a.name)}</b><br><span class="muted small ltr">${esc(a.user)}</span></span>`;
    gate.hidden = true;
    app.hidden = false;
    document.body.classList.remove('is-gate');
    // The numbers page opens without its own password for those who may see it.
    if (SEE.numbers.includes(a.role)) {
      fetch('../dashboard/').then((r) => (r.ok ? r.text() : '')).then((t) => {
        const m = t.match(/data-lock="([^"]+)"/);
        if (m) try { sessionStorage.setItem('eh13-dash', m[1]); } catch { /* fine */ }
      }).catch(() => {});
    }
    route();
    document.dispatchEvent(new Event('eh13:open'));
  };
  gate.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = gate.elements.user.value.trim().toLowerCase();
    const a = (window.EH13_ACCOUNTS || []).find((x) => x.user === user);
    const hash = await sha(`eh13-crm:${user}:${gate.elements.pass.value}`);
    if (a && a.hash === hash) {
      try { sessionStorage.setItem('eh13-crm', JSON.stringify({ user, hash })); } catch { /* fine */ }
      open(a);
    } else {
      $('[data-gate-help]').textContent = 'الباسورد مش صح.';
      gate.elements.pass.select();
    }
  });
  $('[data-out]').addEventListener('click', () => {
    try { ['eh13-crm', 'eh13-crm-role', 'eh13-dash'].forEach((k) => sessionStorage.removeItem(k)); } catch { /* fine */ }
    location.hash = '';
    location.reload();
  });
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('eh13-crm') || 'null'); } catch { /* private window: ask again */ }
  const again = saved && (window.EH13_ACCOUNTS || []).find((x) => x.user === saved.user && x.hash === saved.hash);
  if (again) open(again);
  else gate.elements.user.focus();
  gate.elements.user.addEventListener('change', () => gate.elements.pass.focus());
})();
