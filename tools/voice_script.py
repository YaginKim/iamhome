# 녹음 대본 만들기: 게임에서 소리로 읽는 대사를 모두 찾아서 분류한 표를 만듭니다.
#   python3 tools/voice_script.py
# 결과: docs/대사-녹음-대본.xlsx, docs/대사-녹음-대본.csv
# 녹음 파일 이름은 대사 글자로 정해져요 (js/voice.js 의 voiceKey 와 같은 계산).
# 대사 글자를 고치면 파일 이름도 바뀌므로, 고친 대사는 다시 녹음해야 해요.
import csv, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HANGUL = re.compile(r'[가-힣]')


def voice_key(text):
    """js/voice.js 의 voiceKey 와 똑같이: 공백 정리 후 UTF-16 단위 FNV-1a 32비트."""
    t = re.sub(r'\s+', ' ', text.strip())
    b = t.encode('utf-16-le')
    h = 0x811c9dc5
    for i in range(0, len(b), 2):
        h ^= int.from_bytes(b[i:i + 2], 'little')
        h = (h * 0x01000193) & 0xffffffff
    return 'v%08x' % h


LINES = {}
with open(ROOT / 'data/lines.csv', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        LINES[r['id']] = r['text']

NAMES = {'mom': '엄마', 'owner': '분식점 사장님', 'teller': '은행 직원', 'teacher': '선생님', 'clerk': '반장', 'helper': '체육 도우미',
         'parent': '운동회 부스 도우미', 'friend': '짝꿍', 'cashier': '계산대 점원', 'grocer': '채소 가게 사장님', 'baker': '떡집 사장님',
         'stylist': '미용사 선생님', 'officer': '민원실 직원', 'guard': '안내 데스크 직원', 'guide': '견학 안내 선생님', 'giftclerk': '기념품 가게 직원',
         'null': '안내 (내레이션)'}

# 함수 이름 → 분류
CATEGORY = [
    ('1. 튜토리얼 (집)', ['startTutorial', 'tutorialLesson', 'idCard', 'tutorialHome', 'moneyIntro', 'tryCard']),
    ('2. 엄마 (집)', ['momTalk', 'nextStage', 'leaveForSchool', 'giveErrand', 'deliverErrand', 'comeHome', 'showMemo', 'freeRoamGoal']),
    ('3. 학교 (교실·체육관·운동장)', ['giveSchoolMission', 'teacherTalk', 'missionDone', 'rentalBorrow', 'rentalReturn', 'tokenPay']),
    ('4. 가게 계산대', ['sellerTalk', 'counterGreet', 'counterBye', 'counterBuy', 'orderItems', 'hungryOffer', 'afterCounter', 'pay', 'keypadAsk']),
    ('5. 편의점·대형마트·미용실', ['kioskTalk', 'kiosk', 'martGoal', 'martObject', 'expiryPick', 'holdStill']),
    ('6. 교육지원청·교육부', ['runStep', 'stepGoal', 'waitTurn', 'formFill']),
    ('7. 은행', ['bankTalk', 'deposit', 'enterBank']),
    ('8. 인사·실수·꿈이든 카드 확인', ['greetLoop', 'mistake', 'maybeIdCheck', 'idCheck']),
    ('9. 스테이지 완료·되돌아보기·엔딩', ['finishStage', 'clearScreen', 'buildReview', 'review', 'endingScreen']),
]
CAT_OF = {fn: c for c, fns in CATEGORY for fn in fns}
CAT_BY_ID = [('home.', '1. 튜토리얼 (집)'), ('shop.', '4. 가게 계산대'), ('bank.', '7. 은행'), ('idcheck.', '8. 인사·실수·꿈이든 카드 확인'),
             ('clear.', '9. 스테이지 완료·되돌아보기·엔딩'), ('ending.', '9. 스테이지 완료·되돌아보기·엔딩'), ('tutorial.', '1. 튜토리얼 (집)'),
             ('card.', '4. 가게 계산대'), ('pay.', '4. 가게 계산대')]
OTHER = '10. 기타 알림'


def read_call(src, i):
    """src[i] 가 '(' 일 때 짝이 맞는 ')' 까지 읽고, 맨 위 단계의 인자 목록(문자열)을 돌려줘요."""
    depth, args, cur, j, n = 0, [], '', i, len(src)
    while j < n:
        c = src[j]
        if c in '\'"`':
            k = j + 1
            while k < n:
                if src[k] == '\\':
                    k += 2; continue
                if c == '`' and src.startswith('${', k):
                    d = 1; k += 2
                    while k < n and d:
                        d += {'{': 1, '}': -1}.get(src[k], 0); k += 1
                    continue
                if src[k] == c:
                    break
                k += 1
            cur += src[j:k + 1]; j = k + 1; continue
        if c in '([{':
            depth += 1
            if depth == 1:
                j += 1; continue
        elif c in ')]}':
            depth -= 1
            if depth == 0:
                args.append(cur.strip()); return args, j
        elif c == ',' and depth == 1:
            args.append(cur.strip()); cur = ''; j += 1; continue
        cur += c; j += 1
    return args, j


def literal(arg):
    """인자가 문자열 하나면 (글자, 바뀌는-말-있음) 을 돌려줘요."""
    m = re.fullmatch(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", arg.strip(), re.S)
    if not m:
        return None
    if m.group(3) is not None:
        t = m.group(3)
        return re.sub(r'\$\{[^}]*\}', '○○', t), '${' in t
    return (m.group(1) if m.group(1) is not None else m.group(2)).replace("\\'", "'"), False


rows, seen = [], {}


def add(cat, who, text, variable, src_note):
    text = re.sub(r'\s+', ' ', text.strip())
    if not text or not HANGUL.search(text):
        return
    if '{' in text and re.search(r'\{\w+\}', text):  # lines.csv 의 {n} 같은 바뀌는 말
        variable = True
    key = None if variable else voice_key(text)
    k = (text, variable)
    if k in seen:
        return
    seen[k] = True
    rows.append({'cat': cat, 'who': who, 'text': text, 'file': (key + '.mp3') if key else '', 'variable': variable, 'src': src_note})


def scan(path):
    src = (ROOT / path).read_text(encoding='utf-8')
    funcs = [(m.start(), m.group(1)) for m in re.finditer(r'^(?:export\s+)?(?:async\s+)?function\s+(\w+)', src, re.M)]

    def fn_at(pos):
        name = None
        for p, n in funcs:
            if p > pos:
                break
            name = n
        return name

    def texts_in(arg):
        """인자 안의 모든 문자열 (a ? '가' : '나' 같은 경우)"""
        out = []
        for m2 in re.finditer(r"'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`", arg):
            r = text_of(m2.group(0))
            if r: out.append(r)
        return out

    def text_of(arg):
        lit = literal(arg)
        if not lit:
            return None
        t, var = lit
        if t in LINES:  # 대사 ID
            return LINES[t], False
        return t, var

    for m in re.finditer(r'\b(talk|choose|greetLoop|notify|say|ownerSays|warn|step|ask)\(', src):
        call = m.group(1)
        args, _ = read_call(src, m.end() - 1)
        fn = fn_at(m.start())
        cat = CAT_OF.get(fn, OTHER)
        line_no = src.count('\n', 0, m.start()) + 1
        note = f'{path}:{line_no}'
        who_lit = literal(args[0]) if args else None
        a0 = args[0] if args else ''
        who = (NAMES.get(who_lit[0], '가게 사람') if who_lit else '안내 (내레이션)' if a0 == 'null'
               else '안내 선생님·민원실 직원' if 'reviewBy' in a0 else '엄마·선생님' if 'giver' in a0
               else '은행 직원' if 'teller' in a0 else '가게 사람')
        if call in ('talk', 'choose') and len(args) > 1:
            for r in texts_in(args[1]): add(cat, who, r[0], r[1], note)
        elif call == 'greetLoop' and len(args) > 3:
            r = text_of(args[1])
            if r: add(cat, '안내 (내레이션)', r[0], r[1], note)
            for a in [args[2]] + re.findall(r"'[^']*'", args[3]):
                r = text_of(a)
                if r: add(cat, '나 (학생 대답)', r[0], r[1], note)
        elif call == 'warn' and len(args) > 1:
            a, b = literal(args[0]), literal(args[1])
            if a and b and a[0] in LINES and b[0] in LINES:
                add(cat, '안내 (내레이션)', LINES[a[0]] + ' ' + LINES[b[0]], False, note)
        elif call in ('notify', 'say', 'step', 'ask') and args:
            found = texts_in(args[0])
            for r in found: add(cat, '안내 (내레이션)', r[0], r[1], note)
            if not found and 'textContent' in args[0]:
                # msg.textContent = '…'; say(msg.textContent)
                prev = src[max(0, m.start() - 300):m.start()]
                lm = re.findall(r"textContent = ('[^']*'|`[^`]*`)", prev)
                if lm:
                    r = text_of(lm[-1])
                    if r: add(cat, '안내 (내레이션)', r[0], r[1], note)
        elif call == 'ownerSays' and len(args) > 1:
            for r in texts_in(args[1]): add(cat, '가게 사람', r[0], r[1], note)
    for m in re.finditer(r"(?:const|let)\s+(prompt|title|text|lineText)\s*=\s*([^;\n]+)", src):
        fn = fn_at(m.start()); note = f'{path}:{src.count(chr(10), 0, m.start()) + 1}'
        for r in texts_in(m.group(2)): add(CAT_OF.get(fn, OTHER), '안내 (내레이션)', r[0], r[1], note)
    # 여러 줄에 걸친 a ? '가' : '나' 대사와 ownerLine 뒤에 붙는 말
    for m in re.finditer(r"(?:ownerLine\s*=|^\s*:)\s*([^;\n]*'[^'\n]*[가-힣][^'\n]*'[^;\n]*)", src, re.M):
        fn = fn_at(m.start()); note = f'{path}:{src.count(chr(10), 0, m.start()) + 1}'
        for r in texts_in(m.group(1)): add(CAT_OF.get(fn, OTHER), '안내 (내레이션)', r[0], r[1], note)
    for m in re.finditer(r"\bq: ('[^']*'|`[^`]*`)", src):
        r = text_of(m.group(1))
        if r: add('9. 스테이지 완료·되돌아보기·엔딩', '안내 (내레이션)', r[0], r[1], f'{path}:{src.count(chr(10), 0, m.start()) + 1}')
    # 스테이지 목록의 인사말 (학생이 고르면 읽어 줘요)
    for m in re.finditer(r"(greet|bye): \['([^']*)', \[([^\]]*)\]\]", src):
        line_no = src.count('\n', 0, m.start()) + 1
        for t in [m.group(2)] + re.findall(r"'([^']*)'", m.group(3)):
            add('8. 인사·실수·꿈이든 카드 확인', '나 (학생 대답)', t, False, f'{path}:{line_no}')
    # 계산 화면의 가게 사람 말
    for m in re.finditer(r"ownerLine(?:\s*=|:)\s*('[^']*'|`[^`]*`)", src):
        r = literal(m.group(1))
        if r:
            add('4. 가게 계산대', '가게 사람', r[0], r[1], f'{path}:{src.count(chr(10), 0, m.start()) + 1}')


for p in ['js/game.js', 'js/pay.js', 'js/ui.js']:
    scan(p)
# lines.csv 에만 있고 코드에서 못 찾은 대사도 넣어요 (제목 문구는 읽지 않으니 빼요)
import json as _json
cfg = _json.loads((ROOT / 'data/config.json').read_text(encoding='utf-8'))
for t in cfg.get('nonPaymentCards', {}).values():
    add('4. 가게 계산대', '안내 (내레이션)', t, False, 'data/config.json:nonPaymentCards')
for ev in cfg.get('accountEvents', []):
    add('10. 기타 알림', '안내 (내레이션)', ev['message'], False, 'data/config.json:accountEvents')
if cfg.get('mealCard', {}).get('rejectMessage'):
    add('4. 가게 계산대', '안내 (내레이션)', cfg['mealCard']['rejectMessage'], False, 'data/config.json:mealCard')
# 하트 설명은 난이도마다 숫자가 달라서 숫자별로 따로 넣어요
for n in sorted({lv.get('triesBeforeIdCheck') for lv in cfg.get('levels', {}).values() if lv.get('triesBeforeIdCheck')}):
    if 'home.mom.hearts' in LINES:
        add('1. 튜토리얼 (집)', '엄마', LINES['home.mom.hearts'].replace('{n}', str(n)), False, 'data/lines.csv:home.mom.hearts')
# 물건 이름 (물건을 누르면 이름을 읽어 줘요)
with open(ROOT / 'data/items.csv', encoding='utf-8') as f:
    for it in csv.DictReader(f):
        add('11. 물건 이름', '안내 (물건 이름)', it['name'], False, 'data/items.csv')
pay_src = (ROOT / 'js/pay.js').read_text(encoding='utf-8')
mn = re.search(r'const MONEY_NAME = \{([^}]*)\}', pay_src)
for t in re.findall(r"'([^']*)'", mn.group(1) if mn else ''):
    add('4. 가게 계산대', '안내 (돈 이름)', t, False, 'js/pay.js:MONEY_NAME')
ALL_SRC = ''.join((ROOT / p).read_text(encoding='utf-8') for p in ['js/game.js', 'js/pay.js', 'js/ui.js'])
for id_, t in LINES.items():
    if id_ in ('title.copy',):
        continue
    cat = next((c for pre, c in CAT_BY_ID if id_.startswith(pre)), OTHER)
    who = '엄마' if '.mom.' in id_ else '은행 직원' if id_.startswith('bank.') else '가게 사람' if '.owner.' in id_ else '안내 (내레이션)'
    add(cat, who, t, False, f'data/lines.csv:{id_}')

rows.sort(key=lambda r: (int(r['cat'].split('.')[0]), r['variable'], r['who']))
for i, r in enumerate(rows, 1):
    r['no'] = i

# ---- 게임 안 녹음 화면용 목록 (녹음할 수 있는 대사만) ----
import json
(ROOT / 'data/voice-lines.json').write_text(json.dumps(
    [{'no': r['no'], 'cat': r['cat'], 'who': r['who'], 'text': r['text'], 'key': r['file'][:-4]} for r in rows if not r['variable']],
    ensure_ascii=False, indent=0), encoding='utf-8')

# ---- CSV (엑셀에서 바로 열리게 BOM 포함) ----
out_csv = ROOT / 'docs/대사-녹음-대본.csv'
with open(out_csv, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['번호', '분류', '말하는 사람', '대사', '녹음 파일 이름', '녹음', '코드 위치'])
    for r in rows:
        w.writerow([r['no'], r['cat'], r['who'], r['text'], r['file'], '바뀌는 말이 있어서 TTS로 읽어요' if r['variable'] else '녹음할 수 있어요', r['src']])

# ---- 엑셀 ----
try:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
except ImportError:
    print('openpyxl 이 없어서 CSV만 만들었어요.'); sys.exit()

wb = Workbook()
guide = wb.active
guide.title = '녹음 방법'
how = [
    ['「다녀오겠습니다」 대사 녹음 대본'],
    [],
    ['1', '분류별 탭에서 녹음할 대사를 골라 녹음해요. 다 하지 않아도 돼요. 녹음하지 않은 대사는 지금처럼 TTS가 읽어요.'],
    ['2', '파일은 mp3로, 이름은 「녹음 파일 이름」 칸에 적힌 그대로 저장해요. 예: v1a2b3c4d.mp3'],
    ['', '이름 붙이기가 어려우면 「번호」로 이름을 붙여(예: 12.mp3) 보내 주셔도 돼요. 바꿔서 넣어 드려요.'],
    ['3', '노란 줄은 금액·이름처럼 바뀌는 말이 들어 있어서 녹음해도 쓸 수 없어요. 참고로만 보세요. (○○ 자리가 바뀌는 말)'],
    ['4', '대사 글자를 고치면 파일 이름도 바뀌어요. 고친 대사는 다시 녹음해야 해요.'],
    ['5', '녹음 파일을 voice 폴더에 넣고 python3 tools/voice_manifest.py 를 실행하면 게임에 적용돼요. (Claude에게 파일을 주시면 대신 넣어 드려요)'],
    [],
    ['녹음 팁', '조용한 곳에서, 문장 앞뒤 빈소리는 짧게(0.2초쯤). 학생이 따라 하기 쉽도록 천천히 또렷하게.'],
    [],
    ['분류', '대사 수', '녹음할 수 있는 대사'],
]
for row in how:
    guide.append(row)
cats = sorted({r['cat'] for r in rows}, key=lambda c: int(c.split('.')[0]))
for c in cats:
    rs = [r for r in rows if r['cat'] == c]
    guide.append([c, len(rs), sum(1 for r in rs if not r['variable'])])
guide.append(['합계', len(rows), sum(1 for r in rows if not r['variable'])])
guide['A1'].font = Font(bold=True, size=14)
guide.column_dimensions['A'].width = 34
guide.column_dimensions['B'].width = 90
guide.column_dimensions['C'].width = 20

head_fill = PatternFill('solid', fgColor='22203A')
var_fill = PatternFill('solid', fgColor='FFF3C4')
headers = ['번호', '말하는 사람', '대사', '녹음 파일 이름', '녹음', '녹음 완료']
widths = [7, 20, 70, 18, 28, 11]


def sheet(title, rs):
    ws = wb.create_sheet(title[:31].replace('/', '·'))
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF'); c.fill = head_fill
    for r in rs:
        ws.append([r['no'], r['who'], r['text'], r['file'], '바뀌는 말 → TTS' if r['variable'] else '녹음 가능', ''])
        if r['variable']:
            for c in ws[ws.max_row]:
                c.fill = var_fill
    for i, wdt in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = wdt
    for row in ws.iter_rows(min_row=2):
        row[2].alignment = Alignment(wrap_text=True, vertical='top')
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions


for c in cats:
    sheet(re.sub(r'^\d+\.\s*', '', c), [r for r in rows if r['cat'] == c])
sheet('전체', rows)
out_x = ROOT / 'docs/대사-녹음-대본.xlsx'
wb.save(out_x)
print(f'{len(rows)}개 대사 (녹음 가능 {sum(1 for r in rows if not r["variable"])}개) → {out_csv.name}, {out_x.name}')
