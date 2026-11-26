// 「다녀오겠습니다」 게임 흐름: 타이틀 → 집(튜토리얼) → 동네 → 분식점 심부름 → 되돌아보기 → 은행 → 다녀왔습니다
import { loadData, itemsFor, won, LEVELS } from './data.js';
import { playBgm, getVolume, setVolume } from './bgm.js';
import { initVoice, say, sfx, setVoiceEnabled, stop as stopVoice } from './voice.js';
import { World, townMap, homeMap, shopMap, bankMap, loadBuildingManifest } from './engine.js';
import { renderHud, talk, choose, warn, notify, setGoal, el, line, setLines, highlightHud, highlightStamina, highlightLives, panel, closePanel, fade, flashHud } from './ui.js';
import { pay, deposit, moneyIntro, tryCard, idCheck, review, itemImg, numberChoices, shuffle } from './pay.js';
import { newState, load, save, wipe, today, breakDown, addPieces, cashTotal, DEFAULT_STUDENT } from './state.js';
import { iconCanvas, toImg, cardCanvas, PEOPLE, itemCanvas, moneyCanvas } from './sprites.js';

const $ = s => document.querySelector(s);
let D, S, world;
const run = { stage: null }; // 이번 판의 진행 (저장하지 않는 값)

// ---------- 시작 ----------
async function boot() {
  D = await loadData();
  setLines(D.lines);
  await initVoice();
  world = new World($('#world'));
  world.onArrive = (x, y, settled) => onArrive(x, y, settled);
  world.onStep = () => onStep();
  soundButton();
  phoneLandscape();
  await loadBuildingManifest();
  await world.load(townMap(null, ['home', 'school', 'snackbar', 'convenience', 'hairshop', 'market', 'bank', 'mart', 'edu_office', 'moe']), { x: 17, y: 9 });
  titleScreen();
}

function persist() { save(S); }
// 휴대폰: 처음 누를 때 전체 화면 + 가로 고정을 시도합니다 (안 되는 기기는 '가로로 돌려 주세요' 안내가 나와요)
function phoneLandscape() {
  const phone = matchMedia('(hover: none) and (pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
  if (!phone) return;
  window.addEventListener('pointerdown', () => {
    const el = document.documentElement;
    if (!el.requestFullscreen || document.fullscreenElement) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {})
      .finally(() => setTimeout(() => world?.fit(), 300));
  }, { once: true });
}
// 위쪽 정보 막대 보이기 (지도는 막대 아래 남은 공간에 맞춰 그려요)
function showHud(on) {
  $('#hud').hidden = !on;
  document.body.classList.toggle('has-hud', on);
  world?.fit();
}
// 건물 문 바로 아래 인도 칸
function townSpawn(id) {
  const b = townMap(S, []).buildings.find(b => b.id === id);
  return { x: b.doorX, y: b.doorY + 1 };
}

// 오른쪽 위 소리 설정 버튼
function soundButton() {
  const btn = $('#sound-btn'), pop = $('#sound-pop'), range = $('#bgm-vol'), out = $('#bgm-out');
  btn.append(toImg(iconCanvas('speaker'), 4, ''), el('span', 'cap', '소리'));
  const show = v => { range.value = v; out.textContent = v; btn.classList.toggle('muted', v === 0); range.style.setProperty('--fill', v + '%'); };
  show(getVolume());
  btn.onclick = e => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    btn.setAttribute('aria-expanded', String(!pop.hidden));
    if (!pop.hidden) range.focus();
  };
  range.oninput = () => { setVolume(Number(range.value)); show(getVolume()); };
  pop.addEventListener('pointerdown', e => e.stopPropagation());
  window.addEventListener('pointerdown', () => { if (!pop.hidden) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
}
function hud(place) { renderHud(S, D.config, place ?? run.place, lives()); }
// 하트 = 실수 기회. 틀릴 때마다 하나씩 깨지고, 다 깨지면 꿈이든 카드로 나를 확인한 뒤 다시 채워집니다.
function lives() {
  const st = run.stage || run.tutorial;
  if (!st || !S) return null;
  const max = L().triesBeforeIdCheck;
  return { max, left: max - Math.min(max, st.tries || 0) };
}
function L() { return D.config.levels[S.level]; }

// ---------- 타이틀 ----------
// ---------- 시작 화면 배경 (포스터) ----------
let walkTimer = null;
function poster(sc) {
  clearInterval(walkTimer);
  document.body.dataset.map = 'poster';
  const bg = el('div', 'poster');
  bg.setAttribute('aria-hidden', 'true');
  const band = (cls, words) => {
    const b = el('div', 'band ' + cls);
    const track = el('div', 'track');
    const text = words.join('  ✦  ') + '  ✦  ';
    track.append(el('span', null, text), el('span', null, text));
    b.append(track);
    return b;
  };
  bg.append(
    band('band-a', ['우리 집', '교실', '체육관', '운동장', '분식점', '편의점', '전통시장', '미용실', '대형마트', '교육지원청', '교육부']),
    band('band-b', ['낯선 길', '낯선 사람', '낯선 계산대', '그래도 한 걸음']),
  );
  const stickers = [
    ['kimbap', 6, 14, -12, 6], ['tteokbokki', 82, 10, 9, 6], ['onigiri', 90, 46, -8, 5], ['eggs', 4, 62, 8, 5],
    ['greenonion', 14, 84, -16, 6], ['coolpis', 74, 80, 12, 6], ['eomuk', 30, 8, 18, 5], ['shampoo', 62, 6, -10, 5],
    ['badge', 92, 78, -6, 5],
  ];
  for (const [id, x, y, r, sc2] of stickers) {
    const st = el('div', 'sticker');
    st.style.left = x + '%'; st.style.top = y + '%';
    st.style.setProperty('--r', r + 'deg');
    st.style.animationDelay = (-(x + y) / 30).toFixed(2) + 's';
    st.append(toImg(itemCanvas(id), sc2, ''));
    bg.append(st);
  }
  for (const [v, x, y, r] of [[1000, 20, 30, -14], [500, 82, 30, 20], [100, 24, 72, 10], [5000, 80, 62, -8]]) {
    const st = el('div', 'sticker money');
    st.style.left = x + '%'; st.style.top = y + '%';
    st.style.setProperty('--r', r + 'deg');
    st.append(toImg(moneyCanvas(v), 4, ''));
    bg.append(st);
  }
  const hero = el('div', 'hero');
  const frames = PEOPLE.player().map(c => c.toDataURL());
  const img = toImg(PEOPLE.player()[0], 10, '');
  hero.append(img, el('div', 'hero-shadow'));
  let f = 0;
  walkTimer = setInterval(() => { f ^= 1; img.src = frames[f]; }, 260);
  bg.append(hero);
  sc.append(bg);
}

function titleScreen() {
  playBgm('title');
  world.frozen = true;
  showHud(false); setGoal('');
  const sc = $('#screen'); sc.hidden = false; sc.innerHTML = '';
  poster(sc);
  const t = el('div', 'title-screen');
  const logo = el('div', 'logo-wrap');
  logo.append(el('h1', 'logo', '다녀오겠습니다'));
  const trial = el('span', 'trial', '체험판');
  logo.append(trial);
  t.append(logo, el('p', 'tagline', line('title.copy')));
  const row = el('div', 'row');
  const saved = load();
  if (saved) {
    const c = el('button', 'btn primary big', '이어서 하기');
    c.onclick = () => { clearInterval(walkTimer); S = saved; sc.hidden = true; resume(); };
    row.append(c);
  }
  const n = el('button', 'btn big' + (saved ? '' : ' primary'), saved ? '처음부터' : '시작하기');
  n.onclick = () => setupScreen();
  const st = el('button', 'btn big', '선생님 설정');
  st.onclick = () => settingsScreen();
  row.append(n, st);
  t.append(row);
  sc.append(t);
}

function setupScreen() {
  const sc = $('#screen'); sc.innerHTML = '';
  poster(sc);
  const sh = el('div', 'screen-sheet');
  sh.append(el('h2', null, '누가 다녀올까요?'), el('p', 'lead', '난이도와 꿈이든 카드에 적을 이름, 주소를 정해요. 선생님이 함께 정해 주세요.'));
  const lv = el('div', 'levels');
  const desc = {
    하: '그림을 보고 똑같은 돈 맞추기. 천 원 이하. 보기 2개.',
    중: '여러 돈을 섞어서 내기. 거스름돈 고르기. 체크카드와 급식카드 구분.',
    상: '가장 적은 장수로 내기. 거스름돈 직접 계산. 키오스크와 영수증.',
  };
  let pick = '중';
  const btns = LEVELS.map(l => {
    const b = el('button', 'btn level');
    b.append(el('b', null, l), el('span', null, desc[l]));
    b.setAttribute('aria-pressed', l === pick);
    b.onclick = () => { pick = l; btns.forEach((x, i) => x.setAttribute('aria-pressed', LEVELS[i] === l)); say(l); };
    lv.append(b);
    return b;
  });
  sh.append(lv);
  const f1 = el('div', 'field'); const l1 = el('label', null, '이름'); const i1 = el('input'); i1.id = 'nm'; l1.htmlFor = 'nm'; i1.value = DEFAULT_STUDENT.name; f1.append(l1, i1);
  const f2 = el('div', 'field'); const l2 = el('label', null, '주소'); const i2 = el('input'); i2.id = 'ad'; l2.htmlFor = 'ad'; i2.value = DEFAULT_STUDENT.address; f2.append(l2, i2);
  sh.append(f1, f2, el('p', 'note', '처음에는 가상 이름과 주소가 들어 있어요. 실제 정보를 넣어도 이 기기에만 저장되고, 밖으로 보내지 않아요.'));
  const row = el('div', 'row');
  const back = el('button', 'btn big', '뒤로');
  back.onclick = titleScreen;
  const go = el('button', 'btn primary big', '집에서 시작하기');
  go.onclick = () => {
    S = newState(D.config, pick, { name: i1.value.trim() || DEFAULT_STUDENT.name, address: i2.value.trim() || DEFAULT_STUDENT.address });
    persist();
    clearInterval(walkTimer);
    $('#screen').hidden = true;
    startTutorial();
  };
  row.append(back, go);
  sh.append(row);
  sc.append(sh);
}

function settingsScreen() {
  const sc = $('#screen'); sc.innerHTML = ''; sc.hidden = false;
  poster(sc);
  const cur = load();
  const sh = el('div', 'screen-sheet');
  sh.append(el('h2', null, '선생님 설정'), el('p', 'lead', '이 기기에만 적용돼요.'));
  const tog = (label, on, fn) => {
    const l = el('label', 'toggle'); const i = el('input'); i.type = 'checkbox'; i.checked = on;
    i.onchange = () => fn(i.checked); l.append(i, el('span', null, label)); sh.append(l);
  };
  if (cur) {
    tog('음성으로 읽어 주기', cur.settings.voice, v => { cur.settings.voice = v; save(cur); });
    tog('체력 사용하기', cur.settings.stamina, v => { cur.settings.stamina = v; save(cur); });
    const f = el('div', 'field'); const lb = el('label', null, '난이도'); const sel = el('div', 'row');
    sel.style.justifyContent = 'flex-start';
    for (const l of LEVELS) {
      const b = el('button', 'btn' + (cur.level === l ? ' primary' : ''), l);
      b.onclick = () => { cur.level = l; cur.hasMealCard = l !== '하'; save(cur); settingsScreen(); };
      sel.append(b);
    }
    f.append(lb, sel); sh.append(f);
    sh.append(el('p', 'note', `오늘 끝낸 스테이지: ${cur.day.date === today() ? cur.day.count : 0}개 / 하루 ${D.config.session.maxStagesPerDay}개`));
  } else sh.append(el('p', 'note', '아직 저장된 진행이 없어요.'));
  const row = el('div', 'row');
  const back = el('button', 'btn big', '뒤로'); back.onclick = titleScreen;
  row.append(back);
  if (cur) {
    const r = el('button', 'btn big', '오늘 횟수 초기화');
    r.onclick = () => { cur.day = { date: today(), count: 0 }; save(cur); settingsScreen(); };
    const w = el('button', 'btn big', '진행 모두 지우기');
    w.onclick = () => { if (confirm('이 기기의 진행 기록을 모두 지울까요?')) { wipe(); titleScreen(); } };
    row.append(r, w);
  }
  sh.append(row);
  sc.append(sh);
}

function resume() {
  setVoiceEnabled(S.settings.voice);
  if (!S.tutorialDone) return startTutorial();
  if (S.day.date !== today()) S.day = { date: today(), count: 0 };
  enterTown(townSpawn('home'));
  freeRoamGoal();
}

// ---------- 장소 이동 ----------
function unlocked() {
  const u = ['home', 'bank'];
  if (S.tutorialDone) u.push('snackbar');
  return u;
}

async function enterTown(spawn) {
  playBgm('town');
  run.nearNpc = null;
  document.body.dataset.map = 'town';
  run.map = 'town'; run.place = '우리 동네';
  await world.load(townMap(S, unlocked()), spawn);
  showHud(true); hud();
  world.frozen = false;
  updateGoalMarker();
}
async function enterHome(spawn) {
  playBgm('ingame');
  run.nearNpc = null;
  document.body.dataset.map = 'indoor';
  run.map = 'home'; run.place = '우리 집';
  await world.load(homeMap(), spawn);
  showHud(true); hud();
  world.frozen = false;
  updateGoalMarker();
  if (run.endingNext) setTimeout(comeHome, 300);
  if (run.tutorialReturn) setTimeout(tutorialHome, 300);
}
async function enterShop() {
  playBgm('ingame');
  run.nearNpc = null;
  document.body.dataset.map = 'indoor';
  run.map = 'snackbar'; run.place = '분식점';
  await world.load(shopMap());
  hud(); world.frozen = false; updateGoalMarker();
}
async function enterBank() {
  playBgm('ingame');
  run.nearNpc = null;
  document.body.dataset.map = 'indoor';
  run.map = 'bank'; run.place = '은행';
  await world.load(bankMap());
  hud(); world.frozen = false; updateGoalMarker();
}

function updateGoalMarker() {
  world.goal = null;
  const g = run.goal;
  if (!g) return;
  if (run.map === 'town') {
    const b = world.map.buildings.find(b => b.id === g);
    if (b) world.goal = { x: b.doorX, y: b.doorY }; // 문 위를 가리키는 화살표
  } else if (run.map === 'home' && g === 'home') world.goal = { x: 9, y: 3 }; // 엄마 머리 위
  else if (run.map === 'snackbar' && g === 'snackbar') world.goal = { ...world.map.counter };
  else if (run.map === 'bank' && g === 'bank') world.goal = (L().bank.mode === 'atm' && run.tutorial?.step !== 'bank') ? { x: world.map.atm.x, y: world.map.atm.y + 1 } : { ...world.map.counter };
  else if (world.map.door) world.goal = { ...world.map.door };
}

function goal(where, text) { run.goal = where; setGoal(text); updateGoalMarker(); }

// 문, 사람, 계산대에 닿았을 때
let busy = false;
async function onArrive(x, y, settled) {
  if (busy) return;
  const m = world.map;
  if (run.map === 'town') {
    const b = m.buildings.find(b => b.doorX === x && b.doorY === y);
    if (!b) return;
    if (b.locked) {
      world.player.path = [];
      busy = true;
      await fade(() => world.load(townMap(S, unlocked()), { x, y: y + 1 }));
      notify(b.id === 'school' ? '학교는 다음 체험판에서 열려요.' : `${b.label}은 아직 열리지 않았어요.`, 'no');
      busy = false;
      return;
    }
    busy = true; world.frozen = true;
    await fade(() => (b.id === 'home' ? enterHome({ x: 7, y: 6 }) : b.id === 'snackbar' ? enterShop() : enterBank()));
    busy = false;
    onEnter(b.id);
    return;
  }
  // 실내: 문으로 나가기
  if (m.door && x === m.door.x && y === m.door.y) {
    if (run.map === 'home' && run.lockHomeDoor) {
      world.player.path = [];
      await fade(() => world.load(homeMap(), { x: 7, y: 6 }));
      if (run.onHomeDoor) { busy = true; await run.onHomeDoor(); busy = false; }
      return;
    }
    busy = true; world.frozen = true;
    const spawnOf = townSpawn(run.map);
    await fade(() => enterTown(spawnOf));
    busy = false;
    return;
  }
  // 사람 가까이 (1칸 안, 대각선 포함). 계산대 뒤 사람은 계산대 앞 3칸.
  const near = n => (run.map === 'home'
    ? Math.max(Math.abs(n.x - x), Math.abs(n.y - y)) <= 1
    : y === n.y + 2 && Math.abs(n.x - x) <= 1);
  const who = (m.npcs || []).find(near)?.id
    || (run.map === 'bank' && m.atm && Math.max(Math.abs(m.atm.x - x), Math.abs(m.atm.y - y)) <= 1 ? 'atm' : null);
  if (!who) { run.nearNpc = null; return; }
  if (run.nearNpc === who) return;
  run.nearNpc = who;
  world.keys.clear(); world.player.path = []; world.marker = null;
  busy = true; world.frozen = true;
  await meet(who);
  world.frozen = false; busy = false;
}

async function onEnter(id) {
  if (id === 'snackbar' && run.stage?.phase === 'toShop') { /* 계산대로 걸어가요 */ }
}

let stepCount = 0;
function onStep() {
  if (!S || !S.settings.stamina || !S.tutorialDone) return;
  stepCount++;
  if (stepCount % 40 === 0) changeStamina(-D.config.stamina.drainPerMinuteWalking);
}

function changeStamina(d) {
  const before = S.stamina;
  S.stamina = Math.max(0, Math.min(D.config.stamina.max, S.stamina + d));
  world.slow = S.settings.stamina && S.stamina <= 0;
  if (before > 0 && S.stamina <= 0) notify('배가 너무 고파요… 분식점에서 먹을 걸 사 먹어요.', 'no');
  hud(); persist();
}

// ---------- 튜토리얼 (집) ----------
async function startTutorial() {
  setVoiceEnabled(S.settings.voice);
  run.tutorial = { step: 'findMom' };
  await enterHome({ x: 11, y: 4 });
  world.frozen = true;
  goal('home', line('home.goal.findmom'));
  await talk(null, '여기는 우리 집이에요. 화면을 누르거나 방향키를 누르면 걸어가요.');
  world.frozen = false;
  run.lockHomeDoor = true;
  run.onHomeDoor = async () => { await talk(null, '먼저 엄마한테 가 봐요. 노란 화살표가 있는 곳이에요.'); };
}

async function meet(who) {
  if (who === 'mom') return momTalk();
  if (who === 'owner') return ownerTalk();
  if (who === 'teller' || who === 'atm') return bankTalk(who);
}

async function momTalk() {
  if (run.tutorial?.step === 'findMom') return tutorialLesson();
  if (run.tutorial?.step === 'toDoor') return talk('mom', line('home.mom.door'));
  const st = run.stage;
  if (!st) return talk('mom', '오늘도 잘했어! 동네를 둘러봐도 좋아.');
  if (st.phase === 'atHome') return giveErrand();
  if (st.phase === 'deliver') return deliverErrand();
  if (st.phase === 'toShop') return talk('mom', '분식점에 다녀와 줄래? 메모를 잊지 마!');
  return talk('mom', '은행에 들렀다 오렴.');
}

async function tutorialLesson() {
  run.tutorial.step = 'lesson';
  goal(null, '');
  const lv = S.level;
  await talk('mom', 'home.mom.hello');
  await greetLoop('mom', '엄마에게 아침 인사를 해요.', '안녕히 주무셨어요?', ['안녕히 주무세요.', '잘 가요!', '(아무 말 안 하기)']);
  await talk('mom', 'home.mom.greet_ok');
  highlightHud(true);
  await talk('mom', 'home.mom.hud');
  if (S.hasMealCard) await talk('mom', 'home.mom.hud_meal');
  highlightHud(false);
  if (S.settings.stamina) { highlightStamina(true); await talk('mom', 'home.mom.stamina'); highlightStamina(false); }
  highlightLives(true); await talk('mom', 'home.mom.hearts', { n: L().triesBeforeIdCheck }); highlightLives(false);
  await talk('mom', 'home.mom.money');
  await moneyIntro(L().money);
  // 체크카드: 계좌에 있는 돈만
  await talk('mom', 'home.mom.check_try');
  await tryCard('check', S);
  await talk('mom', 'home.mom.check_fail');
  await talk('mom', 'home.mom.check_rule');
  await talk('mom', 'home.mom.transfer');
  S.account += 3000; hud(); flashHud('account');
  notify(D.config.accountEvents[0].message);
  await wait(800);
  await tryCard('check', S);
  await talk('mom', 'home.mom.check_ok');
  // 꿈이든 카드
  await talk('mom', 'home.mom.dream_try');
  await tryCard('dream', S);
  await talk('mom', 'home.mom.dream_rule');
  await idCard();
  await talk('mom', 'home.mom.dream_check');
  if (S.hasMealCard) {
    await talk('mom', 'home.mom.meal');
    await warn('popup.meal', 'popup.meal_sub', 'meal');
  }
  await talk('mom', 'home.mom.bank');
  await talk('mom', 'home.mom.interest');
  if (lv === '상') await talk('mom', 'home.mom.interest_real');
  await talk('mom', 'home.mom.flow');
  await talk('mom', 'home.mom.limit');
  await talk('mom', 'home.mom.door');
  run.tutorial.step = 'toDoor';
  goal('door', '현관으로 가요.');
  run.onHomeDoor = async () => {
    world.frozen = true;
    await greetLoop(null, 'home.door.greet', '다녀오겠습니다!', ['다녀왔습니다!', '안녕히 주무세요.', '(그냥 나가기)']);
    sfx('ok');
    await talk('mom', 'home.mom.bye');
    run.lockHomeDoor = false; run.onHomeDoor = null;
    run.tutorial.step = 'bank';
    S.cash['1000'] = (S.cash['1000'] || 0) + 2; // 튜토리얼 보상: 천 원 2장
    hud(); flashHud('cash');
    notify('엄마가 용돈 2,000원을 현금으로 줬어요!', 'coin');
    persist();
    await fade(() => enterTown(townSpawn('home')));
    goal('bank', '은행에 가서 돈을 계좌에 넣어 봐요.');
  };
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function idCard() {
  const m = panel('idcheck');
  m.append(el('h2', null, D.config.idCard.name));
  const card = el('div', 'idcard');
  const body = el('div', 'idcard-body');
  const photo = el('div', 'photo'); photo.append(toImg(PEOPLE.player()[0], 4, '내 사진'));
  const dl = el('dl');
  dl.append(el('dt', null, '이름'), el('dd', null, S.student.name), el('dt', null, '주소'), el('dd', null, S.student.address));
  body.append(photo, dl);
  card.append(el('div', 'idcard-top', D.config.idCard.name), body);
  m.append(card);
  say(`이름, ${S.student.name}. 주소, ${S.student.address}.`);
  const ok = el('button', 'btn primary big', '다 읽었어요');
  m.append(ok);
  ok.style.display = 'flex'; ok.style.margin = '0 auto';
  await new Promise(r => { ok.onclick = r; });
  closePanel();
}

// 인사 고르기: 맞을 때까지. 실수가 쌓이면 꿈이든 카드 확인.
async function greetLoop(who, prompt, right, wrongs) {
  const n = L().choices === 'free' ? 4 : Math.min(L().choices, 4);
  const opts = shuffle([right, ...shuffle([...wrongs]).slice(0, n - 1)]);
  for (;;) {
    const i = await choose(who, prompt, opts.map(t => ({ text: t })));
    say(opts[i]);
    if (opts[i] === right) { sfx('ok'); log('greet', { prompt, said: right }); return; }
    sfx('no');
    await mistake('greet');
    await talk(null, '다시 생각해 봐요. 이럴 때는 어떤 인사가 어울릴까요?');
    await maybeIdCheck();
  }
}

// ---------- 실수와 꿈이든 카드 확인 ----------
async function mistake(kind) {
  if (!run.stage && !run.tutorial) return false;
  const st = run.stage || run.tutorial;
  st.mistakes = (st.mistakes || 0) + 1;
  st.tries = (st.tries || 0) + 1;
  log('mistake', { kind });
  hud();
  if (st.tries >= L().triesBeforeIdCheck) {
    st.pendingId = true;
    return true;
  }
  return false;
}
async function maybeIdCheck() {
  const st = run.stage || run.tutorial;
  if (st?.pendingId) {
    st.pendingId = false;
    await idCheck(S, D.config);
    st.tries = 0;
    hud();
    notify('하트가 다시 가득 찼어요!', 'ok');
  }
}

function log(type, data) {
  if (run.stage) run.stage.log.push({ type, ...data });
}

// ---------- 분식점 스테이지 ----------
function missionsFor() { return D.config.session.missionsPerStage[S.level]; }

function startStage() {
  const charge = D.config.mealCard.autoChargePerStage[S.level];
  if (S.hasMealCard && charge) {
    S.meal += charge;
    notify(`급식카드가 ${won(charge)} 충전됐어요.`);
    flashHud('meal');
  }
  run.stage = { id: 'snackbar', mission: 0, mistakes: 0, tries: 0, log: [], phase: 'atHome', bought: [], incidentAt: 2, cardsTried: [] };
  hud(); persist();
}

function pickErrand() {
  const pool = itemsFor(D, 'snackbar', S.level).filter(i => i.price);
  const per = L().itemsPerMission;
  const n = Array.isArray(per) ? per[0] + Math.floor(Math.random() * (per[1] - per[0] + 1)) : per;
  const items = shuffle([...pool]).slice(0, Math.min(n, pool.length));
  return items;
}

async function giveErrand() {
  const st = run.stage;
  const k = st.mission;
  const items = pickErrand();
  const total = items.reduce((t, i) => t + i.price, 0);
  st.errand = { items, total, payBy: k === 1 ? 'card' : 'cash' };
  await talk('mom', k === 0 ? '분식점에 심부름 다녀와 줄래? 여기 메모야.' : '하나 더 부탁해도 될까? 새 메모야.');
  await showMemo(true);
  if (st.errand.payBy === 'card') {
    await talk('mom', `이번에는 체크카드로 사 와. 엄마가 계좌로 ${won(total)}을 보내 줄게.`);
    S.account += total; hud(); flashHud('account');
    notify(`띵동! 엄마가 계좌로 ${won(total)}을 보냈어요.`);
  } else {
    const denoms = L().money;
    let give;
    if (S.level === '하') give = breakDown(total, denoms);
    else {
      // 금액보다 조금 큰 지폐를 줍니다 (만 원이 넘으면 만 원짜리 여러 장)
      const bill = [...denoms].sort((a, b) => a - b).find(d => d >= 1000 && d <= 10000 && d >= total);
      give = bill ? [bill] : Array(Math.ceil(total / 10000)).fill(10000);
    }
    addPieces(S.cash, give);
    hud(); flashHud('cash'); sfx('coin');
    await talk('mom', `여기 ${won(give.reduce((a, b) => a + b, 0))} 줄게. 거스름돈은 잘 받아 와!`);
  }
  st.phase = 'toShop';
  persist();
  goal('snackbar', `분식점에서 ${S.level === '상' ? '메모에 적힌 것' : items.map(i => i.name).join(', ')}을 사 와요.`);
  memoButton(true);
}

function memoButton(on) {
  const b = $('#memo-btn');
  b.hidden = !on;
  b.onclick = () => { run.stage.peeks = (run.stage.peeks || 0) + 1; showMemo(false); };
}

function showMemo(fromMom) {
  return new Promise(res => {
    const e = run.stage.errand;
    const m = panel('memo');
    m.append(el('h2', null, '심부름 메모'));
    const card = el('div', 'memo-card');
    card.append(el('h4', null, '분식점에서 사 올 것'));
    const ul = el('ul');
    for (const it of e.items) {
      const li = el('li');
      li.append(itemImg(it, 3), el('span', null, it.name + (S.level === '하' ? ` (${won(it.price)})` : '')));
      ul.append(li);
    }
    card.append(ul);
    m.append(card);
    if (S.level === '상' && fromMom) m.append(el('p', 'hint', '잘 기억해 두세요. 메모를 다시 보면 별을 받기 어려워져요.'));
    say('분식점에서 사 올 것. ' + e.items.map(i => i.name).join(', '));
    const ok = el('button', 'btn primary big', '기억했어요');
    ok.style.display = 'flex'; ok.style.margin = '8px auto';
    ok.onclick = () => { closePanel(); res(); };
    m.append(ok);
  });
}

async function ownerTalk() {
  const st = run.stage;
  if (!st || (st.phase !== 'toShop' && st.phase !== 'deliver')) {
    await talk('owner', '어서 와! 지금은 심부름이 없구나. 집에 가서 엄마를 만나 보렴.');
    return;
  }
  if (st.phase === 'deliver') { await hungryOffer(); return; }
  world.frozen = true;
  setGoal('');
  // 돌발 상황 (한 판에 한 번)
  if (st.mission === st.incidentAt && !st.incidentDone) {
    st.incidentDone = true;
    if (S.level === '하') {
      await greetLoop(null, 'shop.queue', '줄 서서 기다려요', ['앞으로 끼어들어요', '큰 소리로 불러요']);
      await talk(null, '차례를 잘 기다렸어요!');
    }
  }
  await talk('owner', 'shop.owner.welcome');
  await greetLoop(null, 'shop.greet.prompt', '안녕하세요!', ['야, 떡볶이 줘.', '안녕히 계세요.', '(아무 말 없이 서 있기)']);
  await maybeIdCheck();
  // 주문
  if (S.level === '중' && st.mission === st.incidentAt && !st.soldoutDone) {
    st.soldoutDone = true;
    await talk('owner', 'shop.soldout');
    await greetLoop(null, '어떻게 말할까요?', '괜찮아요. 그럼 다른 날 살게요.', ['왜 없어요! 빨리 줘요!', '(화내고 나가기)']);
    await talk('owner', '고마워! 그건 오늘은 빼고 줄게. 다른 건 있어.');
  }
  await orderItems();
  await maybeIdCheck();
  const e = st.errand;
  // 상: 합계 계산
  let ownerLine;
  if (S.level === '상' && e.items.length > 1) {
    for (;;) {
      const opts = numberChoices(e.total, 4, [500, 1000]);
      const i = await choose('owner', '모두 얼마인지 알겠니?', opts.map(v => ({ text: won(v) })), { grid: true });
      if (opts[i] === e.total) { sfx('ok'); break; }
      sfx('no'); await mistake('total'); await maybeIdCheck();
    }
    ownerLine = `맞아! 모두 ${won(e.total)}이야.`;
  }
  // 결제
  let result;
  for (;;) {
    const ctx = {
      state: S, config: D.config, total: e.total, purpose: 'errand', log: st, ownerLine,
      wrongChange: S.level === '상' && st.mission === st.incidentAt && !st.wrongChangeDone,
      mistake: k => mistake(k),
    };
    if (e.payBy === 'card') ctx.ownerLine = (ownerLine ? ownerLine + ' ' : '') + '이번에는 체크카드로 내 볼까?';
    result = await pay(ctx);
    if (ctx.wrongChange) st.wrongChangeDone = true;
    break;
  }
  log('paid', { total: e.total, items: e.items.map(i => i.name), card: result.card?.kind, change: result.change });
  hud(); persist();
  await maybeIdCheck();
  // 카드 돌려받기
  if (result.card?.method === 'insert' && L().card.steps.includes('takeCardBack')) {
    for (;;) {
      const i = await choose(null, '결제가 끝났어요. 이제 무엇을 할까요?', [{ text: '그냥 나가기' }, { text: '단말기에서 카드 돌려받기', img: toImg(cardCanvas(result.card.kind), 2, '') }]);
      if (i === 1) { sfx('ok'); break; }
      sfx('no'); await talk('owner', 'shop.owner.cardback'); await mistake('cardBack'); await maybeIdCheck();
    }
  }
  // 영수증 (상)
  if (result.card && L().card.steps.includes('checkReceipt')) {
    for (;;) {
      const opts = numberChoices(e.total, 3, [500, 1000]);
      const i = await choose('owner', `영수증이야. 영수증에 적힌 합계는 얼마일까? (${e.items.map(it => `${it.name} ${won(it.price)}`).join(', ')})`, opts.map(v => ({ text: won(v) })));
      if (opts[i] === e.total) { sfx('ok'); break; }
      sfx('no'); await mistake('receipt'); await maybeIdCheck();
    }
  }
  await talk('owner', 'shop.owner.thanks');
  await greetLoop(null, 'shop.bye.prompt', '감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 나가기)', '안녕하세요!']);
  await maybeIdCheck();
  st.bought.push(...e.items.map(i => i.id));
  for (const it of e.items) if (!S.stickers.includes(it.id)) S.stickers.push(it.id);
  st.phase = 'deliver';
  persist();
  await hungryOffer();
  goal('home', '집에 가서 엄마에게 물건을 드려요.');
  world.frozen = false;
}

async function orderItems() {
  const st = run.stage, e = st.errand;
  const pool = itemsFor(D, 'snackbar', S.level).filter(i => i.price);
  for (;;) {
    const picked = await new Promise(res => {
      const m = panel('order');
      m.append(el('h2', null, '분식점 메뉴'));
      if (S.level === '하') {
        const memo = el('div', 'memo-card');
        memo.append(el('h4', null, '메모'));
        const ul = el('ul'); e.items.forEach(it => { const li = el('li'); li.append(itemImg(it, 2), el('span', null, it.name)); ul.append(li); });
        memo.append(ul); m.append(memo);
      }
      const grid = el('div', 'menu');
      const sel = new Set();
      for (const it of pool) {
        const b = el('button', 'menu-item');
        b.setAttribute('aria-pressed', 'false');
        b.append(itemImg(it, 4), el('span', 'nm', it.name), el('span', 'pr', won(it.price)));
        b.onclick = () => {
          sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id);
          b.setAttribute('aria-pressed', sel.has(it.id));
          say(it.name + ', ' + won(it.price));
        };
        grid.append(b);
      }
      m.append(grid);
      const row = el('div', 'row');
      const memoBtn = el('button', 'btn big', '메모 다시 보기');
      memoBtn.onclick = async () => { st.peeks = (st.peeks || 0) + 1; closePanel(); await showMemo(false); res(null); };
      const ok = el('button', 'btn primary big', '이거 주세요');
      ok.onclick = () => { closePanel(); res([...sel]); };
      if (S.level !== '하') row.append(memoBtn);
      row.append(ok);
      m.append(row);
      say(line('shop.owner.order'));
    });
    if (!picked) continue;
    const want = e.items.map(i => i.id).sort().join();
    if (picked.sort().join() === want) { sfx('ok'); return; }
    sfx('no');
    await talk('owner', picked.length ? '어, 메모에 적힌 거 맞니? 다시 골라 볼래?' : '뭘 줄까? 메뉴에서 골라 줘.');
    if (picked.length) { await mistake('order'); await maybeIdCheck(); }
  }
}

async function hungryOffer() {
  if (!S.settings.stamina || S.stamina >= 60) return;
  const i = await choose('owner', 'shop.owner.hungry', [{ text: '네, 먹고 갈래요' }, { text: '괜찮아요' }]);
  if (i !== 0) return;
  const food = itemsFor(D, 'snackbar', S.level).filter(it => it.heal && it.price);
  const pick = await new Promise(res => {
    const m = panel('order');
    m.append(el('h2', null, '무엇을 먹을까요?'));
    if (S.hasMealCard) m.append(el('p', 'hint', `급식카드 잔액: ${won(S.meal)} · 먹을거리는 급식카드로 낼 수 있어요.`));
    const grid = el('div', 'menu');
    for (const it of food) {
      const b = el('button', 'menu-item');
      b.append(itemImg(it, 4), el('span', 'nm', it.name), el('span', 'pr', won(it.price)), el('span', null, `체력 +${it.heal}`));
      b.onclick = () => { closePanel(); res(it); };
      grid.append(b);
    }
    const no = el('button', 'btn big', '안 먹을래요');
    no.style.display = 'flex'; no.style.margin = '18px auto';
    no.onclick = () => { closePanel(); res(null); };
    m.append(grid, no);
  });
  if (!pick) return;
  await pay({ state: S, config: D.config, total: pick.price, purpose: 'eat', log: run.stage || {}, mistake: k => mistake(k), ownerLine: `${pick.name} ${won(pick.price)}이야. 급식카드도 돼.` });
  changeStamina(pick.heal);
  notify(`냠냠! 체력이 ${pick.heal} 올랐어요.`, 'ok');
}

async function deliverErrand() {
  const st = run.stage;
  memoButton(false);
  await greetLoop(null, '집에 돌아왔어요. 엄마에게 뭐라고 인사할까요?', '다녀왔습니다!', ['다녀오겠습니다!', '안녕히 계세요.', '(그냥 들어가기)']);
  await talk('mom', `고마워! ${st.errand.items.map(i => i.name).join(', ')} 잘 받았어.`);
  st.mission++;
  changeStamina(-D.config.stamina.drainPerMission);
  // 가끔 계좌로 보상
  if (st.mission === 2 && S.level !== '하') {
    const ev = D.config.accountEvents[2];
    S.account += ev.amount; hud(); flashHud('account'); notify(ev.message);
  } else {
    addPieces(S.cash, [1000]); hud(); flashHud('cash'); sfx('coin');
    await talk('mom', '심부름 값으로 천 원 줄게!');
  }
  persist();
  if (st.mission >= missionsFor()) return finishStage();
  st.phase = 'atHome';
  await giveErrand();
}

// ---------- 되돌아보기 → 완료 → 은행 ----------
function buildReview() {
  const st = run.stage;
  const qs = [];
  const greet = st.log.find(l => l.type === 'greet' && l.prompt === 'shop.greet.prompt');
  if (greet) qs.push({ q: '아까 분식점에 들어가서 사장님께 처음에 뭐라고 했나요?', a: '안녕하세요!', options: shuffle(['안녕하세요!', ...shuffle(['안녕히 계세요.', '야, 떡볶이 줘.']).slice(0, S.level === '하' ? 1 : 2)]) });
  const paid = st.log.filter(l => l.type === 'paid');
  const one = paid[0];
  if (one) {
    const it = D.items.find(i => i.name === one.items[0]);
    if (it) qs.push({ q: `${it.name}은 얼마였나요?`, a: won(it.price), options: numberChoices(it.price, S.level === '하' ? 2 : 3, [500, 1000]).map(won) });
  }
  const ch = paid.find(p => p.change > 0);
  if (ch && S.level !== '하') qs.push({ q: '거스름돈을 얼마 받았나요?', a: won(ch.change), options: numberChoices(ch.change, 3, [100, 500]).map(won) });
  qs.push({ q: '돈으로 쓸 수 없는 카드는 무엇인가요?', a: '꿈이든 카드', options: shuffle(['꿈이든 카드', '체크카드']) });
  if (S.hasMealCard) qs.push({ q: '급식카드로 살 수 있는 것은?', a: '내가 먹을 먹을거리', options: shuffle(['내가 먹을 먹을거리', '샴푸', '연필']) });
  qs.push({ q: '체크카드로는 어떤 돈을 쓰나요?', a: '계좌에 있는 돈', options: shuffle(['계좌에 있는 돈', '지갑에 있는 현금']) });
  return qs.slice(0, S.level === '하' ? 3 : 5);
}

async function finishStage() {
  const st = run.stage;
  memoButton(false); setGoal('');
  await talk('mom', '오늘 심부름 정말 잘했어! 분식점에서 한 일을 같이 떠올려 볼까?');
  const qs = buildReview();
  await fade();
  const score = await review(qs, S.level);
  let stars = 1;
  if (st.mistakes <= 3) stars++;
  if (score >= qs.length - 1) stars++;
  if (S.level === '상' && (st.peeks || 0) > 1) stars = Math.max(1, stars - 1);
  S.stars.snackbar = Math.max(S.stars.snackbar || 0, stars);
  if (!S.cleared.includes('snackbar')) S.cleared.push('snackbar');
  // 이자
  const rate = D.config.bank.interestRate, unit = D.config.bank.interestRoundDown;
  const interest = Math.floor(S.account * rate / unit) * unit;
  S.account += interest;
  S.day.count++;
  st.phase = 'toBank';
  persist();
  await clearScreen('분식점', stars, score, qs.length, interest);
  hud();
  goal('bank', '은행에 가서 돈을 계좌에 넣어요.');
}

function clearScreen(name, stars, score, total, interest) {
  return new Promise(res => {
    const sc = $('#screen'); sc.hidden = false; sc.innerHTML = '';
    const c = el('div', 'clear-screen');
    c.append(el('h2', null, `${name} 완료!`));
    const s = el('div', 'stars');
    for (let i = 0; i < 3; i++) s.append(toImg(iconCanvas(i < stars ? 'star' : 'starEmpty'), 10, ''));
    c.append(s);
    const f = el('div', 'facts');
    const fl = (label, v) => { const p = el('div'); p.append(el('span', null, label + ' '), el('b', null, v)); f.append(p); };
    fl('되돌아보기', `${score} / ${total}`);
    fl('계좌 이자 (10%)', '+' + won(interest));
    fl('지금 계좌', won(S.account));
    c.append(f);
    const ok = el('button', 'btn primary big', '은행에 가기');
    ok.onclick = () => { sc.hidden = true; res(); };
    c.append(ok);
    sc.append(c);
    sfx('ding');
    say(`${name} 완료! 별 ${stars}개. 이자 ${won(interest)}이 생겼어요.`);
  });
}

async function bankTalk(who) {
  const tut = run.tutorial?.step === 'bank';
  const st = run.stage;
  if (!tut && st?.phase !== 'toBank' && !st) {
    // 자유롭게 입금
  }
  const useAtm = L().bank.mode === 'atm';
  if (who === 'teller' && useAtm && !tut) await talk('teller', '입금은 저기 ATM에서 할 수 있어요. 오른쪽 기계로 가 보세요.');
  if (who === 'atm' && !useAtm) await talk(null, '하 단계에서는 창구 직원에게 도움을 받아요. 왼쪽 직원에게 가 봐요.');
  if ((who === 'teller' && useAtm && !tut) || (who === 'atm' && !useAtm)) return;
  await talk(who === 'atm' ? null : 'teller', 'bank.welcome');
  const amt = await deposit({ state: S, config: D.config });
  hud();
  if (amt) {
    notify(`계좌에 ${won(amt)}을 넣었어요.`);
    await talk(who === 'atm' ? null : 'teller', 'bank.deposit_ok');
  }
  persist();
  if (tut) {
    run.tutorial.step = 'return';
    run.tutorialReturn = true;
    await talk(null, '은행 일을 마쳤어요. 이제 집으로 돌아가요.');
    goal('home', '집으로 돌아가요.');
    return;
  }
  if (st?.phase === 'toBank') {
    st.phase = 'goHome';
    goal('home', '집으로 돌아가요.');
    run.lockHomeDoor = false;
    run.endingNext = true;
  }
}

// 튜토리얼을 마치고 집에 돌아왔을 때
async function tutorialHome() {
  run.tutorialReturn = false;
  world.frozen = true;
  await greetLoop(null, '집에 돌아왔어요. 엄마에게 뭐라고 인사할까요?', '다녀왔습니다!', ['다녀오겠습니다!', '안녕히 주무세요.', '(그냥 들어가기)']);
  run.tutorial = null;
  S.tutorialDone = true;
  if (!S.cleared.includes('home')) S.cleared.push('home');
  persist();
  await new Promise(res => {
    const sc = $('#screen'); sc.hidden = false; sc.innerHTML = '';
    const c = el('div', 'clear-screen home-clear');
    c.append(el('h1', 'world-logo', '다녀왔습니다'), el('p', 'facts', '집 스테이지 완료! 이제 분식점이 열렸어요.'));
    const ok = el('button', 'btn primary big', '계속하기');
    ok.onclick = () => { sc.hidden = true; res(); };
    c.append(ok); sc.append(c);
    sfx('ding'); say('다녀왔습니다! 집 스테이지 완료!');
  });
  await talk('mom', '잘 다녀왔어! 이제 진짜 심부름을 부탁해 볼까?');
  startStage();
  world.frozen = false;
  goal('home', '엄마에게 말을 걸어 심부름 메모를 받아요.');
}

// 마지막으로 집에 돌아왔을 때
async function comeHome() {
  run.endingNext = false;
  world.frozen = true;
  await greetLoop(null, '집에 돌아왔어요. 뭐라고 인사할까요?', '다녀왔습니다!', ['다녀오겠습니다!', '안녕히 계세요.']);
  await talk('mom', '어서 와! 오늘도 혼자서 잘 다녀왔구나.');
  run.stage = null;
  persist();
  endingScreen();
}

function endingScreen() {
  const sc = $('#screen'); sc.hidden = false; sc.innerHTML = '';
  const e = el('div', 'ending');
  e.append(el('h1', 'logo', '다녀왔습니다'), el('p', null, '체험판은 여기까지예요. 다음에는 학교, 편의점, 전통시장이 열려요.'));
  const ok = el('button', 'btn primary big', '처음 화면으로');
  ok.onclick = () => titleScreen();
  e.append(ok);
  sc.append(e);
  sfx('ding');
  say('다녀왔습니다', 'ending.title');
}

function freeRoamGoal() {
  if (run.stage) return;
  if (S.cleared.includes('snackbar')) goal(null, '');
  else { startStage(); goal('home', '집에 가서 엄마에게 심부름 메모를 받아요.'); }
}


// 자동 점검용 (게임에는 영향 없음)
window.__dbg = { get world() { return world; }, get S() { return S; }, run };

window.addEventListener('beforeunload', () => { if (S) persist(); });
boot();
