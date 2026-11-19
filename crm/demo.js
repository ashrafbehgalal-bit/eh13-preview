// Demo data for the CRM prototype: made up, but shaped like what the booking engine (app/db) will hold once the site
// is live (the owner's choice, 2026-11-18: the screens first with demo data, the real wiring after his approval).
// Every trip of the last 180 days and the next 14 is drawn one by one, with its team, its money, the Game Master's log
// and the visitor's word afterwards, so every screen agrees with every other. The same seed gives the same data.
// The houses, start times, team sizes, prices and deposit are the real ones (app/src/config/business.ts); the drink's
// price, the escape rates and every name are made up.
window.EH13_CRM = (() => {
  // Empty unless the owner asked for demo data (the switch in the CRM or on the numbers page): the real data comes
  // when the site is connected to the engine. One switch for both pages; it lives in this browser only.
  const DEMO = (() => { try { return localStorage.getItem('eh13-demo') === '1'; } catch { return false; } })();
  let seed = 1313;
  const rand = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (items, weight) => {
    const total = items.reduce((s, x) => s + weight(x), 0);
    let r = rand() * total;
    for (const x of items) { r -= weight(x); if (r <= 0) return x; }
    return items[items.length - 1];
  };
  const one = (list) => list[Math.floor(rand() * list.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const chance = (p) => rand() < p;
  const pad = (n) => String(n).padStart(2, '0');

  const HOUSES = [
    { slug: 'tomb', name: 'مقبرة الملك الحي', short: 'المقبرة', share: 0.42, max: 12, escape: 0.16,
      starts: ['15:30', '17:00', '18:30', '20:00', '21:30', '23:00', '00:30', '02:00', '03:30'] },
    { slug: 'case', name: 'الحالة 404', short: 'الحالة 404', share: 0.35, max: 12, escape: 0.3,
      starts: ['16:00', '17:30', '19:00', '20:30', '22:00', '23:30', '01:00', '02:30', '04:00'] },
    { slug: 'morgue', name: 'المشرحة 13', short: 'المشرحة', share: 0.23, max: 8, escape: 0.38,
      starts: ['15:00', '16:30', '18:00', '19:30', '21:00', '22:30', '00:00', '01:30', '03:00'] },
  ];
  const HOUSE = Object.fromEntries(HOUSES.map((h) => [h.slug, h]));
  // Minutes from the start of the working day; a start after midnight belongs to the evening before.
  const minutes = (t) => { const [h, m] = t.split(':').map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };

  const ROLES = { owner: 'الأونر', manager: 'الـ CEO', marketer: 'الماركتير', media_buyer: 'الميديا باير', front_desk: 'الاستقبال', game_master: 'الـ Game Master' };
  const STAFF = [
    { id: 'st1', name: 'أحمد م.', role: 'manager' },
    { id: 'st2', name: 'منة ع.', role: 'front_desk' },
    { id: 'st3', name: 'سارة ح.', role: 'front_desk' },
    { id: 'st4', name: 'كريم س.', role: 'game_master' },
    { id: 'st5', name: 'مازن ف.', role: 'game_master' },
    { id: 'st6', name: 'يوسف ر.', role: 'game_master' },
    { id: 'st7', name: 'نادين ك.', role: 'marketer' },
    { id: 'st8', name: 'عمر ط.', role: 'media_buyer' },
  ];
  const GMS = STAFF.filter((s) => s.role === 'game_master');
  const DESK = STAFF.filter((s) => s.role === 'front_desk');

  const SOURCES = {
    tiktok: 'تيك توك', instagram: 'إنستجرام', google: 'جوجل', facebook: 'فيسبوك', direct: 'الموقع مباشرة',
    whatsapp: 'واتساب', phone: 'تليفون', walkin: 'جه المكان', team: 'جه مع فريق', referral: 'ترشيح صاحب',
  };
  const WEB = [['tiktok', 0.34], ['instagram', 0.3], ['google', 0.2], ['direct', 0.1], ['facebook', 0.06]];
  const DESK_SOURCES = [['whatsapp', 0.7], ['phone', 0.22], ['walkin', 0.08]];
  const METHODS = { card: 'كارت', wallet: 'محفظة', instapay: 'InstaPay', cash: 'كاش', gift: 'كارت هدية' };
  const AREAS = [
    'العبور', 'الشروق', 'مدينتي', 'الرحاب', 'التجمع', 'مدينة نصر', 'مصر الجديدة', 'عين شمس والمطرية', 'المرج',
    'شبرا', 'شبرا الخيمة', 'وسط البلد والزمالك', 'المقطم', 'المعادي', 'حلوان', 'المهندسين والدقي', 'الهرم وفيصل',
    '6 أكتوبر', 'الشيخ زايد', 'حتة تانية في القاهرة الكبرى', 'محافظة تانية', 'بره مصر',
  ];
  const AREA_WEIGHT = [9, 6, 3, 3, 8, 9, 8, 5, 2, 3, 3, 2, 2, 3, 1, 2, 2, 2, 2, 4, 5, 1];

  const DEPOSIT = 300;
  const DRINK = 40; // made up: the drinks' prices are not in yet
  const perPerson = (n) => (n === 2 ? 500 : n === 3 ? 400 : n === 4 ? 350 : 300);
  const TEAM = [[3, 0.1], [4, 0.2], [5, 0.2], [6, 0.17], [7, 0.1], [8, 0.09], [9, 0.05], [10, 0.04], [11, 0.03], [12, 0.02]];
  const SLOT_WEIGHT = [0.5, 0.7, 1, 1.4, 1.6, 1.5, 1.3, 0.9, 0.6];
  const PULL = [0.9, 0.85, 0.85, 0.95, 1.25, 1.4, 1.15]; // Sunday first

  const MALE = ['أحمد', 'محمد', 'مصطفى', 'يوسف', 'عمر', 'كريم', 'ياسين', 'آدم', 'زياد', 'خالد', 'مروان', 'سيف', 'حسن', 'علي', 'عبد الرحمن', 'مازن', 'شادي', 'طارق', 'إسلام', 'بلال'];
  const FEMALE = ['مريم', 'سلمى', 'نور', 'هنا', 'فرح', 'ملك', 'جنى', 'رنا', 'دينا', 'ياسمين', 'سارة', 'منة', 'آية', 'هدى', 'لينا', 'روان', 'شهد', 'ندى'];
  const FAMILY = ['حسن', 'عبد الله', 'إبراهيم', 'السيد', 'محمود', 'فؤاد', 'الشريف', 'سليمان', 'عادل', 'رمضان', 'كمال', 'نبيل', 'سامي', 'جمال', 'عثمان', 'رشدي', 'فتحي', 'منصور', 'زكي', 'الجمال'];
  const CODE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const code = (n) => Array.from({ length: n }, () => CODE[Math.floor(rand() * CODE.length)]).join('');

  const INCIDENTS = ['واحدة خافت وطلبت تخرج، خرجت من باب الطوارئ', 'قفل الأوضة 4 علّق، اتفتح من بره', 'حد شد ديكور في الأوضة 2',
    'تليفون اتفتح جوه، اتقفل بعد التنبيه', 'الكاميرا 3 فصلت 10 دقايق'];
  const COMMENTS = {
    5: ['أحسن تجربة رعب عملناها في حياتنا', 'الممثل كان مرعب بجد، هنرجع للبيت التاني', 'الديكور خرافي والألغاز حلوة', 'الـ Game Master كان محترم جداً وساعدنا في الوقت الصح', 'رحلة سعيدة فعلاً 😂', 'المساحة كبيرة جداً، حسيت إني جوه فيلم'],
    4: ['حلوة جداً بس الوقت خلص بسرعة', 'كانت ممتعة، كان نفسنا في hints أوضح', 'تجربة قوية، بس الاستقبال اتأخر علينا شوية', 'الرعب جامد، الألغاز صعبة شوية'],
    3: ['حلوة بس فيه أوضة الإضاءة فيها ضعيفة جداً', 'الانتظار برة كان طويل', 'لغز في النص كان مش واضح خالص'],
    2: ['قفل علّق وضيّع علينا وقت', 'اتأخرنا 10 دقايق في الدخول ومحدش عوّضنا'],
    1: ['حسيت إن الوقت اتحسب علينا من قبل ما ندخل', 'التكييف كان واقف والجو كان صعب جداً'],
  };
  const NOTES = ['بيحب يحجز آخر الليل', 'جاب شركته مرة، ممكن يرجع بمجموعة كبيرة', 'بيسأل دايماً على العروض', 'مرة جه متأخر 20 دقيقة',
    'طلب تورتة عيد ميلاد المرة اللي فاتت', 'صاحب صفحة على تيك توك، صوّر في المكان'];

  // Promo codes: offers, influencers, contests and companies. Two live, the rest done.
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayAt = (k) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + k);
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const TODAY = iso(base);
  const CLOCK = 21 * 60 + 40; // the demo's "now": 9:40 at night
  const PAST = 180;
  const FUTURE = 14;
  const PROMOS = !DEMO ? [] : [
    { code: 'HALLOWEEN20', kind: 'offer', label: 'عرض الهالوين', pct: 20, minTeam: 5, from: '2026-10-29', to: '2026-10-31', share: 0.5 },
    { code: 'NOUR10', kind: 'influencer', label: 'نور، تيك توك', pct: 10, minTeam: 3, from: iso(dayAt(-45)), to: iso(dayAt(30)), share: 0.06 },
    { code: 'SPOOKY15', kind: 'influencer', label: 'سبوكي ستوريز، إنستجرام', pct: 15, minTeam: 4, from: iso(dayAt(-100)), to: iso(dayAt(-40)), share: 0.05 },
    { code: 'CORP10', kind: 'corporate', label: 'الشركات', pct: 10, minTeam: 10, from: iso(dayAt(-180)), to: iso(dayAt(180)), share: 0.35 },
    { code: 'TT13WIN', kind: 'contest', label: 'جايزة مسابقة تيك توك', pct: 100, minTeam: 4, from: iso(dayAt(-20)), to: iso(dayAt(40)), share: 0.004, max: 1 },
  ];

  const people = [];
  const bookings = [];
  const played = [];
  const newPerson = (k, source) => {
    const female = chance(0.44);
    const p = {
      id: people.length + 1,
      name: `${one(female ? FEMALE : MALE)} ${one(FAMILY)}`,
      female,
      phone: `01${one(['0', '1', '2', '5'])}${int(0, 9)}••••${pad(int(0, 99))}${int(0, 9)}`,
      area: pick(AREAS.map((a, i) => [a, AREA_WEIGHT[i]]), (x) => x[1])[0],
      source,
      created: iso(dayAt(k)),
      // From the waiver, which every player fills (the owner's choice, 2026-11-18)
      age: int(16, 36),
      birthday: chance(0.82) ? { m: int(1, 12), d: int(1, 28) } : null,
      marketing: chance(0.6),
      photo: chance(0.74),
      referral: `R-${code(4)}`,
      referredBy: null,
      referrals: 0,
      tags: [],
      notes: '',
      visits: [],
      booked: [],
      houses: new Set(),
      inPlayed: false,
    };
    if (chance(0.025)) p.notes = one(NOTES);
    people.push(p);
    return p;
  };

  for (let k = -PAST; DEMO && k <= FUTURE; k++) {
    const d = dayAt(k);
    const date = iso(d);
    const dow = d.getDay();
    const halloween = date >= '2026-10-28' && date <= '2026-11-01';
    const trend = 0.78 + 0.42 * Math.min(1, (k + PAST) / PAST);
    // Later days fill as they come near; today is drawn a busy evening, so the shift's board has something to show.
    const ahead = k > 0 ? Math.max(0.2, 1 - k / 15) : k === 0 ? 1.9 : 1;
    const count = Math.min(24, Math.round(8 * PULL[dow] * trend * (0.8 + rand() * 0.4) * (halloween ? 1.6 : 1) * ahead));
    const taken = new Set();
    const todays = [];
    for (let i = 0; i < count; i++) {
      const house = pick(HOUSES, (h) => h.share);
      const free = house.starts.map((_, at) => at).filter((at) => !taken.has(house.slug + at));
      if (!free.length) continue;
      const slot = pick(free, (at) => SLOT_WEIGHT[at]);
      taken.add(house.slug + slot);
      const time = house.starts[slot];
      const start = minutes(time);
      const size = pick(TEAM.filter(([n]) => n <= house.max), (x) => x[1])[0];

      const channel = chance(0.66) ? 'web' : 'staff';
      const source = pick(channel === 'web' ? WEB : DESK_SOURCES, (x) => x[1])[0];
      let booker = null;
      if (played.length > 40 && chance(0.2)) {
        for (let t = 0; t < 6 && !booker; t++) {
          const c = one(played);
          if (!c.houses.has(house.slug) || t === 5) booker = c;
        }
      }
      let referrer = null;
      if (!booker) {
        booker = newPerson(k, source);
        if (played.length > 40 && chance(0.06)) {
          referrer = one(played);
          booker.referredBy = referrer.id;
          booker.source = 'referral';
          referrer.referrals++;
        }
      }

      let status;
      const r = rand();
      if (k < 0) status = r < 0.05 ? 'cancelled' : r < 0.09 ? 'no_show' : 'completed';
      else if (k === 0) {
        if (start + 90 <= CLOCK) status = r < 0.05 ? 'no_show' : 'completed';
        else if (start <= CLOCK) status = 'playing';
        else status = start - CLOCK <= 35 && chance(0.6) ? 'arrived' : 'confirmed';
      } else status = r < 0.03 ? 'cancelled' : r < 0.08 ? 'awaiting' : 'confirmed';
      const played_ = status === 'completed' || status === 'playing';

      // Who signed the waiver so far: the one who booked agreed at the checkout; the rest sign by link or at the desk.
      let signRate = 0.84;
      if (!played_) {
        if (status === 'arrived') signRate = 0.7;
        else if (k === 0) signRate = start - CLOCK < 150 ? 0.45 : 0.25;
        else if (k > 0) signRate = k <= 2 ? 0.2 : 0.04;
        if (status === 'cancelled' || status === 'no_show') signRate = 0;
      }
      const team = [booker];
      const players = [{ id: booker.id, signed: true }];
      for (let j = 1; j < size; j++) {
        if (!chance(signRate)) { players.push({ id: null, signed: false }); continue; }
        let p = null;
        if (played.length > 40 && chance(0.09)) { const c = one(played); if (!team.includes(c)) p = c; }
        if (!p) p = newPerson(k, 'team');
        team.push(p);
        players.push({ id: p.id, signed: true });
      }

      const per = perPerson(size);
      const birthday = chance(0.07);
      const base_ = per * size + (birthday ? per : 0);
      const promo = PROMOS.find((p) => date >= p.from && date <= p.to && size >= p.minTeam && chance(p.share * (p.kind === 'offer' ? 1 : 0.4)));
      const discount = promo ? Math.min(base_ - DEPOSIT, Math.round((base_ * promo.pct) / 100)) : 0;
      const depositMethod = channel === 'web'
        ? pick([['card', 0.25], ['wallet', 0.4], ['instapay', 0.35]], (x) => x[1])[0]
        : pick([['cash', 0.5], ['wallet', 0.3], ['instapay', 0.2]], (x) => x[1])[0];
      const drinks = played_ && chance(0.42) ? int(1, size) : 0;
      const rest = Math.max(0, base_ - discount - DEPOSIT);
      const restPaid = status === 'completed' || (status === 'playing' && chance(0.85));
      const b = {
        id: bookings.length + 1,
        code: `EH-${code(5)}`,
        date, k, dow, house: house.slug, slot, time, start, size, channel, source, status,
        booker: booker.id,
        createdBy: channel === 'staff' ? one(DESK).id : null,
        players,
        birthday, promo: promo ? promo.code : null, discount, referral: referrer ? referrer.id : null,
        price: base_, per, deposit: status === 'awaiting' ? 0 : DEPOSIT, depositMethod, rest,
        restPaid: restPaid ? rest : 0,
        restMethod: restPaid ? pick([['cash', 0.6], ['wallet', 0.25], ['instapay', 0.15]], (x) => x[1])[0] : null,
        collectedBy: restPaid ? one(DESK).id : null,
        drinks, drinksPaid: status === 'completed' ? drinks * DRINK : 0,
        gm: null, feedback: null, messages: [],
      };
      if (status === 'no_show' || status === 'cancelled') { b.rest = 0; b.restPaid = 0; }

      if (status === 'completed') {
        const escaped = chance(house.escape * (size >= 6 ? 1.2 : 0.85));
        const late = k === 0 && CLOCK - (start + 90) < 120 && chance(0.6);
        if (!late) {
          b.gm = {
            by: one(GMS).id, escaped,
            minutes: escaped ? int(61, 89) : 90,
            hints: escaped ? int(0, 4) : int(2, 7),
            left: chance(0.06) ? 1 : 0,
            incident: chance(0.035) ? one(INCIDENTS) : '',
            photo: b.players.length > 2 && chance(0.85),
          };
        }
        if (k < 0 && chance(0.56)) {
          const score = pick([[5, 0.6], [4, 0.23], [3, 0.09], [2, 0.045], [1, 0.035]], (x) => x[1])[0] - (b.gm && b.gm.incident && chance(0.5) ? 1 : 0);
          const s = Math.max(1, score);
          b.feedback = {
            score: s,
            comment: chance(0.55) ? one(COMMENTS[s]) : '',
            google: s >= 4 ? { asked: true, clicked: chance(0.42) } : null,
            follow: s <= 3 ? { status: k < -10 || chance(0.45) ? 'closed' : 'open', by: k < -10 ? 'st1' : null } : null,
          };
        }
      }
      // What the engine sent this booking on WhatsApp (the outbox), for the customer's timeline.
      if (status !== 'awaiting') b.messages.push({ kind: 'confirm', day: k - Math.min(int(0, 4), PAST + k) });
      if (status !== 'cancelled' && k >= -PAST + 1 && (k < 0 || k === 0 || k === 1)) b.messages.push({ kind: 'reminder', day: k - 1 });
      if (b.feedback || (status === 'completed' && k < 0)) b.messages.push({ kind: 'ask', day: k });

      booker.booked.push(b.id);
      if (status === 'completed') {
        for (const p of team) {
          p.visits.push(b.id);
          p.houses.add(house.slug);
          if (!p.inPlayed) { p.inPlayed = true; played.push(p); }
        }
      }
      if (size >= 10 && chance(0.4) && !booker.tags.includes('شركة')) booker.tags.push('شركة');
      bookings.push(b);
      todays.push(b);
    }
  }

  const byId = (id) => people[id - 1];
  const booking = (id) => bookings[id - 1];

  // Each person, summed up once: what the profile, the lists and the segments read.
  for (const p of people) {
    const visits = p.visits.map(booking);
    const own = p.booked.map(booking);
    p.visitCount = visits.length;
    p.firstVisit = visits.length ? visits[0].date : null;
    p.lastVisit = visits.length ? visits[visits.length - 1].date : null;
    p.spent = own.reduce((s, b) => s + (b.status === 'cancelled' || b.status === 'no_show' ? b.deposit : b.deposit + b.restPaid + b.drinksPaid), 0);
    p.brought = own.filter((b) => b.status === 'completed').reduce((s, b) => s + b.size - 1, 0);
    const scores = own.filter((b) => b.feedback).map((b) => b.feedback.score);
    p.lastScore = scores.length ? scores[scores.length - 1] : null;
    p.upcoming = own.find((b) => b.k >= 0 && ['confirmed', 'awaiting', 'arrived'].includes(b.status)) || null;
    p.noShows = own.filter((b) => b.status === 'no_show').length;
  }

  // Gift cards: sold at the desk today, online later. Each one's balance after the bookings it paid.
  const giftcards = [];
  const buyers = people.filter((p) => p.visitCount > 0);
  for (let i = 0; DEMO && i < 38; i++) {
    const k = -int(0, 150);
    const value = one([1000, 1500, 2000, 3000]);
    const buyer = one(buyers);
    const age = -k;
    let status = 'active';
    let balance = value;
    if (age > 30 && chance(0.7)) { status = 'used'; balance = 0; }
    else if (age > 20 && chance(0.3)) { status = 'part'; balance = Math.round((value * int(2, 6)) / 10 / 50) * 50; }
    if (status === 'active' && age > 120) status = 'expired';
    giftcards.push({
      code: `GC-${code(4)}-${code(4)}`, value, balance, status, sold: iso(dayAt(k)), expires: iso(dayAt(k + 180)),
      buyer: buyer.id, to: `${one(chance(0.5) ? FEMALE : MALE)} ${one(FAMILY)}`, soldBy: one(DESK).id,
    });
  }
  giftcards.sort((a, b) => (a.sold < b.sold ? 1 : -1));

  return {
    DEMO, HOUSES, HOUSE, ROLES, STAFF, SOURCES, METHODS, AREAS, PROMOS, DEPOSIT, DRINK, INCIDENTS,
    TODAY, CLOCK, PAST, FUTURE, people, bookings, giftcards, byId, booking, iso, dayAt, minutes, perPerson,
  };
})();
