// 진행 상황은 이 기기의 브라우저(localStorage)에 학생(학년·반·번호)마다 따로 저장합니다. 밖으로 보내지 않습니다.
const KEY = 'dagyeo-save-v1';

export const DEFAULT_STUDENT = { name: '김꿈이', address: '꿈동네 한걸음로 23' };

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function newState(config, level, student) {
  const start = config.wallet.startCash[level] || {};
  const cash = {};
  for (const [k, v] of Object.entries(start)) cash[k] = v;
  return {
    v: 1, level, student: { ...DEFAULT_STUDENT, ...student },
    cash, account: config.wallet.startAccount || 0,
    meal: 0, hasMealCard: level !== '하',
    stamina: config.stamina.start,
    cleared: [], stars: {}, stickers: [], tutorialDone: false,
    day: { date: today(), count: 0 },
    settings: { voice: true, stamina: true },
  };
}

// ----- 학생별 저장 칸 -----
// 칸 이름: '3-2-5'(3학년 2반 5번), 'teacher'(선생님 연습), ''(학년·반·번호를 고르기 전에 만든 예전 기록)
const keyOf = id => (id ? `${KEY}:${id}` : KEY);
const LAST = 'dagyeo-last-v1';
export const slotId = (g, c, n) => `${g}-${c}-${n}`;
export function slotLabel(id) {
  if (id === 'teacher') return '선생님 연습';
  if (!id) return '예전 기록';
  const [g, c, n] = id.split('-');
  return `${g}학년 ${c}반 ${n}번`;
}
export function load(id) {
  try {
    const s = JSON.parse(localStorage.getItem(keyOf(id)));
    if (s) s.slot = id || '';
    return s;
  } catch { return null; }
}
export function save(s, touch = true) {
  if (!s) return;
  if (touch) s.updated = Date.now();
  try { localStorage.setItem(keyOf(s.slot), JSON.stringify(s)); } catch { /* 저장 불가: 그대로 진행 */ }
}
export function wipe(id) { try { localStorage.removeItem(keyOf(id)); if (lastSlot() === id) localStorage.removeItem(LAST); } catch { /* */ } }
export function lastSlot() {
  try { const v = localStorage.getItem(LAST); if (v !== null) return v; return localStorage.getItem(KEY) ? '' : null; } catch { return null; }
}
export function setLastSlot(id) { try { localStorage.setItem(LAST, id); } catch { /* */ } }
// 이 기기에 저장된 학생 칸 (선생님 연습 제외), 학년·반·번호 순
export function listSlots() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === KEY) out.push('');
      else if (k.startsWith(KEY + ':') && k !== KEY + ':teacher') out.push(k.slice(KEY.length + 1));
    }
  } catch { /* */ }
  const num = id => (id ? id.split('-').map(Number) : [0, 0, 0]);
  return out.sort((a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
}

// ----- 선생님 비밀번호 (이 기기에만) -----
const TKEY = 'dagyeo-teacher-v1';
export function teacherPin() { try { return localStorage.getItem(TKEY); } catch { return null; } }
export function setTeacherPin(pin) { try { localStorage.setItem(TKEY, pin); } catch { /* */ } }


// ----- 현금(화폐 개수) -----
export const cashTotal = cash => Object.entries(cash).reduce((t, [d, n]) => t + Number(d) * n, 0);

export function addPieces(cash, pieces) {
  for (const p of pieces) cash[p] = (cash[p] || 0) + 1;
}
export function removePieces(cash, pieces) {
  for (const p of pieces) cash[p] = Math.max(0, (cash[p] || 0) - 1);
}

// 금액을 화폐 조각으로 (큰 것부터). denoms: 사용할 수 있는 화폐 목록
export function breakDown(amount, denoms) {
  const out = [];
  const list = [...denoms].sort((a, b) => b - a);
  for (const d of list) while (amount >= d) { out.push(d); amount -= d; }
  return amount === 0 ? out : null;
}

// 가진 조각으로 정확히 낼 수 있는 조합 (가장 적은 장수)
export function exactFromWallet(cash, amount) {
  const pieces = [];
  for (const [d, n] of Object.entries(cash)) for (let i = 0; i < n; i++) pieces.push(Number(d));
  pieces.sort((a, b) => b - a);
  const best = new Map([[0, []]]);
  for (const p of pieces) {
    for (const [sum, combo] of [...best.entries()]) {
      const ns = sum + p;
      if (ns > amount) continue;
      if (!best.has(ns) || best.get(ns).length > combo.length + 1) best.set(ns, [...combo, p]);
    }
  }
  return best.get(amount) || null;
}

export function fewestPieces(amount, denoms) {
  return breakDown(amount, denoms)?.length ?? Infinity;
}
