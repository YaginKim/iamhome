// 기기 사이 저장: 선생님 구글 스프레드시트(Apps Script)에 학생 기록을 보관해요.
// 보내는 것: 학년-반-번호와 게임 진행(난이도, 끝낸 곳, 돈, 별, 스티커, 설정).
// 보내지 않는 것: 꿈이든 카드의 이름과 주소 (이 기기에만 남아요).
const KEY = 'dagyeo-sync-v1';
let cfg = null;
try { cfg = JSON.parse(localStorage.getItem(KEY)); } catch { /* */ }
export const status = { ok: null, at: 0, error: '' };

export function syncCfg() { return cfg; }
export function syncOn() { return !!(cfg && cfg.url && cfg.key); }
export function setSyncCfg(c) {
  cfg = c && c.url && c.key ? { url: c.url.trim(), key: c.key.trim() } : null;
  try { if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg)); else localStorage.removeItem(KEY); } catch { /* */ }
}

const ERR = { key: '비밀번호가 시트와 달라요.', 'secret-not-set': '시트 스크립트의 비밀번호를 아직 바꾸지 않았어요.', timeout: '응답이 늦어요. 인터넷을 확인해 주세요.' };
export const errText = code => ERR[code] || '연결하지 못했어요. 주소와 인터넷을 확인해 주세요.';

async function call(action, extra = {}, { c = cfg, keepalive = false, ms = 8000 } = {}) {
  if (!c) throw new Error('off');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    // text/plain 으로 보내면 브라우저가 따로 허락을 묻지 않아요 (Apps Script가 받을 수 있는 방식)
    const r = await fetch(c.url, { method: 'POST', body: JSON.stringify({ action, key: c.key, ...extra }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl.signal, keepalive, redirect: 'follow' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'fail');
    status.ok = true; status.at = Date.now(); status.error = '';
    return j;
  } catch (e) {
    const code = e.name === 'AbortError' ? 'timeout' : e.message;
    status.ok = false; status.error = code;
    throw new Error(code);
  } finally { clearTimeout(t); }
}

const strip = s => { const { student, slot, teacher, ...rest } = s; return rest; };
const shareable = id => syncOn() && /^\d+-\d+-\d+$/.test(id || '');

export const cloudPing = c => call('ping', {}, { c });
export const cloudHello = c => call('hello', {}, { c });
export async function cloudLoad(id) { return shareable(id) ? (await call('load', { id }, { ms: 7000 })).data : null; }
export async function cloudList() { return syncOn() ? (await call('list')).list : []; }
export async function cloudDelete(id) { if (shareable(id)) await call('delete', { id }); }

// 저장은 잠깐 모았다가 한 번에 보내요 (미션마다 여러 번 저장되므로)
const pending = new Map();
let timer = null;
export function cloudSave(s) {
  if (!s || !shareable(s.slot)) return;
  pending.set(s.slot, strip(s));
  clearTimeout(timer);
  timer = setTimeout(flush, 2500);
}
export function flush(keepalive = false) {
  clearTimeout(timer);
  for (const [id, data] of pending) {
    pending.delete(id);
    call('save', { id, data }, { keepalive }).catch(() => { if (!pending.has(id)) pending.set(id, data); });
  }
}
// 화면을 닫거나 다른 앱으로 갈 때 남은 저장을 보내요
document.addEventListener('visibilitychange', () => { if (document.hidden && pending.size) flush(true); });
window.addEventListener('pagehide', () => { if (pending.size) flush(true); });
// 인터넷이 다시 되면 못 보낸 저장을 보내요
window.addEventListener('online', () => { if (pending.size) flush(); });

// 다른 기기 연결 링크: 주소 끝 #sync=... 로 열면 이 기기도 연결돼요
export function linkFor(c = cfg) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ u: c.url, k: c.key }))));
  return `${location.origin}${location.pathname}#sync=${b64}`;
}
export function readLinkHash() {
  const m = location.hash.match(/^#sync=(.+)$/);
  if (!m) return false;
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    setSyncCfg({ url: o.u, key: o.k });
  } catch { return false; }
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

// ----- 녹음한 대사 (선생님 구글 드라이브) -----
export const cloudVoiceList = async () => (await call('voiceList', {}, { ms: 15000 })).list;
export const cloudVoicePut = (key, mime, data) => call('voicePut', { voice: key, mime, data }, { ms: 30000 });
export const cloudVoiceGet = key => call('voiceGet', { voice: key }, { ms: 20000 });
export const cloudVoiceDelete = key => call('voiceDelete', { voice: key });
