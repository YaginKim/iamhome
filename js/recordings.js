// 선생님이 게임 안에서 녹음한 대사: 이 기기의 브라우저(IndexedDB)에 저장해요.
// 「사이트에 올리기」를 하면 사이트의 voice 폴더로 올라가서 모든 기기에서 들려요 (publish.js).
const DB = 'dagyeo-voice', STORE = 'clips';
let dbp = null;
export const keys = new Map(); // key → updated (빨리 찾으려고 목록만 들고 있어요)

function db() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result);
    t.onerror = () => rej(t.error);
  });
}

export async function initRecordings() {
  try {
    const all = await tx('readonly', s => s.getAll());
    for (const c of all || []) keys.set(c.key, c.updated || 0);
  } catch { /* 저장 공간을 못 쓰는 브라우저: 녹음 없이 진행 */ }
}
export async function getClip(key) { try { return await tx('readonly', s => s.get(key)); } catch { return null; } }
export async function putClip(key, blob, updated = Date.now(), synced = false, publishedAt = 0) {
  await tx('readwrite', s => s.put({ key, blob, mime: blob.type, updated, synced, publishedAt }));
  keys.set(key, updated);
}
export async function allClips() { try { return (await tx('readonly', s => s.getAll())) || []; } catch { return []; } }
export async function delClip(key) {
  await tx('readwrite', s => s.delete(key));
  keys.delete(key);
}

// 녹음 형식: 아이패드·아이폰까지 들리도록 mp4(AAC)를 먼저, 안 되면 webm
export function recMime() {
  if (!window.MediaRecorder) return null;
  for (const m of ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm']) if (MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

export const blobToB64 = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = rej;
  r.readAsDataURL(blob);
});
export function b64ToBlob(b64, mime) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
}
