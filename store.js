// On-device storage: IndexedDB with a localStorage mirror. Nothing leaves the device.
const DB = 'restock', ST = 'kv';
let dbp;
const open = () => dbp || (dbp = new Promise((res, rej) => {
  try {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  } catch (e) { rej(e); }
}));
const idbGet = async k => { const db = await open(); return new Promise((res, rej) => { const q = db.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
const idbSet = async (k, v) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
const lsGet = k => { try { return JSON.parse(localStorage.getItem('restock.' + k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem('restock.' + k, JSON.stringify(v)); } catch {} };

export async function get(k) {
  let a = null; try { a = await idbGet(k); } catch {}
  const b = lsGet(k);
  if (a && b) return (b.updated || 0) > (a.updated || 0) ? b : a;
  return a || b || null;
}
export async function set(k, v) { lsSet(k, v); try { await idbSet(k, v); } catch {} }
export async function persist() { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch {} return false; }
