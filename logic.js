// Pure logic: dates, patterns, due, occasions, import/export. No DOM.
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
export const diff = (a, b) => dayNum(a) - dayNum(b);
export const addDays = (s, n) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

export function keyOf(name) {
  let k = String(name).toLowerCase().replace(/[^a-z0-9\u00c0-\uffff ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (k.length > 3) {
    if (/ies$/.test(k)) k = k.slice(0, -3) + 'y';
    else if (/oes$/.test(k)) k = k.slice(0, -2);
    else if (/[^su]s$/.test(k)) k = k.slice(0, -1);
  }
  return k;
}
export const tidy = n => { n = String(n).replace(/\s+/g, ' ').trim(); return n ? n[0].toUpperCase() + n.slice(1) : n; };

export function parseEntry(text) {
  return String(text).split(/[,;\n]+|\.\s+|\s+and\s+|\s*&\s*/i)
    .map(s => s.replace(/^(please\s+)?(add|buy|get|i need|need|pick up|we need)\s+/i, '').replace(/^some\s+/i, '').replace(/[.!?]+$/, '').trim())
    .filter(Boolean).map(tidy);
}

export const emptyState = () => ({ v: 1, updated: 0, items: [], history: [], sets: [], dismissed: {}, settings: { theme: 'auto' } });
const rid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const find = (S, id) => S.items.find(i => i.id === id);
export const findKey = (S, key) => S.items.find(i => i.key === key);

export function ensureItem(S, name) {
  const key = keyOf(name); if (!key) return null;
  let it = findKey(S, key);
  if (!it) { it = { id: rid(), name: tidy(name), key, onList: false, auto: false, recurring: false, interval: 0 }; S.items.push(it); }
  return it;
}
export function addNames(S, names) {
  const out = [];
  for (const n of names) {
    const it = ensureItem(S, n); if (!it) continue;
    it.onList = true; it.auto = false; delete it.snoozeUntil; out.push(it);
  }
  return out;
}

export function datesFor(S, key) { return [...new Set(S.history.filter(h => h.k === key).map(h => h.d))].sort(); }
export const lastBought = (S, key) => { const d = datesFor(S, key); return d.length ? d[d.length - 1] : null; };

// Pattern: >=3 distinct purchase days; median gap 2..366 days; at least half of gaps near the median.
export function pattern(dates) {
  const d = [...new Set(dates)].sort();
  if (d.length < 3) return null;
  const gaps = []; for (let i = 1; i < d.length; i++) gaps.push(diff(d[i], d[i - 1]));
  const g = gaps.slice(-8), m = median(g);
  if (m < 2 || m > 366) return null;
  const tol = Math.max(1.5, 0.35 * m);
  const ok = g.filter(x => Math.abs(x - m) <= tol).length / g.length;
  if (ok < 0.5) return null;
  const mean = g.reduce((a, b) => a + b, 0) / g.length;
  return { interval: Math.max(2, Math.round(ok >= 0.8 ? m : mean)), confidence: ok };
}

export function recompute(S, it) {
  if (it.manual === 'off') return;
  const p = pattern(datesFor(S, it.key));
  if (p) { it.recurring = true; if (!it.fixed) it.interval = p.interval; }
}
export function checkOff(S, id, today) {
  const it = find(S, id); if (!it) return null;
  it.onList = false; it.auto = false; delete it.snoozeUntil;
  if (!S.history.some(h => h.k === it.key && h.d === today)) S.history.push({ k: it.key, n: it.name, d: today });
  recompute(S, it);
  return it;
}
export function removeFromList(S, id, today) {
  const it = find(S, id); if (!it) return;
  it.onList = false;
  if (it.recurring && it.interval) it.snoozeUntil = addDays(today, Math.max(1, Math.round(it.interval / 2)));
  it.auto = false;
}
export const leadDays = interval => Math.min(3, Math.max(1, Math.ceil(interval / 4)));
export function dueInfo(S, it, today) {
  if (!it.recurring || !it.interval) return null;
  const last = lastBought(S, it.key); if (!last) return null;
  const next = addDays(last, it.interval);
  return { last, next, days: diff(next, today), lead: leadDays(it.interval) };
}
export function refreshDue(S, today) {
  const added = [];
  for (const it of S.items) {
    if (!it.recurring || it.onList) continue;
    const di = dueInfo(S, it, today); if (!di) continue;
    if (di.days <= di.lead && (!it.snoozeUntil || today >= it.snoozeUntil)) { it.onList = true; it.auto = true; added.push(it); }
  }
  return added;
}
export function coming(S, today, max = 8) {
  return S.items.filter(i => i.recurring && !i.onList).map(it => ({ it, di: dueInfo(S, it, today) }))
    .filter(x => x.di).sort((a, b) => a.di.days - b.di.days).slice(0, max);
}
export const needed = S => S.items.filter(i => i.onList).sort((a, b) => (b.auto - a.auto) || a.name.localeCompare(b.name));

// ---- Holidays
const nth = (y, m, dow, n) => { const f = new Date(y, m, 1).getDay(); return ymd(new Date(y, m, 1 + ((dow - f + 7) % 7) + (n - 1) * 7)); };
const lastDow = (y, m, dow) => { const l = new Date(y, m + 1, 0); return ymd(new Date(y, m, l.getDate() - ((l.getDay() - dow + 7) % 7))); };
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(new Date(y, mo - 1, da));
}
export const HOLIDAYS = [
  { key: 'newyear', name: "New Year's Day", before: 4, date: y => `${y}-01-01` },
  { key: 'superbowl', name: 'Big Game Sunday', before: 5, date: y => nth(y, 1, 0, 1) },
  { key: 'valentine', name: "Valentine's Day", before: 6, date: y => `${y}-02-14` },
  { key: 'easter', name: 'Easter', before: 8, date: easter },
  { key: 'mothers', name: "Mother's Day", before: 6, date: y => nth(y, 4, 0, 2) },
  { key: 'memorial', name: 'Memorial Day', before: 6, date: y => lastDow(y, 4, 1) },
  { key: 'fathers', name: "Father's Day", before: 6, date: y => nth(y, 5, 0, 3) },
  { key: 'july4', name: 'Fourth of July', before: 6, date: y => `${y}-07-04` },
  { key: 'labor', name: 'Labor Day', before: 6, date: y => nth(y, 8, 1, 1) },
  { key: 'halloween', name: 'Halloween', before: 8, date: y => `${y}-10-31` },
  { key: 'thanksgiving', name: 'Thanksgiving', before: 10, date: y => nth(y, 10, 4, 4) },
  { key: 'christmas', name: 'Christmas', before: 12, date: y => `${y}-12-25` },
  { key: 'nye', name: "New Year's Eve", before: 4, date: y => `${y}-12-31` },
];
export const holiday = k => HOLIDAYS.find(h => h.key === k);

function boughtInWindow(S, from, to) {
  const m = new Map();
  for (const h of S.history) if (h.d >= from && h.d <= to && !m.has(h.k)) m.set(h.k, h.n);
  return m;
}
const notRecurring = (S, k) => { const it = findKey(S, k); return !(it && it.recurring); };
const offList = (S, k) => { const it = findKey(S, k); return !(it && it.onList); };

export function offers(S, today, max = 3) {
  const out = [], used = new Set(), y0 = Number(today.slice(0, 4));
  const dismissed = id => !!S.dismissed[id];
  for (const y of [y0, y0 + 1]) for (const H of HOLIDAYS) {
    const d = H.date(y), days = diff(d, today);
    if (days < -1 || days > 14) continue;
    const id = `h:${H.key}:${y}`; if (dismissed(id)) continue;
    for (let py = y - 1; py >= y - 10; py--) {
      const hd = H.date(py), m = boughtInWindow(S, addDays(hd, -H.before), addDays(hd, 1));
      const items = [...m].filter(([k]) => notRecurring(S, k) && offList(S, k)).map(([key, name]) => ({ key, name }));
      if (m.size) {
        if (items.length) { out.push({ id, kind: 'holiday', hkey: H.key, title: H.name, sub: String(py), days, items }); items.forEach(i => used.add(i.key)); }
        break;
      }
    }
  }
  for (const set of S.sets) {
    if (!set.occasion) continue; const H = holiday(set.occasion); if (!H) continue;
    for (const y of [y0, y0 + 1]) {
      const days = diff(H.date(y), today); if (days < -1 || days > 14) continue;
      const id = `set:${set.id}:${y}`; if (dismissed(id)) continue;
      const items = set.items.map(n => ({ key: keyOf(n), name: n })).filter(i => offList(S, i.key));
      if (items.length) { out.push({ id, kind: 'set', setId: set.id, title: set.name, sub: H.name, days, items }); items.forEach(i => used.add(i.key)); }
    }
  }
  // Seasonal: what was bought around this date in earlier years
  const half = Number(today.slice(8)) < 16 ? 1 : 2, sid = `s:${today.slice(0, 7)}:${half}`;
  if (!dismissed(sid) && S.history.length) {
    for (let n = 1; n <= 6; n++) {
      const c = addDays(today, -365 * n), m = boughtInWindow(S, addDays(c, -3), addDays(c, 10));
      const recent = addDays(today, -45);
      const items = [...m].filter(([k]) => notRecurring(S, k) && offList(S, k) && !used.has(k) && !S.history.some(h => h.k === k && h.d >= recent))
        .slice(0, 10).map(([key, name]) => ({ key, name }));
      if (items.length) { out.push({ id: sid, kind: 'season', title: 'Around now', sub: String(Number(today.slice(0, 4)) - n), days: 0, items }); break; }
    }
  }
  out.sort((a, b) => a.days - b.days);
  return out.slice(0, max);
}

export function lastYearPurchases(S, hkey, y) { const H = holiday(hkey); return boughtInWindow(S, addDays(H.date(y), -H.before), addDays(H.date(y), 1)); }

// ---- Sets
export function addSet(S, name = 'New set', items = [], occasion = null) { const s = { id: rid(), name: tidy(name) || 'New set', items: [...new Set(items.map(tidy))], occasion }; S.sets.push(s); return s; }

// ---- Export / import
export function toJSON(S, today) { return JSON.stringify({ app: 'restock', v: 1, exported: today, state: S }, null, 1); }
const q = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
export function toCSV(S) {
  const rows = [['record', 'name', 'date', 'onlist', 'recurring', 'interval', 'items', 'occasion']];
  for (const h of [...S.history].sort((a, b) => a.d.localeCompare(b.d))) rows.push(['purchase', h.n, h.d]);
  for (const i of S.items) rows.push(['item', i.name, '', i.onList ? 1 : 0, i.recurring ? 1 : 0, i.interval || '']);
  for (const s of S.sets) rows.push(['set', s.name, '', '', '', '', s.items.join('|'), s.occasion || '']);
  return rows.map(r => r.map(q).join(',')).join('\n') + '\n';
}
export function parseCSV(text) {
  const rows = []; let r = [], f = '', inq = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inq) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += c; }
    else if (c === '"') inq = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; r.push(f); f = ''; if (r.some(x => x !== '')) rows.push(r); r = []; }
    else f += c;
  }
  r.push(f); if (r.some(x => x !== '')) rows.push(r);
  return rows;
}
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
export function fromCSV(text) {
  const rows = parseCSV(text); if (!rows.length) return null;
  const head = rows[0].map(x => x.trim().toLowerCase()), S = emptyState();
  const ci = n => head.indexOf(n);
  const addHist = (name, d) => { if (name && validDate(d) && !S.history.some(h => h.k === keyOf(name) && h.d === d)) S.history.push({ k: keyOf(name), n: tidy(name), d }); };
  if (ci('record') >= 0) {
    for (const r of rows.slice(1)) {
      const g = n => (r[ci(n)] || '').trim(), rec = g('record').toLowerCase(), name = g('name');
      if (!name) continue;
      if (rec === 'purchase') { addHist(name, g('date')); ensureItem(S, name); }
      else if (rec === 'item') { const it = ensureItem(S, name); it.onList = g('onlist') === '1'; if (g('recurring') === '1') { it.recurring = true; it.interval = Number(g('interval')) || 7; } }
      else if (rec === 'set') addSet(S, name, g('items').split('|').filter(Boolean), g('occasion') || null);
    }
  } else if (ci('date') >= 0 && (ci('item') >= 0 || ci('name') >= 0)) {
    const ni = ci('item') >= 0 ? ci('item') : ci('name');
    for (const r of rows.slice(1)) { const n = (r[ni] || '').trim(); if (n) { addHist(n, (r[ci('date')] || '').trim()); ensureItem(S, n); } }
  } else {
    const start = ['item', 'name', 'items'].includes(head[0]) ? 1 : 0;
    for (const r of rows.slice(start)) { const n = (r[0] || '').trim(); if (n) addNames(S, [n]); }
  }
  for (const it of S.items) recompute(S, it);
  return S;
}
export function parseImport(text) {
  const t = text.trim();
  if (t[0] === '{') {
    const j = JSON.parse(t), st = j.state || j;
    if (!Array.isArray(st.items) || !Array.isArray(st.history)) throw new Error('bad');
    return Object.assign(emptyState(), st, { sets: st.sets || [], dismissed: st.dismissed || {} });
  }
  const S = fromCSV(t); if (!S) throw new Error('bad'); return S;
}
export function merge(S, inc) {
  let n = 0;
  for (const h of inc.history) if (h && h.k && /^\d{4}-\d{2}-\d{2}$/.test(h.d) && !S.history.some(x => x.k === h.k && x.d === h.d)) { S.history.push({ k: h.k, n: h.n, d: h.d }); n++; }
  for (const i of inc.items) {
    const l = findKey(S, i.key);
    if (!l) { S.items.push({ ...i, id: rid() }); n++; }
    else { if (i.onList) l.onList = true; if (i.recurring && !l.recurring && l.manual !== 'off') { l.recurring = true; l.interval = i.interval; } }
  }
  for (const s of inc.sets) if (!S.sets.some(x => x.name.toLowerCase() === s.name.toLowerCase())) { S.sets.push({ ...s, id: rid() }); n++; }
  for (const it of S.items) recompute(S, it);
  return n;
}
