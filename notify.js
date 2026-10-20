// Native-only reminders (iOS app). On the web every function is a harmless no-op.
// All scheduling is on-device; nothing is sent anywhere.
const cap = () => (typeof window !== 'undefined' ? window.Capacitor : null);
export const isNative = () => { try { return !!(cap() && cap().isNativePlatform && cap().isNativePlatform()); } catch { return false; } };
const plug = name => { try { return isNative() && cap().registerPlugin ? cap().registerPlugin(name) : null; } catch { return null; } };
const LN = () => plug('LocalNotifications'), BD = () => plug('Badge');
export const REMIND_HOUR = 9;

export async function permission() {
  const p = LN(); if (!p) return 'none';
  try { return (await p.checkPermissions()).display; } catch { return 'none'; }
}
export async function ask() {
  const p = LN(); if (!p) return 'none';
  try { return (await p.requestPermissions()).display; } catch { return 'denied'; }
}
export async function setBadge(n) {
  const b = BD(); if (!b) return;
  try { n > 0 ? await b.set({ count: n }) : await b.clear(); } catch {}
}
// Pure: which reminders to schedule. items: [{id,name,days}] days = whole days until due (from logic.dueInfo).
export function plan(items, now = new Date(), hour = REMIND_HOUR) {
  const out = [];
  for (const x of items) {
    if (x.days < 0 || x.days > 3) continue;
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 0, hour, 0, 0);
    // remind the morning of the lead window: due in N days -> fire today if still before the hour, else tomorrow, never after due date
    if (at <= now) at.setDate(at.getDate() + 1);
    const dueDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + x.days, hour, 0, 0);
    if (at > dueDay) at.setTime(dueDay.getTime());
    if (at <= now) continue;
    out.push({ id: x.id, name: x.name, at });
  }
  return out;
}
const numId = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2147483000 + 1; };
let busy = Promise.resolve();
export function reschedule(items, badgeCount) {
  busy = busy.then(async () => {
    const p = LN(); if (!p) return;
    try {
      const pend = await p.getPending();
      if (pend.notifications.length) await p.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
      await setBadge(badgeCount);
      if ((await p.checkPermissions()).display !== 'granted') return;
      const list = plan(items);
      if (list.length) await p.schedule({ notifications: list.map(r => ({ id: numId(r.id), title: `Don't forget ${r.name}`, schedule: { at: r.at, allowWhileIdle: true } })) });
    } catch {}
  });
  return busy;
}
// Native-only: hand the home-screen glance to the iOS widget (shared App Group). No-op on the web.
const WG = () => plug('RestockWidget');
let lastWidget = '';
export function widgetSync(snap) {
  const w = WG(); if (!w) return;
  const json = JSON.stringify(snap); if (json === lastWidget) return; lastWidget = json;
  try { w.setSnapshot({ json }).catch(() => {}); } catch {}
}
