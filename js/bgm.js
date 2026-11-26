// 배경음악: 화면마다 곡을 바꾸고, 소리 크기(0~100)는 이 기기에 저장합니다.
// 곡 바꾸기: assets/bgm/ 의 파일을 같은 이름으로 바꾸거나 아래 TRACKS의 파일 이름을 고치세요.
const TRACKS = {
  title: 'assets/bgm/kudo.mp3',                 // 시작 화면
  ingame: 'assets/bgm/dream-big-little-star.mp3', // 대부분의 게임 화면 (집, 가게, 은행 등)
  town: 'assets/bgm/pixelated-love.mp3',         // 동네 지도에서 이동할 때
};
const KEY = 'dagyeo-sound-v1';

let volume = 60; // 0~100
let duck = 1;    // 음성이 나올 때 잠깐 줄이기
let current = null; // { name, audio }
let wanted = null;
let unlocked = false;

try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v.volume === 'number') volume = v.volume; } catch { /* 기본값 */ }

const target = () => (volume / 100) * duck;

function fadeTo(audio, to, ms, done) {
  const from = audio.volume, start = performance.now();
  const tick = now => {
    const k = Math.min(1, (now - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(tick); else done?.();
  };
  requestAnimationFrame(tick);
}

export function playBgm(name) {
  wanted = name;
  if (!unlocked) return; // 브라우저는 화면을 한 번 눌러야 소리를 낼 수 있어요
  if (current?.name === name) return;
  const old = current;
  if (old) fadeTo(old.audio, 0, 600, () => old.audio.pause());
  const audio = new Audio(TRACKS[name]);
  audio.loop = true;
  audio.volume = 0;
  audio.play().catch(() => {});
  current = { name, audio };
  fadeTo(audio, target(), 900);
}

export function getVolume() { return volume; }
export function setVolume(v) {
  volume = Math.max(0, Math.min(100, Math.round(v)));
  if (current) current.audio.volume = target();
  try { localStorage.setItem(KEY, JSON.stringify({ volume })); } catch { /* 저장 불가 */ }
}

// 말소리가 나올 때 음악을 잠깐 작게
export function duckBgm(on) {
  duck = on ? 0.35 : 1;
  if (current) fadeTo(current.audio, target(), 250);
}

// 첫 터치/클릭/키 입력 때 음악 시작
function unlock() {
  if (unlocked) return;
  unlocked = true;
  if (wanted) playBgm(wanted);
}
for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { once: true, capture: true });
