import { keys as myClips, getClip, initRecordings } from './recordings.js?v=202611271828';
import { duckBgm } from './bgm.js?v=202611271828';

// 음성: voice/manifest.json에 적힌 녹음 파일이 있으면 그 파일을, 없으면 브라우저 TTS를 씁니다.
// 녹음 파일 이름은 대사 글자로 정해져요 (voiceKey). 대본: docs/대사-녹음-대본.xlsx, 방법: voice/README.md
// 예전 방식(voice/대사ID.mp3)도 그대로 됩니다.
let recorded = new Map(); // 사이트에 올라간 녹음: 대사 이름 → 파일
let current = null;
let enabled = true;

export async function initVoice() {
  try {
    const list = await fetch('voice/manifest.json', { cache: 'no-cache' }).then(r => r.json());
    // 예전 형식 ["대사ID"] (mp3) 과 새 형식 {"v1a2b3c4d": "v1a2b3c4d.m4a?v=…"} 둘 다 읽어요
    recorded = new Map(Array.isArray(list) ? list.map(id => [id, `${id}.mp3`]) : Object.entries(list));
  } catch { recorded = new Map(); }
  await initRecordings();
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
}

// 사이트에 올라간 녹음 파일 (녹음 화면에서 씀)
export const siteFile = key => recorded.get(key) || null;
export function setSiteFiles(obj) { recorded = new Map(Object.entries(obj)); }

export function setVoiceEnabled(on) { enabled = on; if (!on) stop(); }
export function voiceEnabled() { return enabled; }

export function stop() {
  sayToken++;
  if (current) { current.pause(); current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// 대사 글자 → 녹음 파일 이름 (tools/voice_script.py 와 같은 계산: 공백 정리 후 FNV-1a 32비트)
export function voiceKey(text) {
  const t = String(text).trim().replace(/\s+/g, ' ');
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'v' + h.toString(16).padStart(8, '0');
}

let sayToken = 0;
function playUrl(url, text, onEnd) {
  current = new Audio(url);
  current.onplay = () => duckBgm(true);
  current.onended = current.onpause = () => { duckBgm(false); onEnd?.(); };
  current.play().catch(() => { onEnd?.(); speakTTS(text); });
}

export function say(text, id) {
  if (!enabled || !text) return;
  window.__said?.push(text); // 자동 점검용
  stop();
  const key = voiceKey(text);
  // 1) 선생님이 게임에서 녹음한 것 2) voice 폴더의 파일 3) 기계 음성(TTS)
  if (myClips.has(key)) {
    const my = ++sayToken;
    getClip(key).then(c => {
      if (my !== sayToken) return; // 그 사이에 다른 대사가 시작됨
      if (!c) return speakTTS(text);
      const url = URL.createObjectURL(c.blob);
      playUrl(url, text, () => URL.revokeObjectURL(url));
    });
    return;
  }
  const file = (id && recorded.get(id)) || recorded.get(key);
  if (file) { playUrl(`voice/${file}`, text); return; }
  speakTTS(text);
}

// 녹음 화면에서 기계 음성과 비교해 들을 때
export function sayTTS(text) { stop(); speakTTS(text); }

function speakTTS(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text.replace(/[「」*]/g, ''));
  u.lang = 'ko-KR';
  u.rate = 0.9;
  const ko = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('ko'));
  if (ko) u.voice = ko;
  u.onstart = () => duckBgm(true);
  u.onend = u.onerror = () => duckBgm(false);
  speechSynthesis.speak(u);
}

// 효과음: 짧은 소리를 코드로 합성합니다 (파일 없음).
let actx = null;
export function sfx(kind) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = {
      coin: [[1320, 0.05], [1760, 0.09]],
      beep: [[880, 0.12]],
      ok: [[660, 0.08], [880, 0.08], [1100, 0.14]],
      no: [[300, 0.12], [220, 0.18]],
      ding: [[1046, 0.1], [1318, 0.22]],
      step: [[180, 0.03]],
    }[kind] || [[600, 0.05]];
    let t = actx.currentTime;
    for (const [f, d] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === 'step' ? 'triangle' : 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(kind === 'step' ? 0.03 : 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + d);
      t += d * 0.9;
    }
  } catch { /* 소리 없이 진행 */ }
}
