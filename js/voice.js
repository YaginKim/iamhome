import { duckBgm } from './bgm.js';

// 음성: voice/manifest.json에 적힌 녹음 파일이 있으면 그 파일을, 없으면 브라우저 TTS를 씁니다.
// 녹음으로 바꾸는 법: voice/대사ID.mp3 파일을 넣고 manifest.json 목록에 대사 ID를 추가하세요.
let recorded = new Set();
let current = null;
let enabled = true;

export async function initVoice() {
  try {
    const list = await fetch('voice/manifest.json').then(r => r.json());
    recorded = new Set(list);
  } catch { recorded = new Set(); }
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
}

export function setVoiceEnabled(on) { enabled = on; if (!on) stop(); }
export function voiceEnabled() { return enabled; }

export function stop() {
  if (current) { current.pause(); current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function say(text, id) {
  if (!enabled || !text) return;
  stop();
  if (id && recorded.has(id)) {
    current = new Audio(`voice/${id}.mp3`);
    current.onplay = () => duckBgm(true);
    current.onended = current.onpause = () => duckBgm(false);
    current.play().catch(() => speakTTS(text));
    return;
  }
  speakTTS(text);
}

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
