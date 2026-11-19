// Demo numbers for the dashboard: made up, but shaped like what Google Analytics 4 and the booking engine will report
// once the real site is live (the owner's choice, 2026-11-18: demo data first, the real wiring with the real site).
// Every visitor of the last 180 days is drawn one by one, so the funnel, the sources, the places and the bookings all
// agree with each other. The same seed gives the same numbers on every load.
// The houses, their start times, team sizes and prices are the real ones (app/src/config/business.ts).
window.EH13_DEMO = (() => {
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
  const pick = (items, weight = (x) => x.share) => {
    const total = items.reduce((s, x) => s + weight(x), 0);
    let r = rand() * total;
    for (const x of items) { r -= weight(x); if (r <= 0) return x; }
    return items[items.length - 1];
  };

  const HOUSES = [
    { slug: 'tomb', name: 'مقبرة الملك الحي', short: 'المقبرة', share: 0.42, fit: 1, max: 12,
      starts: ['15:30', '17:00', '18:30', '20:00', '21:30', '23:00', '00:30', '02:00', '03:30'] },
    { slug: 'case', name: 'الحالة 404', short: 'الحالة 404', share: 0.35, fit: 0.9, max: 12,
      starts: ['16:00', '17:30', '19:00', '20:30', '22:00', '23:30', '01:00', '02:30', '04:00'] },
    { slug: 'morgue', name: 'المشرحة 13', short: 'المشرحة', share: 0.23, fit: 1.15, max: 8,
      starts: ['15:00', '16:30', '18:00', '19:30', '21:00', '22:30', '00:00', '01:30', '03:00'] },
  ];
  const SOURCES = [
    { key: 'tiktok', name: 'تيك توك', share: 0.34, conv: 0.6 },
    { key: 'instagram', name: 'إنستجرام', share: 0.27, conv: 1.1 },
    { key: 'google', name: 'جوجل', share: 0.16, conv: 1.7 },
    { key: 'whatsapp', name: 'لينك على واتساب', share: 0.1, conv: 1.8 },
    { key: 'direct', name: 'دخول مباشر', share: 0.08, conv: 1.2 },
    { key: 'facebook', name: 'فيسبوك', share: 0.05, conv: 0.8 },
  ];
  const DEVICES = [
    { key: 'mobile', name: 'موبايل', share: 0.81, conv: 0.95 },
    { key: 'desktop', name: 'كمبيوتر', share: 0.16, conv: 1.3 },
    { key: 'tablet', name: 'تابلت', share: 0.03, conv: 1 },
  ];
  // Google Analytics names the governorate (its "region") from the visitor's internet address: close, not exact.
  const REGIONS = [
    ['القاهرة', 0.5], ['الجيزة', 0.17], ['القليوبية', 0.07], ['الشرقية', 0.055], ['الإسكندرية', 0.05],
    ['الدقهلية', 0.03], ['الإسماعيلية', 0.025], ['الغربية', 0.02], ['السويس', 0.015], ['محافظات تانية', 0.065],
  ].map(([name, share]) => ({ name, share }));
  // Greater Cairo, area by area (the owner's wish, 2026-11-18). The area also comes from the internet address: home
  // internet usually names it, mobile data mostly says only "Cairo", so those visitors stay "not clear" (decision T30).
  // Where each area sits is its centre, to draw it on the map and measure how far it is from the venue.
  const VENUE = { name: 'Escape Hub 13', lat: 30.1754, lon: 31.4775 }; // Golf City, Obour (tools/map-flight/flight.json)
  const AREAS = [
    ['مدينة نصر', 'القاهرة', 30.056, 31.345, 0.15], ['مصر الجديدة', 'القاهرة', 30.091, 31.322, 0.12],
    ['التجمع', 'القاهرة', 30.02, 31.47, 0.14], ['الرحاب', 'القاهرة', 30.06, 31.495, 0.035],
    ['مدينتي', 'القاهرة', 30.098, 31.65, 0.035], ['الشروق', 'القاهرة', 30.125, 31.61, 0.05],
    ['المعادي', 'القاهرة', 29.96, 31.257, 0.08], ['المقطم', 'القاهرة', 30.011, 31.3, 0.04],
    ['عين شمس والمطرية', 'القاهرة', 30.13, 31.32, 0.06], ['المرج', 'القاهرة', 30.152, 31.336, 0.03],
    ['شبرا', 'القاهرة', 30.08, 31.245, 0.05], ['وسط البلد والزمالك', 'القاهرة', 30.05, 31.232, 0.05],
    ['حلوان', 'القاهرة', 29.85, 31.334, 0.03],
    ['الهرم وفيصل', 'الجيزة', 29.995, 31.16, 0.3], ['المهندسين والدقي', 'الجيزة', 30.05, 31.205, 0.25],
    ['6 أكتوبر', 'الجيزة', 29.965, 30.93, 0.25], ['الشيخ زايد', 'الجيزة', 30.04, 30.985, 0.2],
    ['العبور', 'القليوبية', 30.228, 31.475, 0.35], ['شبرا الخيمة', 'القليوبية', 30.125, 31.245, 0.3],
  ].map(([name, region, lat, lon, share]) => ({ name, region, lat, lon, share, km: distance(lat, lon) }));
  const UNCLEAR = 'المنطقة مش واضحة';
  function distance(lat, lon) {
    const rad = Math.PI / 180;
    const a = Math.sin(((lat - VENUE.lat) * rad) / 2) ** 2
      + Math.cos(lat * rad) * Math.cos(VENUE.lat * rad) * Math.sin(((lon - VENUE.lon) * rad) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  }
  // Without a clear area: most visitors on mobile data, few on home internet.
  const UNCLEAR_BY_DEVICE = { mobile: 0.42, tablet: 0.25, desktop: 0.12 };
  // Near the venue, a visit turns into a booking more often.
  const nearPull = (area) => (area && area.km != null ? Math.max(0.6, Math.min(1.45, 1.45 - area.km / 40)) : 1);
  const COUNTRIES = [
    ['مصر', 0.93], ['السعودية', 0.03], ['الإمارات', 0.015], ['الكويت', 0.008], ['دول تانية', 0.017],
  ].map(([name, share]) => ({ name, share }));
  // The visit, step by step, with the events the real site will send (docs/01-strategy.md, 7.2).
  const STAGES = [
    { key: 'visit', name: 'دخلوا الموقع', event: 'session_start' },
    { key: 'houses', name: 'وصلوا للبيوت', event: 'view_houses' },
    { key: 'house', name: 'اختاروا بيت', event: 'view_room' },
    { key: 'slot', name: 'اختاروا يوم وميعاد', event: 'select_slot' },
    { key: 'checkout', name: 'داسوا «احجز»', event: 'begin_checkout' },
    { key: 'booked', name: 'حجزوا ودفعوا العربون', event: 'purchase' },
  ];
  const TEAM = [[3, 0.1], [4, 0.2], [5, 0.2], [6, 0.17], [7, 0.1], [8, 0.09], [9, 0.05], [10, 0.04], [11, 0.03], [12, 0.02]];
  const LEAD = [[0, 0.22], [1, 0.25], [2, 0.13], [3, 0.1], [4, 0.06], [5, 0.05], [6, 0.05], [7, 0.04], [10, 0.05], [14, 0.05]];
  const SLOT_WEIGHT = [0.04, 0.07, 0.1, 0.15, 0.17, 0.16, 0.14, 0.1, 0.07];
  const perPerson = (n) => (n === 3 ? 400 : n === 4 ? 350 : 300);
  const DEPOSIT = 300;
  const FIRST = ['أحمد', 'محمد', 'مصطفى', 'يوسف', 'عمر', 'كريم', 'مريم', 'سلمى', 'نور', 'هنا', 'فرح', 'ياسين', 'آدم', 'ملك', 'زياد', 'خالد', 'رنا', 'إياد', 'ليلى', 'حسن'];
  const LAST = 'م ع س ح ف ك ر ش ن ج'.split(' ');
  const CODE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  const DAY = 86400000;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const COUNT = 180;
  const first = today - COUNT * DAY; // the last day drawn is yesterday, the last full day
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const WEEKDAY_PULL = [0.85, 0.85, 0.9, 1, 1.3, 1.35, 1.1]; // Sunday first, as getUTCDay counts

  const days = [];
  const bookings = [];
  const taken = new Set();
  const blank = (list, key = 'key') => Object.fromEntries(list.map((x) => [x[key], 0]));

  for (let d = 0; d < COUNT; d++) {
    const t = first + d * DAY;
    const date = iso(t);
    const dow = new Date(t).getUTCDay();
    // Halloween week: a TikTok video took off. From 8 November: an Instagram ad runs.
    const halloween = date >= '2026-10-28' && date <= '2026-11-02';
    const instaAd = date >= '2026-11-08';
    const trend = 0.8 + 0.45 * (d / COUNT);
    const visitors = !DEMO ? 0 : Math.round(175 * trend * WEEKDAY_PULL[dow] * (0.86 + rand() * 0.28) * (halloween ? 1.55 : 1));
    const day = {
      date, t, dow, visitors, stages: [0, 0, 0, 0, 0, 0], whatsapp: 0,
      source: Object.fromEntries(SOURCES.map((s) => [s.key, [0, 0]])),
      device: Object.fromEntries(DEVICES.map((s) => [s.key, [0, 0]])),
      region: blank(REGIONS, 'name'), country: blank(COUNTRIES, 'name'),
      area: Object.fromEntries([...AREAS.map((a) => a.name), UNCLEAR].map((n) => [n, [0, 0]])),
      picked: blank(HOUSES, 'slug'), booked: blank(HOUSES, 'slug'),
    };
    const sourceWeight = (s) => s.share * (halloween && s.key === 'tiktok' ? 2.6 : 1) * (instaAd && s.key === 'instagram' ? 1.5 : 1);
    for (let v = 0; v < visitors; v++) {
      const source = pick(SOURCES, sourceWeight);
      const device = pick(DEVICES);
      const country = pick(COUNTRIES);
      const region = country.name === 'مصر' ? pick(REGIONS) : null;
      let area = null;
      const inside = region ? AREAS.filter((a) => a.region === region.name) : [];
      // The rest of Qalyubia (Banha and its villages) is not Greater Cairo.
      if (inside.length && !(region.name === 'القليوبية' && rand() < 0.35)) {
        area = rand() < UNCLEAR_BY_DEVICE[device.key] ? { name: UNCLEAR, km: null } : pick(inside);
      }
      day.source[source.key][0]++;
      day.device[device.key][0]++;
      day.country[country.name]++;
      if (region) day.region[region.name]++;
      if (area) day.area[area.name][0]++;
      day.stages[0]++;
      if (rand() < 0.035 * source.conv) day.whatsapp++;
      if (rand() > 0.6) continue;
      day.stages[1]++;
      if (rand() > 0.5) continue;
      day.stages[2]++;
      const house = pick(HOUSES);
      day.picked[house.slug]++;
      if (rand() > 0.42 * house.fit * Math.sqrt(device.conv)) continue;
      day.stages[3]++;
      if (rand() > 0.55) continue;
      day.stages[4]++;
      if (rand() > Math.min(0.92, 0.45 * source.conv * device.conv * nearPull(area) * (halloween ? 0.8 : 1))) continue;

      // A booking: when it is played, at what time, how many.
      const lead = pick(LEAD, (x) => x[1])[0];
      const playT = t + lead * DAY;
      let slot = -1;
      for (let tries = 0; tries < 9 && slot < 0; tries++) {
        const i = pick(SLOT_WEIGHT.map((w, at) => ({ w, at })), (x) => x.w).at;
        const at = tries === 0 ? i : (i + tries) % 9;
        if (!taken.has(`${house.slug}|${playT}|${at}`)) slot = at;
      }
      if (slot < 0) continue; // the house is full that evening
      taken.add(`${house.slug}|${playT}|${slot}`);
      day.stages[5]++;
      day.source[source.key][1]++;
      day.device[device.key][1]++;
      day.booked[house.slug]++;
      if (area) day.area[area.name][1]++;
      const team = pick(TEAM.filter(([n]) => n <= house.max), (x) => x[1])[0];
      const played = playT < today;
      const r = rand();
      const status = played ? (r < 0.06 ? 'cancelled' : r < 0.1 ? 'no_show' : 'played') : (r < 0.03 ? 'cancelled' : 'confirmed');
      const hour = Math.floor(10 + rand() * 14);
      const minute = Math.floor(rand() * 60);
      const tail = String(Math.floor(rand() * 100)).padStart(2, '0');
      bookings.push({
        code: 'EH-' + Array.from({ length: 5 }, () => CODE[Math.floor(rand() * CODE.length)]).join(''),
        createdT: t + (hour * 60 + minute) * 60000, createdDate: date,
        playT, playDate: iso(playT), playDow: new Date(playT).getUTCDay(), slot, time: house.starts[slot], lead,
        house: house.slug, team, perPerson: perPerson(team), total: perPerson(team) * team, deposit: DEPOSIT,
        name: `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}.`,
        phone: `01${Math.floor(rand() * 3)}••••••${tail}`,
        source: source.key, device: device.key, region: region ? region.name : country.name, area: area ? area.name : '', status,
      });
    }
    days.push(day);
  }

  return { DEMO, HOUSES, SOURCES, DEVICES, REGIONS, AREAS, UNCLEAR, VENUE, COUNTRIES, STAGES, DEPOSIT, today, DAY, days, bookings, iso };
})();
