// 위에서 내려다보는 지도: 타일 그리기, 이동(키보드·터치), 길찾기, 문·사람과 만나기
import { PAL, PEOPLE, iconCanvas, playerSprites } from './sprites.js?v=202611271826';
import { sfx } from './voice.js?v=202611271826';

export const T = 16;
const BLOCK = new Set(['t', 'W', 'c', 'T', 'B', 'x', 'S', 'k', 'A', 'U', 'H', 'K', 'M', 'C', 'R', 'V', 'E', 'G']);

function hash(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

function drawTile(ctx, ch, x, y) {
  const px = x * T, py = y * T;
  const f = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(px + a, py + b, w, h); };
  const hv = hash(x, y);
  switch (ch) {
    case 'g':
      f('#9fd27e', 0, 0, T, T);
      if (hv % 5 === 0) { f('#7fb862', 3, 9, 1, 2); f('#7fb862', 5, 8, 1, 3); }
      if (hv % 11 === 0) { f('#f8f6f0', 10, 4, 2, 2); f('#f4c846', 10, 4, 1, 1); }
      break;
    case 'r':
      f('#6c6a7e', 0, 0, T, T);
      if (hv % 7 === 0) f('#605e72', 4, 6, 2, 1);
      break;
    case '-': f('#6c6a7e', 0, 0, T, T); f('#f8f6f0', 2, 7, 8, 2); break; // 가로 차선
    case '|': f('#6c6a7e', 0, 0, T, T); f('#f8f6f0', 7, 2, 2, 8); break; // 세로 차선
    case 'z': // 횡단보도
      f('#6c6a7e', 0, 0, T, T);
      for (let i = 0; i < 4; i++) f('#f8f6f0', 1 + i * 4, 1, 2, 14);
      break;
    case 'Z':
      f('#6c6a7e', 0, 0, T, T);
      for (let i = 0; i < 4; i++) f('#f8f6f0', 1, 1 + i * 4, 14, 2);
      break;
    case 's':
      f('#e2d6c0', 0, 0, T, T); f('#cfc0a6', 0, 15, T, 1); f('#cfc0a6', 15, 0, 1, T);
      break;
    case 't':
      f('#9fd27e', 0, 0, T, T);
      f(PAL.k, 3, 1, 10, 11); f('#3c7840', 4, 2, 8, 9); f('#6eb45a', 5, 3, 4, 4);
      f(PAL.k, 6, 11, 4, 4); f('#a0643c', 7, 11, 2, 4);
      break;
    case 'f': // 나무 바닥
      f('#e8c898', 0, 0, T, T); f('#d4b07c', 0, (y % 2) ? 5 : 11, T, 1); f('#d4b07c', (hv % 2) ? 4 : 10, 0, 1, T);
      break;
    case 'm': f('#f6a0b4', 0, 0, T, T); f('#f8c8d4', 2, 2, 12, 12); break;
    case 'q': f('#cfe8f4', 0, 0, T, T); f('#b4d8ea', 0, 0, T, 1); f('#b4d8ea', 0, 0, 1, T); break; // 타일 바닥
    case 'W':
      f('#f4e6c8', 0, 0, T, T); f('#e0cca4', 0, 12, T, 4); f(PAL.k, 0, 15, T, 1);
      break;
    case 'c': // 계산대
      f(PAL.k, 0, 0, T, T); f('#c48e28', 0, 1, T, 10); f('#f4c846', 0, 1, T, 3); f('#a06a24', 0, 11, T, 4);
      break;
    case 'T': f('#e8c898', 0, 0, T, T); f(PAL.k, 1, 2, 14, 12); f('#c48e28', 2, 3, 12, 8); f('#f4c846', 2, 3, 12, 2); break;
    case 'B': f('#e8c898', 0, 0, T, T); f(PAL.k, 1, 0, 14, 16); f('#96d2f0', 2, 1, 12, 14); f('#f8f6f0', 3, 2, 10, 4); break;
    case 'S': // 메뉴판·선반 (벽에 붙은)
      f('#f4e6c8', 0, 0, T, T); f(PAL.k, 1, 2, 14, 11); f('#2c3a30', 2, 3, 12, 9); f('#f8f6f0', 3, 5, 6, 1); f('#f8f6f0', 3, 8, 8, 1);
      break;
    case 'A': // ATM
      f('#cfe8f4', 0, 0, T, T); f(PAL.k, 2, 0, 12, 16); f('#8c92a0', 3, 1, 10, 14); f('#96d2f0', 4, 2, 8, 5); f('#22203a', 5, 9, 6, 1);
      break;
    case 'D': f('#e8c898', 0, 0, T, T); f('#a0643c', 2, 4, 12, 9); f('#c48e28', 3, 5, 10, 7); break; // 현관 매트
    case 'x': f('#22203a', 0, 0, T, T); break;
    case 'a': // 운동장 모래
      f('#e8d39a', 0, 0, T, T);
      if (hv % 4 === 0) f('#d4bc7e', 3 + (hv % 7), 5 + (hv % 5), 1, 1);
      if (hv % 9 === 0) f('#f4e6b8', 9, 11, 2, 1);
      break;
    case 'L': // 체육관 바닥
      f('#e0a868', 0, 0, T, T); f('#c88c4c', 0, (y % 2) ? 7 : 15, T, 1);
      if (x === 7) f('#f8f6f0', 0, 0, 2, T);
      break;
    case 'U': // 부스 천막
      f(PAL.k, 0, 0, T, T);
      for (let i = 0; i < 4; i++) f(i % 2 ? '#f8f6f0' : '#dc4646', i * 4, 1, 4, 10);
      f('#962a2c', 0, 11, T, 2); f('#e8d39a', 0, 13, T, 3);
      break;
    case 'K': // 셀프 계산대 (키오스크)
      f('#cfe8f4', 0, 0, T, T); f(PAL.k, 3, 0, 10, 16); f('#f8f6f0', 4, 1, 8, 14); f('#4278d2', 5, 2, 6, 6); f('#96d2f0', 6, 3, 4, 3);
      f(PAL.k, 6, 10, 4, 1); f('#f4c846', 6, 12, 4, 2);
      break;
    case 'R': // 카트 보관대
      f('#cfe8f4', 0, 0, T, T); f(PAL.k, 1, 4, 14, 9); f('#ccd0d8', 2, 5, 12, 6); for (let i = 3; i < 13; i += 3) f('#8c92a0', i, 5, 1, 6);
      f(PAL.k, 3, 13, 2, 2); f(PAL.k, 11, 13, 2, 2); f('#dc4646', 12, 2, 3, 3);
      break;
    case 'V': // 자판기
      f('#f4e6c8', 0, 0, T, T); f(PAL.k, 1, 0, 14, 16); f('#dc4646', 2, 1, 12, 14); f('#bfe4f4', 3, 2, 7, 8);
      for (let i = 0; i < 3; i++) f(['#4278d2', '#6eb45a', '#f4c846'][i], 4 + i * 2, 3, 1, 5); f(PAL.k, 11, 4, 2, 2); f(PAL.k, 4, 12, 8, 2);
      break;
    case 'E': // 엘리베이터
      f('#f4e6c8', 0, 0, T, T); f(PAL.k, 1, 0, 14, 16); f('#ccd0d8', 2, 1, 12, 15); f('#8c92a0', 7, 1, 2, 15); f('#f4c846', 6, 2, 4, 2);
      break;
    case 'G': // 보안 검색대
      f('#eef0f4', 0, 0, T, T); f(PAL.k, 1, 2, 14, 12); f('#8c92a0', 2, 3, 12, 10); f(PAL.k, 4, 5, 8, 6); f('#6eb45a', 6, 1, 4, 2);
      break;
    case 'M': // 미용실 거울
      f('#fbeaf0', 0, 0, T, T); f(PAL.k, 2, 0, 12, 14); f('#bfe4f4', 3, 1, 10, 12); f('#f8f6f0', 4, 2, 3, 2);
      break;
    case 'C': // 미용실 의자
      f('#fbeaf0', 0, 0, T, T); f(PAL.k, 3, 3, 10, 12); f('#dc4646', 4, 4, 8, 6); f('#962a2c', 4, 10, 8, 2); f('#8c92a0', 7, 12, 2, 3);
      break;
    case 'H': // 체육 도구 선반
      f('#e0a868', 0, 0, T, T); f(PAL.k, 1, 1, 14, 14); f('#a0643c', 2, 2, 12, 12);
      f('#ee8032', 3, 3, 4, 4); f('#f8f6f0', 9, 3, 4, 4); f('#dc4646', 3, 9, 4, 4); f('#4278d2', 9, 9, 4, 4);
      break;
    default: f('#9fd27e', 0, 0, T, T);
  }
}

function drawBuilding(ctx, b, fontReady) {
  const px = b.x * T, py = b.y * T, w = b.w * T, h = b.h * T;
  const f = (c, a, bb, ww, hh) => { ctx.fillStyle = c; ctx.fillRect(px + a, py + bb, ww, hh); };
  const roofH = 14;
  if (b.art) {
    // assets/buildings/<id>.png 그림이 있으면 그 그림을 씁니다 (간판·자물쇠는 위에 그대로 그림)
    const a = b.art;
    if (a.width <= w && a.height <= h) ctx.drawImage(a, px + Math.floor((w - a.width) / 2), py + h - a.height);
    else { const k = Math.min(w / a.width, h / a.height); ctx.drawImage(a, px + (w - a.width * k) / 2, py + h - a.height * k, a.width * k, a.height * k); }
    if (b.locked) { ctx.fillStyle = 'rgba(140,146,160,0.45)'; ctx.fillRect(px, py, w, h); }
  } else {
  // 그림자 (바닥)
  ctx.fillStyle = 'rgba(34,32,58,0.18)'; ctx.fillRect(px + 2, py + h - 2, w, 4);
  f(PAL.k, 0, 0, w, h);
  f(b.wall, 1, roofH, w - 2, h - roofH - 1);
  f(b.roof, 1, 1, w - 2, roofH - 2);
  f(b.roofShade, 1, roofH - 3, w - 2, 2);
  for (let i = 4; i < w - 4; i += 8) f(b.roofShade, i, 3, 3, 1);
  // 창문
  const winY = roofH + 6;
  for (let i = 6; i + 10 < w - 4; i += 18) {
    if (Math.abs(i + 5 - (b.doorX - b.x) * T - 8) < 12) continue;
    f(PAL.k, i, winY, 12, 10); f('#bfe4f4', i + 1, winY + 1, 10, 8); f('#f8f6f0', i + 2, winY + 2, 3, 2);
  }
  // 문
  const dx = (b.doorX - b.x) * T, dy = (b.doorY - b.y) * T;
  f(PAL.k, dx + 2, dy - 2, 12, 18);
  f(b.locked ? '#8c92a0' : '#a0643c', dx + 3, dy - 1, 10, 17);
  f(b.locked ? '#ccd0d8' : '#f4c846', dx + 10, dy + 7, 2, 2);
  }
  // 간판 (그림에 간판이 이미 있으면 그리지 않음)
  if (b.art && b.showSign === false) {
    if (b.locked) ctx.drawImage(iconCanvas('lock'), px + w - 14, py + 6);
    return;
  }
  if (fontReady) {
    ctx.font = '16px Sam3KR';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '-3px';
    const tw = Math.ceil(ctx.measureText(b.label).width) - ('letterSpacing' in ctx ? 0 : 0);
    const sw = tw + 10, sx = Math.round(px + w / 2 - sw / 2), sy = py + roofH - 4;
    ctx.fillStyle = PAL.k; ctx.fillRect(sx, sy, sw, 20);
    ctx.fillStyle = b.locked ? '#ccd0d8' : '#fffdf6'; ctx.fillRect(sx + 1, sy + 1, sw - 2, 18);
    ctx.fillStyle = b.locked ? '#6c6a7e' : PAL.k;
    ctx.textBaseline = 'top';
    ctx.fillText(b.label, sx + 5, sy + 2);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    if (b.locked) ctx.drawImage(iconCanvas('lock'), sx + sw - 4, sy + 12);
  }
}

// 건물 그림 교체: assets/buildings/manifest.json 에 적힌 건물만 PNG를 읽습니다
let artList = {};
let manifestLoaded = false;
const artCache = new Map();
// 건물 그림 목록(문 위치 포함). 지도를 만들기 전에 한 번 읽어 둡니다.
export async function loadBuildingManifest() {
  if (manifestLoaded) return artList;
  try { artList = await fetch('assets/buildings/manifest.json').then(r => r.json()); } catch { artList = {}; }
  if (Array.isArray(artList)) artList = Object.fromEntries(artList.map(id => [id, {}])); // 예전 목록 형식도 읽기
  manifestLoaded = true;
  return artList;
}
async function loadBuildingArt(buildings) {
  await loadBuildingManifest();
  await Promise.all(buildings.filter(b => artList[b.id]).map(b => {
    const info = artList[b.id];
    b.showSign = info.sign !== false;
    if (artCache.has(b.id)) { b.art = artCache.get(b.id); return null; }
    return new Promise(res => {
      const img = new Image();
      img.onload = () => { artCache.set(b.id, img); b.art = img; res(); };
      img.onerror = () => res();
      img.src = `assets/buildings/${info.file || b.id + '.png'}`;
    });
  }));
}

// 방 그림: assets/rooms/manifest.json 에 적힌 방은 칸 그림 대신 한 장짜리 그림을 씁니다
let roomList = null;
const roomCache = new Map();
async function loadRoomArt(id) {
  if (!id) return null;
  if (!roomList) {
    try { roomList = await fetch('assets/rooms/manifest.json').then(r => r.json()); } catch { roomList = {}; }
  }
  const file = roomList[id];
  if (!file) return null;
  if (roomCache.has(id)) return roomCache.get(id);
  const img = await new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = `assets/rooms/${file}`;
  });
  roomCache.set(id, img);
  return img;
}

// 교실 칠판에 오늘 날짜(폰·PC 시계 기준)를 분필 글씨로 씁니다. 예: 11/27
const CHALK_GLYPH = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001111', '/': '001001010100100',
};
function drawChalkDate(ctx, x, y) {
  const d = new Date();
  ctx.fillStyle = '#f0efe6';
  for (const ch of `${d.getMonth() + 1}/${d.getDate()}`) {
    const g = CHALK_GLYPH[ch];
    for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
    x += 4;
  }
}
const ROOM_EXTRAS = { classroom: ctx => drawChalkDate(ctx, 51, 7) };

// 방 안 표지판 (코너 이름, 창구 이름)
function drawLabel(ctx, l) {
  ctx.font = '16px Sam3KR';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-3px';
  const tw = Math.ceil(ctx.measureText(l.text).width);
  const sw = tw + 8, cx = Math.round(l.x * T + T / 2 - sw / 2), cy = l.y * T + 1;
  ctx.fillStyle = PAL.k; ctx.fillRect(cx, cy, sw, 15);
  ctx.fillStyle = l.color || '#f4c846'; ctx.fillRect(cx + 1, cy + 1, sw - 2, 13);
  ctx.fillStyle = PAL.k; ctx.textBaseline = 'top';
  ctx.fillText(l.text, cx + 4, cy);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

export class World {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = null;
    this.player = { x: 0, y: 0, rx: 0, ry: 0, path: [], frame: 0, t: 0, dir: 'down' };
    this.frozen = true;
    this.keys = new Set();
    this.speed = 6; // 초당 타일
    this.onArrive = null; // (x, y) => void
    this.marker = null;
    this.playerSprites = playerSprites();
    this.last = performance.now();
    this.bindInput();
    requestAnimationFrame(t => this.loop(t));
  }

  async load(map, spawn) {
    await document.fonts.load('16px Sam3KR').catch(() => {});
    await loadBuildingArt(map.buildings || []);
    const roomArt = await loadRoomArt(map.id);
    this.map = map;
    this.grid = map.tiles.map(r => [...r]);
    const W = map.tiles[0].length, H = map.tiles.length;
    this.W = W; this.H = H;
    this.blocked = this.grid.map(r => r.map(ch => BLOCK.has(ch)));
    for (const b of map.buildings || []) {
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) this.blocked[y][x] = true;
      this.blocked[b.doorY][b.doorX] = false;
    }
    for (const n of map.npcs || []) this.blocked[n.y][n.x] = true;
    this.cv.width = W * T; this.cv.height = H * T;
    // 고정된 바닥은 한 번만 그립니다
    this.bg = document.createElement('canvas');
    this.bg.width = W * T; this.bg.height = H * T;
    const bctx = this.bg.getContext('2d');
    const useArt = roomArt && roomArt.width === W * T && roomArt.height === H * T;
    if (useArt) { bctx.drawImage(roomArt, 0, 0); ROOM_EXTRAS[map.id]?.(bctx); }
    else this.grid.forEach((row, y) => row.forEach((ch, x) => drawTile(bctx, ch, x, y)));
    for (const b of map.buildings || []) drawBuilding(bctx, b, true);
    if (!useArt) for (const l of map.labels || []) drawLabel(bctx, l); // 방 그림이 있으면 글자 표지는 안 그림
    this.npcSprites = (map.npcs || []).map(n => PEOPLE[n.sprite]());
    const p = spawn || map.spawn;
    Object.assign(this.player, { x: p.x, y: p.y, rx: p.x, ry: p.y, path: [] });
    this.fit();
  }

  fit() {
    if (!this.map) return;
    const hud = document.getElementById('hud');
    const hudH = document.body.classList.contains('has-hud') && hud
      ? parseFloat(getComputedStyle(hud).getPropertyValue('--hud-h')) || 0 : 0;
    // 게임 화면 크기 (화면을 90도 돌려 출력할 때도 돌리기 전 크기 기준)
    const game = document.getElementById('game');
    const vw = game?.offsetWidth || window.innerWidth, vh = (game?.offsetHeight || window.innerHeight) - hudH;
    const s = Math.min(vw / this.cv.width, vh / this.cv.height);
    const scale = s >= 2 ? Math.floor(s) : s;
    this.cv.style.width = Math.floor(this.cv.width * scale) + 'px';
    this.cv.style.height = Math.floor(this.cv.height * scale) + 'px';
    this.scale = scale;
  }

  bindInput() {
    window.addEventListener('resize', () => this.fit());
    window.addEventListener('keydown', e => {
      const k = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' }[e.key];
      if (k && !this.frozen) { this.keys.add(k); this.player.path = []; this.marker = null; e.preventDefault(); }
    });
    window.addEventListener('keyup', e => {
      const k = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' }[e.key];
      if (k) this.keys.delete(k);
    });
    this.cv.addEventListener('pointerdown', e => {
      if (this.frozen || !this.map) return;
      const r = this.cv.getBoundingClientRect();
      let fx, fy;
      if (document.body.classList.contains('rotated')) {
        // 화면을 시계 방향으로 90도 돌려 출력 중: 화면의 아래쪽 = 지도의 오른쪽, 화면의 왼쪽 = 지도의 아래쪽
        fx = (e.clientY - r.top) / r.height;
        fy = (r.right - e.clientX) / r.width;
      } else {
        fx = (e.clientX - r.left) / r.width;
        fy = (e.clientY - r.top) / r.height;
      }
      const tx = Math.floor(fx * this.W);
      const ty = Math.floor(fy * this.H);
      this.goTo(tx, ty);
    });
  }

  // 화면 방향키(휴대폰·패드): 누르고 있는 동안 그쪽으로 걸어요
  pressKey(k, on) {
    if (on) { if (this.frozen) return; this.keys.add(k); this.player.path = []; this.marker = null; }
    else this.keys.delete(k);
  }

  // 누른 곳으로 걸어가기. 건물이나 사람을 누르면 그 앞까지 갑니다.
  goTo(tx, ty) {
    let target = [tx, ty];
    const b = (this.map.buildings || []).find(b => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
    if (b) target = [b.doorX, b.doorY];
    const n = (this.map.npcs || []).find(n => Math.abs(n.x - tx) <= 0 && Math.abs(n.y - ty) <= 1);
    if (n) target = n.counter && this.blocked[n.y + 2]?.[n.x] === false ? [n.x, n.y + 2] : this.nearestFree(n.x, n.y); // 창구 뒤 사람은 창구 앞으로
    if (this.blocked[target[1]]?.[target[0]] !== false) target = this.nearestFree(tx, ty);
    if (!target) return;
    const path = this.bfs([this.player.x, this.player.y], target);
    if (path) { this.player.path = path; this.marker = { x: target[0], y: target[1], t: 0 }; }
  }

  nearestFree(x, y) {
    let best = null, bd = 1e9;
    for (let yy = 0; yy < this.H; yy++) for (let xx = 0; xx < this.W; xx++) {
      if (this.blocked[yy][xx]) continue;
      const d = Math.abs(xx - x) + Math.abs(yy - y);
      if (d < bd) { bd = d; best = [xx, yy]; }
    }
    return best;
  }

  bfs(from, to) {
    const key = (x, y) => y * this.W + x;
    const prev = new Map([[key(...from), null]]);
    const q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === to[0] && y === to[1]) {
        const path = []; let k = key(x, y);
        while (k !== key(...from)) { path.unshift([k % this.W, Math.floor(k / this.W)]); k = prev.get(k); }
        return path;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.W || ny >= this.H || this.blocked[ny][nx]) continue;
        const nk = key(nx, ny);
        if (prev.has(nk)) continue;
        prev.set(nk, key(x, y)); q.push([nx, ny]);
      }
    }
    return null;
  }

  isMoving() { return this.player.rx !== this.player.x || this.player.ry !== this.player.y; }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.map) { this.update(dt); this.draw(dt); }
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    const p = this.player;
    const sp = this.speed * (this.slow ? 0.5 : 1);
    if (!this.isMoving() && !this.frozen) {
      let next = null;
      if (p.path.length) next = p.path.shift();
      else if (this.keys.size) {
        const k = [...this.keys].pop();
        const [dx, dy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[k];
        const nx = p.x + dx, ny = p.y + dy;
        if (this.blocked[ny]?.[nx] === false) next = [nx, ny];
      }
      if (next) {
        const dx = next[0] - p.x, dy = next[1] - p.y;
        p.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy < 0 ? 'up' : 'down';
        p.x = next[0]; p.y = next[1];
        this.stepped = (this.stepped || 0) + 1;
      }
    }
    if (this.isMoving()) {
      const step = sp * dt;
      const dx = p.x - p.rx, dy = p.y - p.ry;
      p.rx += Math.sign(dx) * Math.min(Math.abs(dx), step);
      p.ry += Math.sign(dy) * Math.min(Math.abs(dy), step);
      p.t += dt;
      if (p.t > 0.12) { p.t = 0; p.frame = (p.frame + 1) % 4; if (p.frame % 2) sfx('step'); }
      if (!this.isMoving()) {
        if (!p.path.length) this.marker = null;
        this.onArrive?.(p.x, p.y, p.path.length === 0 && !this.keys.size);
        this.onStep?.();
      }
    } else p.frame = 0;
  }

  draw(dt) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bg, 0, 0);
    if (this.marker) {
      this.marker.t += dt;
      const a = 0.5 + 0.5 * Math.sin(this.marker.t * 8);
      ctx.fillStyle = `rgba(244,200,70,${0.35 + a * 0.4})`;
      ctx.fillRect(this.marker.x * T + 2, this.marker.y * T + 2, T - 4, T - 4);
    }
    const actors = (this.map.npcs || []).map((n, i) => ({ y: n.y, draw: () => this.drawPerson(this.npcSprites[i][0], n.x, n.y, false) }));
    const p = this.player;
    // 걷기 순서: 왼발 → 서기 → 오른발 → 서기. 걸을 때는 한 칸씩 몸이 살짝 들썩여요.
    const set = this.playerSprites[p.dir === 'left' ? 'right' : p.dir];
    const moving = this.isMoving();
    const idx = moving ? [1, 0, 2, 0][p.frame] : 0;
    const bob = moving && (p.frame === 1 || p.frame === 3) ? -1 / T : 0;
    actors.push({ y: p.ry, draw: () => this.drawPerson(set[idx], p.rx, p.ry + bob, p.dir === 'left') });
    actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
    if (this.goal) {
      // 가야 할 곳: 위아래로 움직이는 빨간 화살표
      const g = this.goal, bob = Math.round(Math.sin(performance.now() / 180) * 2);
      const x0 = g.x * T + 2, y0 = g.y * T - 15 + bob;
      const rows = [[4, 8], [4, 8], [4, 8], [4, 8], [0, 12], [1, 11], [2, 10], [3, 9], [4, 8], [5, 7]];
      ctx.fillStyle = PAL.k;
      ctx.fillRect(x0 + 3, y0 - 1, 6, 1);
      rows.forEach(([a, b], i) => ctx.fillRect(x0 + a - 1, y0 + i, b - a + 2, 1));
      ctx.fillRect(x0 + 5, y0 + rows.length, 2, 1);
      ctx.fillStyle = PAL.r;
      rows.forEach(([a, b], i) => ctx.fillRect(x0 + a, y0 + i, b - a, 1));
      ctx.fillStyle = '#f08080';
      ctx.fillRect(x0 + 4, y0, 1, 4);
    }
  }

  drawPerson(img, x, y, flip) {
    const ctx = this.ctx;
    const px = Math.round(x * T), py = Math.round(y * T + T - img.height);
    ctx.fillStyle = 'rgba(34,32,58,0.22)';
    ctx.fillRect(px + 4, Math.round(y * T) + T - 2, 8, 2);
    if (flip) {
      ctx.save(); ctx.translate(px + img.width, py); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
    } else ctx.drawImage(img, px, py);
  }
}

// ---------- 지도 ----------
export function townMap(state, unlocked) {
  // 위쪽 건물 줄 → 큰길 → 아래쪽 건물 줄 → 아랫길. 모든 건물 문은 아래쪽 길을 바라봅니다.
  const W = 35, H = 23;
  const SIDE = [8, 11, 18, 21], ROAD = [9, 10, 19, 20];
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      let ch = 'g';
      if (y === 0 || y === H - 1 || x === 0 || x === W - 1) ch = 't';
      if (SIDE.includes(y) && x > 0 && x < W - 1) ch = 's';
      if (y === 9 || y === 19) ch = x % 3 === 0 && x > 0 && x < W - 1 ? '-' : 'r';
      if (y === 10 || y === 20) ch = x > 0 && x < W - 1 ? 'r' : 't';
      if (x === 15 || x === 18) ch = (y >= 1 && y <= H - 2) ? (ROAD.includes(y) ? 'r' : 's') : ch;
      if (x === 16 || x === 17) {
        if (y >= 1 && y <= H - 2) ch = ROAD.includes(y) ? 'r' : (x === 16 && y % 3 === 0 ? '|' : 'r');
      }
      if ((x === 14 || x === 19) && ROAD.includes(y)) ch = 'z';
      if (SIDE.includes(y) && (x === 16 || x === 17)) ch = 'Z';
      if ((y === 9 || y === 19) && (x === 0 || x === W - 1)) ch = 't';
      r += ch;
    }
    rows.push(r);
  }
  // 건물 앞 길
  const B = (id, label, x, y, w, h, top, colors) => {
    const col = artList[id]?.door;
    const doorX = x + (Number.isInteger(col) && col >= 0 && col < w ? col : Math.floor(w / 2));
    const doorY = y + h - 1; // 문은 맨 아래 줄
    return { id, label, x, y, w, h, doorX, doorY, locked: !unlocked.includes(id), ...colors };
  };
  const C = {
    home: { wall: '#fce8c8', roof: '#dc4646', roofShade: '#962a2c' },
    school: { wall: '#f4e6c8', roof: '#4278d2', roofShade: '#284e96' },
    snackbar: { wall: '#fff2dc', roof: '#ee8032', roofShade: '#b4501e' },
    convenience: { wall: '#eef6f8', roof: '#6eb45a', roofShade: '#3c7840' },
    hairshop: { wall: '#fbeaf0', roof: '#f6a0b4', roofShade: '#c86482' },
    market: { wall: '#f8ecd4', roof: '#c48e28', roofShade: '#8a5e18' },
    bank: { wall: '#eef2f8', roof: '#284e96', roofShade: '#1a3466' },
    mart: { wall: '#f6f6f2', roof: '#dc4646', roofShade: '#962a2c' },
    edu_office: { wall: '#eef0f4', roof: '#8c64c8', roofShade: '#5a3e8c' },
    moe: { wall: '#eef0f4', roof: '#3c7840', roofShade: '#264c28' },
  };
  const buildings = [
    B('home', '우리 집', 2, 2, 5, 6, true, C.home),
    B('school', '학교', 8, 1, 6, 7, true, C.school),
    B('snackbar', '분식점', 20, 2, 4, 6, true, C.snackbar),
    B('convenience', '편의점', 25, 2, 4, 6, true, C.convenience),
    B('hairshop', '미용실', 30, 2, 4, 6, true, C.hairshop),
    B('market', '전통시장', 1, 12, 7, 6, false, C.market),
    B('bank', '은행', 9, 12, 5, 6, false, C.bank),
    B('mart', '대형마트', 20, 12, 5, 6, false, C.mart),
    B('edu_office', '교육지원청', 25, 12, 4, 6, false, C.edu_office),
    B('moe', '교육부', 30, 12, 4, 6, false, C.moe),
  ];
  return { id: 'town', name: '우리 동네', tiles: rows, buildings, npcs: [], spawn: { x: 4, y: 8 } };
}

export function homeMap() {
  return {
    id: 'home', name: '우리 집',
    tiles: [
      'xxxxxxxxxxxxxx',
      'xWWWWWWWWWWWWx',
      'xfffffffffBBfx',
      'xffTTffffffffx',
      'xffTTfffmmmffx',
      'xfffffffmmmffx',
      'xffffffffffffx',
      'xffffffDfffffx',
      'xxxxxxxxxxxxxx',
    ],
    npcs: [{ id: 'mom', sprite: 'mom', x: 9, y: 3 }],
    spawn: { x: 11, y: 4 },
    door: { x: 7, y: 7 },
  };
}

export function shopMap() {
  return {
    id: 'snackbar_in', name: '분식점',
    tiles: [
      'xxxxxxxxxxxxxx',
      'xWWSSWWWWSSWWx',
      'xqqqqqqqqqqqqx',
      'xcccccccccccqx',
      'xqqqqqqqqqqqqx',
      'xqqTTqqqqTTqqx',
      'xqqqqqqqqqqqqx',
      'xxxxxxDxxxxxxx',
    ],
    npcs: [{ id: 'owner', sprite: 'owner', x: 6, y: 2, counter: true }],
    counter: { x: 6, y: 4 },
    spawn: { x: 6, y: 6 },
    door: { x: 6, y: 7 },
  };
}

export function bankMap() {
  return {
    id: 'bank_in', name: '은행',
    tiles: [
      'xxxxxxxxxxxxxx',
      'xWWWWWWWWWWWWx',
      'xqqqqqqqqqAqqx',
      'xcccccccccqqqx',
      'xqqqqqqqqqqqqx',
      'xqqqqqqqqqqqqx',
      'xqqqqqqqqqqqqx',
      'xxxxxxDxxxxxxx',
    ],
    npcs: [{ id: 'teller', sprite: 'teller', x: 5, y: 2, counter: true }],
    counter: { x: 5, y: 4 }, atm: { x: 10, y: 3 },
    spawn: { x: 6, y: 6 },
    door: { x: 6, y: 7 },
  };
}

// ---------- 학교 ----------
export function classroomMap() {
  return {
    id: 'classroom', name: '교실',
    tiles: [
      'xxxxxxxxxxxxxx',
      'xWWSSSSSWWWWWx',
      'xffffffffffffx',
      'xffffffffcccfx',
      'xffTTffTTffffx',
      'xffffffffffffx',
      'xffTTffTTffffx',
      'xffffffDfffffx',
      'xxxxxxxxxxxxxx',
    ],
    npcs: [
      { id: 'teacher', sprite: 'teacher', x: 5, y: 2 },
      { id: 'clerk', sprite: 'clerk', x: 10, y: 2, counter: true },
      { id: 'friend', sprite: 'friend', x: 2, y: 5 },
    ],
    counter: { x: 10, y: 4 },
    spawn: { x: 7, y: 6 },
    door: { x: 7, y: 7 },
  };
}

export function gymMap() {
  return {
    id: 'gym', name: '체육관',
    tiles: [
      'xxxxxxxxxxxxxx',
      'xWHHWWWWWWWWWx',
      'xLLLLLLLLLLLLx',
      'xLcccLLLLLLLLx',
      'xLLLLLLLLLLLLx',
      'xLLLLLLLLLLLLx',
      'xLLLLLLLLLLLLx',
      'xLLLLLLDLLLLLx',
      'xxxxxxxxxxxxxx',
    ],
    npcs: [
      { id: 'helper', sprite: 'helper', x: 3, y: 2, counter: true },
      { id: 'teacher', sprite: 'teacher', x: 10, y: 3 },
    ],
    counter: { x: 3, y: 4 },
    spawn: { x: 7, y: 6 },
    door: { x: 7, y: 7 },
  };
}

export function fieldMap() {
  return {
    id: 'field', name: '운동장',
    tiles: [
      'tttttttttttttttt',
      'taaaaaaaaUUUUUat',
      'taaaaaaaaaaaaaat',
      'taaaaaaaaacccaat',
      'taaaaaaaaaaaaaat',
      'taagggggggggaaat',
      'taagggggggggaaat',
      'taagggggggggaaat',
      'taaaaaaaaaaaaaat',
      'taaaaaaaDaaaaaat',
      'tttttttttttttttt',
    ],
    npcs: [
      { id: 'parent', sprite: 'parent', x: 11, y: 2, counter: true },
      { id: 'teacher', sprite: 'teacher', x: 4, y: 3 },
    ],
    counter: { x: 11, y: 4 },
    spawn: { x: 8, y: 8 },
    door: { x: 8, y: 9 },
  };
}

export function convenienceMap() {
  return {
    id: 'convenience', name: '편의점',
    tiles: [
      'xxxxxxxxxxxxxx',
      'xHHHHHWWWHHHHx',
      'xqqqqqqqqqqqqx',
      'xqHHqqHHqqqqqx',
      'xqqqqqqqqqqqqx',
      'xKHHqqHHqcccqx',
      'xqqqqqqqqqqqkx',
      'xxxxxxDxxxxxxx',
    ],
    kiosk: { x: 1, y: 5 },
    npcs: [{ id: 'cashier', sprite: 'cashier', x: 10, y: 4, counter: true }],
    counter: { x: 10, y: 6 },
    spawn: { x: 6, y: 6 },
    door: { x: 6, y: 7 },
  };
}

export function marketMap() {
  return {
    id: 'market', name: '전통시장',
    tiles: [
      'tttttttttttttttt',
      'tUUUUUssssUUUUUt',
      'tssssssssssssst',
      'tscccssssssccc' + 'st',
      'tssssssssssssst',
      'tsHssssssssssHst',
      'tssssssssssssst',
      'tssssssDsssssss' + 't',
      'tttttttttttttttt',
    ].map(r => (r.length < 16 ? r.slice(0, -1) + 's'.repeat(16 - r.length) + 't' : r)),
    npcs: [
      { id: 'grocer', sprite: 'grocer', x: 3, y: 2, counter: true },
      { id: 'baker', sprite: 'baker', x: 12, y: 2, counter: true },
    ],
    counters: { grocer: { x: 3, y: 4 }, baker: { x: 12, y: 4 } },
    counter: { x: 3, y: 4 },
    spawn: { x: 7, y: 6 },
    door: { x: 7, y: 7 },
  };
}

export function hairshopMap() {
  return {
    id: 'hairshop', name: '미용실',
    tiles: [
      'xxxxxxxxxxxxxx',
      'xWMMWMMWWWWWWx',
      'xqCqqCqkkqqqqx',
      'xqqqqqqqqcccqx',
      'xqqqqqqqqqqqqx',
      'xqTTkqqqqqqqkx',
      'xqqqqqqqqqqqqx',
      'xxxxxxDxxxxxxx',
    ],
    npcs: [{ id: 'stylist', sprite: 'stylist', x: 10, y: 2, counter: true }],
    counter: { x: 10, y: 4 },
    spawn: { x: 6, y: 6 },
    door: { x: 6, y: 7 },
  };
}

export function martMap() {
  return {
    id: 'mart', name: '대형마트',
    tiles: [
      'xxxxxxxxxxxxxxxx',
      'xHHHHWWWWWHHHHHx',
      'xqqqqqqqqqqqqqqx',
      'xqHHqqHHqqHHqqqx',
      'xqqqHqqqHqqqqHqx',
      'xqqqHqqqHqqqqHqx',
      'xqqqqqqqqqqqqqqx',
      'xqkkkqkkkqcccqKx',
      'xqqqqqqqqqqqqqqx',
      'xqqRqqqDqqqqqqqx',
      'xxxxxxxxxxxxxxxx',
    ],
    npcs: [{ id: 'cashier', sprite: 'cashier', x: 11, y: 6, counter: true }],
    objects: [{ id: 'cart', x: 3, y: 9 }, { id: 'c_food', x: 2, y: 3 }, { id: 'c_daily', x: 6, y: 3 }, { id: 'c_fruit', x: 10, y: 3 }],
    labels: [{ x: 2.5, y: 2, text: '식품' }, { x: 6.5, y: 2, text: '생활용품', color: '#96d2f0' }, { x: 10.5, y: 2, text: '과일', color: '#f6a0b4' }],
    kiosk: { x: 14, y: 7 },
    counter: { x: 11, y: 8 },
    spawn: { x: 7, y: 8 },
    door: { x: 7, y: 9 },
  };
}

export function eduOfficeMap() {
  return {
    id: 'edu_office', name: '교육지원청',
    tiles: [
      'xxxxxxxxxxxxxx',
      'xWWWWWWWWWVWEx',
      'xqqqqqqqqqqqqx',
      'xKqcccccqqqqqx',
      'xqqqqqqqqqqqqx',
      'xqTTqqqqTTqqkx',
      'xqqqqqqqqqqqqx',
      'xqqqqqDqqqqqqx',
      'xxxxxxxxxxxxxx',
    ],
    npcs: [{ id: 'officer', sprite: 'officer', x: 5, y: 2, counter: true }],
    objects: [{ id: 'ticket', x: 1, y: 3 }, { id: 'vending', x: 10, y: 1 }, { id: 'elevator', x: 12, y: 1 }],
    labels: [{ x: 5, y: 1, text: '민원실' }, { x: 2.2, y: 2, text: '번호표', color: '#96d2f0' }],
    counter: { x: 5, y: 4 },
    spawn: { x: 6, y: 6 },
    door: { x: 6, y: 7 },
  };
}

export function moeMap() {
  return {
    id: 'moe', name: '교육부',
    tiles: [
      'xxxxxxxxxxxxxxxx',
      'xWWWWWWWWWWWWWWx',
      'xqqqqqqqqqqqqqkx',
      'xcccqqqqqqqccckx',
      'xqqqqqqqqqqqqqqx',
      'xqqqqqGqqqqqqqqx',
      'xqqqqqqqqqqqqqqx',
      'xqTTqqqqqqqTTqqx',
      'xkqqqqqDqqqqqqkx',
      'xxxxxxxxxxxxxxxx',
    ],
    npcs: [
      { id: 'guard', sprite: 'guard', x: 2, y: 2, counter: true },
      { id: 'giftclerk', sprite: 'giftclerk', x: 12, y: 2, counter: true },
      { id: 'guide', sprite: 'guide', x: 9, y: 6 },
    ],
    objects: [{ id: 'gate', x: 6, y: 5 }],
    labels: [{ x: 2, y: 1, text: '안내' }, { x: 12, y: 1, text: '기념품', color: '#f6a0b4' }, { x: 6, y: 4, text: '검색대', color: '#96d2f0' }],
    counter: { x: 2, y: 4 },
    spawn: { x: 7, y: 7 },
    door: { x: 7, y: 8 },
  };
}
