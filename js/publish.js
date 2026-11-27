// 녹음을 사이트에 올리기: 선생님 기기에서 녹음한 파일을 GitHub 저장소의 voice 폴더에 바로 올려요.
// 올리고 1~2분 뒤(사이트 배포가 끝나면) 사이트에 들어오는 모든 기기에서 녹음으로 들려요.
// GitHub 열쇠(토큰)는 이 기기의 브라우저에만 저장하고, GitHub 말고는 어디에도 보내지 않아요.
import { allClips, putClip, blobToB64 } from './recordings.js?v=202611271828';

const REPO = 'YaginKim/iamhome', BRANCH = 'main', API = 'https://api.github.com';
const TOKEN_KEY = 'dagyeo-gh-v1', DEL_KEY = 'dagyeo-voice-del-v1';

export function ghToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
export function setGhToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t.trim()); else localStorage.removeItem(TOKEN_KEY); } catch { /* */ } }

// 지운 녹음은 다음에 올릴 때 사이트에서도 지워요
const delList = () => { try { return JSON.parse(localStorage.getItem(DEL_KEY)) || []; } catch { return []; } };
export function markDeleted(key) { const l = delList(); if (!l.includes(key)) l.push(key); try { localStorage.setItem(DEL_KEY, JSON.stringify(l)); } catch { /* */ } }
export const isDeleted = key => delList().includes(key);
export function unmarkDeleted(key) { try { localStorage.setItem(DEL_KEY, JSON.stringify(delList().filter(k => k !== key))); } catch { /* */ } }

async function gh(path, opts = {}, token = ghToken()) {
  const r = await fetch(API + path, { ...opts, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!r.ok) {
    const e = new Error(r.status === 401 ? 'token' : r.status === 403 || r.status === 404 ? 'perm' : r.status === 422 ? 'conflict' : 'net');
    e.status = r.status; throw e;
  }
  return r.status === 204 ? null : r.json();
}
export const ghErrText = code => ({
  token: 'GitHub 열쇠가 맞지 않거나 기간이 끝났어요. 열쇠를 새로 만들어 넣어 주세요.',
  perm: 'GitHub 열쇠에 iamhome 저장소의 Contents 쓰기 권한이 없어요. 열쇠 설정을 확인해 주세요.',
  conflict: '사이트가 막 바뀌는 중이라 못 올렸어요. 잠시 뒤 다시 눌러 주세요.',
}[code] || '인터넷 연결을 확인하고 다시 눌러 주세요.');

// 열쇠 확인: 저장소에 쓸 수 있는지
export async function checkToken(token) {
  const r = await gh(`/repos/${REPO}`, {}, token);
  if (!r.permissions?.push) throw Object.assign(new Error('perm'), { status: 403 });
  return true;
}

const extOf = mime => (/mp4|aac|m4a/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /mpeg|mp3/.test(mime) ? 'mp3' : 'webm');
const fileOnly = f => String(f).split('?')[0];

// 올릴 것: 새로 녹음했거나 바꾼 것 + 지운 것
export async function pending() {
  const clips = await allClips();
  return { changed: clips.filter(c => !c.publishedAt || c.updated > c.publishedAt), deleted: delList() };
}

function decodeB64Utf8(b64) {
  const bin = atob(b64.replace(/\n/g, '')), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(u);
}

export async function publish(onProgress = () => {}) {
  const { changed, deleted } = await pending();
  if (!changed.length && !deleted.length) return { added: 0, removed: 0 };
  // 지금 사이트의 녹음 목록
  let manifest = {};
  try {
    const cur = await gh(`/repos/${REPO}/contents/voice/manifest.json?ref=${BRANCH}`);
    const parsed = JSON.parse(decodeB64Utf8(cur.content));
    manifest = Array.isArray(parsed) ? Object.fromEntries(parsed.map(id => [id, `${id}.mp3`])) : parsed;
  } catch (e) { if (e.status !== 404) throw e; }

  const tree = [];
  let n = 0;
  for (const c of changed) {
    onProgress(++n, changed.length);
    const ext = extOf(c.mime || c.blob.type);
    const blob = await gh(`/repos/${REPO}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: await blobToB64(c.blob), encoding: 'base64' }) });
    const path = `voice/${c.key}.${ext}`;
    const old = manifest[c.key] && `voice/${fileOnly(manifest[c.key])}`;
    if (old && old !== path) tree.push({ path: old, mode: '100644', type: 'blob', sha: null });
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    manifest[c.key] = `${c.key}.${ext}?v=${c.updated}`; // 다시 녹음하면 주소가 바뀌어서 예전 소리가 남지 않아요
  }
  let removed = 0;
  for (const key of deleted) {
    if (changed.some(c => c.key === key)) continue; // 지웠다가 다시 녹음함
    if (manifest[key]) { tree.push({ path: `voice/${fileOnly(manifest[key])}`, mode: '100644', type: 'blob', sha: null }); delete manifest[key]; removed++; }
  }
  if (!changed.length && !removed) { try { localStorage.removeItem(DEL_KEY); } catch { /* */ } return { added: 0, removed: 0 }; }
  const sorted = Object.fromEntries(Object.keys(manifest).sort().map(k => [k, manifest[k]]));
  tree.push({ path: 'voice/manifest.json', mode: '100644', type: 'blob', content: JSON.stringify(sorted, null, 1) + '\n' });

  // 한 번의 커밋으로 올려요 (사이트가 그 사이 바뀌었으면 한 번 더 시도)
  for (let attempt = 0; ; attempt++) {
    try {
      const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
      const head = await gh(`/repos/${REPO}/git/commits/${ref.object.sha}`);
      const t = await gh(`/repos/${REPO}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const msg = `녹음 ${changed.length}개 올림${removed ? `, ${removed}개 지움` : ''} (게임 안 녹음 화면에서)`;
      const commit = await gh(`/repos/${REPO}/git/commits`, { method: 'POST', body: JSON.stringify({ message: msg, tree: t.sha, parents: [ref.object.sha] }) });
      await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
      break;
    } catch (e) { if (attempt >= 1 || e.message !== 'conflict') throw e; }
  }
  for (const c of changed) await putClip(c.key, c.blob, c.updated, true, c.updated);
  try { localStorage.removeItem(DEL_KEY); } catch { /* */ }
  return { added: changed.length, removed, manifest: sorted };
}

// 열쇠 없이: 녹음을 파일 하나로 내보내기 (Claude에게 주면 사이트에 넣어 줘요)
export async function exportClips() {
  const clips = await allClips();
  const out = [];
  for (const c of clips) out.push({ key: c.key, mime: c.mime || c.blob.type, updated: c.updated, data: await blobToB64(c.blob) });
  const blob = new Blob([JSON.stringify({ app: 'dagyeo-voice', clips: out })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `다녀오겠습니다-녹음-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return out.length;
}
