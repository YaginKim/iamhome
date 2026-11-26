// 진행 상황은 이 기기의 브라우저(localStorage)에만 저장합니다. 밖으로 보내지 않습니다.
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

export function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 불가: 그대로 진행 */ }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch { /* */ } }

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
