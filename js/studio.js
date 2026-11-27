// 대사 녹음하기 (선생님): 대사를 하나씩 보여 주고, 연결된 마이크로 녹음해요.
// 녹음은 먼저 이 기기에 저장되고, 「사이트에 올리기」를 하면 모든 기기에서 들려요.
import { el, notify } from './ui.js?v=202611271849';
import { keys, getClip, putClip, delClip, recMime } from './recordings.js?v=202611271849';
import { ghToken, setGhToken, checkToken, pending, publish, exportClips, markDeleted, unmarkDeleted, isDeleted, ghErrText } from './publish.js?v=202611271849';
import { stop as stopVoice, sayTTS, siteFile, setSiteFiles } from './voice.js?v=202611271849';

const MAX_SEC = 20;
// 녹음이 있는지: 이 기기에서 녹음했거나, 사이트에 올라가 있으면 (다른 기기에서 녹음해서 올린 것도)
const hasRec = key => keys.has(key) || (!!siteFile(key) && !isDeleted(key));
const MIC_KEY = 'dagyeo-mic-v1';
let lines = null;

async function loadLines() {
  lines ||= await fetch('data/voice-lines.json', { cache: 'no-cache' }).then(r => r.json());
  return lines;
}

export async function openStudio({ sheet, back }) {
  const sh = sheet('대사 녹음하기', '대사를 하나씩 녹음해요. 녹음한 대사는 기계 음성 대신 선생님 목소리로 나와요. 녹음하지 않은 대사는 그대로 기계 음성이 읽어요.');
  const all = await loadLines();
  const cats = [...new Set(all.map(l => l.cat))];
  const whos = [...new Set(all.map(l => l.who))];
  let cat = '전체', who = '전체', onlyTodo = false, idx = 0;
  let draft = null; // 이미 녹음이 있는 대사를 새로 녹음했을 때: 바꿀지 고르기 전까지 여기에 둬요
  let stream = null, rec = null, chunks = [], startAt = 0, meterRaf = 0, actx = null, timer = 0, player = null;
  const mime = recMime();

  // ----- 위: 고르기 -----
  const top = el('div', 'studio-top');
  const catSel = el('select', 'studio-select'); catSel.setAttribute('aria-label', '분류');
  const micSel = el('select', 'studio-select'); micSel.setAttribute('aria-label', '입력 장치');
  const todo = el('label', 'toggle'); const todoBox = el('input'); todoBox.type = 'checkbox';
  todo.append(todoBox, el('span', null, '녹음 안 한 대사만'));
  const whoSel = el('select', 'studio-select'); whoSel.setAttribute('aria-label', '말하는 사람');
  const fcat = el('div', 'field'); const lc = el('label', null, '분류'); fcat.append(lc, catSel);
  const fwho = el('div', 'field'); const lw = el('label', null, '말하는 사람'); fwho.append(lw, whoSel);

  const fmic = el('div', 'field'); const lm = el('label', null, '입력 장치 (마이크)'); fmic.append(lm, micSel);
  top.append(fmic, fcat, fwho, todo);
  const progress = el('p', 'note studio-progress');

  // ----- 가운데: 대사 카드 -----
  const card = el('div', 'studio-card');
  const meta = el('div', 'studio-meta');
  const text = el('p', 'studio-line');
  const state = el('div', 'studio-state');
  const meter = el('div', 'studio-meter'); const meterFill = el('i'); meter.append(meterFill);
  card.append(meta, text, meter, state);

  // ----- 아래: 버튼 -----
  const recBtn = el('button', 'btn primary big studio-rec');
  const playBtn = el('button', 'btn big', '들어 보기');
  const ttsBtn = el('button', 'btn big', '기계 음성');
  const delBtn = el('button', 'btn big', '지우기');
  const prevBtn = el('button', 'btn big', '◀ 이전');
  const nextBtn = el('button', 'btn primary big', '다음 ▶');
  const row1 = el('div', 'row'); row1.append(recBtn, playBtn, ttsBtn, delBtn);
  // 새로 녹음한 것으로 바꿀지 고르기
  const choice = el('div', 'studio-choice'); choice.hidden = true;
  const cNew = el('button', 'btn big', '▶ 새 녹음 듣기');
  const cOld = el('button', 'btn big', '▶ 원래 녹음 듣기');
  const cKeep = el('button', 'btn big', '원래 녹음 그대로 두기');
  const cSwap = el('button', 'btn primary big', '새 녹음으로 바꾸기');
  const cRow1 = el('div', 'row'); cRow1.append(cNew, cOld);
  const cRow2 = el('div', 'row'); cRow2.append(cKeep, cSwap);
  choice.append(el('p', 'studio-choice-q', '이 대사는 이미 녹음돼 있어요. 새 녹음으로 바꿀까요?'), cRow1, cRow2);
  const row2 = el('div', 'row'); const backBtn = el('button', 'btn big', '나가기');
  row2.append(backBtn, prevBtn, nextBtn);
  const warnNote = el('p', 'note', '');
  // ----- 사이트에 올리기 -----
  const pub = el('div', 'studio-pub');
  const pubTitle = el('h3', null, '사이트에 올리기');
  const pubInfo = el('p', 'note');
  const pubBtn = el('button', 'btn primary big', '사이트에 올리기');
  const expBtn = el('button', 'btn big', '녹음 파일 내보내기');
  const keyBtn = el('button', 'btn', 'GitHub 열쇠 넣기');
  const pubRow = el('div', 'row'); pubRow.style.justifyContent = 'flex-start'; pubRow.append(pubBtn, expBtn, keyBtn);
  const keyBox = el('div', 'studio-key'); keyBox.hidden = true;
  pub.append(pubTitle, pubInfo, pubRow, keyBox);
  sh.append(top, progress, card, choice, row1, row2, warnNote, pub);

  async function refreshPub() {
    const p = await pending();
    const n = p.changed.length, d = p.deleted.length;
    pubInfo.textContent = (n || d)
      ? `${[n && `이 기기에만 있는 녹음 ${n}개`, d && `사이트에서 지울 녹음 ${d}개`].filter(Boolean).join(', ')}. 「사이트에 올리기」를 누르면 1~2분 뒤 모든 기기에 반영돼요.`
      : '모든 녹음이 사이트에 올라가 있어요. 새로 녹음하거나 바꾸면 다시 올려 주세요.';
    pubBtn.disabled = !(n || d);
    keyBtn.textContent = ghToken() ? 'GitHub 열쇠 바꾸기' : 'GitHub 열쇠 넣기';
  }
  function showKeyBox() {
    keyBox.hidden = false; keyBox.innerHTML = '';
    const steps = el('ol', 'studio-steps');
    const s1 = el('li'); const a = el('a', null, 'GitHub 열쇠 만들기 페이지'); a.href = 'https://github.com/settings/personal-access-tokens/new'; a.target = '_blank'; a.rel = 'noopener';
    s1.append(a, document.createTextNode('를 열어요 (YaginKim 계정으로 로그인).'));
    steps.append(s1,
      el('li', null, 'Token name: 다녀오겠습니다 녹음 / Expiration: 1년 (최대로)'),
      el('li', null, 'Repository access: Only select repositories → iamhome'),
      el('li', null, 'Permissions → 「+ Add permissions」 → Contents 체크 → 옆 권한을 Read and write로'),
      el('li', null, '맨 아래 Generate token → 나온 열쇠(github_pat_로 시작)를 복사해서 아래에 붙여 넣어요.'));
    const f = el('div', 'field'); const lb = el('label', null, 'GitHub 열쇠'); const inp = el('input'); inp.type = 'password'; inp.id = 'gh-token'; lb.htmlFor = 'gh-token'; inp.autocomplete = 'off';
    f.append(lb, inp);
    const msg = el('p', 'note', '열쇠는 이 기기의 브라우저에만 저장돼요. 학생 기기에는 넣지 마세요.');
    const manage = el('p', 'note'); const ma = el('a', null, '지금 쓰는 열쇠 관리 페이지'); ma.href = 'https://github.com/settings/personal-access-tokens/23789869'; ma.target = '_blank'; ma.rel = 'noopener';
    manage.append('이미 만든 열쇠가 있으면 ', ma, '에서 만료 날짜를 보거나, 잃어버렸을 때 Regenerate token으로 새 열쇠를 받을 수 있어요.');
    const ok = el('button', 'btn primary', '열쇠 저장');
    const cancel = el('button', 'btn', '닫기');
    const r = el('div', 'row'); r.style.justifyContent = 'flex-start'; r.append(ok, cancel);
    ok.onclick = async () => {
      const t = inp.value.trim(); if (!t) return;
      ok.disabled = true; msg.textContent = '확인하는 중…';
      try { await checkToken(t); setGhToken(t); keyBox.hidden = true; refreshPub(); notify('GitHub 열쇠를 저장했어요.'); }
      catch (e) { msg.textContent = ghErrText(e.message); ok.disabled = false; }
    };
    cancel.onclick = () => { keyBox.hidden = true; };
    keyBox.append(manage, steps, f, msg, r);
    setTimeout(() => inp.focus(), 50);
  }
  keyBtn.onclick = showKeyBox;
  pubBtn.onclick = async () => {
    if (!ghToken()) return showKeyBox();
    pubBtn.disabled = true;
    try {
      const r = await publish((i, n) => { pubInfo.textContent = `올리는 중… ${i} / ${n}`; });
      if (r.manifest) setSiteFiles(r.manifest);
      pubInfo.textContent = `${r.added}개를 올렸어요${r.removed ? `, ${r.removed}개를 지웠어요` : ''}. 1~2분 뒤 모든 기기에서 들려요.`;
      notify('녹음을 사이트에 올렸어요.');
    } catch (e) {
      pubInfo.textContent = ghErrText(e.message);
      if (e.message === 'token' || e.message === 'perm') showKeyBox();
    }
    pubBtn.disabled = false;
    setTimeout(refreshPub, 4000);
  };
  expBtn.onclick = async () => { const n = await exportClips(); notify(`녹음 ${n}개를 파일 하나로 내보냈어요.`); };

  if (mime === null || !navigator.mediaDevices?.getUserMedia) warnNote.textContent = '이 브라우저는 녹음을 지원하지 않아요. 크롬이나 사파리 최신 버전에서 해 주세요.';

  const list = () => all.filter(l => (cat === '전체' || l.cat === cat) && (who === '전체' || l.who === who) && (!onlyTodo || !hasRec(l.key)));
  function fillWhos() {
    whoSel.innerHTML = '';
    for (const w of ['전체', ...whos]) {
      const n = all.filter(l => w === '전체' || l.who === w);
      const o = el('option', null, `${w} (${n.filter(l => hasRec(l.key)).length}/${n.length})`);
      o.value = w; o.selected = w === who; whoSel.append(o);
    }
  }
  function fillCats() {
    catSel.innerHTML = '';
    for (const c of ['전체', ...cats]) {
      const n = all.filter(l => c === '전체' || l.cat === c);
      const o = el('option', null, `${c.replace(/^\d+\.\s*/, '')} (${n.filter(l => hasRec(l.key)).length}/${n.length})`);
      o.value = c; o.selected = c === cat; catSel.append(o);
    }
  }
  async function fillMics() {
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch { /* */ }
    const saved = localStorage.getItem(MIC_KEY);
    micSel.innerHTML = '';
    if (!devs.length) { const o = el('option', null, '기본 마이크'); o.value = ''; micSel.append(o); return; }
    devs.forEach((d, i) => {
      const o = el('option', null, d.label || `마이크 ${i + 1} (녹음을 한 번 하면 이름이 보여요)`);
      o.value = d.deviceId; o.selected = d.deviceId === saved; micSel.append(o);
    });
  }

  function draw() {
    const L = list();
    if (idx >= L.length) idx = Math.max(0, L.length - 1);
    const l = L[idx];
    const done = all.filter(x => hasRec(x.key)).length;
    progress.textContent = `녹음한 대사 ${done} / ${all.length}` + (L.length ? ` · 지금 ${idx + 1} / ${L.length}번째` : '');
    if (!l) {
      meta.textContent = ''; text.textContent = onlyTodo ? '이 분류는 모두 녹음했어요!' : '대사가 없어요.'; state.textContent = '';
      [recBtn, playBtn, delBtn, ttsBtn, prevBtn, nextBtn].forEach(b => { b.disabled = true; });
      return;
    }
    meta.innerHTML = '';
    meta.append(el('span', 'studio-no', `${l.no}`), el('span', 'studio-who', l.who), el('span', 'studio-cat', l.cat.replace(/^\d+\.\s*/, '')));
    text.textContent = l.text;
    const has = hasRec(l.key);
    const recording = !!rec;
    const choosing = !!draft && draft.key === l.key;
    choice.hidden = !choosing;
    row1.hidden = choosing;
    recBtn.textContent = recording ? '■ 멈추기' : has ? '● 다시 녹음' : '● 녹음';
    recBtn.classList.toggle('on', recording);
    recBtn.disabled = mime === null;
    playBtn.disabled = !has || recording;
    delBtn.disabled = !has || recording;
    ttsBtn.disabled = recording;
    prevBtn.disabled = idx === 0 || recording || choosing;
    nextBtn.disabled = choosing || (recording ? false : idx >= L.length - 1);
    nextBtn.textContent = recording ? '멈추고 다음 ▶' : '다음 ▶';
    if (!recording && !choosing) {
      state.textContent = has ? '녹음돼 있어요.' : '아직 녹음하지 않았어요.';
    }
    if (choosing) state.textContent = '새 녹음을 들어 보고 골라요.';
    state.classList.toggle('has', has && !recording && !choosing);
  }

  async function openMic() {
    if (stream) return stream;
    const id = micSel.value;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    await fillMics(); // 허락한 뒤에는 마이크 이름이 보여요
    return stream;
  }
  function closeMic() { stream?.getTracks().forEach(t => t.stop()); stream = null; }

  function startMeter(s) {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaStreamSource(s), an = actx.createAnalyser();
    an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      meterFill.style.width = Math.min(100, peak / 128 * 140) + '%';
      meter.classList.toggle('loud', peak > 120);
      const sec = (performance.now() - startAt) / 1000;
      state.textContent = `녹음 중… ${sec.toFixed(1)}초 (최대 ${MAX_SEC}초)`;
      meterRaf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(meterRaf); src.disconnect(); meterFill.style.width = '0%'; meter.classList.remove('loud'); };
  }

  let stopMeter = null;
  async function startRec() {
    stopVoice(); player?.pause();
    let s;
    try { s = await openMic(); } catch (e) {
      warnNote.textContent = e.name === 'NotAllowedError' ? '마이크 사용을 허락해 주세요. 주소창 옆 자물쇠 → 마이크 → 허용.' : '마이크를 찾지 못했어요. 입력 장치를 확인해 주세요.';
      return;
    }
    chunks = [];
    rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const l = list()[idx];
    const done = new Promise(res => { rec.onstop = res; });
    rec.start();
    startAt = performance.now();
    stopMeter = startMeter(s);
    timer = setTimeout(() => stopRec(), MAX_SEC * 1000);
    draw();
    await done;
    const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
    rec = null;
    if (blob.size < 2000) { state.textContent = '너무 짧아요. 다시 녹음해 주세요.'; draw(); return; }
    if (hasRec(l.key)) { // 이미 녹음이 있으면 바로 바꾸지 않고 고르게 해요
      draft = { key: l.key, blob };
      draw(); playBlob(blob);
      return;
    }
    await save(l.key, blob);
  }
  async function save(key, blob) {
    await putClip(key, blob, Date.now(), false);
    unmarkDeleted(key);
    fillCats(); fillWhos(); draw();
    playClip(key);
    state.textContent = '녹음했어요. 이 기기에서는 바로 들려요.';
    refreshPub();
  }
  function stopRec() {
    clearTimeout(timer);
    stopMeter?.(); stopMeter = null;
    if (rec && rec.state !== 'inactive') rec.stop();
  }
  async function playClip(key) {
    const c = await getClip(key);
    if (c) return playBlob(c.blob);
    const f = siteFile(key); // 이 기기에는 없고 사이트에만 있는 녹음
    if (f) { stopVoice(); player?.pause(); player = new Audio(`voice/${f}`); player.play().catch(() => {}); }
  }
  function playBlob(blob) {
    stopVoice();
    player?.pause();
    const url = URL.createObjectURL(blob);
    player = new Audio(url); player.onended = () => URL.revokeObjectURL(url);
    player.play().catch(() => {});
  }

  recBtn.onclick = () => (rec ? stopRec() : startRec());
  cNew.onclick = () => playBlob(draft.blob);
  cOld.onclick = () => playClip(draft.key);
  cKeep.onclick = () => { draft = null; draw(); };
  cSwap.onclick = async () => { const d = draft; draft = null; await save(d.key, d.blob); };
  playBtn.onclick = () => playClip(list()[idx].key);
  ttsBtn.onclick = () => sayTTS(list()[idx].text);
  delBtn.onclick = async () => {
    const l = list()[idx];
    if (!confirm('이 대사의 녹음을 지울까요? 기계 음성으로 돌아가요.')) return;
    const c = await getClip(l.key);
    if (c) await delClip(l.key);
    if (siteFile(l.key) || c?.publishedAt) markDeleted(l.key);
    fillCats(); fillWhos(); draw(); refreshPub();
  };
  const go = async d => {
    if (rec) { stopRec(); await new Promise(r => setTimeout(r, 300)); }
    idx = Math.max(0, Math.min(list().length - 1, idx + d)); draw();
  };
  prevBtn.onclick = () => go(-1);
  nextBtn.onclick = () => go(onlyTodo && !rec ? 0 : 1);
  catSel.onchange = () => { cat = catSel.value; idx = 0; draft = null; draw(); };
  whoSel.onchange = () => { who = whoSel.value; idx = 0; draft = null; draw(); };
  todoBox.onchange = () => { onlyTodo = todoBox.checked; idx = 0; draw(); };
  micSel.onchange = () => { try { localStorage.setItem(MIC_KEY, micSel.value); } catch { /* */ } closeMic(); };
  const onKey = e => {
    if (e.target.closest?.('select, input')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); nextBtn.click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevBtn.click(); }
  };
  document.addEventListener('keydown', onKey);
  backBtn.onclick = () => { stopRec(); closeMic(); draft = null; player?.pause(); document.removeEventListener('keydown', onKey); back(); };

  fillCats(); fillWhos(); await fillMics(); draw(); refreshPub();
}
