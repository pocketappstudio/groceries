import * as L from './logic.js';
import * as store from './store.js';
import * as N from './notify.js';
import { GUMROAD_PRODUCT_ID, GUMROAD_URL, APP_VERSION } from './config.js';

const $app = document.getElementById('app'), $toast = document.getElementById('toast');
let S = L.emptyState(), license = { ok: false };
let toastTimer, pending = [], navDir = '', screenClick = null;
const today = () => L.ymd(new Date());
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  check: '<svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 4.5v15M4.5 12h15"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M4.5 12h15"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M17 3l3 3-3 3M4 11V9a3 3 0 013-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 01-3 3H4"/></svg>',
  home: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  sets: '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  memory: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.1"/></svg>',
};
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const longDate = d => L.fromYmd(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = d => L.fromYmd(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// ---------- persistence
let saving = Promise.resolve();
function commit() {
  S.updated = Date.now();
  const snap = JSON.parse(JSON.stringify(S));
  saving = saving.then(() => store.set('state', snap));
  badge();
}
function badge() {
  const n = L.needed(S).length;
  if (N.isNative()) { const t = today(); N.widgetSync({ need: L.needed(S).map(it => { const di = L.dueInfo(S, it, t); return { n: it.name, next: it.auto && di ? di.next : null }; }), soon: L.coming(S, t, 20).map(({ it, di }) => ({ n: it.name, next: di.next, lead: di.lead })) }); N.reschedule(S.items.filter(i => i.recurring).map(it => ({ it, di: L.dueInfo(S, it, t) })).filter(x => x.di).map(({ it, di }) => ({ id: it.id, name: it.name, days: it.onList ? 1 : di.days })), n); return; }
  try { if (n && navigator.setAppBadge) navigator.setAppBadge(n); else if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch {}
}
const snapshot = () => JSON.stringify(S);
function toast(msg, undoSnap) {
  clearTimeout(toastTimer);
  $toast.hidden = false; $toast.replaceChildren();
  const s = document.createElement('span'); s.textContent = msg; $toast.append(s);
  if (undoSnap) {
    const b = document.createElement('button'); b.textContent = 'Undo';
    b.onclick = () => { S = JSON.parse(undoSnap); commit(); $toast.hidden = true; render(); };
    $toast.append(b);
  }
  toastTimer = setTimeout(() => { $toast.hidden = true; }, undoSnap ? 6000 : 2600);
}
function applyTheme() {
  const t = S.settings.theme, r = document.documentElement;
  if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches);
  let m = document.querySelector('meta[name=theme-color][data-js]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; m.dataset.js = 1; document.head.append(m); }
  m.content = dark ? '#11140F' : '#FAF7F0';
}

// ---------- routing
const tabs = [['home', 'Today', I.home], ['sets', 'Sets', I.sets], ['memory', 'Memory', I.memory], ['more', 'More', I.more]];
const route = () => { const p = (location.hash.slice(2) || 'home').split('/'); return { name: p[0], arg: decodeURIComponent(p.slice(1).join('/')) }; };
const go = (h, dir = '') => { navDir = dir; if (location.hash === h) render(); else location.hash = h; };
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
const tabNames = tabs.map(t => t[0]);
let lastRoute = 'home';

function render() {
  const r = route();
  if (GUMROAD_PRODUCT_ID && !license.ok) return paint(gate(), 'tab');
  const isTab = tabNames.includes(r.name);
  const dir = navDir || (isTab ? 'tab' : ''); navDir = '';
  let html;
  switch (r.name) {
    case 'add': html = addScreen(); break;
    case 'item': html = itemScreen(r.arg); break;
    case 'sets': html = setsScreen(); break;
    case 'set': html = setScreen(r.arg); break;
    case 'memory': html = memoryScreen(); break;
    case 'more': html = moreScreen(); break;
    case 'offer': html = offerScreen(r.arg); break;
    default: html = homeScreen();
  }
  const paintIt = () => { paint(html, dir, isTab ? r.name : null); if (r.name === 'add') bindAdd(); if (r.name === 'set') bindSet(r.arg); if (r.name === 'memory') bindMemory(); };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion:reduce)').matches && lastRoute !== r.name) { const vt = document.startViewTransition(paintIt); vt.ready.catch(() => {}); vt.finished.catch(() => {}); vt.updateCallbackDone.catch(() => {}); } else paintIt();
  lastRoute = r.name;
}
function paint(html, dir, tab) {
  screenClick = null;
  $app.innerHTML = `<main class="screen ${dir || ''}">${html}</main>` + (tab ? dock(tab) : '');
}
const dock = cur => `<nav class="dock" aria-label="Main">${cur === 'home' ? `<button class="fab" data-go="#/add">${I.plus}Add</button>` : ''}
<div class="tabs">${tabs.map(([k, n, ic]) => `<a href="#/${k}" ${k === cur ? 'aria-current="page"' : ''}>${ic}${n}</a>`).join('')}</div></nav>`;
const top = (title, back = '#/home') => `<div class="top"><button class="iconbtn" data-back="${back}" aria-label="Back">${I.back}</button></div>${title ? `<h1>${esc(title)}</h1>` : ''}`;

// ---------- screens
function dueText(di) {
  if (!di) return '';
  if (di.days < 0) return `Overdue ${-di.days}d`;
  if (di.days === 0) return 'Due today';
  if (di.days === 1) return 'Due tomorrow';
  return `Due in ${di.days} days`;
}
function homeScreen() {
  const now = new Date(), t = today(), list = L.needed(S), soon = L.coming(S, t), offs = L.offers(S, t);
  const rows = list.map(it => {
    const di = L.dueInfo(S, it, t);
    const tag = it.auto && di ? `<span class="tag ${di.days <= 0 ? 'now' : ''}">${I.repeat}${dueText(di)}</span>` : it.recurring ? `<span class="tag">${I.repeat}Every ${it.interval}d</span>` : '';
    return `<li class="row" data-row="${it.id}"><button class="check" data-buy="${it.id}" aria-label="Bought ${esc(it.name)}"><span>${I.check}</span></button>
<button class="rowmain" data-go="#/item/${it.id}"><span class="nm">${esc(it.name)}</span>${tag}</button></li>`;
  }).join('');
  const soonRows = soon.map(({ it, di }) => `<li><button class="row" style="width:100%;text-align:left" data-go="#/item/${it.id}">
<span class="rowmain" style="padding-left:18px"><span class="nm">${esc(it.name)}</span>
<span class="when"><b>${Math.max(0, di.days)}</b><i>${di.days <= 0 ? 'today' : di.days === 1 ? 'day' : 'days'}</i></span></span></button></li>`).join('');
  return `<div class="tiles">
<div class="tile" role="group" aria-label="Today"><div class="band"><span>${MONTHS[now.getMonth()]}</span><span>${now.getFullYear()}</span></div><div class="big">${now.getDate()}</div><div class="cap">${now.toLocaleDateString(undefined, { weekday: 'long' })}</div></div>
<div class="tile need ${list.length ? '' : 'zero'}" role="group" aria-label="To buy"><div class="band"><span>To buy</span></div><div class="big">${list.length}</div><div class="cap">${list.length ? (list.length === 1 ? 'item' : 'items') : 'all stocked'}</div></div></div>
${N.isNative() && notifPerm === 'prompt' ? `<button class="offer" data-remind><span><span class="t">${I.bell} Reminders</span></span></button>` : ''}
${offs.map(o => `<button class="offer" data-go="#/offer/${esc(o.id)}"><span><span class="t">${esc(o.kind === 'holiday' ? 'Last ' + o.title : o.title)}</span><br><span class="s">${esc(o.sub)}${o.kind === 'holiday' ? ' · ' + (o.days <= 0 ? 'today' : o.days + 'd away') : ''}</span></span><span class="n">${o.items.length}</span></button>`).join('')}
<h2>Need now</h2>${list.length ? `<ul class="list">${rows}</ul>` : `<div class="empty">${I.check}Nothing needed</div>`}
${soon.length ? `<h2>Coming due</h2><ul class="list">${soonRows}</ul>` : ''}`;
}

function addScreen() {
  return `${top('', '#/home')}<h1>Add</h1>
<div class="field"><input id="in" type="text" placeholder="Milk, eggs, bread" enterkeyhint="done" autocomplete="off" autocapitalize="sentences" aria-label="Add items">
${SR ? `<button class="iconbtn mic" id="mic" aria-pressed="false" aria-label="Dictate">${I.mic}</button>` : ''}</div>
<div class="chips" id="chips"></div><h2 id="sugh">Often</h2><div class="chips" id="sug"></div>
<div class="screen-dock"><button class="btn" id="ok" disabled>Add</button></div>`;
}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function bindAdd() {
  pending = [];
  const $in = document.getElementById('in'), $chips = document.getElementById('chips'), $sug = document.getElementById('sug'), $ok = document.getElementById('ok'), $sugh = document.getElementById('sugh');
  const keys = () => new Set(pending.map(L.keyOf));
  const draft = () => L.parseEntry($in.value);
  const all = () => { const k = new Set(), out = []; for (const n of [...pending, ...draft()]) { const x = L.keyOf(n); if (x && !k.has(x)) { k.add(x); out.push(n); } } return out; };
  function paintBits() {
    const names = all();
    $chips.innerHTML = names.map(n => `<span class="chip">${esc(n)}<button class="iconbtn" style="min-width:48px;min-height:48px" data-unchip="${esc(n)}" aria-label="Remove ${esc(n)}">${I.x}</button></span>`).join('');
    $ok.disabled = !names.length; $ok.innerHTML = names.length ? `${I.check}Add ${names.length === 1 ? names[0] : names.length + ' items'}` : 'Add';
    const q = L.keyOf($in.value.split(/[,;\n]/).pop() || ''), have = new Set(names.map(L.keyOf));
    let pool = S.items.filter(i => !i.onList && !have.has(i.key));
    pool = q ? pool.filter(i => i.key.includes(q)) : pool;
    pool.sort((a, b) => (L.lastBought(S, b.key) || '').localeCompare(L.lastBought(S, a.key) || ''));
    pool = pool.slice(0, 12);
    $sugh.hidden = !pool.length; $sug.innerHTML = pool.map(i => `<button class="chip sug" data-sug="${esc(i.name)}">${I.plus}${esc(i.name)}</button>`).join('');
  }
  $in.addEventListener('input', paintBits);
  $in.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const d = draft(); if (d.length) { pending.push(...d); $in.value = ''; paintBits(); } else if (all().length) $ok.click(); } });
  screenClick = e => {
    const u = e.target.closest('[data-unchip]'), s = e.target.closest('[data-sug]');
    if (u) { const k = L.keyOf(u.dataset.unchip); pending = pending.filter(n => L.keyOf(n) !== k); const d = draft().filter(n => L.keyOf(n) !== k); $in.value = d.join(', '); paintBits(); return; }
    if (s) { pending.push(s.dataset.sug); $in.value = ''; paintBits(); $in.focus(); return; }
    if (e.target.closest('#ok')) { const names = all(); if (!names.length) return; const snap = snapshot(); L.addNames(S, names); commit(); go('#/home', 'back'); toast(`Added ${names.length === 1 ? names[0] : names.length + ' items'}`, snap); store.persist(); return; }
  };
  const $mic = document.getElementById('mic');
  if ($mic) {
    let rec = null;
    $mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = false;
      $mic.setAttribute('aria-pressed', 'true'); $mic.setAttribute('aria-label', 'Listening');
      rec.onresult = ev => { $in.value = [...ev.results].map(r => r[0].transcript).join(' '); paintBits(); };
      rec.onend = () => { rec = null; $mic.setAttribute('aria-pressed', 'false'); $mic.setAttribute('aria-label', 'Dictate'); const d = draft(); if (d.length) { pending.push(...d); $in.value = ''; } paintBits(); };
      rec.onerror = () => {};
      try { rec.start(); } catch { rec = null; $mic.setAttribute('aria-pressed', 'false'); }
    };
  }
  paintBits(); setTimeout(() => $in.focus(), 60);
}

function itemScreen(id) {
  const it = L.find(S, id); if (!it) return top('', '#/home') + '<h1>Not found</h1>';
  const t = today(), di = L.dueInfo(S, it, t), dates = L.datesFor(S, it.key), n = dates.length;
  return `${top('', '#/home')}<h1>${esc(it.name)}</h1>
${it.recurring ? `<div class="herocap">Repeats every</div><div class="stepper"><button data-step="-1" aria-label="Fewer days">${I.minus}</button><div class="hero">${it.interval}<span style="font-size:24px;letter-spacing:0"> days</span></div><button data-step="1" aria-label="More days">${I.plus}</button></div>` : ''}
<div style="margin-top:18px">
<div class="kv"><span>Bought</span><b>${n}×</b></div>
${dates.length ? `<div class="kv"><span>Last</span><b>${shortDate(dates[n - 1])}</b></div>` : ''}
${di ? `<div class="kv"><span>Next</span><b>${shortDate(di.next)}</b></div>` : ''}</div>
<div class="screen-dock" style="display:flex;flex-direction:column;gap:10px">
${it.onList ? `<button class="btn" data-buy-item="${it.id}">${I.check}Bought</button><button class="btn ghost" data-unlist="${it.id}">Remove from list</button>`
      : `<button class="btn" data-list="${it.id}">${I.plus}Add to list</button>`}
<button class="btn ghost" data-repeat="${it.id}">${I.repeat}Repeat: ${it.recurring ? 'On' : 'Off'}</button></div><div style="height:${it.onList ? 190 : 120}px"></div>`;
}

function setsScreen() {
  return `<h1>Sets</h1>${S.sets.length ? `<div class="menu">${S.sets.map(s => `<button data-go="#/set/${s.id}"><span>${esc(s.name)}${s.occasion ? `<br><small>${esc(L.holiday(s.occasion)?.name || '')}</small>` : ''}</span><b style="font-size:30px;font-variant-numeric:tabular-nums">${s.items.length}</b></button>`).join('')}</div>` : ''}
<div class="stack"><button class="btn" data-newset>${I.plus}New set</button></div>`;
}
function setScreen(id) {
  const s = S.sets.find(x => x.id === id); if (!s) return top('', '#/sets') + '<h1>Not found</h1>';
  return `${top('', '#/sets')}<div class="field"><input id="sname" value="${esc(s.name)}" aria-label="Set name" autocomplete="off" enterkeyhint="done"></div>
<div class="chips" id="schips"></div>
<form class="field" id="saddf" style="margin-top:16px" action="#" autocomplete="off"><input id="sadd" type="text" placeholder="Add item" aria-label="Add item to set" autocomplete="off" enterkeyhint="go" autocapitalize="sentences"><button class="iconbtn" id="saddb" type="submit" aria-label="Add">${I.plus}</button></form>
<h2>Returns near</h2><select id="socc" aria-label="Returns near"><option value="">Never</option>${L.HOLIDAYS.map(h => `<option value="${h.key}" ${s.occasion === h.key ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>
<div class="stack"><button class="btn warn" data-delset="${s.id}">Delete set</button></div>
<div class="screen-dock"><button class="btn" id="sall" ${s.items.length ? '' : 'disabled'}>${I.check}Add all to list</button></div><div style="height:90px"></div>`;
}
function bindSet(id) {
  const s = S.sets.find(x => x.id === id); if (!s) return;
  const $c = document.getElementById('schips'), $a = document.getElementById('sadd');
  const paintC = () => { $c.innerHTML = s.items.map(n => `<span class="chip">${esc(n)}<button class="iconbtn" style="min-width:48px;min-height:48px" data-sdel="${esc(n)}" aria-label="Remove ${esc(n)}">${I.x}</button></span>`).join(''); const b = document.getElementById('sall'); b.disabled = !s.items.length; };
  const addI = () => { const d = L.parseEntry($a.value); $a.value = ''; if (!d.length) return; for (const n of d) if (!s.items.some(x => L.keyOf(x) === L.keyOf(n))) s.items.push(n); commit(); paintC(); };
  document.getElementById('sname').oninput = e => { s.name = e.target.value.trim() || 'Set'; commit(); };
  // iOS: the keyboard's Go key submits the form; keeping focus on + stops the keyboard from closing (and the layout jumping) mid-tap.
  document.getElementById('saddf').onsubmit = e => { e.preventDefault(); addI(); };
  const $b = document.getElementById('saddb');
  $b.addEventListener('pointerdown', e => { if (document.activeElement === $a) e.preventDefault(); });
  $b.addEventListener('touchstart', e => { if (document.activeElement === $a) { e.preventDefault(); addI(); } }, { passive: false });
  $a.addEventListener('blur', () => { if ($a.value.trim()) addI(); });
  document.getElementById('socc').onchange = e => { s.occasion = e.target.value || null; commit(); };
  document.getElementById('sall').onclick = () => { if ($a.value.trim()) addI(); const snap = snapshot(); L.addNames(S, s.items); commit(); go('#/home', 'back'); toast(`Added ${s.items.length} from ${s.name}`, snap); };
  screenClick = e => { const d = e.target.closest('[data-sdel]'); if (d) { s.items = s.items.filter(n => n !== d.dataset.sdel); commit(); paintC(); return true; } };
  paintC();
}

function offerScreen(id) {
  const o = L.offers(S, today(), 12).find(x => x.id === id);
  if (!o) return top('', '#/home') + '<h1>Nothing here</h1>';
  const sel = offerSel[id] || (offerSel[id] = new Set(o.items.map(i => i.key)));
  return `${top('', '#/home')}<h1>${esc(o.kind === 'holiday' ? 'Last ' + o.title : o.title)}</h1><div class="herocap">${esc(o.sub)}</div>
<div>${o.items.map(i => `<button class="pick" role="checkbox" aria-checked="${sel.has(i.key)}" data-pick="${esc(id)}|${esc(i.key)}"><span class="box">${I.check}</span>${esc(i.name)}</button>`).join('')}</div>
<div class="screen-dock" style="display:flex;flex-direction:column;gap:10px"><button class="btn" data-offer-add="${esc(id)}" ${sel.size ? '' : 'disabled'}>${I.check}Add ${sel.size}</button>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${o.kind !== 'set' ? `<button class="btn ghost" data-offer-set="${esc(id)}">Save as set</button>` : '<span></span>'}<button class="btn ghost" data-offer-no="${esc(id)}">Not now</button></div></div><div style="height:200px"></div>`;
}
const offerSel = {};

let memLimit = 200, memQ = '';
function memoryScreen() {
  return `<h1>Memory</h1><div class="hero">${S.history.length}</div><div class="herocap">purchases remembered</div>
<div class="field"><input id="mq" type="search" placeholder="Search" value="${esc(memQ)}" aria-label="Search purchases" autocomplete="off"></div><div id="mlist"></div>`;
}
function bindMemory() {
  const $l = document.getElementById('mlist'), $q = document.getElementById('mq');
  const draw = () => {
    const q = L.keyOf(memQ) || memQ.toLowerCase().trim();
    const rows = [...S.history].filter(h => !q || h.k.includes(q) || h.n.toLowerCase().includes(q)).sort((a, b) => b.d.localeCompare(a.d) || a.n.localeCompare(b.n));
    let out = '', cur = '';
    for (const h of rows.slice(0, memLimit)) {
      const m = L.fromYmd(h.d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (m !== cur) { cur = m; out += `<h2 class="month">${m}</h2>`; }
      out += `<button class="hrow" data-hist="${esc(h.n)}"><span>${esc(h.n)}</span><span>${L.fromYmd(h.d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</span></button>`;
    }
    if (rows.length > memLimit) out += `<div class="stack"><button class="btn ghost" id="more">Show more</button></div>`;
    $l.innerHTML = out || (S.history.length ? '' : `<div class="empty" style="margin-top:18px">${I.memory}Nothing yet</div>`);
  };
  $q.oninput = () => { memQ = $q.value; memLimit = 200; draw(); };
  screenClick = e => { if (e.target.closest('#more')) { memLimit += 300; draw(); return; } const h = e.target.closest('[data-hist]'); if (h) { const it = L.ensureItem(S, h.dataset.hist); commit(); go('#/item/' + it.id); return true; } };
  draw();
}

let notifPerm = 'none';
function moreScreen() {
  const th = S.settings.theme;
  const remindRow = N.isNative() && notifPerm !== 'granted' ? `<div class="stack"><button class="btn" data-remind>${I.bell}${notifPerm === 'denied' ? 'Reminders off in Settings' : 'Turn on reminders'}</button></div>` : '';
  return `<h1>More</h1>
<div class="seg" role="group" aria-label="Appearance">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<button data-theme="${k}" aria-pressed="${th === k}">${th === k ? I.check : ''}${n}</button>`).join('')}</div>
${remindRow}<h2>Backup</h2><div class="menu"><button data-export="json">Export JSON<small>.json</small></button><button data-export="csv">Export CSV<small>.csv</small></button><button data-import>Import<small>.json .csv</small></button></div>
<input id="file" type="file" accept=".json,.csv,application/json,text/csv,text/plain" hidden>
<h2>Studio</h2><div class="menu">${GUMROAD_URL ? `<a href="${GUMROAD_URL}" target="_blank" rel="noopener">Support${I.chev}</a>` : ''}<a href="privacy.html">Privacy &amp; terms${I.chev}</a><div>Version<small>${APP_VERSION}</small></div></div>`;
}
function gate() {
  return `<div class="gate center"><img src="icons/icon-192.png" alt="" width="96" height="96"><h1 style="margin-top:20px">Restock</h1>
<div class="field"><input id="lic" placeholder="License key" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="License key"></div>
<div id="licerr"></div><div class="stack"><button class="btn" id="licgo">Activate</button><a class="btn ghost" href="${GUMROAD_URL}" target="_blank" rel="noopener" style="text-decoration:none">Get Restock</a></div></div>`;
}
async function verify(key) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal,
      body: new URLSearchParams({ product_id: GUMROAD_PRODUCT_ID, license_key: key, increment_uses_count: 'false' }) });
    const j = await r.json();
    return j && j.success === true ? 'ok' : j && j.success === false ? 'bad' : 'unknown';
  } catch { return 'unknown'; } finally { clearTimeout(t); }
}

// ---------- events
function clicks(e) {
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return true; }
  const b = e.target.closest('[data-back]'); if (b) { go(b.dataset.back, 'back'); return true; }
  const buy = e.target.closest('[data-buy]');
  if (buy) {
    const id = buy.dataset.buy, row = buy.closest('.row'); if (row) row.classList.add('gone');
    const snap = snapshot(), it = L.find(S, id), was = it && it.recurring;
    setTimeout(() => { L.checkOff(S, id, today()); commit(); render(); toast(!was && it.recurring ? `${it.name} now repeats every ${it.interval} days` : `Bought ${it.name}`, snap); }, 280);
    return true;
  }
  const bi = e.target.closest('[data-buy-item]');
  if (bi) { const snap = snapshot(), it = L.checkOff(S, bi.dataset.buyItem, today()); commit(); go('#/home', 'back'); toast(it.recurring ? `Bought ${it.name} · every ${it.interval}d` : `Bought ${it.name}`, snap); return true; }
  const ul = e.target.closest('[data-unlist]'); if (ul) { const snap = snapshot(); L.removeFromList(S, ul.dataset.unlist, today()); commit(); go('#/home', 'back'); toast('Removed', snap); return true; }
  const li = e.target.closest('[data-list]'); if (li) { const snap = snapshot(); L.addNames(S, [L.find(S, li.dataset.list).name]); commit(); go('#/home', 'back'); toast('Added', snap); return true; }
  const rp = e.target.closest('[data-repeat]');
  if (rp) { const it = L.find(S, rp.dataset.repeat); if (it.recurring) { it.recurring = false; it.manual = 'off'; } else { delete it.manual; it.recurring = true; it.interval = it.interval || 7; it.fixed = true; } commit(); render(); return true; }
  const st = e.target.closest('[data-step]');
  if (st) { const it = L.find(S, route().arg); it.interval = Math.min(365, Math.max(2, it.interval + Number(st.dataset.step))); it.fixed = true; commit(); const h = document.querySelector('.hero'); if (h) h.firstChild.nodeValue = it.interval; return true; }
  if (e.target.closest('[data-newset]')) { const s = L.addSet(S, 'New set'); commit(); go('#/set/' + s.id); return true; }
  const ds = e.target.closest('[data-delset]'); if (ds) { const snap = snapshot(); S.sets = S.sets.filter(x => x.id !== ds.dataset.delset); commit(); go('#/sets', 'back'); toast('Deleted', snap); return true; }
  const pk = e.target.closest('[data-pick]');
  if (pk) { const [id, k] = pk.dataset.pick.split('|'), sel = offerSel[id]; sel.has(k) ? sel.delete(k) : sel.add(k); render(); return true; }
  const oa = e.target.closest('[data-offer-add]');
  if (oa) { const id = oa.dataset.offerAdd, o = L.offers(S, today(), 12).find(x => x.id === id), sel = offerSel[id]; const snap = snapshot(); const names = o.items.filter(i => sel.has(i.key)).map(i => i.name); L.addNames(S, names); S.dismissed[id] = 1; commit(); go('#/home', 'back'); toast(`Added ${names.length}`, snap); return true; }
  const os = e.target.closest('[data-offer-set]');
  if (os) { const id = os.dataset.offerSet, o = L.offers(S, today(), 12).find(x => x.id === id), sel = offerSel[id]; const s = L.addSet(S, o.kind === 'holiday' ? o.title : 'New set', o.items.filter(i => sel.has(i.key)).map(i => i.name), o.hkey || null); commit(); go('#/set/' + s.id); return true; }
  const on = e.target.closest('[data-offer-no]'); if (on) { S.dismissed[on.dataset.offerNo] = 1; commit(); go('#/home', 'back'); return true; }
  const th = e.target.closest('[data-theme]'); if (th) { S.settings.theme = th.dataset.theme; commit(); applyTheme(); render(); return true; }
  const ex = e.target.closest('[data-export]'); if (ex) { exportData(ex.dataset.export); return true; }
  if (e.target.closest('[data-import]')) { const f = document.getElementById('file'); f.onchange = () => importFile(f.files[0]); f.click(); return true; }
  if (e.target.closest('[data-remind]')) { N.ask().then(p => { notifPerm = p; badge(); render(); }); return true; }
  if (e.target.closest('#licgo')) { activate(); return true; }
  return false;
}
document.addEventListener('click', e => { if (screenClick && screenClick(e) === true) return; clicks(e); });

async function activate() {
  const key = document.getElementById('lic').value.trim(), $e = document.getElementById('licerr'), b = document.getElementById('licgo');
  if (!key) return;
  b.disabled = true; b.textContent = 'Checking';
  const r = await verify(key);
  if (r === 'bad') { $e.innerHTML = `<div class="err">${I.warn}Key not recognized</div>`; b.disabled = false; b.textContent = 'Activate'; return; }
  license = { ok: true, at: today(), verified: r === 'ok', updated: Date.now() };
  await store.set('license', license); render();
}

function download(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) {
    navigator.share({ files: [file], title: name }).catch(err => { if (err && err.name !== 'AbortError') anchor(); });
    return;
  }
  anchor();
  function anchor() { const u = URL.createObjectURL(file), a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
}
function exportData(kind) {
  const t = today();
  if (kind === 'json') download(`restock-backup-${t}.json`, L.toJSON(S, t), 'application/json');
  else download(`restock-backup-${t}.csv`, L.toCSV(S), 'text/csv');
  toast('Exported');
}
async function importFile(f) {
  if (!f) return;
  try {
    const inc = L.parseImport(await f.text()), snap = snapshot(), n = L.merge(S, inc);
    L.refreshDue(S, today()); commit(); render(); toast(n ? `Imported ${n}` : 'Nothing new', snap);
  } catch { toast('Could not read that file'); }
}

// ---------- boot
async function boot() {
  const st = await store.get('state'); if (st) S = Object.assign(L.emptyState(), st);
  const lic = await store.get('license'); if (lic) license = lic;
  notifPerm = await N.permission();
  applyTheme(); matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change', applyTheme);
  if (L.refreshDue(S, today()).length) commit(); else badge();
  render();
  store.persist();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (L.refreshDue(S, today()).length) commit(); const r = route(); if (['home', ''].includes(r.name)) render(); else badge(); } });
}
if ('serviceWorker' in navigator && !N.isNative()) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && route().name === 'home') location.reload(); });
}
boot();
