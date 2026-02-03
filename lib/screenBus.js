// lib/screenBus.js
const g = globalThis;

if (!g.__SYSBYTE_SCREEN_BUS__) {
  g.__SYSBYTE_SCREEN_BUS__ = {
    subs: new Map(), // codeLower -> Set<(msg)=>void>
  };
}

const bus = g.__SYSBYTE_SCREEN_BUS__;

export function subscribeScreen(codeLower, fn) {
  const key = String(codeLower || "").toLowerCase();
  if (!bus.subs.has(key)) bus.subs.set(key, new Set());
  const set = bus.subs.get(key);
  set.add(fn);

  return () => {
    try {
      set.delete(fn);
      if (set.size === 0) bus.subs.delete(key);
    } catch {}
  };
}

export function publishScreen(codeLower, msg) {
  const key = String(codeLower || "").toLowerCase();
  const set = bus.subs.get(key);
  if (!set || set.size === 0) return;

  for (const fn of set) {
    try {
      fn(msg);
    } catch {}
  }
}
