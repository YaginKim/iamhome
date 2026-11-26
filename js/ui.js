// 화면 위에 얹는 UI: 상단 정보(HUD), 대화창, 선택지, 경고 팝업, 알림
import { iconCanvas, toImg, PEOPLE, cardCanvas } from './sprites.js';
import { say, sfx } from './voice.js';
import { cashTotal } from './state.js';
import { won } from './data.js';

const $ = s => document.querySelector(s);
export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

let LINES = {};
export function setLines(l) { LINES = l; }
export function line(id, vars = {}) {
  return (LINES[id] || id).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// ---------- HUD ----------
export function renderHud(state, config, place) {
  const left = $('#hud-left');
  left.innerHTML = '';
  if (place) left.append(el('div', 'place', place));
  if (state.settings.stamina) {
    const st = el('div', 'stamina');
    st.setAttribute('aria-label', `체력 ${state.stamina} / ${config.stamina.max}`);
    if (config.stamina.display[state.level] === 'hearts5') {
      const full = Math.ceil(state.stamina / 20);
      for (let i = 0; i < 5; i++) st.append(toImg(iconCanvas(i < full ? 'heart' : 'heartEmpty'), 3));
    } else {
      st.append(toImg(iconCanvas('heart'), 3));
      const bar = el('div', 'bar'); const fill = el('i');
      fill.style.width = state.stamina + '%';
      if (state.stamina < 30) bar.classList.add('low');
      bar.append(fill); st.append(bar);
    }
    // 숫자로도 보여 줍니다 (예: 76 / 100)
    const num = el('span', 'stamina-num' + (state.stamina < 30 ? ' low' : ''));
    num.append(el('b', null, String(state.stamina)), el('small', null, ` / ${config.stamina.max}`));
    st.append(num);
    left.append(st);
  }
  const right = $('#hud-right');
  right.innerHTML = '';
  const row = (icon, label, value, key) => {
    const r = el('div', 'money-row'); r.dataset.key = key;
    r.append(toImg(iconCanvas(icon), 3), el('span', 'label', label), el('b', 'value', won(value)));
    right.append(r);
  };
  row('cash', '현금', cashTotal(state.cash), 'cash');
  row('bank', '계좌', state.account, 'account');
  if (state.hasMealCard && config.mealCard.showFromLevel.includes(state.level)) row('meal', '급식카드', state.meal, 'meal');
}

export function flashHud(key) {
  const r = document.querySelector(`.money-row[data-key="${key}"]`);
  if (!r) return;
  r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
}

export function highlightHud(on) { $('#hud-right').classList.toggle('spot', on); }
export function highlightStamina(on) { $('#hud-left').classList.toggle('spot', on); }

// ---------- 목표 배너 ----------
export function setGoal(text) {
  const b = $('#goal');
  b.textContent = text || '';
  b.hidden = !text;
}

// ---------- 대화 ----------
const PORTRAITS = {};
function portrait(who) {
  if (!who || !PEOPLE[who]) return null;
  PORTRAITS[who] ||= PEOPLE[who]()[0];
  return toImg(PORTRAITS[who], 4, '');
}

const NAMES = { mom: '엄마', owner: '분식점 사장님', teller: '은행 직원', player: '나' };

function openDialog(who, text, voiceId) {
  const d = $('#dialog');
  d.hidden = false;
  d.innerHTML = '';
  const face = portrait(who);
  const box = el('div', 'dlg-body');
  if (face) { const f = el('div', 'face'); f.append(face); d.append(f); }
  if (who && NAMES[who]) box.append(el('div', 'who', NAMES[who]));
  const p = el('p', 'say', text);
  box.append(p);
  d.append(box);
  const replay = el('button', 'icon-btn replay');
  replay.setAttribute('aria-label', '다시 듣기');
  replay.append(toImg(iconCanvas('speaker'), 3));
  replay.onclick = () => say(text, voiceId);
  d.append(replay);
  say(text, voiceId);
  return { d, box };
}

export function closeDialog() { $('#dialog').hidden = true; }

// 말하기: [다음]을 누를 때까지 기다립니다
export function talk(who, idOrText, vars, opts = {}) {
  const isId = LINES[idOrText] !== undefined;
  const text = isId ? line(idOrText, vars) : idOrText;
  return new Promise(res => {
    const { d, box } = openDialog(who, text, isId && !vars ? idOrText : null);
    const next = el('button', 'btn primary next', opts.button || '다음');
    next.onclick = () => { if (next.disabled) return; next.disabled = true; sfx('beep'); closeDialog(); res(); };
    box.append(next);
    next.focus({ preventScroll: true });
  });
}

// 선택지: 고른 번호를 돌려줍니다. options: [{text, img?}]
export function choose(who, prompt, options, opts = {}) {
  const isId = LINES[prompt] !== undefined;
  const text = isId ? line(prompt) : prompt;
  return new Promise(res => {
    const { box } = openDialog(who, text, isId ? prompt : null);
    const list = el('div', 'choices' + (opts.grid ? ' grid' : ''));
    options.forEach((o, i) => {
      const b = el('button', 'btn choice');
      if (o.img) b.append(o.img);
      b.append(el('span', null, o.text));
      b.onclick = () => { if (list.dataset.done) return; list.dataset.done = '1'; closeDialog(); res(i); };
      list.append(b);
    });
    box.append(list);
  });
}

// ---------- 경고 팝업 (반드시 [알겠어요]를 눌러야 닫힘) ----------
let warnChain = Promise.resolve();
export function warn(titleId, subId, cardKind) {
  warnChain = warnChain.then(() => showWarn(titleId, subId, cardKind));
  return warnChain;
}
function showWarn(titleId, subId, cardKind) {
  return new Promise(res => {
    const m = $('#popup');
    m.innerHTML = '';
    m.hidden = false;
    const card = el('div', 'warn');
    if (cardKind) {
      const pic = el('div', 'warn-card');
      pic.append(toImg(cardCanvas(cardKind), 6, ''));
      pic.append(el('span', 'nope'));
      card.append(pic);
    }
    const t = line(titleId), s = subId ? line(subId) : '';
    card.append(el('h2', null, t));
    if (s) card.append(el('p', null, s));
    const ok = el('button', 'btn primary big', '알겠어요');
    ok.onclick = () => { m.hidden = true; res(); };
    card.append(ok);
    m.append(card);
    sfx('no');
    say(t + ' ' + s, null);
    setTimeout(() => ok.focus(), 50);
  });
}

// ---------- 알림 (띵동!) ----------
export function notify(text, kind = 'ding') {
  const n = el('div', 'toast', text);
  $('#toasts').append(n);
  sfx(kind);
  say(text);
  setTimeout(() => n.classList.add('out'), 3600);
  setTimeout(() => n.remove(), 4200);
}

// ---------- 큰 패널 ----------
export function panel(cls) {
  const m = $('#panel');
  m.innerHTML = '';
  m.className = 'panel ' + (cls || '');
  m.hidden = false;
  if (cls === 'review' || cls === 'trycard') return m;
  const sheet = el('div', 'sheet');
  m.append(sheet);
  return sheet;
}
export function closePanel() { const m = $('#panel'); m.hidden = true; m.innerHTML = ''; }

export function fade(fn) {
  const f = $('#fade');
  f.classList.add('on');
  return new Promise(res => setTimeout(async () => {
    await fn?.();
    f.classList.remove('on');
    setTimeout(res, 260);
  }, 260));
}
