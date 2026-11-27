// 계산대 결제, 거스름돈, 카드 단말기, 은행 입금, 꿈이든 카드 확인, 되돌아보기 화면
import { moneyCanvas, cardCanvas, toImg, PEOPLE, itemCanvas, MONEY, iconCanvas, tokenCanvas } from './sprites.js?v=202611271736';
import { el, panel, closePanel, warn, line, flashHud } from './ui.js?v=202611271736';
import { say, sfx } from './voice.js?v=202611271736';
import { cashTotal, breakDown, exactFromWallet, fewestPieces, removePieces, addPieces } from './state.js?v=202611271736';
import { won, levelCfg, areaLevel } from './data.js?v=202611271736';

const MONEY_NAME = { 10: '십 원', 50: '오십 원', 100: '백 원', 500: '오백 원', 1000: '천 원', 5000: '오천 원', 10000: '만 원', 50000: '오만 원' };
const money = (v, s = 3) => toImg(moneyCanvas(v), s, MONEY_NAME[v]);
const wait = ms => new Promise(r => setTimeout(r, ms));

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// 오답 보기 만들기
export function numberChoices(correct, n, steps = [100, 500, 1000]) {
  const set = new Set([correct]);
  let guard = 0;
  while (set.size < n && guard++ < 50) {
    const st = steps[Math.floor(Math.random() * steps.length)];
    const v = correct + (Math.random() < 0.5 ? -st : st);
    if (v > 0) set.add(v);
  }
  return shuffle([...set]);
}

function ownerSays(box, text) {
  box.textContent = text;
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  say(text);
}


// 카드를 꾹 누른 채로 끌어서 단말기에 대기 (마우스·터치 모두). 'tap'(화면 쪽) 또는 'insert'(꽂는 곳)을 돌려줍니다.
export function dragCard(host, dev, kind, tipText) {
  return new Promise(res => {
    const wrap = el('div', 'drag-card');
    wrap.append(toImg(cardCanvas(kind), 5, ''));
    wrap.setAttribute('role', 'button');
    wrap.tabIndex = 0;
    wrap.setAttribute('aria-label', '카드를 단말기로 끌어 놓기. 엔터를 누르면 대기');
    const tip = el('p', 'drag-tip', tipText || '카드를 꾹 누른 채로 끌어서 단말기에 대 주세요');
    host.append(wrap, tip);
    let sx = 0, sy = 0, dragging = false;
    const zoneAt = (x, y) => {
      const sl = dev.querySelector('.slot').getBoundingClientRect();
      if (x > sl.left - 30 && x < sl.right + 30 && y > sl.top - 36 && y < sl.bottom + 36) return 'insert';
      const d = dev.getBoundingClientRect();
      if (x > d.left - 24 && x < d.right + 24 && y > d.top - 24 && y < d.bottom + 24) return 'tap';
      return null;
    };
    const finish = z => { wrap.remove(); tip.remove(); dev.dataset.over = ''; res(z); };
    wrap.addEventListener('pointerdown', e => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      wrap.setPointerCapture(e.pointerId);
      wrap.classList.add('dragging');
      sfx('step');
    });
    wrap.addEventListener('pointermove', e => {
      if (!dragging) return;
      let dx = e.clientX - sx, dy = e.clientY - sy;
      // 화면을 90도 돌려 출력 중이면 손가락 움직임도 돌려서 계산
      if (document.body.classList.contains('rotated')) [dx, dy] = [dy, -dx];
      wrap.style.transform = `translate(${dx}px, ${dy}px) rotate(-8deg) scale(1.06)`;
      dev.dataset.over = zoneAt(e.clientX, e.clientY) || '';
    });
    wrap.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove('dragging');
      const z = zoneAt(e.clientX, e.clientY);
      if (z) finish(z);
      else { wrap.style.transform = ''; dev.dataset.over = ''; }
    });
    wrap.addEventListener('pointercancel', () => { dragging = false; wrap.classList.remove('dragging'); wrap.style.transform = ''; dev.dataset.over = ''; });
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish('tap'); } });
  });
}

export function makeDevice(withSlotLabel) {
  const dev = el('div', 'device');
  dev.append(el('div', 'screen', ''), el('div', 'slot'));
  if (withSlotLabel) dev.append(el('span', 'slot-label', '카드 꽂는 곳'));
  return dev;
}

// ---------- 결제 ----------
// ctx: { state, config, total, purpose: 'errand'|'eat'|'tutorial', mistake(), log, items }
export function pay(ctx) {
  const { state, config, total } = ctx;
  const L = levelCfg(config, state);
  const denoms = L.money;
  const tray = [];
  let cardPaid = null;

  return new Promise(resolve => {
    const m = panel('pay');
    const head = el('div', 'pay-head');
    const due = el('div', 'due');
    due.append(el('span', null, '내야 할 돈'), el('b', null, won(total)));
    const paidBox = el('div', 'paid');
    head.append(due);
    if (L.pay.showRunningTotal) head.append(paidBox);
    const talkBox = el('div', 'owner-line', '');
    const owner = el('div', 'pay-owner');
    owner.append(toImg(PEOPLE[ctx.who || 'owner']()[0], 4, ''), talkBox);

    const trayEl = el('div', 'tray');
    trayEl.setAttribute('aria-label', '계산대 위');
    const walletEl = el('div', 'wallet');
    const cardsEl = el('div', 'cards');
    const done = el('button', 'btn primary big pay-done', '다 냈어요');
    const top = el('div', 'pay-top');
    top.append(owner, head);
    const bottom = el('div', 'pay-bottom');
    const wlab = el('h3', null, '내 지갑');
    const clab = el('h3', null, '내 카드');
    bottom.append(wlab, walletEl, clab, cardsEl);
    m.append(top, trayEl, bottom, done);

    // 하 단계: 내야 할 돈 모양을 그림자로 보여 줍니다
    let ghosts = [];
    if (L.pay.showSilhouette) {
      ghosts = exactFromWallet(state.cash, total) || breakDown(total, denoms) || [];
    }

    const inWallet = d => (state.cash[d] || 0) - tray.filter(x => x === d).length;
    const trayTotal = () => tray.reduce((a, b) => a + b, 0);
    const remaining = () => total - trayTotal() - (cardPaid?.amount || 0);

    function draw() {
      trayEl.innerHTML = '';
      const used = [...tray];
      if (ghosts.length) {
        const g = [...ghosts];
        for (const t of used) { const i = g.indexOf(t); if (i >= 0) g.splice(i, 1); }
        for (const d of used) trayEl.append(trayPiece(d));
        for (const d of g) { const gh = el('span', 'ghost'); gh.append(money(d)); trayEl.append(gh); }
      } else {
        for (const d of used) trayEl.append(trayPiece(d));
        if (!used.length) trayEl.append(el('span', 'tray-hint', '지갑에서 돈을 눌러 계산대에 올려요'));
      }
      if (cardPaid) {
        const c = el('span', 'tray-card');
        c.append(toImg(cardCanvas(cardPaid.kind), 3, ''), el('small', null, won(cardPaid.amount)));
        trayEl.append(c);
      }
      paidBox.innerHTML = '';
      paidBox.append(el('span', null, '낸 돈'), el('b', null, won(trayTotal() + (cardPaid?.amount || 0))));
      walletEl.innerHTML = '';
      for (const d of [...denoms].sort((a, b) => a - b)) {
        const n = inWallet(d);
        if ((state.cash[d] || 0) === 0) continue;
        const b = el('button', 'money-btn');
        b.append(money(d), el('span', 'count', `${n}`));
        b.setAttribute('aria-label', `${MONEY_NAME[d]} ${n}개`);
        b.disabled = n <= 0 || !!cardPaid;
        b.onclick = () => { tray.push(d); sfx('coin'); say(MONEY_NAME[d]); draw(); };
        walletEl.append(b);
      }
      if (!walletEl.children.length) walletEl.append(el('span', 'tray-hint', '현금이 없어요'));
    }
    function trayPiece(d) {
      const b = el('button', 'tray-piece');
      b.append(money(d));
      b.setAttribute('aria-label', `${MONEY_NAME[d]} 돌려받기`);
      b.onclick = () => { if (cardPaid) return; tray.splice(tray.lastIndexOf(d), 1); draw(); };
      return b;
    }

    const cardKinds = ['check'];
    if (state.hasMealCard) cardKinds.push('meal');
    cardKinds.push('dream', 'welfare');
    const CN = { check: '체크카드', meal: '급식카드', dream: '꿈이든 카드', welfare: '복지카드' };
    for (const k of cardKinds) {
      const b = el('button', 'card-btn');
      b.append(toImg(cardCanvas(k), 4, ''), el('span', null, CN[k]));
      b.onclick = () => useCard(k);
      cardsEl.append(b);
    }

    let cardBusy = false;
    async function useCard(kind) {
      if (cardPaid || cardBusy) return;
      cardBusy = true;
      try { await useCardInner(kind); } finally { cardBusy = false; }
    }
    async function useCardInner(kind) {
      ctx.log?.cardsTried?.push(kind);
      if (kind === 'dream' || kind === 'welfare') {
        await warn(`popup.${kind}`, `popup.${kind}_sub`, kind);
        ctx.mistake?.('nonPaymentCard');
        return;
      }
      if (ctx.cashOnly && kind === 'check') {
        ownerSays(talkBox, '미안해요, 우리 가게는 현금만 받아요. 현금으로 내 줄래요?');
        ctx.log?.cardsTried?.push('cashOnly');
        return;
      }
      if (kind === 'meal' && ctx.purpose !== 'eat') {
        await warn('popup.meal', 'popup.meal_sub', 'meal');
        ctx.mistake?.('mealCardMisuse');
        return;
      }
      const need = remaining();
      if (need <= 0) { ownerSays(talkBox, '돈은 이미 다 냈어!'); return; }
      const balance = kind === 'meal' ? state.meal : state.account;
      if (balance < need) {
        if (kind === 'meal') {
          ownerSays(talkBox, `급식카드에 ${won(balance)}밖에 없어. 모자란 돈은 현금이나 체크카드로 내렴.`);
        } else {
          await warn('popup.no_balance', 'popup.no_balance_sub', 'check');
        }
        return;
      }
      const method = await terminal(kind);
      cardPaid = { kind, amount: need, method };
      if (kind === 'meal') { state.meal -= need; flashHud('meal'); } else { state.account -= need; flashHud('account'); }
      sfx('ok');
      draw();
      await wait(500);
      finish();
    }

    async function terminal(kind) {
      const steps = L.card.steps;
      const choose = steps.includes('tapOrInsert');
      const ov = el('div', 'terminal');
      const dev = makeDevice(choose);
      const msg = el('p', 'term-msg');
      ov.append(dev, msg);
      m.append(ov);
      const tap = !choose || Math.random() < 0.5;
      const prompt = tap ? '카드를 단말기 화면에 대 주세요' : 'IC 카드를 아래 꽂는 곳에 꽂아 주세요';
      dev.querySelector('.screen').textContent = tap ? '카드를 대 주세요' : '카드를 꽂아 주세요';
      msg.textContent = prompt;
      say(prompt);
      for (;;) {
        const z = await dragCard(ov, dev, kind, choose ? '카드를 꾹 누른 채로 끌어서, 화면에 대거나 아래에 꽂아요' : null);
        if (!choose || z === (tap ? 'tap' : 'insert')) break;
        sfx('no');
        msg.textContent = tap ? '화면을 다시 읽어 봐요. 대 달래요!' : '화면을 다시 읽어 봐요. 꽂아 달래요!';
        say(msg.textContent);
        ctx.mistake?.('cardMethod');
      }
      if (!tap) {
        const stuck = el('div', 'stuck-card');
        stuck.append(toImg(cardCanvas(kind), 3, ''));
        dev.append(stuck);
      }
      sfx('beep');
      dev.querySelector('.screen').textContent = '결제 완료';
      msg.textContent = '삑! 결제가 끝났어요.';
      say('결제가 끝났어요.');
      await wait(1000);
      ov.remove();
      return tap ? 'tap' : 'insert';
    }

    done.onclick = async () => {
      if (cardBusy || done.disabled) return;
      const paid = trayTotal();
      if (paid < total) {
        const short = total - paid;
        const allCash = cashTotal(state.cash);
        if (L.card.splitPayment === 'guided' && allCash < total && paid === allCash) {
          ownerSays(talkBox, `현금이 ${won(short)} 모자라요. 나머지는 체크카드로 내요!`);
          cardsEl.querySelector('.card-btn')?.classList.add('hint');
          return;
        }
        if (allCash < total && paid === allCash) {
          ownerSays(talkBox, `${won(short)}이 모자라. 나머지는 카드로 낼래?`);
          return;
        }
        ownerSays(talkBox, `${won(short)}이 모자라.`);
        ctx.mistake?.('underpay');
        return;
      }
      if (areaLevel(state, 'money') === '하' && paid > total && exactFromWallet(state.cash, total)) {
        ownerSays(talkBox, '돈이 너무 많아. 그림자랑 똑같이 맞춰 볼까?');
        ctx.mistake?.('overpay');
        return;
      }
      finish();
    };

    async function finish() {
      removePieces(state.cash, tray);
      if (tray.length) flashHud('cash');
      const paid = trayTotal() + (cardPaid?.amount || 0);
      const change = paid - total;
      if (L.pay.mode === 'fewestPieces' && !cardPaid && change === 0) {
        ctx.log.fewest = tray.length <= fewestPieces(total, denoms);
      }
      m.querySelector('.pay-bottom').remove(); done.remove();
      let changeGot = 0;
      if (change > 0) changeGot = await giveChange(change);
      closePanel();
      resolve({ cash: [...tray], card: cardPaid, change: changeGot });
    }

    async function giveChange(change) {
      const pieces = breakDown(change, denoms) || breakDown(change, Object.keys(MONEY).map(Number));
      const area = el('div', 'change');
      m.append(area);
      const mode = L.change.mode;
      if (mode === 'choose') {
        await new Promise(res => {
          area.innerHTML = '';
          area.append(el('h3', null, '거스름돈은 얼마일까요?'));
          say('거스름돈은 얼마일까요?');
          const row = el('div', 'row');
          for (const v of numberChoices(change, L.change.choices || 3, [100, 500])) {
            const b = el('button', 'btn big', won(v));
            b.onclick = () => {
              if (row.dataset.done) return;
              if (v === change) { row.dataset.done = '1'; sfx('ok'); res(); }
              else { sfx('no'); b.disabled = true; ctx.mistake?.('changeCalc'); }
            };
            row.append(b);
          }
          area.append(row);
        });
      } else if (mode === 'inputAndVerify') {
        await keypadAsk(area, '거스름돈은 얼마일까요? 숫자로 써 보세요.', change, () => ctx.mistake?.('changeCalc'));
      }
      // 거스름돈 받기
      let give = [...pieces];
      let short = 0;
      if (ctx.wrongChange && give.length) {
        const smallest = Math.min(...give.filter(p => p >= 100));
        if (isFinite(smallest)) { give.splice(give.indexOf(smallest), 1); short = smallest; }
      }
      area.innerHTML = '';
      area.append(el('h3', null, '거스름돈이에요'));
      const got = el('div', 'tray');
      give.forEach(p => got.append(money(p)));
      area.append(got);
      ownerSays(talkBox, `여기 거스름돈!`);
      if (short) {
        await new Promise(res => {
          const row = el('div', 'row');
          const a = el('button', 'btn big', '네, 감사합니다');
          const b = el('button', 'btn big', `${won(short)}이 모자라요`);
          a.onclick = () => { sfx('no'); ctx.mistake?.('wrongChangeMissed'); a.disabled = true; ownerSays(talkBox, '다시 세어 볼래?'); };
          b.onclick = () => { sfx('ok'); res(); };
          area.append(el('p', 'q', '받은 거스름돈을 세어 봐요. 맞나요?'));
          row.append(a, b); area.append(row);
          say('받은 거스름돈을 세어 봐요. 맞나요?');
        });
        ownerSays(talkBox, '어머, 미안해! 여기 있어.');
        give = pieces;
        got.innerHTML = ''; give.forEach(p => got.append(money(p)));
        ctx.log.caughtWrongChange = true;
        await wait(900);
      } else {
        const ok = el('button', 'btn primary big', '받았어요');
        area.append(ok);
        await new Promise(r => { ok.onclick = r; });
      }
      addPieces(state.cash, give);
      flashHud('cash');
      sfx('coin');
      return change;
    }

    draw();
    ownerSays(talkBox, ctx.ownerLine || `모두 ${won(total)}이야.`);
  });
}

// 숫자 입력판 (상 단계)
export function keypadAsk(area, prompt, answer, onWrong) {
  return new Promise(res => {
    area.innerHTML = '';
    area.append(el('h3', null, prompt));
    say(prompt);
    const out = el('output', 'num-out', '0원');
    let v = '';
    const pad = el('div', 'keypad');
    const upd = () => { out.textContent = won(Number(v || 0)); };
    [1, 2, 3, 4, 5, 6, 7, 8, 9, '지움', 0, '00'].forEach(k => {
      const b = el('button', 'btn key', String(k));
      b.onclick = () => {
        if (k === '지움') v = v.slice(0, -1);
        else if (v.length < 6) v += String(k);
        upd();
      };
      pad.append(b);
    });
    const ok = el('button', 'btn primary big', '확인');
    ok.onclick = () => {
      if (Number(v) === answer) { sfx('ok'); res(); }
      else { sfx('no'); onWrong?.(); out.classList.add('shake'); setTimeout(() => out.classList.remove('shake'), 400); v = ''; upd(); }
    };
    area.append(out, pad, ok);
  });
}

// ---------- 은행 입금 ----------
export function deposit(ctx) {
  const { state, config } = ctx;
  const L = levelCfg(config, state);
  const unit = config.bank.depositUnit;
  const billsOnly = L.bank.deposit === 'billsOnly';
  const tray = [];
  return new Promise(resolve => {
    const m = panel('pay bank');
    const head = el('div', 'pay-top');
    const who = el('div', 'pay-owner');
    const talkBox = el('div', 'owner-line');
    who.append(toImg(PEOPLE.teller()[0], 4, ''), talkBox);
    const sum = el('div', 'due');
    head.append(who, sum);
    const trayEl = el('div', 'tray');
    const walletEl = el('div', 'wallet');
    const row = el('div', 'row');
    const go = el('button', 'btn primary big', '입금하기');
    const skip = el('button', 'btn big', '오늘은 안 할래요');
    row.append(skip, go);
    m.append(head, trayEl, el('h3', null, '내 지갑'), walletEl, row);
    const total = () => tray.reduce((a, b) => a + b, 0);
    const avail = d => (state.cash[d] || 0) - tray.filter(x => x === d).length;
    function draw() {
      sum.innerHTML = '';
      sum.append(el('span', null, '넣을 돈'), el('b', null, won(total())));
      trayEl.innerHTML = '';
      tray.forEach((d, i) => { const b = el('button', 'tray-piece'); b.append(money(d)); b.onclick = () => { tray.splice(i, 1); draw(); }; trayEl.append(b); });
      if (!tray.length) trayEl.append(el('span', 'tray-hint', billsOnly ? '천 원짜리를 눌러서 올려요' : '넣을 돈을 눌러서 올려요 (천 원 단위)'));
      walletEl.innerHTML = '';
      for (const d of [...L.money].sort((a, b) => a - b)) {
        if (!(state.cash[d] > 0)) continue;
        if (billsOnly && d < 1000) continue;
        const b = el('button', 'money-btn');
        b.append(money(d), el('span', 'count', String(avail(d))));
        b.disabled = avail(d) <= 0;
        b.onclick = () => { tray.push(d); sfx('coin'); draw(); };
        walletEl.append(b);
      }
      const t = total();
      go.disabled = !(t > 0 && t % unit === 0);
      go.textContent = t > 0 && t % unit !== 0 ? `천 원 단위만 넣을 수 있어요` : '입금하기';
    }
    skip.onclick = () => { closePanel(); resolve(0); };
    go.onclick = () => {
      const t = total();
      removePieces(state.cash, tray);
      state.account += t;
      flashHud('cash'); flashHud('account'); sfx('ding');
      closePanel();
      resolve(t);
    };
    draw();
    const tip = L.bank.deposit === 'planKeepCash'
      ? '얼마를 넣을까요? 전통시장은 현금만 받는 곳이 많아요. 현금을 조금 남겨 두는 것도 좋아요.'
      : '계좌에 넣을 돈을 올려 주세요. 천 원 단위로 넣을 수 있어요.';
    ownerSays(talkBox, tip);
  });
}

// ---------- 화폐 알아보기 (튜토리얼) ----------
export function moneyIntro(levelMoney) {
  return new Promise(res => {
    const m = panel('intro');
    m.append(el('h2', null, '우리가 쓰는 돈'));
    const g = el('div', 'money-grid');
    for (const d of levelMoney) {
      const b = el('button', 'money-btn big');
      b.append(money(d, 4), el('span', 'name', MONEY_NAME[d]));
      b.onclick = () => { sfx('coin'); say(MONEY_NAME[d]); };
      g.append(b);
    }
    m.append(g, el('p', 'hint', '돈을 누르면 이름을 들을 수 있어요.'));
    const ok = el('button', 'btn primary big', '다 봤어요');
    ok.onclick = () => { closePanel(); res(); };
    m.append(ok);
  });
}

// ---------- 카드 대 보기 (튜토리얼) ----------
export function tryCard(kind, state) {
  return new Promise(async res => {
    const m = panel('trycard');
    const dev = makeDevice(false);
    dev.querySelector('.screen').textContent = '카드를 대 주세요';
    m.append(el('h2', null, kind === 'check' ? '체크카드 대 보기' : '꿈이든 카드 대 보기'), dev);
    say('카드를 꾹 누른 채로 끌어서 단말기에 대 보세요.');
    await dragCard(m, dev, kind);
    sfx('beep');
    if (kind === 'check') {
      const ok = state.account > 0;
      dev.querySelector('.screen').textContent = ok ? '결제 가능' : '잔액 부족';
      await wait(900);
      closePanel(); res(ok);
    } else {
      dev.querySelector('.screen').textContent = '사용할 수 없는 카드';
      await warn('popup.dream', 'popup.dream_sub', 'dream');
      closePanel(); res(false);
    }
  });
}

// ---------- 꿈이든 카드로 나를 확인해요 ----------
export function idCheck(state, config) {
  const s = state.student;
  const level = state.level;
  return new Promise(async res => {
    const m = panel('idcheck');
    m.append(el('h2', null, '나를 확인해요'));
    const card = el('div', 'idcard');
    const top = el('div', 'idcard-top', config.idCard.name);
    const body = el('div', 'idcard-body');
    const photo = el('div', 'photo'); photo.append(toImg(PEOPLE.player()[0], 4, '내 사진'));
    const info = el('dl');
    info.append(el('dt', null, '이름'), el('dd', null, s.name), el('dt', null, '주소'), el('dd', null, s.address));
    body.append(photo, info); card.append(top, body);
    const q = el('div', 'id-q');
    m.append(card, q);
    say(line('idcheck.intro'));

    const decoyNames = ['이하늘', '박바다', '최나무', '정구름'].filter(n => n !== s.name);
    const decoyAddr = ['별빛동 무지개로 7', '해님동 큰길 101', '달빛동 작은길 5'].filter(a => a !== s.address);
    const ask = (title, correct, decoys, n) => new Promise(r => {
      q.innerHTML = '';
      q.append(el('h3', null, title));
      say(title);
      const row = el('div', 'row');
      for (const v of shuffle([correct, ...decoys.slice(0, n - 1)])) {
        const b = el('button', 'btn big', v);
        b.onclick = () => { if (v === correct) { sfx('ok'); r(); } else { sfx('no'); b.disabled = true; } };
        row.append(b);
      }
      q.append(row);
    });

    if (level === '상') {
      card.classList.add('hidden-card');
      await keypadText(q, '카드를 보지 않고 내 이름을 써 보세요.', s.name);
      card.classList.remove('hidden-card');
      await ask('카드를 보고 내 주소를 골라 보세요.', s.address, decoyAddr, 4);
    } else if (level === '중') {
      await ask('카드에 적힌 내 이름은?', s.name, decoyNames, 3);
      await ask('카드에 적힌 내 주소는?', s.address, decoyAddr, 3);
    } else {
      await ask('카드에 적힌 내 이름은?', s.name, decoyNames, 2);
      say(`${s.name}. 주소는 ${s.address}`);
    }
    q.innerHTML = '';
    q.append(el('h3', null, line('idcheck.ok')));
    say(line('idcheck.ok'));
    const ok = el('button', 'btn primary big', '다시 해 볼게요');
    ok.onclick = () => { closePanel(); res(); };
    q.append(ok);
  });
}

function keypadText(area, prompt, answer) {
  return new Promise(res => {
    area.innerHTML = '';
    area.append(el('h3', null, prompt));
    say(prompt);
    const inp = el('input', 'text-in');
    inp.setAttribute('aria-label', '내 이름');
    inp.autocomplete = 'off';
    const ok = el('button', 'btn primary big', '다 썼어요');
    const fb = el('p', 'q');
    ok.onclick = () => {
      const right = inp.value.replace(/\s/g, '') === answer.replace(/\s/g, '');
      fb.textContent = right ? '맞아요! 카드와 똑같아요.' : `카드를 보고 확인해요. 내 이름은 ${answer}이에요.`;
      say(fb.textContent);
      sfx(right ? 'ok' : 'no');
      setTimeout(res, 1400);
    };
    area.append(inp, ok, fb);
    setTimeout(() => inp.focus(), 50);
  });
}

// ---------- 되돌아보기 (1인칭) ----------
export function review(questions, level, who = 'owner', place = '분식점') {
  return new Promise(async res => {
    const m = panel('review');
    const scene = el('div', 'fp-scene');
    const wall = el('div', 'fp-wall');
    const board = el('div', 'fp-board');
    board.append(el('span', null, place));
    const face = el('div', 'fp-owner'); face.append(toImg(PEOPLE[who]()[0], 12, ''));
    const counter = el('div', 'fp-counter');
    scene.append(wall, board, face, counter);
    const q = el('div', 'fp-q');
    m.append(scene, q);
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      const it = questions[i];
      await new Promise(r => {
        q.innerHTML = '';
        q.append(el('div', 'fp-count', `${i + 1} / ${questions.length}`), el('h3', null, it.q));
        say(it.q);
        const row = el('div', 'row wrap');
        let first = true, solved = false;
        for (const opt of it.options) {
          const b = el('button', 'btn big', opt);
          b.onclick = () => {
            if (solved) return;
            if (opt === it.a) {
              solved = true;
              if (first) score++;
              sfx('ok'); b.classList.add('right');
              say('맞아요!');
              setTimeout(r, 700);
            } else { first = false; sfx('no'); b.disabled = true; }
          };
          row.append(b);
        }
        q.append(row);
      });
    }
    closePanel();
    res(score);
  });
}

export function itemImg(item, s = 4) { return toImg(itemCanvas(item.sprite, item), s, item.name); }
export { money, MONEY_NAME, shuffle, iconCanvas };

// ---------- 학급 토큰으로 내기 (교실) ----------
// ctx: { state, config, total, who, mistake() }
export function tokenPay(ctx) {
  const { state, config, total } = ctx;
  const L = levelCfg(config, state);
  let tray = 0;
  return new Promise(resolve => {
    const m = panel('pay');
    const top = el('div', 'pay-top');
    const owner = el('div', 'pay-owner');
    const talkBox = el('div', 'owner-line');
    owner.append(toImg(PEOPLE[ctx.who || 'clerk']()[0], 4, ''), talkBox);
    const head = el('div', 'pay-head');
    const due = el('div', 'due'); due.append(el('span', null, '내야 할 토큰'), el('b', null, `${total}개`));
    const paid = el('div', 'paid');
    head.append(due); if (L.pay.showRunningTotal) head.append(paid);
    top.append(owner, head);
    const trayEl = el('div', 'tray');
    const bottom = el('div', 'pay-bottom');
    const wallet = el('div', 'wallet');
    bottom.append(el('h3', null, '내 토큰'), wallet);
    const done = el('button', 'btn primary big pay-done', '다 냈어요');
    m.append(top, trayEl, bottom, done);
    const tok = s2 => toImg(tokenCanvas(), s2, '토큰');
    function draw() {
      trayEl.innerHTML = '';
      for (let i = 0; i < tray; i++) {
        const b = el('button', 'tray-piece'); b.append(tok(4));
        b.setAttribute('aria-label', '토큰 돌려받기');
        b.onclick = () => { tray--; draw(); };
        trayEl.append(b);
      }
      if (L.pay.showSilhouette) for (let i = tray; i < total; i++) { const g = el('span', 'ghost'); g.append(tok(4)); trayEl.append(g); }
      if (!tray && !L.pay.showSilhouette) trayEl.append(el('span', 'tray-hint', '토큰을 눌러 장터 책상에 올려요'));
      paid.innerHTML = ''; paid.append(el('span', null, '낸 토큰'), el('b', null, `${tray}개`));
      wallet.innerHTML = '';
      const b = el('button', 'money-btn');
      const left = (state.tokens || 0) - tray;
      b.append(tok(4), el('span', 'count', String(left)));
      b.setAttribute('aria-label', `토큰 ${left}개`);
      b.disabled = left <= 0;
      b.onclick = () => { tray++; sfx('coin'); say(`${tray}개`); draw(); };
      wallet.append(b);
    }
    done.onclick = () => {
      if (tray < total) { ownerSays(talkBox, `토큰이 ${total - tray}개 모자라.`); ctx.mistake?.('underpay'); return; }
      if (tray > total) { ownerSays(talkBox, `토큰이 ${tray - total}개 많아. 다시 세어 볼래?`); ctx.mistake?.('overpay'); return; }
      state.tokens -= tray;
      sfx('ok');
      closePanel();
      resolve(tray);
    };
    draw();
    ownerSays(talkBox, ctx.ownerLine || `토큰 ${total}개야.`);
  });
}

// ---------- 셀프 계산대 (키오스크) ----------
// ctx: { state, config, pool, want(품목 id 목록), full(상: 봉투 단계), mistake() }
export function kiosk(ctx) {
  const { state, pool, want } = ctx;
  return new Promise(async resolve => {
    const m = panel('kiosk');
    const screen = el('div', 'kiosk-screen');
    m.append(el('h2', null, '셀프 계산대'), screen);
    const step = (title) => { screen.innerHTML = ''; screen.append(el('h3', null, title)); say(title); };
    const ask = (title, options) => new Promise(res => {
      step(title);
      const row = el('div', 'row');
      options.forEach((o, i) => { const b = el('button', 'btn big', o); b.onclick = () => res(i); row.append(b); });
      screen.append(row);
    });
    // 1. 물건 담기
    let cart;
    for (;;) {
      cart = await new Promise(res => {
        step('살 물건을 눌러서 담아요');
        const grid = el('div', 'menu');
        const sel = new Set();
        const sum = el('p', 'kiosk-sum');
        const upd = () => { sum.textContent = `담은 물건 ${sel.size}개 · 합계 ${won([...sel].reduce((t, id) => t + pool.find(i => i.id === id).price, 0))}`; };
        for (const it of pool) {
          const b = el('button', 'menu-item');
          b.setAttribute('aria-pressed', 'false');
          b.append(itemImg(it, 3), el('span', 'nm', it.name), el('span', 'pr', won(it.price)));
          b.onclick = () => { sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); b.setAttribute('aria-pressed', sel.has(it.id)); say(it.name); upd(); };
          grid.append(b);
        }
        const go = el('button', 'btn primary big', '결제하기');
        go.onclick = () => res([...sel]);
        upd();
        screen.append(grid, sum, go);
      });
      if (cart.slice().sort().join() === [...want].sort().join()) break;
      sfx('no'); ctx.mistake?.('kioskCart');
      await ask('메모와 담은 물건이 달라요. 다시 담아 볼까요?', ['다시 담기']);
    }
    const total = cart.reduce((t, id) => t + pool.find(i => i.id === id).price, 0);
    // 2. 봉투 (상)
    if (ctx.full) {
      for (;;) {
        const i = await ask('봉투가 필요하세요?', ['필요 없어요 (장바구니 있어요)', '봉투 사기 (100원)']);
        if (i === 0) break;
        sfx('no'); ctx.mistake?.('kioskBag');
        await ask('장바구니를 가져왔으니 봉투는 필요 없어요.', ['알겠어요']);
      }
    }
    // 3. 결제 방법
    for (;;) {
      const i = await ask(`합계 ${won(total)} · 결제 방법을 고르세요`, ['카드 결제', '현금 결제']);
      if (i === 0) break;
      sfx('no');
      await ask('이 계산대는 카드만 돼요. 현금은 계산대 점원에게 내요.', ['알겠어요']);
    }
    if (state.account < total) { await warn('popup.no_balance', 'popup.no_balance_sub', 'check'); }
    // 4. 카드 대기
    step('카드를 리더기에 대 주세요');
    const dev = makeDevice(false);
    dev.querySelector('.screen').textContent = '카드를 대 주세요';
    screen.append(dev);
    await dragCard(screen, dev, 'check');
    sfx('beep');
    state.account -= total;
    flashHud('account');
    dev.querySelector('.screen').textContent = '결제 완료';
    await wait(700);
    // 5. 영수증
    await ask('영수증을 출력할까요?', ['출력하기', '출력 안 하기']);
    sfx('ok');
    closePanel();
    resolve({ total, items: cart });
  });
}

// ---------- 가만히 있기 (미용실) ----------
export function holdStill(seconds = 4) {
  return new Promise(res => {
    const m = panel('hold');
    m.append(el('h2', null, '가만히 있어요'), el('p', 'hint', '머리를 자르는 동안 버튼을 꾹 누른 채로 가만히 있어요.'));
    const bar = el('div', 'hold-bar'); const fill = el('i'); bar.append(fill);
    const btn = el('button', 'btn primary big hold-btn', '꾹 누르기');
    const msg = el('p', 'q', '');
    m.append(bar, btn, msg);
    say('머리를 자르는 동안 버튼을 꾹 누른 채로 가만히 있어요.');
    let t0 = 0, raf = 0, done = false;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
      fill.style.width = (k * 100) + '%';
      if (k >= 1) { done = true; sfx('ok'); say('다 잘랐어요! 잘 참았어요.'); setTimeout(() => { closePanel(); res(); }, 600); return; }
      raf = requestAnimationFrame(tick);
    };
    const down = e => { if (done) return; e.preventDefault(); t0 = performance.now(); msg.textContent = '싹둑싹둑…'; btn.classList.add('on'); raf = requestAnimationFrame(tick); };
    const up = () => {
      if (done || !t0) return;
      cancelAnimationFrame(raf); t0 = 0; fill.style.width = '0%'; btn.classList.remove('on');
      msg.textContent = '움직이면 위험해요! 다시 가만히 있어 볼까요?'; say(msg.textContent); sfx('no');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); });
    btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') up(); });
  });
}

// ---------- 유통기한 고르기 ----------
export function expiryPick(item) {
  return new Promise(res => {
    const d = new Date();
    const fmt = dt => `${dt.getMonth() + 1}월 ${dt.getDate()}일까지`;
    const past = new Date(d); past.setDate(d.getDate() - 2);
    const good = new Date(d); good.setDate(d.getDate() + 5);
    const opts = shuffle([{ ok: false, label: fmt(past) }, { ok: true, label: fmt(good) }]);
    const m = panel('order');
    m.append(el('h2', null, '유통기한을 확인해요'), el('p', 'hint', `오늘은 ${d.getMonth() + 1}월 ${d.getDate()}일이에요. 어느 ${item.name}을(를) 살까요?`));
    say(`오늘은 ${d.getMonth() + 1}월 ${d.getDate()}일이에요. 유통기한을 보고 골라요.`);
    const grid = el('div', 'menu');
    for (const o of opts) {
      const b = el('button', 'menu-item');
      b.append(itemImg(item, 4), el('span', 'nm', item.name), el('span', 'pr', '유통기한 ' + o.label));
      b.onclick = () => { closePanel(); res(o.ok); };
      grid.append(b);
    }
    m.append(grid);
  });
}

// ---------- 번호표 기다리기 (교육지원청) ----------
export function waitTurn(ticket, mistake) {
  return new Promise(res => {
    const m = panel('order');
    m.append(el('h2', null, '내 차례를 기다려요'));
    const board = el('div', 'queue-board', '');
    const mine = el('p', 'my-ticket', `내 번호표: ${ticket}번`);
    const msg = el('p', 'hint', '전광판에 내 번호가 나오면 버튼을 눌러요.');
    const btn = el('button', 'btn primary big', '제 차례예요!');
    btn.style.display = 'flex'; btn.style.margin = '10px auto';
    m.append(el('p', 'hint', '전광판'), board, mine, msg, btn);
    let cur = ticket - 3, timer;
    const show = () => { board.textContent = String(cur).padStart(3, '0'); say(`${cur}번 손님`); };
    const next = () => {
      cur++;
      if (cur > ticket + 1) { cur = ticket - 2; msg.textContent = '내 번호가 지나갔어요! 다시 한번 잘 봐요.'; say(msg.textContent); sfx('no'); }
      show();
    };
    show();
    timer = setInterval(next, 2200);
    btn.onclick = () => {
      if (cur === ticket) { clearInterval(timer); sfx('ok'); say('내 차례예요!'); closePanel(); res(); return; }
      sfx('no'); msg.textContent = '아직 내 번호가 아니에요. 전광판을 보고 기다려요.'; say(msg.textContent); mistake?.('ticketEarly');
    };
  });
}

// ---------- 신청서 쓰기 (교육지원청): 꿈이든 카드를 보고 이름·주소 고르기 ----------
export function formFill(state, nChoices, mistake) {
  const s = state.student;
  return new Promise(res => {
    const m = panel('idcheck');
    m.append(el('h2', null, '신청서를 써요'));
    const card = el('div', 'idcard');
    const body = el('div', 'idcard-body');
    const photo = el('div', 'photo'); photo.append(toImg(PEOPLE.player()[0], 4, '내 사진'));
    const info = el('dl'); info.append(el('dt', null, '이름'), el('dd', null, s.name), el('dt', null, '주소'), el('dd', null, s.address));
    body.append(photo, info); card.append(el('div', 'idcard-top', '꿈이든 카드'), body);
    m.append(el('p', 'hint', '꿈이든 카드를 보고 신청서에 알맞은 것을 골라요.'), card);
    const fields = [
      ['이름', s.name, ['이하늘', '박바다', '최나무'].filter(x => x !== s.name)],
      ['주소', s.address, ['별빛동 무지개로 7', '해님동 큰길 101', '달빛동 작은길 5'].filter(x => x !== s.address)],
      ['온 이유', '서류 제출', ['놀러 옴', '물건 사기']],
    ];
    const done = new Set();
    for (const [label, right, wrongs] of fields) {
      const row = el('div', 'form-row'); row.append(el('b', null, label));
      const opts = el('div', 'row');
      for (const v of shuffle([right, ...shuffle(wrongs).slice(0, nChoices - 1)])) {
        const b = el('button', 'btn', v);
        b.onclick = () => {
          if (done.has(label)) return;
          if (v === right) { done.add(label); b.classList.add('primary'); sfx('ok'); say(v); if (done.size === fields.length) setTimeout(() => { closePanel(); res(); }, 600); }
          else { sfx('no'); b.disabled = true; mistake?.('form'); }
        };
        opts.append(b);
      }
      row.append(opts); m.append(row);
    }
    say('꿈이든 카드를 보고 신청서를 써요.');
  });
}
