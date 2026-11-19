// The numbers page: the curtain, the period picker, and every chart, drawn by hand in SVG and HTML (no chart library).
// It reads window.EH13_DEMO (demo-data.js). When the real site is live the same shapes come from Google Analytics 4
// (visits, places, devices, the funnel's steps) and from the booking engine (bookings), and only this file's inputs change.
(() => {
  const D = window.EH13_DEMO;
  const $ = (s, root = document) => root.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const SALT = 'eh13-dashboard:';
  const DAY = D.DAY;

  // Words and numbers. The site writes Western digits, so the numbers here do too.
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const WEEKDAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
  const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // the Egyptian week starts on Saturday
  const STATUS = { played: 'لعبوا', confirmed: 'مأكد، لسه جاي', no_show: 'ما جوش', cancelled: 'اتلغى' };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
  const money = (n) => `${fmt(n)} ج.م`;
  const dateAr = (t, year = false) => {
    const d = new Date(t);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ''}`;
  };
  const clock = (t) => new Date(t).toISOString().slice(11, 16);
  const HOUSE = Object.fromEntries(D.HOUSES.map((h) => [h.slug, h]));
  const SOURCE = Object.fromEntries(D.SOURCES.map((s) => [s.key, s]));
  const DEVICE = Object.fromEntries(D.DEVICES.map((s) => [s.key, s]));
  const HOUSE_KEYS = D.HOUSES.map((h) => ({ key: h.slug, name: h.short, color: `var(--${h.slug})` }));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ------------------------------------------------------------------------------------------------------------------
  // The curtain
  // ------------------------------------------------------------------------------------------------------------------
  const gate = $('[data-gate]');
  const app = $('[data-app]');
  const lock = document.documentElement.dataset.lock;
  const sha = async (text) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  let started = false;
  const open = () => {
    gate.hidden = true;
    app.hidden = false;
    if (!started) { started = true; start(); }
  };
  gate.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hash = await sha(SALT + gate.elements.pass.value);
    if (hash === lock) {
      try { sessionStorage.setItem('eh13-dash', lock); } catch { /* fine */ }
      open();
    } else {
      $('[data-gate-help]').textContent = 'الباسورد مش صح.';
      gate.elements.pass.select();
    }
  });

  // ------------------------------------------------------------------------------------------------------------------
  // Adding up a period
  // ------------------------------------------------------------------------------------------------------------------
  const periodDays = (n, back) => {
    const end = D.days.length - back * n;
    return D.days.slice(Math.max(0, end - n), end);
  };
  const add = (into, from) => { for (const k in from) into[k] = (into[k] || 0) + from[k]; };
  const addPairs = (into, from) => {
    for (const k in from) { into[k] ||= [0, 0]; into[k][0] += from[k][0]; into[k][1] += from[k][1]; }
  };
  function total(days) {
    const out = { days, n: days.length, from: days[0].t, to: days[days.length - 1].t, visitors: 0, whatsapp: 0,
      stages: [0, 0, 0, 0, 0, 0], source: {}, device: {}, area: {}, region: {}, country: {}, picked: {}, booked: {} };
    for (const d of days) {
      out.visitors += d.visitors;
      out.whatsapp += d.whatsapp;
      d.stages.forEach((v, i) => { out.stages[i] += v; });
      addPairs(out.source, d.source);
      addPairs(out.device, d.device);
      addPairs(out.area, d.area);
      add(out.region, d.region); add(out.country, d.country); add(out.picked, d.picked); add(out.booked, d.booked);
    }
    // Bookings made in the period, and journeys played in it.
    out.made = D.bookings.filter((b) => b.createdT >= out.from && b.createdT < out.to + DAY);
    out.live = out.made.filter((b) => b.status !== 'cancelled');
    out.played = D.bookings.filter((b) => b.playT >= out.from && b.playT <= out.to && b.status !== 'cancelled');
    out.capacity = 27 * out.n; // 9 starts a day in each of the 3 houses
    out.revenue = out.live.reduce((s, b) => s + b.total, 0);
    out.deposits = out.made.length * D.DEPOSIT; // the deposit is kept on a cancellation (decision B4)
    return out;
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The tooltip, for mouse and finger
  // ------------------------------------------------------------------------------------------------------------------
  const tip = $('[data-tip]');
  const showTip = (html, x, y) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2));
    let top = y - r.height - 14;
    if (top < 8) top = y + 18;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  const hideTip = () => { tip.hidden = true; };
  addEventListener('scroll', hideTip, { passive: true });
  const line = (color, label, value) =>
    `<span class="tip__line">${color ? `<i class="swatch" style="background:${color}"></i>` : ''}${esc(label)}: <b class="num">${value}</b></span>`;

  // ------------------------------------------------------------------------------------------------------------------
  // SVG charts. Time runs from right (oldest) to left (newest), the way the page reads.
  // ------------------------------------------------------------------------------------------------------------------
  const el = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  const ticks = (max, count = 4) => {
    if (max <= 0) return [0, 1];
    const raw = max / count;
    const p = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
    const out = [];
    for (let v = 0; v <= Math.ceil(max / step) * step + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  };
  const roundTop = (x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h));
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };
  const frame = (host, label) => {
    host.innerHTML = '';
    const W = host.clientWidth, H = host.clientHeight;
    // The page is right to left; the drawing's coordinates are not, so its text anchors stay put.
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, direction: 'ltr' });
    host.append(svg);
    return { svg, W, H, padR: 44, padL: 6, padT: 10, padB: 26 };
  };
  const yAxis = (f, tk, y) => {
    for (const v of tk) {
      f.svg.append(el('line', { x1: f.padL, x2: f.W - f.padR, y1: y(v), y2: y(v), stroke: v === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }));
      f.svg.append(el('text', { x: f.W - f.padR + 8, y: y(v) + 4, 'text-anchor': 'start', class: 'num' }, fmt(v)));
    }
  };
  const pointerX = (svg, e) => e.clientX - svg.getBoundingClientRect().left;

  function lineChart(host, points, unit) {
    const f = frame(host, `${unit} كل يوم`);
    const n = points.length;
    const pw = f.W - f.padR - f.padL, ph = f.H - f.padT - f.padB;
    const tk = ticks(Math.max(...points.map((p) => p.v)));
    const top = tk[tk.length - 1];
    const x = (i) => f.W - f.padR - (n === 1 ? pw / 2 : (i * pw) / (n - 1));
    const y = (v) => f.padT + ph - (v / top) * ph;
    yAxis(f, tk, y);
    const marks = Math.min(n, f.W < 520 ? 3 : 5);
    for (let k = 0; k < marks; k++) {
      const i = Math.round((k * (n - 1)) / Math.max(1, marks - 1));
      const anchor = i === 0 ? 'end' : i === n - 1 ? 'start' : 'middle';
      f.svg.append(el('text', { x: x(i), y: f.H - 6, 'text-anchor': anchor }, dateAr(points[i].t)));
    }
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    f.svg.append(el('path', { d: `${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`, fill: 'var(--bar)', opacity: 0.08 }));
    f.svg.append(el('path', { d, fill: 'none', stroke: 'var(--bar)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const cross = el('line', { y1: f.padT, y2: f.padT + ph, stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '3 3', visibility: 'hidden' });
    const dot = el('circle', { r: 4.5, fill: 'var(--bar)', stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' });
    f.svg.append(cross, dot);
    const hit = el('rect', { x: f.padL, y: 0, width: pw, height: f.H, fill: 'transparent' });
    f.svg.append(hit);
    const move = (e) => {
      const i = Math.max(0, Math.min(n - 1, Math.round(((f.W - f.padR - pointerX(f.svg, e)) / pw) * (n - 1))));
      const p = points[i];
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(p.v)); dot.setAttribute('visibility', 'visible');
      const box = f.svg.getBoundingClientRect();
      showTip(`<b>${WEEKDAYS[new Date(p.t).getUTCDay()]} ${dateAr(p.t)}</b><br>${line(null, unit, fmt(p.v))}${p.more || ''}`, box.left + x(i), box.top + y(p.v));
    };
    const leave = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
  }

  // Columns, stacked when there is more than one key. A 2px gap of surface between stacked parts.
  function columns(host, buckets, keys, label, opts = {}) {
    const f = frame(host, label);
    const n = buckets.length;
    const pw = f.W - f.padR - f.padL, ph = f.H - f.padT - f.padB;
    const sums = buckets.map((b) => keys.reduce((s, k) => s + (b.values[k.key] || 0), 0));
    const tk = ticks(Math.max(...sums, 1));
    const top = tk[tk.length - 1];
    const y = (v) => f.padT + ph - (v / top) * ph;
    yAxis(f, tk, y);
    const slot = pw / n;
    const w = Math.max(2, Math.min(opts.maxWidth || 26, slot * 0.68));
    const cx = (i) => f.W - f.padR - (i + 0.5) * slot;
    const every = opts.everyLabel ? 1 : Math.ceil(n / (f.W < 520 ? 3 : 5));
    buckets.forEach((b, i) => {
      if (i % every === 0) {
        f.svg.append(el('text', { x: cx(i), y: f.H - 6, 'text-anchor': 'middle' }, b.label));
      }
      let base = y(0);
      const parts = keys.map((k) => ({ k, v: b.values[k.key] || 0 })).filter((p) => p.v > 0);
      parts.forEach((p, j) => {
        const h = (p.v / top) * ph;
        const yTop = base - h;
        const isTop = j === parts.length - 1;
        const gap = isTop ? 0 : 2;
        const hh = Math.max(0, h - gap);
        const shape = isTop
          ? el('path', { d: roundTop(cx(i) - w / 2, yTop, w, h, 4), fill: p.k.color })
          : el('rect', { x: cx(i) - w / 2, y: yTop + gap, width: w, height: hh, fill: p.k.color });
        f.svg.append(shape);
        base = yTop;
      });
      const hitbox = el('rect', { x: cx(i) - slot / 2, y: 0, width: slot, height: f.H, fill: 'transparent' });
      const show = (e) => {
        const lines = keys.length > 1
          ? keys.map((k) => line(k.color, k.name, fmt(b.values[k.key] || 0))).join('') + line(null, 'الإجمالي', fmt(sums[i]))
          : line(null, opts.unit || 'العدد', fmt(sums[i]));
        showTip(`<b>${b.tip}</b><br>${lines}`, e.clientX, f.svg.getBoundingClientRect().top + y(sums[i]));
      };
      hitbox.addEventListener('pointermove', show);
      hitbox.addEventListener('pointerdown', show);
      hitbox.addEventListener('pointerleave', hideTip);
      f.svg.append(hitbox);
    });
  }

  // Greater Cairo on a plain map: each area a circle (bigger = more visitors, lighter = books more), a ring every 10 km
  // around the venue, and the Nile for bearings. Each circle sits on its area's centre (demo-data.js).
  const NILE = [[29.84, 31.29], [29.9, 31.268], [29.96, 31.243], [30.0, 31.229], [30.03, 31.228], [30.06, 31.222],
    [30.09, 31.231], [30.12, 31.236], [30.15, 31.205], [30.19, 31.13]];
  const KM_PER_DEG = 111.2;
  function cairoMap(host, list) {
    const f = frame(host, 'خريطة مناطق القاهرة الكبرى والمكان');
    const pts = [...D.AREAS, D.VENUE];
    const lat0 = Math.min(...pts.map((p) => p.lat)), lat1 = Math.max(...pts.map((p) => p.lat));
    const lon0 = Math.min(...pts.map((p) => p.lon)), lon1 = Math.max(...pts.map((p) => p.lon));
    const kx = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
    const pad = Math.max(24, f.W / 14);
    const s = Math.min((f.W - 2 * pad) / ((lon1 - lon0) * kx), (f.H - 2 * pad) / (lat1 - lat0));
    const ox = (f.W - (lon1 - lon0) * kx * s) / 2, oy = (f.H - (lat1 - lat0) * s) / 2;
    const X = (lon) => ox + (lon - lon0) * kx * s;
    const Y = (lat) => f.H - oy - (lat - lat0) * s;
    const perKm = s / KM_PER_DEG;
    const vx = X(D.VENUE.lon), vy = Y(D.VENUE.lat);
    const defs = el('defs'), clip = el('clipPath', { id: 'map-clip' });
    clip.append(el('rect', { x: 0, y: 0, width: f.W, height: f.H }));
    defs.append(clip);
    f.svg.append(defs);

    // Rings every 10 km, and the Nile.
    const rings = el('g', { 'clip-path': 'url(#map-clip)' });
    for (let km = 10; km <= 60; km += 10) {
      const r = km * perKm;
      rings.append(el('circle', { cx: vx, cy: vy, r, fill: 'none', stroke: 'var(--axis)', 'stroke-width': 1, 'stroke-dasharray': '2 4' }));
      if (vy - r > 12) rings.append(el('text', { x: vx, y: vy - r - 4, 'text-anchor': 'middle', direction: 'rtl', class: 'map__ring' }, `${km} كم`));
    }
    const nile = NILE.map(([la, lo], i) => `${i ? 'L' : 'M'}${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join('');
    rings.append(el('path', { d: nile, fill: 'none', stroke: 'oklch(52% 0.07 235 / 0.55)', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    rings.append(el('text', { x: X(31.27) + 6, y: Y(29.88), 'text-anchor': 'end', direction: 'rtl', class: 'map__ring' }, 'النيل'));
    f.svg.append(rings);

    // The circles: the busiest drawn first, so the small ones stay on top.
    const known = list.filter((a) => a.area && a.v > 0);
    const max = Math.max(...known.map((a) => a.v), 1);
    const avg = known.reduce((t, a) => t + a.b, 0) / Math.max(1, known.reduce((t, a) => t + a.v, 0));
    const rMax = Math.max(11, Math.min(26, f.W / 26));
    const placed = [];
    const dots = known.map((a) => {
      const ratio = a.b / a.v / (avg || 1);
      const step = 2 + [0.7, 0.9, 1.1, 1.3].filter((t) => ratio >= t).length;
      return { ...a, x: X(a.area.lon), y: Y(a.area.lat), r: 3 + Math.sqrt(a.v / max) * rMax, step };
    }).sort((a, b) => b.v - a.v);
    for (const d of dots) {
      f.svg.append(el('circle', { cx: d.x, cy: d.y, r: d.r, fill: `var(--heat-${d.step})`, 'fill-opacity': 0.9, stroke: 'var(--well)', 'stroke-width': 2 }));
      placed.push({ x0: d.x - d.r, x1: d.x + d.r, y0: d.y - d.r, y1: d.y + d.r, self: d.name });
    }

    // The venue, a diamond.
    const v = 7;
    f.svg.append(el('path', { d: `M${vx},${vy - v}L${vx + v},${vy}L${vx},${vy + v}L${vx - v},${vy}Z`, fill: 'var(--accent)', stroke: 'var(--ink)', 'stroke-width': 1.5 }));

    // Names where they fit: beside, above or below each circle, never over another name or circle. The rest are in the
    // list beside the map, and in each circle's tooltip.
    // The three busiest may lie over a neighbour's circle, not over its name.
    const hits = (b, self, loose) => b.x0 < 2 || b.x1 > f.W - 2 || b.y0 < 2 || b.y1 > f.H - 2
      || placed.some((p) => p.self !== self && !(loose && p.self) && b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
    // Arabic names read right to left; the drawing itself is left to right, so its anchors flip for them.
    const FLIP = { start: 'end', end: 'start', middle: 'middle' };
    const label = (text, x, y, r, cls, self, loose) => {
      const w = text.length * (cls === 'map__venue' ? 6.6 : 5.9) + 4, h = 13;
      const tries = [
        [x + r + 4, y + 4, 'start', { x0: x + r + 2, x1: x + r + 4 + w, y0: y - h / 2 - 1, y1: y + h / 2 + 1 }],
        [x - r - 4, y + 4, 'end', { x0: x - r - 4 - w, x1: x - r - 2, y0: y - h / 2 - 1, y1: y + h / 2 + 1 }],
        [x, y - r - 5, 'middle', { x0: x - w / 2, x1: x + w / 2, y0: y - r - 5 - h, y1: y - r - 3 }],
        [x, y + r + 13, 'middle', { x0: x - w / 2, x1: x + w / 2, y0: y + r + 1, y1: y + r + 15 }],
      ];
      // Over a neighbour, a name stays right above or below its own circle, so it is not read as the neighbour's.
      const fit = tries.find((t) => !hits(t[3], self)) || (loose && tries.slice(2).find((t) => !hits(t[3], self, true)));
      if (!fit) return;
      placed.push(fit[3]);
      const rtl = /[؀-ۿ]/.test(text);
      f.svg.append(el('text', { x: fit[0], y: fit[1], 'text-anchor': rtl ? FLIP[fit[2]] : fit[2], direction: rtl ? 'rtl' : 'ltr', class: `map__label ${cls || ''}` }, text));
    };
    label('Escape Hub 13', vx, vy, v, 'map__venue');
    dots.slice(0, f.W < 520 ? 8 : dots.length).forEach((d, i) => label(d.name, d.x, d.y, d.r, '', d.name, i < 3));

    // A finger or the mouse on a circle tells its numbers.
    for (const d of [...dots].reverse()) {
      const hit = el('circle', { cx: d.x, cy: d.y, r: Math.max(d.r, 12), fill: 'transparent' });
      const show = () => {
        const box = f.svg.getBoundingClientRect();
        const scale = box.width / f.W;
        showTip(`<b>${esc(d.name)}</b><br>${line(null, 'زوار', fmt(d.v))}${line(null, 'حجوزات', fmt(d.b))}${line(null, 'حجز من كل', d.b ? `${fmt(d.v / d.b)} زائر` : '—')}<span class="tip__line">على بعد ${fmt(d.area.km)} كم من المكان</span>`,
          box.left + d.x * scale, box.top + (d.y - d.r) * scale);
      };
      hit.addEventListener('pointermove', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', hideTip);
      f.svg.append(hit);
    }
  }

  // Charts redraw at their own width when the window changes.
  const drawn = new Map();
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const fn = drawn.get(entry.target);
      if (fn && entry.contentRect.width !== fn.width) { fn.width = entry.contentRect.width; fn(); }
    }
  });
  const draw = (host, fn) => {
    const wrapped = () => fn();
    wrapped.width = host.clientWidth;
    if (!drawn.has(host)) ro.observe(host);
    drawn.set(host, wrapped);
    fn();
  };

  // ------------------------------------------------------------------------------------------------------------------
  // HTML pieces
  // ------------------------------------------------------------------------------------------------------------------
  const rows = (host, items, max = Math.max(...items.map((i) => i.value), 1)) => {
    host.innerHTML = items.map((i) => `
      <div class="row">
        <span class="row__name">${esc(i.name)}</span>
        <span class="row__value num">${i.shown ?? fmt(i.value)}${i.small ? `<small>${i.small}</small>` : ''}</span>
        <span class="row__bar" aria-hidden="true"><i style="width:${(i.value / max) * 100}%"></i></span>
        ${i.more ? `<p class="row__more">${i.more}</p>` : ''}
      </div>`).join('');
  };
  const miniTable = (host, head, body) => {
    host.innerHTML = `<table class="mini"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((c) => `<td class="num">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  };
  const periodWord = (n) => (n === 7 ? 'الأسبوع اللي قبله' : `الـ ${n} يوم اللي قبلها`);

  // ------------------------------------------------------------------------------------------------------------------
  // Each part of the page
  // ------------------------------------------------------------------------------------------------------------------
  function kpis(cur, prev) {
    const delta = (a, b, rate) => {
      if (!b) return '';
      const change = rate ? (a - b) * 100 : ((a - b) / b) * 100;
      const text = rate ? `${Math.abs(change).toFixed(1)} نقطة` : `${Math.abs(change).toFixed(0)}%`;
      if (/^0(\.0)?( |%)/.test(text)) return `<p class="delta"><b>زي ما هي</b> عن ${periodWord(cur.n)}</p>`;
      const up = change >= 0;
      return `<p class="delta delta--${up ? 'up' : 'down'}"><b><span aria-hidden="true">${up ? '▲' : '▼'}</span> ${up ? 'زيادة' : 'نقص'} ${text}</b> عن ${periodWord(cur.n)}</p>`;
    };
    const conv = (t) => t.made.length / t.visitors;
    const occ = (t) => t.played.length / t.capacity;
    const tiles = [
      { label: 'الزوار', value: fmt(cur.visitors), extra: `${fmt(cur.whatsapp)} منهم داسوا على واتساب`, d: delta(cur.visitors, prev.visitors) },
      { label: 'الحجوزات', value: fmt(cur.made.length), extra: `${fmt(cur.made.length - cur.live.length)} منهم اتلغوا`, d: delta(cur.made.length, prev.made.length) },
      { label: 'نسبة اللي حجزوا', value: pct(conv(cur), 1), extra: `حجز من كل ${fmt(1 / conv(cur))} زائر`, d: delta(conv(cur), conv(prev), true) },
      { label: 'نسبة الامتلاء', value: pct(occ(cur)), extra: `${fmt(cur.played.length)} رحلة من ${fmt(cur.capacity)} ممكنة`, d: delta(occ(cur), occ(prev), true) },
      { label: 'قيمة الحجوزات', value: cur.revenue >= 1e6 ? `${(cur.revenue / 1e6).toFixed(2)}<small>مليون ج.م</small>` : `${fmt(cur.revenue)}<small>ج.م</small>`, extra: `العربون اللي اتدفع: ${money(cur.deposits)}`, d: delta(cur.revenue, prev.revenue) },
    ];
    $('[data-kpis]').innerHTML = tiles.map((t) => `
      <div class="kpi"><p class="kpi__label">${t.label}</p><p class="kpi__value num">${t.value}</p><p class="kpi__extra">${t.extra}</p>${t.d}</div>`).join('');
  }

  function funnel(cur) {
    const s = cur.stages;
    let worst = 1;
    for (let i = 2; i < s.length; i++) if (s[i] / s[i - 1] < s[worst] / s[worst - 1]) worst = i;
    $('[data-funnel]').innerHTML = D.STAGES.map((stage, i) => {
      const drop = i === 0 ? '' : `
        <p class="step__drop ${i === worst ? 'step__drop--worst' : ''}">
          <span aria-hidden="true">↓</span> كمّل ${pct(s[i] / s[i - 1])} بس من اللي قبلهم${i === worst ? ' · <b>⚠ أكبر نزول</b>' : ''}
        </p>`;
      return `${drop}
        <li class="step">
          <span class="step__name">${stage.name}</span>
          <span class="step__bar" aria-hidden="true"><i style="width:${(s[i] / s[0]) * 100}%"></i></span>
          <span class="step__count num">${fmt(s[i])}<small>${pct(s[i] / s[0], s[i] / s[0] < 0.1 ? 1 : 0)}</small></span>
        </li>`;
    }).join('');
    return worst;
  }

  function timeCharts(cur) {
    const points = cur.days.map((d) => ({ t: d.t, v: d.visitors, more: line(null, 'حجوزات', fmt(d.stages[5])) }));
    draw($('[data-chart="visitors"]'), () => lineChart($('[data-chart="visitors"]'), points, 'زائر'));
    miniTable($('[data-table="visitors"]'), ['اليوم', 'الزوار', 'الحجوزات'],
      [...cur.days].reverse().map((d) => [dateAr(d.t), fmt(d.visitors), fmt(d.stages[5])]));

    // By day for a week or a month, by week for three months.
    const weekly = cur.n > 31;
    const buckets = [];
    for (let i = 0; i < cur.days.length; i += weekly ? 7 : 1) {
      const part = cur.days.slice(i, i + (weekly ? 7 : 1));
      const values = {};
      for (const d of part) add(values, d.booked);
      const a = part[0].t, b = part[part.length - 1].t;
      buckets.push({ label: dateAr(a), tip: weekly ? `من ${dateAr(a)} لـ ${dateAr(b)}` : `${WEEKDAYS[new Date(a).getUTCDay()]} ${dateAr(a)}`, values });
    }
    $('[data-bookings-note]').textContent = weekly ? 'كل عمود أسبوع' : 'كل عمود يوم';
    const sumsBy = Object.fromEntries(HOUSE_KEYS.map((k) => [k.key, buckets.reduce((s, b) => s + (b.values[k.key] || 0), 0)]));
    $('[data-legend="bookings"]').innerHTML = HOUSE_KEYS.map((k) =>
      `<span><i style="background:${k.color}"></i>${k.name} <b class="num">${fmt(sumsBy[k.key])}</b></span>`).join('');
    draw($('[data-chart="bookings"]'), () => columns($('[data-chart="bookings"]'), buckets, HOUSE_KEYS, 'الحجوزات حسب البيت'));
    miniTable($('[data-table="bookings"]'), [weekly ? 'الأسبوع' : 'اليوم', ...HOUSE_KEYS.map((k) => k.name), 'الإجمالي'],
      [...buckets].reverse().map((b) => [b.label, ...HOUSE_KEYS.map((k) => fmt(b.values[k.key] || 0)), fmt(HOUSE_KEYS.reduce((s, k) => s + (b.values[k.key] || 0), 0))]));
  }

  function sources(cur) {
    const list = D.SOURCES.map((s) => ({ s, v: cur.source[s.key][0], b: cur.source[s.key][1] })).sort((a, b) => b.v - a.v);
    rows($('[data-rows="sources"]'), list.map(({ s, v, b }) => ({
      name: s.name, value: v, small: pct(v / cur.visitors),
      more: `حجز منهم ${fmt(b)} · واحد من كل ${b ? fmt(v / b) : '—'}`,
    })));
    return list;
  }

  function places(cur) {
    const egypt = cur.country['مصر'];
    const regions = Object.entries(cur.region).sort((a, b) => (a[0] === 'محافظات تانية') - (b[0] === 'محافظات تانية') || b[1] - a[1]);
    rows($('[data-rows="regions"]'), regions.map(([name, v]) => ({ name, value: v, small: pct(v / egypt) })));
    const abroad = Object.entries(cur.country).filter(([n]) => n !== 'مصر').sort((a, b) => (a[0] === 'دول تانية') - (b[0] === 'دول تانية') || b[1] - a[1]);
    rows($('[data-rows="countries"]'), abroad.map(([name, v]) => ({ name, value: v, small: pct(v / cur.visitors, 1) })));
    return { regions, egypt };
  }

  const AREA = Object.fromEntries(D.AREAS.map((a) => [a.name, a]));
  function cairo(cur) {
    const list = Object.entries(cur.area).map(([name, [v, b]]) => ({ name, v, b, area: AREA[name] || null }))
      .filter((a) => a.v > 0)
      .sort((a, b) => (a.name === D.UNCLEAR) - (b.name === D.UNCLEAR) || b.v - a.v);
    const all = list.reduce((t, a) => t + a.v, 0) || 1;
    const items = list.map((a) => ({
      name: a.name, value: a.v, small: pct(a.v / all),
      more: a.area
        ? `${a.b ? `حجز منهم ${fmt(a.b)} · واحد من كل ${fmt(a.v / a.b)}` : 'ما حجزش حد منهم'} · على بعد ${fmt(a.area.km)} كم`
        : `حجز منهم ${fmt(a.b)} · أغلبهم على باقة موبايل`,
    }));
    const max = Math.max(...items.map((i) => i.value), 1);
    const head = items.filter((i) => i.name !== D.UNCLEAR).slice(0, 8);
    const rest = items.filter((i) => !head.includes(i));
    rows($('[data-rows="areas"]'), head, max);
    rows($('[data-rows="areas-more"]'), rest, max);
    $('[data-areas-more] summary').textContent = `باقي المناطق (${rest.length})`;
    const host = $('[data-chart="cairo"]');
    draw(host, () => cairoMap(host, list));
    $('[data-map-key]').innerHTML = `
      <span><i class="map-key__dot"></i><i class="map-key__dot map-key__dot--big"></i>أكبر = زوار أكتر</span>
      <span><span class="heat-key__ramp" aria-hidden="true">${[2, 3, 4, 5, 6].map((i) => `<i style="background:var(--heat-${i})"></i>`).join('')}</span>أفتح = بيحجزوا أكتر</span>
      <span><i class="map-key__venue"></i>المكان، جولف سيتي العبور</span>
      <span>الدواير كل 10 كم</span>`;
    return { list, all };
  }

  function devices(cur) {
    const list = D.DEVICES.map((d) => ({ d, v: cur.device[d.key][0], b: cur.device[d.key][1] }));
    rows($('[data-rows="devices"]'), list.map(({ d, v, b }) => ({
      name: d.name, value: v, shown: pct(v / cur.visitors), small: fmt(v), more: `حجز منهم ${pct(b / v, 1)}`,
    })));
    return list;
  }

  function houses(cur) {
    const out = D.HOUSES.map((h) => {
      const mine = cur.live.filter((b) => b.house === h.slug);
      const played = cur.played.filter((b) => b.house === h.slug).length;
      return { h, picked: cur.picked[h.slug], booked: cur.booked[h.slug], mine, played,
        team: mine.length ? mine.reduce((s, b) => s + b.team, 0) / mine.length : 0,
        revenue: mine.reduce((s, b) => s + b.total, 0), occupancy: played / (9 * cur.n) };
    });
    $('[data-houses]').innerHTML = out.map((x) => `
      <article class="house" style="--house:var(--${x.h.slug})">
        <h3><i class="swatch" style="background:var(--${x.h.slug})"></i>${x.h.name}</h3>
        <dl class="num">
          <dt>اختاروه</dt><dd>${fmt(x.picked)}</dd>
          <dt>حجزوه</dt><dd>${fmt(x.booked)}</dd>
          <dt>من اللي اختاروه حجز</dt><dd>${pct(x.booked / x.picked, 1)}</dd>
          <dt>نسبة الامتلاء</dt><dd>${pct(x.occupancy)}</dd>
          <dt>متوسط الفريق</dt><dd>${x.team.toFixed(1)} أفراد</dd>
          <dt>قيمة الحجوزات</dt><dd>${money(x.revenue)}</dd>
        </dl>
      </article>`).join('');
    return out;
  }

  function heat(cur) {
    const STEPS = [0.1, 0.2, 0.35, 0.5, 0.7];
    const counts = Array.from({ length: 7 }, () => Array(9).fill(0));
    for (const b of cur.played) counts[b.playDow][b.slot]++;
    const nights = Array(7).fill(0);
    for (const d of cur.days) nights[d.dow]++;
    const times = HOUSE.tomb.starts;
    let html = '<span></span>' + times.map((t) => `<span class="heat__col">${t}</span>`).join('');
    const cells = [];
    for (const dow of WEEK_ORDER) {
      html += `<span class="heat__row">${WEEKDAYS[dow]}</span>`;
      for (let s = 0; s < 9; s++) {
        const cap = 3 * nights[dow];
        const v = counts[dow][s];
        const r = cap ? v / cap : 0;
        const step = v === 0 ? 0 : 1 + STEPS.filter((x) => r >= x).length;
        cells.push({ dow, s, v, cap, r });
        html += `<span class="heat__cell ${step >= 5 ? 'heat__cell--light' : ''}" style="background:var(--heat-${step})"
          data-tip-html="<b>${WEEKDAYS[dow]} · ${times[s]}</b><br>${fmt(v)} رحلة من ${fmt(cap)} ممكنة (${pct(r)})"
          aria-label="${WEEKDAYS[dow]} ${times[s]}: ${pct(r)}"><span>${cap ? pct(r) : ''}</span></span>`;
      }
    }
    const host = $('[data-heat]');
    host.innerHTML = html;
    host.querySelectorAll('.heat__cell').forEach((c) => {
      const show = (e) => showTip(c.dataset.tipHtml, e.clientX, c.getBoundingClientRect().top);
      c.addEventListener('pointermove', show);
      c.addEventListener('pointerdown', show);
      c.addEventListener('pointerleave', hideTip);
    });
    $('[data-heat-key]').innerHTML = `<span>فاضي</span><span class="heat-key__ramp" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<i style="background:var(--heat-${i})"></i>`).join('')}</span><span>مليان</span>`;
    const byDay = WEEK_ORDER.map((dow) => ({ dow, r: counts[dow].reduce((a, b) => a + b, 0) / (27 * Math.max(1, nights[dow])) }));
    return { cells, byDay };
  }

  function team(cur) {
    const counts = {};
    for (const b of cur.live) counts[b.team] = (counts[b.team] || 0) + 1;
    const buckets = [];
    for (let n = 3; n <= 12; n++) buckets.push({ label: String(n), tip: `فريق من ${n}`, values: { all: counts[n] || 0 } });
    draw($('[data-chart="team"]'), () => columns($('[data-chart="team"]'), buckets, [{ key: 'all', name: 'حجوزات', color: 'var(--bar)' }], 'حجم الفريق', { everyLabel: true, maxWidth: 22, unit: 'حجوزات' }));
  }

  function lead(cur) {
    const groups = [['نفس اليوم', (l) => l === 0], ['قبلها بيوم', (l) => l === 1], ['من 2 لـ 3 أيام', (l) => l >= 2 && l <= 3],
      ['من 4 لـ 7 أيام', (l) => l >= 4 && l <= 7], ['أكتر من أسبوع', (l) => l > 7]];
    const all = cur.made.length || 1;
    const list = groups.map(([name, test]) => ({ name, value: cur.made.filter((b) => test(b.lead)).length }));
    rows($('[data-rows="lead"]'), list.map((g) => ({ ...g, shown: pct(g.value / all), small: fmt(g.value) })));
    return list.map((g) => g.value / all);
  }

  const COLUMNS = [
    ['وقت الحجز', (b) => `${dateAr(b.createdT)} ${clock(b.createdT)}`], ['الكود', (b) => b.code, 'code'],
    ['البيت', (b) => HOUSE[b.house].name], ['يوم اللعب', (b) => `${WEEKDAYS[b.playDow]} ${dateAr(b.playT)}`],
    ['الميعاد', (b) => b.time], ['الفريق', (b) => b.team], ['الإجمالي', (b) => money(b.total)], ['العربون', (b) => money(b.deposit)],
    ['الاسم', (b) => b.name], ['الموبايل', (b) => b.phone, 'phone'], ['المصدر', (b) => SOURCE[b.source].name],
    ['الحالة', (b) => STATUS[b.status]],
  ];
  function bookingsTable(cur) {
    const last = [...cur.made].sort((a, b) => b.createdT - a.createdT).slice(0, 12);
    $('[data-bookings]').innerHTML = `<thead><tr>${COLUMNS.map(([h]) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
      <tbody>${last.map((b) => `<tr>${COLUMNS.map(([h, get, cls]) => h === 'الحالة'
        ? `<td><span class="status status--${b.status}">${get(b)}</span></td>`
        : `<td class="num ${cls || ''}">${esc(get(b))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }

  // Excel opens a UTF-8 CSV with its byte-order mark in Arabic as it is.
  function download(cur) {
    const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const head = [...COLUMNS.map(([h]) => h), 'الجهاز', 'المحافظة', 'المنطقة'];
    const body = [...cur.made].sort((a, b) => a.createdT - b.createdT).map((b) => [
      `${new Date(b.createdT).toISOString().slice(0, 10)} ${clock(b.createdT)}`, b.code, HOUSE[b.house].name, b.playDate, b.time,
      b.team, b.total, b.deposit, b.name, b.phone, SOURCE[b.source].name, STATUS[b.status], DEVICE[b.device].name, b.region, b.area]);
    const csv = '﻿' + [head, ...body].map((r) => r.map(cell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `escape-hub-13-bookings-demo-${D.iso(cur.from)}-to-${D.iso(cur.to)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // What the numbers say, in a sentence each. Worked out from the same numbers as the charts.
  function reads(cur, worst, srcList, place, houseList, heatInfo, leadShares, deviceList) {
    const s = cur.stages;
    const out = [];
    out.push(`أكبر نزول بين «<b>${D.STAGES[worst - 1].name}</b>» و«<b>${D.STAGES[worst].name}</b>»: كمّل ${pct(s[worst] / s[worst - 1])} بس. ده أول مكان نحسّنه.`);
    const top = srcList[0];
    const best = srcList.filter((x) => x.v >= 30 && x.b).sort((a, b) => b.b / b.v - a.b / a.v)[0];
    if (best && best.s.key !== top.s.key) {
      out.push(`<b>${top.s.name}</b> بيجيب أكتر زوار (${pct(top.v / cur.visitors)})، لكن <b>${best.s.name}</b> بيحوّل أحسن: حجز من كل ${fmt(best.v / best.b)} زائر، قصاد واحد من كل ${fmt(top.v / Math.max(1, top.b))}.`);
    }
    const days = [...heatInfo.byDay].sort((a, b) => b.r - a.r);
    const cells = heatInfo.cells.filter((c) => c.cap).sort((a, b) => b.r - a.r);
    if (cells.length) {
      const hot = cells[0];
      out.push(`أكتر يوم مليان <b>${WEEKDAYS[days[0].dow]}</b> (${pct(days[0].r)})، وأضعفه <b>${WEEKDAYS[days[days.length - 1].dow]}</b> (${pct(days[days.length - 1].r)}). وأكتر ميعاد مطلوب ${WEEKDAYS[hot.dow]} الساعة ${HOUSE.tomb.starts[hot.s]}: ينفع عرض على الأيام الضعيفة.`);
    }
    const byPick = [...houseList].sort((a, b) => b.picked - a.picked)[0];
    const byConv = [...houseList].sort((a, b) => b.booked / b.picked - a.booked / a.picked)[0];
    if (byPick.h.slug !== byConv.h.slug) {
      out.push(`<b>${byPick.h.name}</b> أكتر بيت بيتفتح، لكن <b>${byConv.h.name}</b> أكتر بيت اللي بيفتحه بيحجزه (${pct(byConv.booked / byConv.picked, 1)}).`);
    } else {
      out.push(`<b>${byPick.h.name}</b> أكتر بيت بيتفتح وأكتر بيت بيتحجز.`);
    }
    out.push(`${pct(leadShares[0] + leadShares[1])} من الحجوزات لنفس اليوم أو اليوم اللي بعده: الإعلان يشتغل قبل الميعاد بيوم أو يومين.`);
    const mobile = deviceList.find((x) => x.d.key === 'mobile');
    const desktop = deviceList.find((x) => x.d.key === 'desktop');
    out.push(`${pct(mobile.v / cur.visitors)} من الزوار على الموبايل، لكن الكمبيوتر بيحجز أكتر: ${pct(desktop.b / desktop.v, 1)} من زواره حجزوا، والموبايل ${pct(mobile.b / mobile.v, 1)} بس. الحجز على الموبايل لازم يبقى أسهل.`);
    // Qalyubia is left out: the venue itself is in Obour, which is Qalyubia.
    const outside = place.regions.filter(([n]) => !['القاهرة', 'الجيزة', 'القليوبية'].includes(n));
    const far = outside.reduce((a, [, v]) => a + v, 0);
    const near = outside.filter(([n]) => n !== 'محافظات تانية').slice(0, 2).map(([n]) => `<b>${n}</b>`).join(' و');
    out.push(`${pct(far / place.egypt)} من زوار مصر من بره القاهرة والجيزة والقليوبية، أكترهم من ${near}: ناس بتيجي مشوار مخصوص، وده يستاهل إعلان يوصلهم.`);
    // Greater Cairo: near the venue against far from it, among the visitors whose area is known.
    const known = place.cairo.list.filter((a) => a.area);
    const sum = (xs, k) => xs.reduce((t, a) => t + a[k], 0);
    const close = known.filter((a) => a.area.km <= 20), away = known.filter((a) => a.area.km > 20);
    if (sum(close, 'v') && sum(away, 'v') && sum(away, 'b')) {
      const rate = (xs) => sum(xs, 'b') / sum(xs, 'v');
      const names = close.slice(0, 3).map((a) => `<b>${a.name}</b>`).join(' و');
      out.push(`في القاهرة الكبرى، اللي على بعد 20 كم أو أقل من المكان (${names}) بيحجزوا ${(rate(close) / rate(away)).toFixed(1)}× اللي أبعد: ${pct(rate(close), 1)} قصاد ${pct(rate(away), 1)}. الإعلان الممول يبدأ بالمناطق القريبة دي.`);
      const bigFar = [...away].sort((a, b) => b.v - a.v)[0];
      out.push(`<b>${bigFar.name}</b> بتجيب زوار كتير (${fmt(bigFar.v)}) لكن المشوار ${fmt(bigFar.area.km)} كم، فبيحجز منهم واحد من كل ${bigFar.b ? fmt(bigFar.v / bigFar.b) : '—'} بس. ممكن عرض «تعالوا جروب» يخلّي المشوار يستاهل.`);
    }
    const unclear = place.cairo.list.find((a) => !a.area);
    if (unclear) out.push(`${pct(unclear.v / place.cairo.all)} من زوار القاهرة الكبرى منطقتهم مش واضحة من الإنترنت (أغلبهم على باقة موبايل). لكن اللي بيحجزوا بيختاروا منطقتهم بنفسهم من سؤال «ساكنين فين؟» في الحجز، وبتظهر في شيت الحجوزات.`);
    const peak = [...cur.days].sort((a, b) => b.visitors - a.visitors)[0];
    const avg = cur.visitors / cur.n;
    if (peak.visitors > avg * 1.4) {
      out.push(`أعلى يوم زيارات <b>${dateAr(peak.t)}</b>: ${fmt(peak.visitors)} زائر (${(peak.visitors / avg).toFixed(1)}× المتوسط)، وحجز منهم ${fmt(peak.stages[5])} بس. زيارات كتير مش معناها حجوزات كتير.`);
    }
    $('[data-reads]').innerHTML = out.map((t) => `<li>${t}</li>`).join('');
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The period, and drawing it all
  // ------------------------------------------------------------------------------------------------------------------
  let range = 30;
  try { range = +localStorage.getItem('eh13-dash-range') || 30; } catch { /* the default */ }
  let current;

  function render() {
    const cur = total(periodDays(range, 0));
    const prev = total(periodDays(range, 1));
    current = cur;
    document.querySelectorAll('[data-range]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.range === range)));
    $('[data-span]').textContent = `من ${dateAr(cur.from)} لحد ${dateAr(cur.to, true)} · والمقارنة بـ${periodWord(range)}`;
    kpis(cur, prev);
    const worst = funnel(cur);
    timeCharts(cur);
    const srcList = sources(cur);
    const place = places(cur);
    place.cairo = cairo(cur);
    const deviceList = devices(cur);
    const houseList = houses(cur);
    const heatInfo = heat(cur);
    team(cur);
    const leadShares = lead(cur);
    bookingsTable(cur);
    reads(cur, worst, srcList, place, houseList, heatInfo, leadShares, deviceList);
  }

  function start() {
    // Demo numbers or none: the owner's switch, shared with the CRM.
    $('[data-demo-note]').innerHTML = D.DEMO
      ? '<span aria-hidden="true">◆</span> أرقام تجريبية: الشكل اللي هتشوفه لما الموقع الحقيقي ينزل'
      : '<span aria-hidden="true">◆</span> لسه مفيش أرقام: بتبدأ أول ما الموقع الحقيقي ينزل ويتربط بـ Google Analytics';
    $('[data-demo-switch]').textContent = D.DEMO ? 'امسح الأرقام التجريبية' : 'اعرض بأرقام تجريبية';
    $('[data-demo-switch]').addEventListener('click', () => {
      try { if (D.DEMO) localStorage.removeItem('eh13-demo'); else localStorage.setItem('eh13-demo', '1'); } catch { /* fine */ }
      location.reload();
    });
    // No numbers yet: say what the page will show, instead of charts of nothing.
    if (!D.DEMO) {
      $('.range').hidden = true;
      $('main.grid').innerHTML = `<section class="card card--wide"><h2>لسه مفيش أرقام</h2>
        <p class="note" style="margin-top:8px;line-height:1.8">الصفحة دي بتتملا لوحدها أول ما الموقع الحقيقي ينزل: الزوار كل يوم، وجم منين (تيك توك، إنستجرام، جوجل…)، ومنين في مصر والقاهرة، ووصلوا لحد فين في الحجز، والحجوزات حسب البيت، والمواعيد الأكتر طلباً، وآخر الحجوزات مع تنزيلها Excel، وجمل بتقرا الأرقام.<br>عشان تشوف شكلها وهي مليانة: «اعرض بأرقام تجريبية» فوق.</p></section>`;
      return;
    }
    document.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
      range = +b.dataset.range;
      try { localStorage.setItem('eh13-dash-range', String(range)); } catch { /* fine */ }
      hideTip();
      render();
    }));
    $('[data-download]').addEventListener('click', () => download(current));
    render();
  }

  // Opened already in this tab: no need to ask again.
  let remembered = null;
  try { remembered = sessionStorage.getItem('eh13-dash'); } catch { /* private window: ask again */ }
  if (remembered && remembered === lock) open();
  else gate.elements.pass.focus();
})();
