// 「다녀오겠습니다」 게임 흐름: 타이틀 → 집(튜토리얼) → 동네 → 분식점 심부름 → 되돌아보기 → 은행 → 다녀왔습니다
import { loadData, itemsFor, won, LEVELS, AREAS, areaLevel, levelCfg } from './data.js?v=202611271033';
import { playBgm, getVolume, setVolume } from './bgm.js?v=202611271033';
import { initVoice, say, sfx, setVoiceEnabled, stop as stopVoice } from './voice.js?v=202611271033';
import { World, townMap, homeMap, shopMap, bankMap, classroomMap, gymMap, fieldMap, convenienceMap, marketMap, hairshopMap, martMap, eduOfficeMap, moeMap, loadBuildingManifest } from './engine.js?v=202611271033';
import { renderHud, talk, choose, warn, notify, setGoal, el, line, setLines, highlightHud, highlightStamina, highlightLives, setBookHandler, panel, closePanel, fade, flashHud } from './ui.js?v=202611271033';
import { pay, tokenPay, kiosk, holdStill, expiryPick, waitTurn, formFill, deposit, moneyIntro, tryCard, idCheck, review, itemImg, numberChoices, shuffle } from './pay.js?v=202611271033';
import { newState, load, save, wipe, today, breakDown, addPieces, removePieces, cashTotal, DEFAULT_STUDENT } from './state.js?v=202611271033';
import { iconCanvas, toImg, cardCanvas, PEOPLE, itemCanvas, moneyCanvas } from './sprites.js?v=202611271033';

const $ = s => document.querySelector(s);
// 받침에 따라 조사 고르기: josa('우유', '은', '는') → '우유는'
function josa(word, withB, noB) {
  const w = String(word).replace(/[^가-힣0-9]+$/, '');
  const c = w.charCodeAt(w.length - 1);
  const has = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 !== 0 : /[013678]$/.test(w);
  return word + (has ? withB : noB);
}
const listOf = items => items.map(i => i.name).join(', ');
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
  setBookHandler(openBook);
  touchLayout();
  await loadBuildingManifest();
  await world.load(townMap(null, ['home', 'school', 'snackbar', 'convenience', 'hairshop', 'market', 'bank', 'mart', 'edu_office', 'moe']), { x: 17, y: 9 });
  titleScreen();
}

function persist() { save(S); }
// 휴대폰·패드: 세로로 들고 있으면 게임 화면을 90도 돌려 출력하고, 오른쪽 아래에 방향키를 보여 줘요 (PC는 그대로)
function touchLayout() {
  const apply = () => {
    // 휴대폰·패드 판단: 브라우저마다 알려 주는 정보가 달라서 여러 가지를 함께 봐요
    const ua = navigator.userAgent || '';
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser/i.test(ua);
    const ipadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches;
    const touch = mobileUA || ipadOS || (navigator.maxTouchPoints > 0 && coarse && !matchMedia('(pointer: fine)').matches);
    document.body.classList.toggle('touch', touch);
    document.body.classList.toggle('rotated', touch && window.innerHeight > window.innerWidth);
    requestAnimationFrame(() => world?.fit());
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 200));
  // 방향키
  for (const b of document.querySelectorAll('#dpad button')) {
    const k = b.dataset.k;
    const down = e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('on'); world.pressKey(k, true); };
    const up = () => { b.classList.remove('on'); world.pressKey(k, false); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
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
function hud(place) { renderHud(S, D.config, place ?? run.place, lives(), run.stage?.def?.mode === 'token' ? { tokens: S.tokens || 0 } : null); }
// 하트 = 실수 기회. 틀릴 때마다 하나씩 깨지고, 다 깨지면 꿈이든 카드로 나를 확인한 뒤 다시 채워집니다.
function lives() {
  const st = run.stage || run.tutorial;
  if (!st || !S) return null;
  const max = L().triesBeforeIdCheck;
  return { max, left: max - Math.min(max, st.tries || 0) };
}
function L() { return levelCfg(D.config, S); }

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

// 휴대폰·패드 첫 화면: 세로 모드로 고정하고 기기를 왼쪽으로 눕히라는 안내 (게임 화면 밖에 똑바로 띄움)
function orientGuide() {
  if (!document.body.classList.contains('touch')) return;
  try { if (sessionStorage.getItem('dagyeo-orient')) return; } catch { /* */ }
  const ov = el('div', 'orient');
  ov.id = 'orient';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-label', '화면 방향 안내');
  const card = el('div', 'orient-card');
  const pic = el('div', 'orient-pic'); pic.setAttribute('aria-hidden', 'true');
  const phone = el('div', 'orient-phone'); phone.append(el('i'));
  pic.append(phone);
  const how = el('ol', 'orient-steps');
  const li1 = el('li'); li1.append(el('b', null, '세로 모드로 고정'), el('span', null, '아이폰·아이패드: 제어 센터 → 화면 방향 잠금 켜기'), el('span', null, '갤럭시: 빠른 설정 → 자동 회전 끄기 (세로)'));
  const li2 = el('li'); li2.append(el('b', null, '기기를 왼쪽으로 눕히기'), el('span', null, '게임 화면이 똑바로 보여요'));
  how.append(li1, li2);
  const ok = el('button', 'btn primary big', '확인했어요');
  ok.onclick = () => { try { sessionStorage.setItem('dagyeo-orient', '1'); } catch { /* */ } ov.remove(); };
  card.append(pic, el('h2', null, '세로 모드로 고정해 주세요'), how, ok);
  ov.append(card);
  document.body.append(ov);
}

function titleScreen() {
  playBgm('title');
  orientGuide();
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
    // 영역별 난이도 (경계선 학생용): 비워 두면 위의 난이도를 따라가요
    sh.append(el('h3', null, '영역별 난이도'), el('p', 'note', '학생에 맞게 영역마다 따로 정할 수 있어요. "기본"은 위의 난이도를 따라가요.'));
    cur.areas ||= {};
    for (const [key, label] of Object.entries(AREAS)) {
      const r = el('div', 'area-row'); r.append(el('span', null, label));
      for (const l of ['기본', ...LEVELS]) {
        const on = (cur.areas[key] || '기본') === l;
        const b = el('button', 'btn' + (on ? ' primary' : ''), l);
        b.onclick = () => { if (l === '기본') delete cur.areas[key]; else cur.areas[key] = l; save(cur); settingsScreen(); };
        r.append(b);
      }
      sh.append(r);
    }
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
  if (!S.tutorialDone) return u;
  const cur = currentDef();
  for (const d of STAGES) if (S.cleared.includes(d.id) || d === cur) u.push(d.building);
  return [...new Set(u)];
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
async function enterRoom(def) {
  playBgm('ingame');
  run.nearNpc = null;
  document.body.dataset.map = 'indoor';
  run.map = def.id; run.place = isSchool(def) ? `학교 ${def.name}` : def.name;
  await world.load(def.map());
  hud(); world.frozen = false;
  const st = run.stage;
  if (st && st.def === def && st.phase === 'toSchool' && def.mode === 'script') { st.phase = 'script'; st.step = 0; stepGoal(); }
  else if (st && st.def === def && st.phase === 'toSchool') { st.phase = 'atRoom'; goal('giver', '선생님께 가서 인사해요.'); }
  else if (st && st.def === def && def.mart && st.phase === 'toShop') martGoal();
  else updateGoalMarker();
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
  else if (run.map === 'bank' && g === 'bank') world.goal = (L().bank.mode === 'atm' && run.tutorial?.step !== 'bank') ? { x: world.map.atm.x, y: world.map.atm.y + 1 } : { ...world.map.counter };
  else if ((g === 'step' || g === 'obj') && run.goalTarget) {
    const t = run.goalTarget;
    const n = (world.map.npcs || []).find(n => n.id === t) || (world.map.objects || []).find(o => o.id === t);
    if (n) world.goal = n.counter ? { x: n.x, y: n.y + 2 } : { x: n.x, y: n.y }; // 창구 뒤 사람은 창구 앞 칸
  }
  else if (g === 'kiosk' && world.map.kiosk) world.goal = { x: world.map.kiosk.x, y: world.map.kiosk.y };
  else if ((g === 'counter' || g === run.map) && world.map.counters && run.stage?.errand?.left?.length) world.goal = { ...world.map.counters[run.stage.errand.left[0]] };
  else if ((g === 'counter' || g === run.map) && run.stage?.errand?.payBy === 'kiosk' && world.map.kiosk) world.goal = { x: world.map.kiosk.x, y: world.map.kiosk.y };
  else if ((g === 'counter' || g === run.map) && world.map.counter) world.goal = { ...world.map.counter };
  else if (g === 'giver' && run.stage?.def) {
    const n = (world.map.npcs || []).find(n => n.id === run.stage.def.giver);
    if (n) world.goal = { x: n.x, y: n.y };
  }
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
      notify(`${josa(b.label, '은', '는')} 아직 열리지 않았어요.`, 'no');
      busy = false;
      return;
    }
    busy = true; world.frozen = true;
    const roomDef = run.stage?.def?.building === b.id ? run.stage.def
      : [...STAGES].reverse().find(d => d.building === b.id && S.cleared.includes(d.id));
    if (b.id !== 'home' && b.id !== 'bank' && !roomDef) {
      busy = false; world.frozen = false;
      notify('지금은 할 일이 없어요.', 'no');
      return;
    }
    await fade(() => (b.id === 'home' ? enterHome({ x: 7, y: 6 }) : b.id === 'bank' ? enterBank() : enterRoom(roomDef)));
    busy = false;
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
    const spawnOf = townSpawn(stageById(run.map)?.building || run.map);
    await fade(() => enterTown(spawnOf));
    busy = false;
    return;
  }
  // 사람 가까이 (1칸 안, 대각선 포함). 계산대 뒤 사람은 계산대 앞 3칸.
  const near = n => (n.counter
    ? y === n.y + 2 && Math.abs(n.x - x) <= 1
    : Math.max(Math.abs(n.x - x), Math.abs(n.y - y)) <= 1);
  const who = (m.npcs || []).find(near)?.id
    || (run.map === 'bank' && m.atm && Math.max(Math.abs(m.atm.x - x), Math.abs(m.atm.y - y)) <= 1 ? 'atm' : null)
    || (m.kiosk && Math.max(Math.abs(m.kiosk.x - x), Math.abs(m.kiosk.y - y)) <= 1 ? 'kiosk' : null)
    || (m.objects || []).find(o => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= 1)?.id;
  if (!who) { run.nearNpc = null; return; }
  if (run.nearNpc === who) return;
  run.nearNpc = who;
  world.keys.clear(); world.player.path = []; world.marker = null;
  busy = true; world.frozen = true;
  await meet(who);
  world.frozen = false; busy = false;
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
  const st = run.stage;
  if (st?.def.mode === 'script' && st.phase === 'script') {
    const target = st.def.steps(S.level)[st.step];
    if (who === target) return runStep(target);
    if (who !== 'mom') return talk(null, '먼저 노란 글씨 목표를 따라가 봐요.');
  }
  if (st?.def.mart && st.phase === 'toShop' && (who === 'cart' || who.startsWith('c_'))) return martObject(who);
  if (who === 'mom') return momTalk();
  if (who === 'teacher') return teacherTalk();
  if (who === 'friend') return talk('friend', '안녕! 오늘도 같이 힘내자.');
  if (who === 'teller' || who === 'atm') return bankTalk(who);
  if (who === 'kiosk') return kioskTalk();
  return sellerTalk(who);
}

async function momTalk() {
  if (run.tutorial?.step === 'findMom') return tutorialLesson();
  if (run.tutorial?.step === 'toDoor') return talk('mom', line('home.mom.door'));
  const st = run.stage;
  if (!st) {
    if (currentDef() && dayLimitReached()) return talk('mom', '오늘은 여기까지! 내일 또 하자.');
    if (currentDef()) { await nextStage(); if (run.stage) return momTalk(); return; }
    return talk('mom', '오늘도 잘했어! 동네를 둘러봐도 좋아.');
  }
  const def = st.def;
  if (st.phase === 'atHome') return def.mode === 'script' ? leaveForSchool(def) : def.giver === 'mom' ? giveErrand() : leaveForSchool(def);
  if (st.phase === 'deliver' && def.giver === 'mom') return deliverErrand();
  if (st.phase === 'toShop') return talk('mom', `${def.name}에 다녀와 줄래? 메모를 잊지 마!`);
  if (st.phase === 'toSchool') return talk('mom', '현관으로 가서 인사하고 학교에 가렴.');
  if (st.phase === 'toBank') return talk('mom', '은행에 들렀다 오렴.');
  return talk('mom', '잘 다녀와!');
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

// ---------- 스테이지 목록 (정식 순서) ----------
// giver: 심부름을 주는 사람(엄마는 집, 선생님은 학교 안) / seller: 계산대 사람 / mode: 돈 내는 방식
const STAGES = [
  { id: 'classroom', name: '교실', building: 'school', map: classroomMap, giver: 'teacher', seller: 'clerk', mode: 'token',
    itemStage: 'classroom', counterName: '학급 문구 장터', greet: ['안녕! 문구 살게.', ['야, 빨리 줘.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['고마워!', ['됐어.', '(그냥 가기)', '안녕하세요!']] },
  { id: 'gym', name: '체육관', building: 'school', map: gymMap, giver: 'teacher', seller: 'helper', mode: 'rental',
    itemStage: 'gym', counterName: '체육 도구 대여 창구', greet: ['안녕하세요!', ['야, 공 줘.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['감사합니다!', ['됐어요.', '(그냥 가기)', '안녕하세요!']] },
  { id: 'field', name: '운동장', building: 'school', map: fieldMap, giver: 'teacher', seller: 'parent', mode: 'cash',
    itemStage: 'field', counterName: '운동회 먹거리 부스', greet: ['안녕하세요!', ['야, 이거 줘.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 가기)', '안녕하세요!']] },
  { id: 'snackbar', name: '분식점', building: 'snackbar', map: shopMap, giver: 'mom', seller: 'owner', mode: 'cash',
    itemStage: 'snackbar', counterName: '분식점', greet: ['안녕하세요!', ['야, 떡볶이 줘.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 나가기)', '안녕하세요!']] },
  { id: 'convenience', name: '편의점', building: 'convenience', map: convenienceMap, giver: 'mom', seller: 'cashier', mode: 'cash', promo: true, bag: true, kiosk: true, expiry: true,
    itemStage: 'convenience', counterName: '편의점', greet: ['안녕하세요!', ['야, 이거 계산해.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 나가기)', '안녕하세요!']] },
  { id: 'market', name: '전통시장', building: 'market', map: marketMap, giver: 'mom', seller: 'grocer', mode: 'cash', cashOnly: true, dum: true, lowMax: 5000,
    missions: { 하: 2, 중: 3, 상: 3 },
    stalls: [{ seller: 'grocer', name: '채소·과일 가게', cats: ['채소', '과일', '생선'] }, { seller: 'baker', name: '떡·반찬 가게', cats: ['식품', '간식', '반찬', '잡화'] }],
    itemStage: 'market', counterName: '전통시장', greet: ['안녕하세요!', ['야, 이거 줘.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 가기)', '안녕하세요!']] },
  { id: 'hairshop', name: '미용실', building: 'hairshop', map: hairshopMap, giver: 'mom', seller: 'stylist', mode: 'cash', hair: true, lowMax: 5000,
    missions: { 하: 2, 중: 3, 상: 3 },
    itemStage: 'hairshop', counterName: '미용실', greet: ['안녕하세요!', ['야, 머리 잘라 줘.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 나가기)', '안녕하세요!']] },
  { id: 'mart', name: '대형마트', building: 'mart', map: martMap, giver: 'mom', seller: 'cashier', mode: 'cash', mart: true, bag: true, kiosk: true,
    maxBy: { 하: 6000, 중: 10000 }, missions: { 하: 2, 중: 3, 상: 3 },
    itemStage: 'mart', counterName: '대형마트 계산대', greet: ['안녕하세요!', ['야, 계산해.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 나가기)', '안녕하세요!']] },
  { id: 'edu_office', name: '교육지원청', building: 'edu_office', map: eduOfficeMap, giver: 'mom', reviewBy: 'officer', seller: 'officer', mode: 'script',
    leaveLine: '학교에서 받은 서류를 교육지원청 민원실에 내고 오렴. 번호표를 뽑고 차례를 기다리면 돼.',
    steps: lv => (lv === '하' ? ['ticket', 'officer', 'vending'] : ['ticket', 'officer', 'elevator', 'vending']),
    itemStage: 'edu_office', counterName: '민원실' },
  { id: 'moe', name: '교육부', building: 'moe', map: moeMap, giver: 'mom', reviewBy: 'guide', seller: 'giftclerk', mode: 'script', lowMax: 4000,
    leaveLine: '오늘은 교육부 견학 가는 날이야! 꿈이든 카드 꼭 챙겨 가렴.',
    steps: () => ['guard', 'gate', 'guide', 'giftclerk'],
    itemStage: 'moe', counterName: '기념품 가게', greet: ['안녕하세요!', ['야, 이거 줘.', '안녕히 계세요.', '(아무 말 없이 서 있기)']], bye: ['감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 가기)', '안녕하세요!']] },
];
// 대형마트 코너
const MART_CORNER = { 식품: 'c_food', 간식: 'c_food', 생활용품: 'c_daily', 과일: 'c_fruit' };
const CORNER_NAME = { c_food: '식품 코너', c_daily: '생활용품 코너', c_fruit: '과일 코너' };
const martNeed = st => st.errand.items.filter(i => !st.errand.got.includes(i.id));
const NAME_OF_CASHIER = '점원';
const HAIR_STYLES = ['앞머리만 조금 잘라 주세요.', '짧게 잘라 주세요.', '머리 감겨 주세요.'];
const stallOf = (def, item) => def.stalls?.find(st => st.cats.includes(item.category)) || def.stalls?.[1];
const poolOf = def => itemsFor(D, def.itemStage, S.level, def.maxBy?.[areaLevel(S, 'money')] || (areaLevel(S, 'money') === '하' ? def.lowMax : 0), L().maxPrice);
const stageById = id => STAGES.find(d => d.id === id);
function currentDef() { return STAGES.find(d => !S.cleared.includes(d.id)) || null; }
function missionsFor(def) { def ||= run.stage?.def; return def?.missions?.[S.level] ?? D.config.session.missionsPerStage[S.level]; }
const isSchool = def => def?.building === 'school';
const verbOf = def => (def.mode === 'rental' ? '빌려 올 것' : '사 올 것');

function dayLimitReached() {
  if (S.day.date !== today()) S.day = { date: today(), count: 0 };
  return S.day.count >= D.config.session.maxStagesPerDay;
}

function startStage(def) {
  const charge = D.config.mealCard.autoChargePerStage[S.level];
  if (S.hasMealCard && charge && def.mode === 'cash') {
    S.meal += charge;
    notify(`급식카드가 ${won(charge)} 충전됐어요.`);
    flashHud('meal');
  }
  run.stage = { def, id: def.id, mission: 0, mistakes: 0, tries: 0, log: [], phase: 'atHome', bought: [], incidentAt: Math.min(2, missionsFor(def) - 1), cardsTried: [] };
  hud(); persist();
}

// 다음 스테이지 시작 (하루 제한 확인)
async function nextStage() {
  const def = currentDef();
  if (!def) return;
  if (dayLimitReached()) {
    run.stage = null;
    goal(null, '');
    await talk('mom', `오늘은 여기까지! 하루에 ${D.config.session.maxStagesPerDay}개까지 할 수 있어. 내일 또 하자.`);
    return;
  }
  startStage(def);
  goal('home', `엄마에게 말을 걸어요. 다음은 ${def.name}이에요.`);
}

// 학교 가기: 엄마 → 현관에서 "다녀오겠습니다" → 학교
async function leaveForSchool(def) {
  await talk('mom', def.leaveLine || `오늘은 학교 ${def.name}에서 할 일이 있대. 선생님 말씀 잘 듣고 다녀와!`);
  run.stage.phase = 'toSchool';
  run.lockHomeDoor = true;
  run.onHomeDoor = async () => {
    world.frozen = true;
    await greetLoop(null, 'home.door.greet', '다녀오겠습니다!', ['다녀왔습니다!', '안녕히 주무세요.', '(그냥 나가기)']);
    await maybeIdCheck();
    run.lockHomeDoor = false; run.onHomeDoor = null;
    await fade(() => enterTown(townSpawn('home')));
    goal(def.building, def.building === 'school' ? `학교에 가요. 오늘은 ${def.name}!` : `${def.name}에 가요.`);
  };
  goal('door', '현관으로 가요.');
}

function pickErrand(def) {
  let pool = poolOf(def);
  if (def.mode !== 'rental') pool = pool.filter(i => i.price);
  const per = L().itemsPerMission;
  let n = Array.isArray(per) ? per[0] + Math.floor(Math.random() * (per[1] - per[0] + 1)) : per;
  if (def.mode === 'rental') n = Math.min(n, 3); // 빌리는 건 3개까지
  if (def.hair) {
    // 미용실: 첫 미션은 머리 손질(서비스), 그다음은 물건 사기
    const kind = run.stage.mission === 0 ? '서비스' : '판매';
    pool = pool.filter(i => i.category === kind);
    n = kind === '서비스' ? 1 : Math.min(n, 2);
  }
  if (def.stalls) {
    // 시장: 두 가게에서 하나씩은 사게 (가게마다 따로 계산)
    n = Math.max(2, Math.min(n, 4));
    const picks = def.stalls.map(stl => shuffle(pool.filter(i => stallOf(def, i) === stl))[0]).filter(Boolean);
    const rest = shuffle(pool.filter(i => !picks.includes(i)));
    return [...picks, ...rest].slice(0, Math.min(n, pool.length));
  }
  return shuffle([...pool]).slice(0, Math.min(n, pool.length));
}

// 현금 주기 (하: 딱 맞게, 중·상: 조금 큰 지폐)
function cashFor(total) {
  const denoms = L().money;
  if (areaLevel(S, 'money') === '하') return breakDown(total, denoms);
  // 그 단계에서 쓰는 지폐만 줘요 (중 단계에는 만 원이 없으니 오천 원 여러 장)
  const bills = [...denoms].filter(d => d >= 1000 && d <= 10000).sort((a, b) => a - b);
  const one = bills.find(d => d >= total);
  if (one) return [one];
  const big = bills[bills.length - 1];
  return Array(Math.ceil(total / big)).fill(big);
}

// ----- 엄마 심부름 (분식점) -----
async function giveErrand() {
  const st = run.stage, def = st.def;
  const k = st.mission;
  const items = pickErrand(def);
  const total = items.reduce((t, i) => t + i.price, 0);
  st.errand = { items, total, payBy: k === 1 && !def.cashOnly ? 'card' : 'cash' };
  if (def.kiosk && k === 1 && L().card.kiosk) st.errand.payBy = 'kiosk';
  if (def.promo && S.level !== '하' && st.errand.payBy !== 'kiosk') st.errand.promo = items[0].id; // 첫 품목을 1+1 행사로
  if (def.stalls) st.errand.left = def.stalls.filter(stl => items.some(i => stallOf(def, i) === stl)).map(stl => stl.seller);
  if (def.hair && items[0]?.category === '서비스') st.errand.style = items[0].id === 'hair_wash' ? HAIR_STYLES[2] : HAIR_STYLES[Math.floor(Math.random() * 2)];
  await talk('mom', k === 0 ? `${def.name}에 심부름 다녀와 줄래? 여기 메모야.` : '하나 더 부탁해도 될까? 새 메모야.');
  await showMemo(true);
  if (st.errand.payBy === 'card' || st.errand.payBy === 'kiosk') {
    await talk('mom', st.errand.payBy === 'kiosk'
      ? `이번에는 셀프 계산대(키오스크)에서 체크카드로 계산해 보렴. 엄마가 계좌로 ${won(total)}을 보내 줄게.`
      : `이번에는 체크카드로 사 와. 엄마가 계좌로 ${won(total)}을 보내 줄게.`);
    S.account += total; hud(); flashHud('account');
    notify(`띵동! 엄마가 계좌로 ${won(total)}을 보냈어요.`);
  } else {
    const give = cashFor(total);
    addPieces(S.cash, give);
    hud(); flashHud('cash'); sfx('coin');
    await talk('mom', `여기 ${won(give.reduce((a, b) => a + b, 0))} 줄게. 거스름돈은 잘 받아 와!`);
  }
  st.phase = 'toShop';
  persist();
  if (def.cashOnly) await talk('mom', '전통시장은 현금만 받는 가게가 많아. 현금으로 내렴.');
  if (def.mart) {
    st.errand.got = [];
    if (!st.cartDone) {
      if (!(S.cash[100] > 0)) { addPieces(S.cash, [100]); hud(); }
      await talk('mom', '마트에서는 입구에서 카트를 빼야 해. 카트에 100원짜리 동전을 넣으면 빠져. 다 쓰면 돌려받을 수 있어.');
    }
  }
  goal(def.building, `${def.name}에서 ${S.level === '상' ? '메모에 적힌 것을' : josa(listOf(items), '을', '를')} ${def.hair && st.errand.style ? '하고' : '사'} 와요.`);
  memoButton(true);
}

// ----- 선생님 미션 (학교) -----
async function giveSchoolMission() {
  const st = run.stage, def = st.def;
  const k = st.mission;
  const items = pickErrand(def);
  const total = items.reduce((t, i) => t + (i.price || 0), 0);
  st.errand = { items, total, payBy: def.mode };
  if (k === 0) {
    if (def.mode === 'token') await talk('teacher', '오늘은 학급 문구 장터가 열려. 학급 토큰으로 준비물을 살 수 있단다.');
    if (def.mode === 'rental') {
      await talk('teacher', '오늘은 체육 시간이야. 이건 대여카드야. 체육 도구를 빌릴 때 대여 창구에 보여 주는 카드란다.');
      notify('대여카드를 받았어요.', 'coin');
    }
    if (def.mode === 'cash') await talk('teacher', '오늘은 운동회야! 먹거리 부스에서 친구들 간식을 사 와 줄래?');
  } else await talk('teacher', '하나 더 부탁할게.');
  // 돌발 상황 (교실): 짝꿍에게 지우개 빌리기
  if (def.mode === 'token' && k === st.incidentAt && !st.incidentDone) {
    st.incidentDone = true;
    await talk('teacher', '앗, 지우개가 없구나. 짝꿍에게 빌려 볼까?');
    await greetLoop('friend', '짝꿍에게 뭐라고 말할까요?', '지우개 좀 빌려줄래?', ['지우개 내놔.', '(말없이 가져가기)', '안녕히 계세요.']);
    await talk('friend', '그래, 여기 있어!');
    await greetLoop('friend', '지우개를 받았어요. 뭐라고 말할까요?', '고마워! 다 쓰고 돌려줄게.', ['(그냥 가기)', '이거 내 거야.', '안녕하세요!']);
    await talk('friend', '응!');
  }
  await showMemo(true);
  if (def.mode === 'token') {
    const extra = S.level === '하' ? 0 : S.level === '중' ? 1 : Math.floor(Math.random() * 3);
    const give = total + extra;
    S.tokens = (S.tokens || 0) + give;
    hud(); sfx('coin'); flashHud('token');
    await talk('teacher', `학급 토큰 ${give}개를 줄게. ${def.counterName}은 오른쪽에 있어.`);
  } else if (def.mode === 'cash') {
    const give = cashFor(total);
    addPieces(S.cash, give);
    hud(); flashHud('cash'); sfx('coin');
    await talk('teacher', `여기 ${won(give.reduce((a, b) => a + b, 0))} 줄게. 거스름돈도 잘 받아 오렴.`);
  } else {
    await talk('teacher', `${def.counterName}에서 빌려 오렴. 무엇을 빌렸는지 잘 기억해야 해. 나중에 똑같이 반납할 거야.`);
  }
  st.phase = 'toCounter';
  persist();
  goal('counter', `${def.counterName}에서 ${S.level === '상' ? '메모에 적힌 것을' : josa(listOf(items), '을', '를')} ${def.mode === 'rental' ? '빌려' : '사'} 와요.`);
  memoButton(true);
}

function memoButton(on) {
  const b = $('#memo-btn');
  b.hidden = !on;
  b.onclick = () => { run.stage.peeks = (run.stage.peeks || 0) + 1; showMemo(false); };
}

function showMemo(fromGiver) {
  return new Promise(res => {
    const def = run.stage.def, e = run.stage.errand;
    const m = panel('memo');
    m.append(el('h2', null, def.giver === 'mom' ? '심부름 메모' : '선생님 메모'));
    const card = el('div', 'memo-card');
    card.append(el('h4', null, `${def.counterName}에서 ${verbOf(def)}`));
    const ul = el('ul');
    for (const it of e.items) {
      const li = el('li');
      const price = def.mode === 'cash' ? ` (${won(it.price)})` : def.mode === 'token' ? ` (토큰 ${it.price}개)` : '';
      const promo = (e.promo === it.id ? ' 2개 (1+1 행사: 1개 값)' : '') + (def.stalls ? ` · ${stallOf(def, it).name}` : '');
      li.append(itemImg(it, 3), el('span', null, it.name + promo + (S.level === '하' ? price : '')));
      ul.append(li);
    }
    card.append(ul);
    if (e.style) card.append(el('p', null, `미용사 선생님께: "${e.style}"`));
    if (e.payBy === 'kiosk') card.append(el('p', null, '셀프 계산대(키오스크)에서 체크카드로 계산하기'));
    m.append(card);
    if (areaLevel(S, 'memory') === '상' && fromGiver) m.append(el('p', 'hint', '잘 기억해 두세요. 메모를 다시 보면 별을 받기 어려워져요.'));
    say(`${def.counterName}에서 ${verbOf(def)}. ` + e.items.map(i => i.name).join(', '));
    const ok = el('button', 'btn primary big', '기억했어요');
    ok.style.display = 'flex'; ok.style.margin = '8px auto';
    ok.onclick = () => { closePanel(); res(); };
    m.append(ok);
  });
}

// ----- 계산대 사람 -----
async function sellerTalk(who) {
  const st = run.stage, def = st?.def;
  if (def?.stalls && def.stalls.some(stl => stl.seller === who)) {
    if (st.phase === 'toShop' && st.errand.left.includes(who)) return counterBuy(def, { stall: who });
    if (st.phase === 'toShop') return talk(who, '우리 가게 건 다 샀구나! 다른 가게에도 들러 보렴.');
    return talk(who, '또 와!');
  }
  if (def && def.seller === who && st.phase === 'toShop' && st.errand.payBy === 'kiosk') return talk(who, '이번에는 셀프 계산대에서 계산해 보세요.');
  if (def?.mart && def.seller === who && st.phase === 'toShop' && (!st.cartDone || martNeed(st).length)) return talk(who, '먼저 카트를 가져와서 코너에서 물건을 담아 오세요.');
  if (!def || def.seller !== who) {
    await talk(who, who === 'owner' ? '어서 와! 지금은 심부름이 없구나.' : '안녕! 지금은 할 일이 없구나.');
    return;
  }
  if (st.phase === 'toShop' || st.phase === 'toCounter') {
    if (def.mode === 'rental') return rentalBorrow(def);
    return counterBuy(def);
  }
  if (st.phase === 'toReturn') return rentalReturn(def);
  if (st.phase === 'deliver' && def.mode === 'cash') return hungryOffer(def);
  await talk(who, def.giver === 'mom' ? '또 와!' : '선생님께 가 보렴.');
}

async function counterGreet(def) {
  const [right, wrongs] = def.greet;
  await greetLoop(null, `${def.counterName}에 왔어요. ${NAME_OF[def.seller]}에게 뭐라고 인사할까요?`, right, wrongs);
  log('greetCounter', { said: right });
  await maybeIdCheck();
}
async function counterBye(def) {
  const [right, wrongs] = def.bye;
  await greetLoop(null, '다 끝났어요. 떠날 때는 뭐라고 할까요?', right, wrongs);
  await maybeIdCheck();
}
const NAME_OF = { officer: '민원실 직원', guard: '안내 데스크 직원', guide: '견학 안내 선생님', giftclerk: '기념품 가게 직원', grocer: '채소 가게 사장님', baker: '떡집 사장님', stylist: '미용사 선생님', cashier: NAME_OF_CASHIER, owner: '사장님', clerk: '반장', helper: '체육 도우미 선생님', parent: '부스 도우미', teacher: '선생님' };

function afterCounter(def) {
  const st = run.stage;
  st.phase = 'deliver';
  persist();
  if (def.giver === 'mom') goal('home', '집에 가서 엄마에게 물건을 드려요.');
  else goal('giver', '선생님께 가져다 드려요.');
}

// 사기 (현금·토큰)
async function counterBuy(def, opts = {}) {
  const st = run.stage;
  world.frozen = true;
  setGoal('');
  const all = st.errand;
  const e = opts.stall ? { ...all, items: all.items.filter(i => stallOf(def, i).seller === opts.stall) } : all;
  if (opts.stall) e.total = e.items.reduce((t, i) => t + i.price, 0);
  const seller = opts.stall || def.seller;
  def = { ...def, seller, counterName: opts.stall ? def.stalls.find(x => x.seller === opts.stall).name : def.counterName };
  if (def.mode === 'cash' && st.mission === st.incidentAt && !st.incidentDone && S.level === '하') {
    st.incidentDone = true;
    await greetLoop(null, 'shop.queue', '줄 서서 기다려요', ['앞으로 끼어들어요', '큰 소리로 불러요']);
    await talk(null, '차례를 잘 기다렸어요!');
  }
  await talk(def.seller, def.mode === 'token' ? '어서 와! 문구 장터야.' : 'shop.owner.welcome');
  await counterGreet(def);
  if (def.mode === 'cash' && S.level === '중' && st.mission === st.incidentAt && !st.soldoutDone) {
    st.soldoutDone = true;
    await talk(def.seller, 'shop.soldout');
    await greetLoop(null, '어떻게 말할까요?', '괜찮아요. 그럼 다른 날 살게요.', ['왜 없어요! 빨리 줘요!', '(화내고 나가기)']);
    await talk(def.seller, '고마워! 그건 오늘은 빼고 줄게. 다른 건 있어.');
  }
  if (def.mart) { await talk(def.seller, '바코드를 찍을게요. 삑, 삑!'); sfx('beep'); }
  else await orderItems(def, { items: e.items });
  await maybeIdCheck();
  if (def.expiry && S.level !== '하' && st.mission === st.incidentAt && !st.expiryDone) {
    st.expiryDone = true;
    for (;;) {
      const ok = await expiryPick(e.items[0]);
      if (ok) { sfx('ok'); log('expiry', { ok: true }); break; }
      sfx('no');
      await talk(def.seller, '어머, 그건 유통기한이 지났어요. 날짜를 다시 확인해 볼까요?');
      await mistake('expiry'); await maybeIdCheck();
    }
  }
  if (def.hair && e.style) {
    await greetLoop(null, '잠깐 기다려 달래요. 어떻게 할까요?', '의자에 앉아서 기다려요', ['계속 빨리 해 달라고 해요', '그냥 나가요']);
    await talk(def.seller, '기다려 줘서 고마워. 이제 앉아 볼까? 어떻게 해 줄까?');
    await greetLoop(null, `메모를 떠올려 봐요. 미용사 선생님께 뭐라고 할까요?`, e.style, HAIR_STYLES.filter(x => x !== e.style).concat(['아무렇게나 해 주세요.']));
    log('style', { said: e.style });
    await holdStill(4);
    log('hold', {});
    await talk(def.seller, '다 됐어! 정말 잘 참았구나.');
  }
  if (e.promo) {
    const pi = e.items.find(i => i.id === e.promo);
    await talk(def.seller, `${josa(pi.name, '은', '는')} 1+1 행사라서 하나 값으로 2개를 드려요!`);
    log('promo', { name: pi.name });
  }
  if (def.mode === 'token') {
    await tokenPay({ state: S, config: D.config, total: e.total, who: def.seller, mistake: k => mistake(k), ownerLine: `모두 토큰 ${e.total}개야.` });
    log('paid', { total: e.total, items: e.items.map(i => i.name), token: true });
    hud(); persist();
    await maybeIdCheck();
  } else {
    let ownerLine;
    if (S.level === '상' && e.items.length > 1) {
      for (;;) {
        const opts = numberChoices(e.total, 4, [500, 1000]);
        const i = await choose(def.seller, '모두 얼마인지 알겠니?', opts.map(v => ({ text: won(v) })), { grid: true });
        if (opts[i] === e.total) { sfx('ok'); break; }
        sfx('no'); await mistake('total'); await maybeIdCheck();
      }
      ownerLine = `맞아! 모두 ${won(e.total)}이야.`;
    }
    const ctx = {
      state: S, config: D.config, total: e.total, purpose: 'errand', log: st, ownerLine, who: def.seller, cashOnly: def.cashOnly,
      wrongChange: S.level === '상' && st.mission === st.incidentAt && !st.wrongChangeDone,
      mistake: k => mistake(k),
    };
    if (e.payBy === 'card') ctx.ownerLine = (ownerLine ? ownerLine + ' ' : '') + '이번에는 체크카드로 내 볼까?';
    const result = await pay(ctx);
    if (ctx.wrongChange) st.wrongChangeDone = true;
    log('paid', { total: e.total, items: e.items.map(i => i.name), card: result.card?.kind, change: result.change });
    hud(); persist();
    await maybeIdCheck();
    if (result.card?.method === 'insert' && L().card.steps.includes('takeCardBack')) {
      for (;;) {
        const i = await choose(null, '결제가 끝났어요. 이제 무엇을 할까요?', [{ text: '그냥 나가기' }, { text: '단말기에서 카드 돌려받기', img: toImg(cardCanvas(result.card.kind), 2, '') }]);
        if (i === 1) { sfx('ok'); break; }
        sfx('no'); await talk(def.seller, 'shop.owner.cardback'); await mistake('cardBack'); await maybeIdCheck();
      }
    }
    if (result.card && L().card.steps.includes('checkReceipt')) {
      for (;;) {
        const opts = numberChoices(e.total, 3, [500, 1000]);
        const i = await choose(def.seller, `영수증이야. 영수증에 적힌 합계는 얼마일까? (${e.items.map(it => `${it.name} ${won(it.price)}`).join(', ')})`, opts.map(v => ({ text: won(v) })));
        if (opts[i] === e.total) { sfx('ok'); break; }
        sfx('no'); await mistake('receipt'); await maybeIdCheck();
      }
    }
  }
  if (def.dum && st.mission === 0 && !st.dumDone) {
    st.dumDone = true;
    await talk(def.seller, '이건 덤이야! 하나 더 넣었어.');
    await greetLoop(null, '덤을 받았어요. 뭐라고 할까요?', '감사합니다!', ['(그냥 받기)', '더 주세요.', '안녕하세요!']);
    log('dum', {});
  }
  if (def.bag) {
    await greetLoop(def.seller, '봉투 필요하세요?', '괜찮아요. 장바구니 있어요.', ['(대답 안 하기)', '봉투 내놔요.', '몰라요.']);
    log('bag', {});
    await maybeIdCheck();
  }
  await talk(def.seller, def.mode === 'token' ? '자, 여기 있어!' : 'shop.owner.thanks');
  await counterBye(def);
  st.bought.push(...e.items.map(i => i.id));
  for (const it of e.items) if (!S.stickers.includes(it.id)) S.stickers.push(it.id);
  if (opts.script) { world.frozen = false; return; }
  if (opts.stall) {
    all.left = all.left.filter(x => x !== opts.stall);
    if (all.left.length) {
      const next = run.stage.def.stalls.find(x => x.seller === all.left[0]);
      goal('counter', `${next.name}에도 가서 사요.`);
      world.frozen = false;
      return;
    }
  }
  afterCounter(run.stage.def);
  if (def.mode === 'cash') await hungryOffer(def);
  world.frozen = false;
}

// ---------- 대형마트: 카트, 코너 ----------
function martGoal() {
  const st = run.stage;
  if (!st.cartDone) { run.goalTarget = 'cart'; goal('obj', '입구의 카트에 100원을 넣어요.'); return; }
  const need = martNeed(st);
  if (need.length) {
    const c = MART_CORNER[need[0].category] || 'c_food';
    run.goalTarget = c;
    goal('obj', `${CORNER_NAME[c]}에서 ${josa(need.filter(i => (MART_CORNER[i.category] || 'c_food') === c).map(i => i.name).join(', '), '을', '를')} 찾아요.`);
    return;
  }
  goal(st.errand.payBy === 'kiosk' ? 'kiosk' : 'counter', st.errand.payBy === 'kiosk' ? '셀프 계산대에서 계산해요.' : '계산대에서 계산해요.');
}

async function martObject(id) {
  const st = run.stage, def = st.def;
  if (id === 'cart') {
    if (st.cartDone) return talk(null, '카트는 이미 빌렸어요.');
    for (;;) {
      let opts = L().choices === 2 ? ['100원', shuffle(['500원', '1,000원'])[0]] : ['100원', '500원', '1,000원'];
      opts = shuffle(opts);
      const i = await choose(null, '카트에 어떤 돈을 넣을까요?', opts.map(t => ({ text: t })));
      if (opts[i] === '100원') break;
      sfx('no'); await talk(null, '카트에는 100원짜리 동전을 넣어요.'); await mistake('cart'); await maybeIdCheck();
    }
    removePieces(S.cash, [100]); hud(); flashHud('cash'); sfx('coin');
    st.cartDone = true; log('cart', {});
    await talk(null, '딸깍! 카트를 뺐어요.');
    return martGoal();
  }
  // 코너
  const need = martNeed(st).filter(i => (MART_CORNER[i.category] || 'c_food') === id);
  const corner = poolOf(def).filter(i => i.price && (MART_CORNER[i.category] || 'c_food') === id);
  if (!need.length) { await talk(null, `${CORNER_NAME[id]}예요. 여기서 살 건 없어요.`); return martGoal(); }
  for (;;) {
    const picked = await new Promise(res => {
      const m = panel('order');
      m.append(el('h2', null, CORNER_NAME[id]));
      const grid = el('div', 'menu'); const sel = new Set();
      for (const it of corner) {
        const b = el('button', 'menu-item'); b.setAttribute('aria-pressed', 'false');
        b.append(itemImg(it, 4), el('span', 'nm', it.name), el('span', 'pr', won(it.price)));
        b.onclick = () => { sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); b.setAttribute('aria-pressed', sel.has(it.id)); say(it.name); };
        grid.append(b);
      }
      const ok = el('button', 'btn primary big', '카트에 담기'); ok.style.display = 'flex'; ok.style.margin = '14px auto';
      ok.onclick = () => { closePanel(); res([...sel]); };
      m.append(grid, ok);
      say(`${CORNER_NAME[id]}예요. 메모에 있는 물건을 담아요.`);
    });
    if (picked.slice().sort().join() === need.map(i => i.id).sort().join()) break;
    sfx('no'); await talk(null, '메모와 달라요. 다시 골라 볼까요?'); await mistake('corner'); await maybeIdCheck();
  }
  st.errand.got.push(...need.map(i => i.id));
  sfx('ok'); notify(`${josa(need.map(i => i.name).join(', '), '을', '를')} 카트에 담았어요.`, 'coin');
  log('corner', { id });
  martGoal();
}

// ---------- 교육지원청·교육부: 정해진 순서대로 ----------
const STEP_TEXT = {
  ticket: '번호표 기계에서 번호표를 뽑아요.', officer: '민원실 창구로 가요.', elevator: '엘리베이터를 타요.', vending: '자판기에서 음료를 사요.',
  guard: '안내 데스크로 가요.', gate: '보안 검색대를 지나가요.', guide: '견학 안내 선생님께 가요.', giftclerk: '기념품 가게에 가요.',
};
function stepGoal() {
  const st = run.stage;
  const target = st.def.steps(S.level)[st.step];
  run.goalTarget = target;
  goal('step', STEP_TEXT[target]);
}

async function runStep(target) {
  const st = run.stage, def = st.def;
  world.frozen = true; setGoal('');
  if (target === 'ticket') {
    await choose(null, '번호표 기계예요. 버튼을 눌러요.', [{ text: '번호표 뽑기' }]);
    st.ticket = 10 + Math.floor(Math.random() * 30);
    sfx('beep'); notify(`${st.ticket}번 번호표를 뽑았어요.`, 'coin');
    await waitTurn(st.ticket, k => mistake(k));
    log('ticket', { n: st.ticket });
  } else if (target === 'officer') {
    await talk('officer', `${st.ticket || ''}번 손님, 이쪽으로 오세요.`);
    await greetLoop(null, '창구 직원에게 뭐라고 인사할까요?', '안녕하세요!', ['야!', '안녕히 계세요.', '(아무 말 안 하기)']);
    await greetLoop('officer', '어떻게 오셨어요?', '서류를 내러 왔어요.', ['그냥 왔어요.', '몰라요.', '(아무 말 안 하기)']);
    await talk('officer', '신청서를 써 주세요. 꿈이든 카드를 보고 쓰면 돼요.');
    await formFill(S, L().choices === 2 ? 2 : 3, k => mistake(k));
    log('form', {});
    await talk('officer', '접수됐어요. 수고하셨어요!');
    await greetLoop(null, '다 끝났어요. 뭐라고 할까요?', '감사합니다. 안녕히 계세요!', ['안녕히 가세요.', '(그냥 가기)', '안녕하세요!']);
  } else if (target === 'elevator') {
    const floor = 2 + Math.floor(Math.random() * 4);
    await talk(null, `안내판: 교육과는 ${floor}층이에요.`);
    for (;;) {
      const opts = [1, 2, 3, 4, 5].map(n => ({ text: `${n}층` }));
      const i = await choose(null, '엘리베이터 버튼을 눌러요. 몇 층으로 갈까요?', opts, { grid: true });
      if (i + 1 === floor) break;
      sfx('no'); await talk(null, `안내판을 다시 봐요. 교육과는 ${floor}층이에요.`); await mistake('floor'); await maybeIdCheck();
    }
    sfx('ding'); await talk(null, `${floor}층에 도착했어요. 교육과에 서류 사본을 드리고 내려왔어요.`);
    log('floor', { floor });
  } else if (target === 'vending') {
    const it = D.items.find(i => i.id === 'office_vending');
    await talk(null, `자판기예요. ${it.name}는 ${won(it.price)}이에요.`);
    await pay({ state: S, config: D.config, total: it.price, purpose: 'eat', who: 'officer', log: st, mistake: k => mistake(k), ownerLine: `자판기: ${won(it.price)}을 넣어 주세요.` });
    changeStamina(it.heal || 10); hud();
    log('vending', {});
  } else if (target === 'guard') {
    await talk('guard', '교육부에 오신 걸 환영합니다.');
    await greetLoop(null, '안내 데스크 직원에게 뭐라고 인사할까요?', '안녕하세요!', ['야!', '안녕히 계세요.', '(아무 말 안 하기)']);
    await greetLoop('guard', '어떻게 오셨어요?', '견학 왔어요.', ['놀러 왔어요.', '몰라요.', '(아무 말 안 하기)']);
    const cards = shuffle(['dream', 'check', 'meal']);
    const names = { dream: '꿈이든 카드', check: '체크카드', meal: '급식카드' };
    for (;;) {
      const i = await choose('guard', '신분증을 보여 주세요.', cards.map(k => ({ text: names[k], img: toImg(cardCanvas(k), 2, '') })));
      if (cards[i] === 'dream') break;
      sfx('no'); await talk('guard', '그건 신분증이 아니에요. 이름과 주소가 있는 카드를 보여 주세요.'); await mistake('id'); await maybeIdCheck();
    }
    sfx('ok'); await talk('guard', `${S.student.name} 학생, 확인했어요. 방문 출입증이에요. 목에 걸어 주세요.`);
    if (!S.stickers.includes('moe_badge')) S.stickers.push('moe_badge');
    notify('방문 출입증을 받았어요.', 'coin');
    log('id', {});
  } else if (target === 'gate') {
    await greetLoop(null, '보안 검색대예요. 어떻게 할까요?', '가방을 검색대 위에 올려요', ['가방을 메고 그냥 지나가요', '뛰어서 지나가요']);
    sfx('beep'); await talk(null, '삑! 통과했어요.');
    log('gate', {});
  } else if (target === 'guide') {
    await talk('guide', '반가워요! 이제 견학을 시작할게요.');
    await greetLoop(null, '견학하는 동안에는 어떻게 할까요?', '조용히 따라가요', ['뛰어다녀요', '큰 소리로 떠들어요']);
    await talk('guide', '여기서는 학생들이 배우는 교육 과정을 만들고, 학교를 도와요. 잘 들어 줘서 고마워요!');
    log('tour', {});
  } else if (target === 'giftclerk') {
    const pool = poolOf(def).filter(i => i.price && i.category === '기념품');
    const it = shuffle(pool)[0];
    st.errand = { items: [it], total: it.price, payBy: 'cash' };
    await talk('guide', `기념품 가게에서 ${josa(it.name, '을', '를')} 하나 사 볼까요?`);
    if (!(S.cash && Object.keys(S.cash).length)) addPieces(S.cash, cashFor(it.price));
    await counterBuy({ ...def, seller: 'giftclerk', mode: 'cash' }, { script: true });
  }
  st.step++;
  persist();
  world.frozen = false;
  if (st.step >= def.steps(S.level).length) return finishStage();
  stepGoal();
}

// 셀프 계산대 (편의점)
async function kioskTalk() {
  const st = run.stage, def = st?.def;
  if (def?.mart && st.phase === 'toShop' && (!st.cartDone || martNeed(st).length)) return talk(null, '먼저 코너에서 물건을 담아 와요.');
  if (!def || st.phase !== 'toShop' || st.errand.payBy !== 'kiosk') return talk(null, '셀프 계산대예요. 화면을 눌러서 직접 계산할 수 있어요.');
  world.frozen = true; setGoal('');
  const pool = poolOf(def).filter(i => i.price);
  await kiosk({ state: S, config: D.config, pool, want: st.errand.items.map(i => i.id), full: L().card.kiosk === 'full', mistake: k => mistake(k) });
  log('kiosk', {});
  hud(); persist();
  await maybeIdCheck();
  for (const it of st.errand.items) if (!S.stickers.includes(it.id)) S.stickers.push(it.id);
  afterCounter(def);
  world.frozen = false;
}

// 빌리기 (체육관)
async function rentalBorrow(def) {
  const st = run.stage, e = st.errand;
  world.frozen = true; setGoal('');
  if (st.mission === st.incidentAt && !st.incidentDone) {
    st.incidentDone = true;
    await greetLoop(null, 'shop.queue', '줄 서서 기다려요', ['앞으로 끼어들어요', '큰 소리로 불러요']);
    await talk(null, '차례를 잘 기다렸어요!');
  }
  await talk(def.seller, '어서 와! 체육 도구를 빌리러 왔니?');
  await counterGreet(def);
  // 대여카드 보여 주기
  const cards = shuffle(['rental', 'dream', 'check']);
  const names = { rental: '대여카드', dream: '꿈이든 카드', check: '체크카드' };
  for (;;) {
    const i = await choose(def.seller, '대여카드를 보여 줄래?', cards.map(k => ({ text: names[k], img: toImg(cardCanvas(k), 2, '') })));
    if (cards[i] === 'rental') { sfx('ok'); log('rentalCard', {}); break; }
    sfx('no');
    await talk(def.seller, `그건 ${names[cards[i]]}야. 체육 도구는 대여카드로 빌려.`);
    await mistake('wrongCard'); await maybeIdCheck();
  }
  await orderItems(def);
  await maybeIdCheck();
  log('borrowed', { items: e.items.map(i => i.name) });
  notify(`${josa(listOf(e.items), '을', '를')} 빌렸어요.`, 'coin');
  await talk(def.seller, '다 쓰면 꼭 반납하러 와!');
  await counterBye(def);
  for (const it of e.items) if (!S.stickers.includes(it.id)) S.stickers.push(it.id);
  afterCounter(def);
  world.frozen = false;
}

// 반납하기 (체육관): 무엇을 빌렸는지 기억해서 고르기
async function rentalReturn(def) {
  const st = run.stage;
  world.frozen = true; setGoal('');
  await talk(def.seller, '반납하러 왔구나! 무엇을 빌렸었니?');
  memoButton(false);
  await orderItems(def, { returning: true });
  log('returned', { items: st.errand.items.map(i => i.name) });
  await talk(def.seller, '반납 완료! 깨끗하게 잘 썼구나.');
  await counterBye(def);
  st.phase = 'returned';
  persist();
  goal('giver', '선생님께 반납했다고 말씀드려요.');
  world.frozen = false;
}

async function orderItems(def, opts = {}) {
  const st = run.stage, e = { ...st.errand, items: opts.items || st.errand.items };
  let pool = poolOf(def);
  if (def.mode !== 'rental') pool = pool.filter(i => i.price);
  if (def.hair) pool = pool.filter(i => i.category === e.items[0].category);
  if (def.stalls) pool = pool.filter(i => stallOf(def, i).seller === def.seller);
  const title = opts.returning ? '반납할 도구를 모두 골라요' : def.mode === 'rental' ? '빌릴 도구를 골라요' : `${def.counterName} 메뉴`;
  for (;;) {
    const picked = await new Promise(res => {
      const m = panel('order');
      m.append(el('h2', null, title));
      if (areaLevel(S, 'memory') === '하' && !opts.returning) {
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
        b.append(itemImg(it, 4), el('span', 'nm', it.name));
        if (def.mode === 'cash') b.append(el('span', 'pr', won(it.price)));
        if (def.mode === 'token') b.append(el('span', 'pr', `토큰 ${it.price}개`));
        b.onclick = () => {
          sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id);
          b.setAttribute('aria-pressed', sel.has(it.id));
          say(it.name + (def.mode === 'cash' ? ', ' + won(it.price) : def.mode === 'token' ? `, 토큰 ${it.price}개` : ''));
        };
        grid.append(b);
      }
      m.append(grid);
      const row = el('div', 'row');
      const memoBtn = el('button', 'btn big', '메모 다시 보기');
      memoBtn.onclick = async () => { st.peeks = (st.peeks || 0) + 1; closePanel(); await showMemo(false); res(null); };
      const ok = el('button', 'btn primary big', opts.returning ? '이거 반납할게요' : def.mode === 'rental' ? '이거 빌려 주세요' : '이거 주세요');
      ok.onclick = () => { closePanel(); res([...sel]); };
      if (S.level !== '하' && !opts.returning) row.append(memoBtn);
      row.append(ok);
      m.append(row);
      say(opts.returning ? '무엇을 빌렸었는지 기억해서 골라요.' : line('shop.owner.order'));
    });
    if (!picked) continue;
    const want = e.items.map(i => i.id).sort().join();
    if (picked.sort().join() === want) { sfx('ok'); return; }
    sfx('no');
    await talk(def.seller, picked.length ? (opts.returning ? '음, 빌려 간 것과 달라. 다시 생각해 볼래?' : '어, 메모에 적힌 거 맞니? 다시 골라 볼래?') : '골라 줘.');
    if (picked.length) { await mistake(opts.returning ? 'return' : 'order'); await maybeIdCheck(); }
  }
}

async function hungryOffer(def) {
  if (!S.settings.stamina || S.stamina >= 60) return;
  const i = await choose(def.seller, 'shop.owner.hungry', [{ text: '네, 먹고 갈래요' }, { text: '괜찮아요' }]);
  if (i !== 0) return;
  const food = poolOf(def).filter(it => it.heal && it.price);
  if (!food.length) return;
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
  const cardWord = S.hasMealCard ? (def.cashOnly ? ' 현금이나 급식카드로 내렴.' : ' 급식카드도 돼.') : '';
  await pay({ state: S, config: D.config, total: pick.price, purpose: 'eat', who: def.seller, cashOnly: def.cashOnly, log: run.stage || {}, mistake: k => mistake(k), ownerLine: `${pick.name} ${won(pick.price)}이야.${cardWord}` });
  changeStamina(pick.heal);
  notify(`냠냠! 체력이 ${pick.heal} 올랐어요.`, 'ok');
}

// ----- 물건 전달 -----
async function deliverErrand() {
  const st = run.stage;
  memoButton(false);
  await greetLoop(null, '집에 돌아왔어요. 엄마에게 뭐라고 인사할까요?', '다녀왔습니다!', ['다녀오겠습니다!', '안녕히 계세요.', '(그냥 들어가기)']);
  await talk('mom', `고마워! ${st.errand.items.map(i => i.name).join(', ')} 잘 받았어.`);
  await missionDone('mom');
}

async function teacherTalk() {
  const st = run.stage, def = st?.def;
  if (!def || def.giver !== 'teacher') return talk('teacher', '안녕! 오늘도 즐겁게 지내자.');
  if (st.phase === 'atRoom' || st.phase === 'atHome' || st.phase === 'toSchool') {
    run.lockHomeDoor = false; run.onHomeDoor = null;
    st.phase = 'atRoom';
    await greetLoop(null, '선생님을 만났어요. 뭐라고 인사할까요?', '안녕하세요, 선생님!', ['안녕!', '야!', '(그냥 지나가기)']);
    await maybeIdCheck();
    return giveSchoolMission();
  }
  if (st.phase === 'toCounter') return talk('teacher', `${def.counterName}에 다녀오렴. 메모를 잊지 마!`);
  if (st.phase === 'toReturn') return talk('teacher', `${def.counterName}에 반납하고 오렴.`);
  if (st.phase === 'deliver' && def.mode === 'rental') {
    memoButton(false);
    await talk('teacher', `고마워! ${st.errand.items.map(i => i.name).join(', ')} 잘 썼어. 이제 다 썼으니 반납하고 와 줄래?`);
    st.phase = 'toReturn';
    persist();
    goal('counter', `${def.counterName}에 빌린 것을 반납해요.`);
    return;
  }
  if (st.phase === 'deliver' || st.phase === 'returned') {
    memoButton(false);
    await talk('teacher', st.phase === 'returned' ? '반납까지 잘했어!' : `고마워! ${st.errand.items.map(i => i.name).join(', ')} 잘 받았어.`);
    return missionDone('teacher');
  }
  return talk('teacher', '오늘 정말 잘했어! 은행에 들렀다가 집에 가렴.');
}

// 미션 하나 끝: 보상 → 다음 미션 또는 스테이지 끝
async function missionDone(giver) {
  const st = run.stage, def = st.def;
  st.mission++;
  changeStamina(-D.config.stamina.drainPerMission);
  if (giver === 'mom' && st.mission === 2 && S.level !== '하') {
    const ev = D.config.accountEvents[2];
    S.account += ev.amount; hud(); flashHud('account'); notify(ev.message);
  } else {
    addPieces(S.cash, [giver === 'mom' ? 1000 : 500]); hud(); flashHud('cash'); sfx('coin');
    await talk(giver, giver === 'mom' ? '심부름 값으로 천 원 줄게!' : '참 잘했어요! 칭찬 용돈 500원이야.');
  }
  persist();
  if (st.mission >= missionsFor()) return finishStage();
  if (giver === 'mom') { st.phase = 'atHome'; return giveErrand(); }
  return giveSchoolMission();
}

// ---------- 되돌아보기 → 완료 → 은행 ----------
function buildReview(def) {
  const st = run.stage;
  const qs = [];
  const n = S.level === '하' ? 2 : 3;
  if (st.log.some(l => l.type === 'greetCounter') && def.greet) {
    const [right, wrongs] = def.greet;
    qs.push({ q: `${def.counterName}에서 ${NAME_OF[def.seller]}에게 처음에 뭐라고 했나요?`, a: right, options: shuffle([right, ...shuffle([...wrongs]).slice(0, n - 1)]) });
  }
  const paid = st.log.filter(l => l.type === 'paid');
  const one = paid[0];
  const it = one && D.items.find(i => i.name === one.items[0]);
  if (it && def.mode === 'cash') qs.push({ q: `${josa(it.name, '은', '는')} 얼마였나요?`, a: won(it.price), options: numberChoices(it.price, n, [500, 1000]).map(won) });
  if (it && def.mode === 'token') qs.push({ q: `${josa(it.name, '은', '는')} 학급 토큰 몇 개였나요?`, a: `${it.price}개`, options: numberChoices(it.price, n, [1, 2]).map(v => `${v}개`) });
  const ch = paid.find(p => p.change > 0);
  if (ch && S.level !== '하') qs.push({ q: '거스름돈을 얼마 받았나요?', a: won(ch.change), options: numberChoices(ch.change, 3, [100, 500]).map(won) });
  if (def.mode === 'rental') {
    const b = st.log.find(l => l.type === 'borrowed');
    if (b) {
      const pool = itemsFor(D, 'gym', S.level).map(i => i.name).filter(x => x !== b.items[0]);
      qs.push({ q: '체육관에서 빌린 것 중 하나는 무엇인가요?', a: b.items[0], options: shuffle([b.items[0], ...shuffle(pool).slice(0, n - 1)]) });
    }
    qs.push({ q: '체육 도구를 빌릴 때 보여 준 카드는?', a: '대여카드', options: shuffle(['대여카드', '꿈이든 카드', '체크카드']).slice(0, 3) });
    qs.push({ q: '빌린 물건은 다 쓰면 어떻게 하나요?', a: '빌린 곳에 반납해요', options: shuffle(['빌린 곳에 반납해요', '집에 가져가요']) });
  }
  if (st.log.some(l => l.type === 'cart')) qs.push({ q: '마트 카트에는 어떤 동전을 넣었나요?', a: '100원', options: shuffle(['100원', '500원']) });
  if (st.log.some(l => l.type === 'corner')) qs.push({ q: '마트에서 물건은 어떻게 찾았나요?', a: '코너 표지판을 보고 찾아요', options: shuffle(['코너 표지판을 보고 찾아요', '아무 데나 돌아다녀요']) });
  if (st.log.some(l => l.type === 'ticket')) qs.push({ q: '번호표를 뽑은 뒤에는 어떻게 하나요?', a: '내 번호가 나올 때까지 기다려요', options: shuffle(['내 번호가 나올 때까지 기다려요', '바로 창구로 가요']) });
  if (st.log.some(l => l.type === 'form')) qs.push({ q: '신청서에 이름과 주소를 쓸 때 무엇을 보고 썼나요?', a: '꿈이든 카드', options: shuffle(['꿈이든 카드', '체크카드']) });
  const fl = st.log.find(l => l.type === 'floor');
  if (fl) qs.push({ q: '교육과는 몇 층이었나요?', a: `${fl.floor}층`, options: shuffle([`${fl.floor}층`, `${fl.floor === 5 ? 4 : fl.floor + 1}층`]) });
  if (st.log.some(l => l.type === 'id')) qs.push({ q: '교육부에 들어갈 때 신분증으로 보여 준 카드는?', a: '꿈이든 카드', options: shuffle(['꿈이든 카드', '체크카드', '급식카드']) });
  if (st.log.some(l => l.type === 'gate')) qs.push({ q: '보안 검색대에서는 어떻게 했나요?', a: '가방을 검색대 위에 올려요', options: shuffle(['가방을 검색대 위에 올려요', '뛰어서 지나가요']) });
  if (st.log.some(l => l.type === 'tour')) qs.push({ q: '견학하는 동안에는 어떻게 하나요?', a: '조용히 따라가요', options: shuffle(['조용히 따라가요', '큰 소리로 떠들어요']) });
  if (def.cashOnly) qs.push({ q: '전통시장 가게에서는 무엇으로 계산했나요?', a: '현금', options: shuffle(['현금', '체크카드']) });
  if (st.log.some(l => l.type === 'dum')) qs.push({ q: '사장님이 덤을 주셨을 때 뭐라고 했나요?', a: '감사합니다!', options: shuffle(['감사합니다!', '더 주세요.']) });
  if (st.log.some(l => l.type === 'hold')) qs.push({ q: '머리를 자르는 동안에는 어떻게 하나요?', a: '가만히 있어요', options: shuffle(['가만히 있어요', '고개를 돌려요']) });
  if (st.log.some(l => l.type === 'kiosk')) qs.push({ q: '셀프 계산대에서는 무엇으로 계산했나요?', a: '카드', options: shuffle(['카드', '현금']) });
  if (st.log.some(l => l.type === 'expiry')) qs.push({ q: '유통기한이 지난 물건은 어떻게 하나요?', a: '사지 않아요', options: shuffle(['사지 않아요', '그냥 사요']) });
  if (st.log.some(l => l.type === 'promo')) qs.push({ q: '1+1 행사는 무엇인가요?', a: '하나 값에 두 개를 줘요', options: shuffle(['하나 값에 두 개를 줘요', '두 개 값에 하나를 줘요']) });
  if (st.log.some(l => l.type === 'bag')) qs.push({ q: '봉투가 필요하냐고 물으면 뭐라고 했나요?', a: '괜찮아요. 장바구니 있어요.', options: shuffle(['괜찮아요. 장바구니 있어요.', '(대답 안 하기)']) });
  if (def.mode === 'token') qs.push({ q: '친구에게 물건을 빌렸을 때 뭐라고 말하나요?', a: '고마워! 다 쓰고 돌려줄게.', options: shuffle(['고마워! 다 쓰고 돌려줄게.', '이거 내 거야.']) });
  qs.push({ q: '돈으로 쓸 수 없는 카드는 무엇인가요?', a: '꿈이든 카드', options: shuffle(['꿈이든 카드', '체크카드']) });
  if (def.mode === 'cash') {
    if (S.hasMealCard) qs.push({ q: '급식카드로 살 수 있는 것은?', a: '내가 먹을 먹을거리', options: shuffle(['내가 먹을 먹을거리', '샴푸', '연필']) });
    qs.push({ q: '체크카드로는 어떤 돈을 쓰나요?', a: '계좌에 있는 돈', options: shuffle(['계좌에 있는 돈', '지갑에 있는 현금']) });
  }
  return qs.slice(0, S.level === '하' ? 3 : 5);
}

async function finishStage() {
  const st = run.stage, def = st.def;
  memoButton(false); setGoal('');
  await talk(def.reviewBy || def.giver, `오늘 ${def.name}에서 정말 잘했어요! 한 일을 같이 떠올려 볼까요?`);
  const qs = buildReview(def);
  await fade();
  const score = await review(qs, S.level, def.reviewBy || def.seller, def.mode === 'script' ? def.name : def.counterName);
  if (def.mart && st.cartDone) { addPieces(S.cash, [100]); hud(); notify('카트를 돌려놓고 100원을 돌려받았어요.', 'coin'); }
  let stars = 1;
  if (st.mistakes <= 3) stars++;
  if (score >= qs.length - 1) stars++;
  if (S.level === '상' && (st.peeks || 0) > 1) stars = Math.max(1, stars - 1);
  S.stars[def.id] = Math.max(S.stars[def.id] || 0, stars);
  if (!S.cleared.includes(def.id)) S.cleared.push(def.id);
  const rate = D.config.bank.interestRate, unit = D.config.bank.interestRoundDown;
  const interest = Math.floor(S.account * rate / unit) * unit;
  S.account += interest;
  if (S.day.date !== today()) S.day = { date: today(), count: 0 };
  S.day.count++;
  S.tokens = 0; // 토큰은 교실에서만 써요
  st.phase = 'toBank';
  persist();
  await clearScreen(def.name, stars, score, qs.length, interest);
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
    c.append(el('h1', 'world-logo', '다녀왔습니다'), el('p', 'facts', '집 스테이지 완료! 이제 학교에 갈 수 있어요.'));
    const ok = el('button', 'btn primary big', '계속하기');
    ok.onclick = () => { sc.hidden = true; res(); };
    c.append(ok); sc.append(c);
    sfx('ding'); say('다녀왔습니다! 집 스테이지 완료!');
  });
  await talk('mom', '잘 다녀왔어! 이제 하나씩 해 볼까?');
  world.frozen = false;
  await nextStage();
}

// 스테이지를 마치고 집에 돌아왔을 때
async function comeHome() {
  run.endingNext = false;
  world.frozen = true;
  await greetLoop(null, '집에 돌아왔어요. 뭐라고 인사할까요?', '다녀왔습니다!', ['다녀오겠습니다!', '안녕히 계세요.']);
  await talk('mom', '어서 와! 오늘도 혼자서 잘 다녀왔구나.');
  run.stage = null;
  persist();
  world.frozen = false;
  if (!currentDef()) return endingScreen();
  await nextStage();
}

function endingScreen() {
  const sc = $('#screen'); sc.hidden = false; sc.innerHTML = '';
  const e = el('div', 'ending');
  e.append(el('h1', 'logo', '다녀왔습니다'), el('p', null, '집에서 교육부까지, 모든 곳을 혼자서 다녀왔어요. 정말 잘했어요!'));
  const ok = el('button', 'btn primary big', '처음 화면으로');
  ok.onclick = () => titleScreen();
  e.append(ok);
  sc.append(e);
  sfx('ding');
  say('다녀왔습니다', 'ending.title');
}

function freeRoamGoal() {
  if (run.stage) return;
  if (!currentDef()) { goal(null, ''); return; }
  if (dayLimitReached()) { goal(null, '오늘은 여기까지! 내일 또 만나요.'); return; }
  startStage(currentDef());
  goal('home', `집에 가서 엄마를 만나요. 다음은 ${currentDef().name}이에요.`);
}

// ---------- 스티커 도감 · 도장판 ----------
// 품목 파일(data/items.csv)을 그대로 읽어서 만들어요. 품목을 추가하면 도감 칸도 저절로 늘어나요.
const PLACE_NAMES = { classroom: '교실', gym: '체육관', field: '운동장', snackbar: '분식점', convenience: '편의점', market: '전통시장',
  hairshop: '미용실', mart: '대형마트', edu_office: '교육지원청', moe: '교육부' };
// 사거나 빌릴 수 있는 것만 (집에서 챙기는 물건, 값 없는 민원 서류 등은 빼요)
const collectible = it => it.stage !== 'home' && (it.price != null || it.stage === 'gym');

function openBook() {
  if (!S) return;
  const m = panel('book');
  m.append(el('h2', null, '스티커 도감'));
  // 도장판
  const stamps = el('div', 'stamps');
  for (const [id, name] of [['home', '집'], ...STAGES.map(d => [d.id, d.name])]) {
    const done = S.cleared.includes(id);
    const c = el('div', 'stamp' + (done ? '' : ' empty'));
    c.append(toImg(iconCanvas('stamp'), 5, ''), el('b', null, name));
    if (id !== 'home') {
      const stars = el('span', 'stamp-stars');
      for (let i = 0; i < 3; i++) stars.append(toImg(iconCanvas(i < (S.stars[id] || 0) ? 'star' : 'starEmpty'), 2, ''));
      c.append(stars);
    }
    c.setAttribute('aria-label', `${name} ${done ? `완료, 별 ${S.stars[id] || 0}개` : '아직 안 함'}`);
    stamps.append(c);
  }
  m.append(el('h3', null, '동네 도장판'), stamps);
  // 장소별 스티커
  const groups = new Map();
  for (const it of D.items.filter(collectible)) {
    if (!groups.has(it.stage)) groups.set(it.stage, []);
    groups.get(it.stage).push(it);
  }
  for (const [stage, items] of groups) {
    const got = items.filter(it => S.stickers.includes(it.id)).length;
    m.append(el('h3', null, `${PLACE_NAMES[stage] || stage} (${got} / ${items.length})`));
    const grid = el('div', 'book-grid');
    for (const it of items) {
      const has = S.stickers.includes(it.id);
      const c = el('div', 'sticker-cell' + (has ? '' : ' empty'));
      c.append(itemImg(it, 3), el('span', null, has ? it.name : '?'));
      grid.append(c);
    }
    m.append(grid);
  }
  const ok = el('button', 'btn primary big', '닫기');
  ok.style.display = 'flex'; ok.style.margin = '16px auto 0';
  ok.onclick = () => closePanel();
  m.append(ok);
  say(`스티커 ${S.stickers.length}개를 모았어요.`);
}

// 자동 점검용 (게임에는 영향 없음)
window.__dbg = { get world() { return world; }, get S() { return S; }, get busy() { return busy; }, run };

window.addEventListener('beforeunload', () => { if (S) persist(); });
boot();
