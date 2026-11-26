// 배경음악: 화면마다 곡을 바꾸고, 곡은 끝나면 처음부터 계속 반복합니다.
// 소리 크기(0~100)는 이 기기에 저장합니다.
// 곡 바꾸기: assets/bgm/ 의 파일을 같은 이름으로 바꾸거나 아래 TRACKS의 파일 이름을 고치세요.
const TRACKS = {
  title: 'assets/bgm/kudo.mp3',                   // 시작 화면
  ingame: 'assets/bgm/dream-big-little-star.mp3', // 대부분의 게임 화면 (집, 가게, 은행 등)
  town: 'assets/bgm/pixelated-love.mp3',          // 동네 지도에서 이동할 때
};
const KEY = 'dagyeo-sound-v1';

let volume = 60;   // 0~100
let duck = 1;      // 음성이 나올 때 잠깐 줄이기
let currentName = null;
let unlocked = false;
const audios = {}; // 곡마다 하나씩 만들어 두고 계속 다시 씁니다
export const _audios = audios; // 자동 점검용
const fades = new Map();

try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v.volume === 'number') volume = v.volume; } catch { /* 기본값 */ }

const target = () => (volume / 100) * duck;

function audioOf(name) {
  if (!audios[name]) {
    const a = new Audio(TRACKS[name]);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    // 반복이 어떤 이유로 끊기면(일부 브라우저) 처음부터 다시 재생
    a.addEventListener('ended', () => { if (currentName === name) { a.currentTime = 0; a.play().catch(() => {}); } });
    audios[name] = a;
  }
  return audios[name];
}

function fadeTo(audio, to, ms, done) {
  const id = Symbol();
  fades.set(audio, id);
  const from = audio.volume, start = performance.now();
  const tick = now => {
    if (fades.get(audio) !== id) return; // 더 새로운 페이드가 시작됨
    const k = Math.min(1, (now - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(tick); else done?.();
  };
  requestAnimationFrame(tick);
}

function ensurePlaying() {
  if (!unlocked || !currentName) return;
  const a = audioOf(currentName);
  if (a.paused) a.play().catch(() => {});
}

export function playBgm(name) {
  if (currentName === name) { ensurePlaying(); return; }
  const old = currentName;
  currentName = name;
  if (!unlocked) return; // 브라우저는 화면을 한 번 눌러야 소리를 낼 수 있어요
  if (old) {
    const oa = audioOf(old);
    fadeTo(oa, 0, 600, () => { if (currentName !== old) oa.pause(); }); // 멈춘 자리는 기억해 둡니다
  }
  const a = audioOf(name);
  a.play().catch(() => {});
  fadeTo(a, target(), 900);
}

export function getVolume() { return volume; }
export function setVolume(v) {
  volume = Math.max(0, Math.min(100, Math.round(v)));
  if (currentName) { fades.delete(audioOf(currentName)); audioOf(currentName).volume = target(); }
  try { localStorage.setItem(KEY, JSON.stringify({ volume })); } catch { /* 저장 불가 */ }
}

// 말소리가 나올 때 음악을 잠깐 작게
export function duckBgm(on) {
  duck = on ? 0.35 : 1;
  if (currentName && unlocked) fadeTo(audioOf(currentName), target(), 250);
}

// 첫 터치/클릭/키 입력 때 세 곡을 모두 준비해 둡니다 (아이패드·아이폰은 이때 준비한 소리만 낼 수 있어요)
function unlock() {
  if (unlocked) return;
  unlocked = true;
  for (const name of Object.keys(TRACKS)) {
    const a = audioOf(name);
    if (name === currentName) continue;
    a.muted = true;
    a.play().then(() => { if (currentName !== name) a.pause(); a.muted = false; }).catch(() => { a.muted = false; });
  }
  if (currentName) {
    const a = audioOf(currentName);
    a.play().catch(() => {});
    fadeTo(a, target(), 900);
  }
}
for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true });

// 다른 앱·탭에 다녀오면 다시 재생, 그리고 혹시 멈춰 있으면 다음 터치 때 다시 재생
document.addEventListener('visibilitychange', () => { if (!document.hidden) ensurePlaying(); });
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, ensurePlaying, { passive: true });
