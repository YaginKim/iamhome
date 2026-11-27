// data/ 폴더의 CSV·JSON을 읽습니다. 품목과 규칙은 코드가 아니라 이 파일들에서 고칩니다.
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export const LEVELS = ['하', '중', '상'];
export const levelIndex = l => LEVELS.indexOf(l);

export async function loadData() {
  const [itemsText, config, linesText] = await Promise.all([
    fetch('data/items.csv').then(r => r.text()),
    fetch('data/config.json').then(r => r.json()),
    fetch('data/lines.csv').then(r => r.text()),
  ]);
  const items = parseCSV(itemsText).map(r => ({
    ...r,
    price: r.price ? Number(r.price) : null,
    heal: r.heal ? Number(r.heal) : 0,
    payment: r.payment ? r.payment.split('|') : [],
  }));
  const lines = Object.fromEntries(parseCSV(linesText).map(r => [r.id, r.text]));
  return { items, config, lines };
}

// maxOverride: 하 단계에서도 물건 값이 비싼 가게(시장·미용실)는 이 값까지 보여 줘요
export function itemsFor(data, stage, level, maxOverride) {
  const cfg = data.config.levels[level];
  const max = Math.max(cfg.maxPrice, maxOverride || 0);
  return data.items.filter(it => it.stage === stage
    && levelIndex(it.min_level) <= levelIndex(level)
    && (it.price == null || it.price <= max));
}

export const won = n => n.toLocaleString('ko-KR') + '원';
