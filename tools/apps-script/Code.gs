// 「다녀오겠습니다」 학생 기록 저장소 (구글 스프레드시트 + Apps Script)
// 쓰는 법은 docs/구글시트-저장.md 에 있어요.
//
// ▼ 이 줄만 고치세요. 따옴표 안을 선생님만 아는 비밀번호로 바꿔요 (영어·숫자 8자 이상 추천).
//   게임의 「선생님 → 기기 사이 저장」에도 똑같이 넣어요.
const SECRET = '여기에-비밀번호';

// 아래는 고치지 않아도 돼요.
const SHEET = '기록';
const HEAD = ['학년-반-번호', '학생', '마지막 저장', '난이도', '끝낸 곳', '기록 (고치지 마세요)'];

function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out({ ok: false, error: 'bad-json' }); }
  if (SECRET === '여기에-비밀번호') return out({ ok: false, error: 'secret-not-set' });
  if (req.key !== SECRET) return out({ ok: false, error: 'key' });
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheet_();
    const rows = sh.getDataRange().getValues();
    const find = id => rows.findIndex((r, i) => i > 0 && String(r[0]) === String(id));
    const dataAt = i => { try { return JSON.parse(rows[i][5]); } catch (err) { return null; } };
    switch (req.action) {
      case 'ping':
        return out({ ok: true, count: rows.length - 1 });
      case 'load': {
        const i = find(req.id);
        return out({ ok: true, data: i > 0 ? dataAt(i) : null });
      }
      case 'list':
        return out({ ok: true, list: rows.slice(1).map((r, j) => {
          const d = dataAt(j + 1) || {};
          return { id: String(r[0]), updated: d.updated || 0, level: d.level, cleared: d.cleared || [], tutorialDone: !!d.tutorialDone };
        }) });
      case 'save': {
        const d = req.data;
        if (!d || !/^\d+-\d+-\d+$/.test(String(req.id))) return out({ ok: false, error: 'bad-id' });
        const i = find(req.id);
        if (i > 0) {
          const old = dataAt(i);
          if (old && (old.updated || 0) > (d.updated || 0)) return out({ ok: true, stale: true });
        }
        const p = String(req.id).split('-');
        const row = [String(req.id), p[0] + '학년 ' + p[1] + '반 ' + p[2] + '번', new Date(d.updated || Date.now()), d.level || '',
          (d.cleared || []).length, JSON.stringify(d)];
        const at = i > 0 ? i + 1 : sh.getLastRow() + 1;
        sh.getRange(at, 1).setNumberFormat('@');
        sh.getRange(at, 1, 1, row.length).setValues([row]);
        return out({ ok: true });
      }
      case 'delete': {
        const i = find(req.id);
        if (i > 0) sh.deleteRow(i + 1);
        return out({ ok: true });
      }
    }
    return out({ ok: false, error: 'action' });
  } finally {
    lock.releaseLock();
  }
}

// 브라우저에서 주소를 열어 보면 연결됐는지 알려 줘요
function doGet() {
  return out({ ok: true, app: 'dagyeo', ready: SECRET !== '여기에-비밀번호' });
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.getRange('A:A').setNumberFormat('@'); // 3-2-5 가 날짜로 바뀌지 않도록
    sh.setFrozenRows(1);
    sh.setColumnWidth(6, 120);
  }
  return sh;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
