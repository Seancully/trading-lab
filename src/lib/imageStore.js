// Image blob store — keeps screenshots OUT of localStorage.
//
// Why: trades/notes used to embed chart screenshots as inline base64 data URLs
// inside the `tl_trades` / `tl_notes` JSON in localStorage. localStorage caps at
// ~5MB per origin, so a few dozen screenshots filled it and saves started
// failing with QuotaExceededError. IndexedDB has a far larger quota (typically a
// large fraction of free disk — hundreds of MB to GBs), so the image bytes live
// here instead. localStorage keeps only lightweight `idb:img_<hash>` references.
//
// The rest of the app stays synchronous: on boot we load every image into an
// in-memory Map, so hydrate()/dehydrate() are synchronous string swaps. Supabase
// sync is unchanged — the full data URLs are still pushed/pulled remotely, so
// images still travel across devices; this module only changes LOCAL persistence.

const DB_NAME = 'trading-lab';
const STORE = 'images';
const REF_PREFIX = 'idb:img_';

let dbPromise = null;
let usable = false;
const refToUrl = new Map(); // ref  → data URL
const urlToRef = new Map(); // data URL → ref (dedup identical images)
const pending = new Set();  // in-flight IDB writes (awaited by flushImageWrites)

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
  });
  return dbPromise;
}

// Fast, stable 53-bit string hash (cyrb53) → identical images share one ref.
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Load every stored image into memory. Call once on boot before any hydrate().
export async function initImageCache() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const kReq = store.getAllKeys();
      const vReq = store.getAll();
      tx.oncomplete = () => {
        const keys = kReq.result || [];
        const vals = vReq.result || [];
        for (let i = 0; i < keys.length; i++) {
          const ref = keys[i], url = vals[i];
          if (typeof ref === 'string' && typeof url === 'string') {
            refToUrl.set(ref, url);
            urlToRef.set(url, ref);
          }
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
    usable = true;
  } catch (e) {
    usable = false;
    console.warn('[imageStore] IndexedDB unavailable — images stay inline:', e?.message);
  }
}

function idbPut(ref, url) {
  if (!usable) return;
  const p = openDb()
    .then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(url, ref);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }))
    .catch(e => console.warn('[imageStore] write failed:', e?.message))
    .finally(() => pending.delete(p));
  pending.add(p);
}

// Resolve once all queued IDB writes have committed. Awaited by the boot
// migration and the unload flush so an image is never lost between sessions.
export function flushImageWrites() {
  return Promise.allSettled([...pending]);
}

const isDataImg = (s) => typeof s === 'string' && s.startsWith('data:image');
const isRef = (s) => typeof s === 'string' && s.startsWith(REF_PREFIX);

function toRef(url) {
  const existing = urlToRef.get(url);
  if (existing) return existing;
  const ref = REF_PREFIX + cyrb53(url);
  refToUrl.set(ref, url);
  urlToRef.set(url, ref);
  idbPut(ref, url);
  return ref;
}

// Deep-walk a JSON-ish value, applying fn to every string. Returns the original
// reference when nothing changed, so unchanged objects aren't needlessly cloned.
function deepMap(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map(v => { const nv = deepMap(v, fn); if (nv !== v) changed = true; return nv; });
    return changed ? out : value;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const out = {};
    for (const k in value) { const nv = deepMap(value[k], fn); if (nv !== value[k]) changed = true; out[k] = nv; }
    return changed ? out : value;
  }
  return value;
}

// Replace inline image data URLs with refs (and persist the bytes to IDB).
// Use before writing trades/notes to localStorage.
export function dehydrate(obj) {
  if (!usable) return obj;
  return deepMap(obj, (s) => (isDataImg(s) ? toRef(s) : s));
}

// Replace refs with their image data URLs from the in-memory cache.
// Use on every read that feeds the UI or a Supabase push.
export function hydrate(obj) {
  if (!usable) return obj;
  return deepMap(obj, (s) => (isRef(s) ? (refToUrl.get(s) || s) : s));
}

// Wipe everything — used when a different user signs in.
export async function clearImageCache() {
  refToUrl.clear();
  urlToRef.clear();
  if (!usable) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* noop */ }
}
