// تخزين المشاريع محليًا في IndexedDB (يدعم حفظ الصور والصوت والفيديو كـ Blob)
const NAME = 'storystudio';
const STORE = 'projects';
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

function tx(mode, fn) {
  return open().then(
    (d) =>
      new Promise((res, rej) => {
        const t = d.transaction(STORE, mode);
        const out = fn(t.objectStore(STORE));
        t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
        t.onerror = () => rej(t.error);
      })
  );
}

export const db = {
  put: (p) => tx('readwrite', (s) => s.put({ ...p, updated: Date.now() })),
  get: (id) => tx('readonly', (s) => s.get(id)),
  all: () => tx('readonly', (s) => s.getAll()).then((a) => (a || []).sort((x, y) => (y.updated || 0) - (x.updated || 0))),
  del: (id) => tx('readwrite', (s) => s.delete(id)),
};
