"""방 그림(도트) 만들기: 은행, 교실
사용법: python3 tools/room_art.py
결과: assets/rooms/bank.png (224x128), assets/rooms/classroom.png (224x144)

- 1칸 = 16x16픽셀. 걸을 수 있는 곳·막힌 곳은 js/engine.js 의 칸 지도(bankMap, classroomMap)를 따릅니다.
- 사람은 게임이 따로 그리니 그림에 넣지 않습니다.
"""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'rooms'
DRAFT = ROOT / 'docs' / 'room-drafts'   # 확인 전 초안 (게임에는 아직 안 씀)
T = 16


def hx(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


class Canvas:
    def __init__(self, w, h, bg='#22203a'):
        self.w, self.h = w, h
        self.im = Image.new('RGBA', (w, h), hx(bg))
        self.px = self.im.load()

    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = hx(c) if isinstance(c, str) else c

    def get(self, x, y):
        return self.px[x, y]

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.p(i, j, c)

    def box(self, x, y, w, h, fill, line='#22203a'):
        """테두리 있는 상자"""
        self.rect(x, y, w, h, line)
        self.rect(x + 1, y + 1, w - 2, h - 2, fill)

    def hline(self, x, y, w, c):
        self.rect(x, y, w, 1, c)

    def vline(self, x, y, h, c):
        self.rect(x, y, 1, h, c)

    def dither(self, x, y, w, h, c, phase=0):
        for j in range(y, y + h):
            for i in range(x, x + w):
                if (i + j + phase) % 2 == 0:
                    self.p(i, j, c)

    def blend(self, x, y, w, h, c, a):
        """반투명 덧칠(빛, 그림자). 결과는 불투명 픽셀"""
        r, g, b, _ = hx(c)
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < self.w and 0 <= j < self.h:
                    o = self.px[i, j]
                    self.px[i, j] = (round(o[0] + (r - o[0]) * a), round(o[1] + (g - o[1]) * a), round(o[2] + (b - o[2]) * a), 255)

    def sprite(self, x, y, rows, pal):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in pal:
                    self.p(x + i, y + j, pal[ch])

    def save(self, path, scale=1):
        im = self.im if scale == 1 else self.im.resize((self.w * scale, self.h * scale), Image.NEAREST)
        im.save(path)


K = '#22203a'  # 테두리(게임 공통)

# 3x5 숫자·글자
GLYPH = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
    '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
    'A': ['010', '101', '111', '101', '101'], 'T': ['111', '010', '010', '010', '010'],
    'M': ['101', '111', '111', '101', '101'], '/': ['001', '001', '010', '100', '100'],
}


def text(cv, x, y, s, c):
    for ch in s:
        g = GLYPH.get(ch)
        if g:
            for j, row in enumerate(g):
                for i, b in enumerate(row):
                    if b == '1':
                        cv.p(x + i, y + j, c)
        x += 4


def plant(cv, x, y):
    """화분 (x,y = 왼쪽 위, 14x22)"""
    L1, L2, L3 = '#3c7840', '#5ea24e', '#8cd06a'
    leaves = [
        '.....kk..kk...',
        '....k21kk12k..',
        '..kk2321k32k..',
        '.k1232k2k21kk.',
        'k12232k22k232k',
        'k1223k2k1k22k.',
        '.k122k2kk12k..',
        '..kk1k22kk1k..',
        '.k21k12k2k12k.',
        'k232kk2kk2232k',
        'k1221k1k12221k',
        '.k111k1k1111k.',
        '..kkkk1kkkkk..',
    ]
    pot = [
        '..kkkkkkkkkk..',
        '.kaaaaaaaaaak.',
        '.kbbbbbbbbbbk.',
        '..kccbbbbbck..',
        '..kccbbbbbck..',
        '..kccbbbbbck..',
        '..kccbbbbbck..',
        '...kccbbbck...',
        '...kkkkkkkk...',
    ]
    cv.sprite(x, y, leaves, {'k': K, '1': L1, '2': L2, '3': L3})
    cv.sprite(x, y + 13, pot, {'k': K, 'a': '#f8f6f0', 'b': '#e8e4da', 'c': '#bcb6a8'})


# ======================================================================
# 은행 224x128 (14x8칸)
#   0 xxxxxxxxxxxxxx      x = 벽 바깥(막힘)   W = 뒷벽
#   1 xWWWWWWWWWWWWx      q = 바닥             c = 창구(계산대)
#   2 xqqqqqqqqqAqqx      A = ATM              D = 문
#   3 xcccccccccqqqx      직원 (5,2), 손님이 서는 곳 (5,4)
#   4~6 바닥, 7 xxxxxxDxxxxxxx
# ======================================================================
def bank():
    cv = Canvas(224, 128)
    NAVY, NAVY2, NAVY3 = '#34407a', '#2a3466', '#4a5894'

    # ---------- 바닥: 크림색 대리석 타일 ----------
    F1, F2, FG, FH = '#efe6d2', '#e6dac0', '#d3c4a4', '#fbf6ea'
    for ty in range(2, 7):
        for tx in range(1, 13):
            x0, y0 = tx * T, ty * T
            cv.rect(x0, y0, T, T, F1 if (tx + ty) % 2 == 0 else F2)
            cv.hline(x0, y0, T, FG)
            cv.vline(x0, y0, T, FG)
            # 대리석 결
            if (tx * 7 + ty * 3) % 5 == 0:
                cv.p(x0 + 4, y0 + 6, FG); cv.p(x0 + 5, y0 + 7, FG); cv.p(x0 + 6, y0 + 7, FG); cv.p(x0 + 7, y0 + 8, FG)
            if (tx * 5 + ty) % 4 == 1:
                cv.p(x0 + 10, y0 + 11, FG); cv.p(x0 + 11, y0 + 10, FG); cv.p(x0 + 12, y0 + 10, FG)
            # 반짝임
            cv.p(x0 + 2, y0 + 2, FH); cv.p(x0 + 3, y0 + 2, FH); cv.p(x0 + 2, y0 + 3, FH)

    # 직원 자리(창구 안쪽) 바닥: 남색 카펫
    C1, C2 = '#5a6aa8', '#4e5d98'
    cv.rect(16, 32, 144, 16, C1)
    for i in range(16, 160, 4):
        cv.p(i, 34, C2); cv.p(i + 2, 38, C2); cv.p(i, 42, C2); cv.p(i + 2, 46, C2)

    # 문에서 창구까지 이어지는 빨간 카펫 (손님 길)
    R1, R2, R3 = '#c84646', '#a83636', '#e8b84a'
    cx0, cx1 = 80, 112  # 5~6번째 칸
    cv.rect(cx0, 64, cx1 - cx0, 48, R1)
    cv.vline(cx0 + 1, 64, 48, R3); cv.vline(cx1 - 2, 64, 48, R3)
    cv.vline(cx0, 64, 48, R2); cv.vline(cx1 - 1, 64, 48, R2)
    for j in range(66, 112, 6):
        cv.p(cx0 + 15, j, R2); cv.p(cx0 + 16, j, R2); cv.p(cx0 + 15, j + 1, R2)

    # 오른쪽 창문에서 들어오는 햇빛
    for j in range(32, 112):
        sx = 172 + (j - 32) // 3
        cv.blend(sx, j, max(0, min(22, 208 - sx)), 1, '#fffbe6', 0.35)

    # ---------- 뒷벽 (0~1줄, 32px) ----------
    cv.rect(16, 0, 192, 32, NAVY)
    cv.rect(16, 0, 192, 2, K)
    cv.hline(16, 2, 192, NAVY3)
    # 벽 패널 이음매
    for x in range(40, 160, 48):
        cv.vline(x, 3, 22, NAVY2)
    # 걸레받이
    cv.rect(16, 25, 192, 1, NAVY3)
    cv.rect(16, 26, 192, 5, '#dcd8e8')
    cv.hline(16, 26, 192, '#f4f2fa')
    cv.hline(16, 31, 192, K)

    # 기둥 (나무)
    cv.rect(160, 0, 10, 31, '#8a5a3a')
    cv.vline(160, 0, 31, '#6c3c24'); cv.vline(169, 0, 31, '#6c3c24'); cv.vline(161, 2, 29, '#a8744c')

    # 큰 유리창 + 도시 풍경 (오른쪽)
    wx, wy, ww, wh = 170, 2, 38, 24
    sky = ['#cfeaf8', '#c0e2f6', '#b2dbf2', '#a4d2ee', '#96caea']
    for j in range(wh):
        cv.hline(wx, wy + j, ww, sky[min(4, j // 5)])
    # 구름
    cv.rect(176, 5, 7, 2, '#f8fcff'); cv.rect(178, 4, 3, 1, '#f8fcff'); cv.rect(196, 8, 6, 1, '#f8fcff'); cv.rect(198, 7, 3, 1, '#f8fcff')
    # 빌딩 실루엣
    B1, B2, BW = '#8eb4d4', '#7aa2c6', '#d8ecf8'
    for bx, bt, bw in [(170, 14, 6), (176, 9, 7), (183, 16, 5), (188, 11, 8), (196, 15, 5), (201, 10, 7)]:
        cv.rect(bx, wy + bt, bw, wh - bt, B1)
        cv.vline(bx + bw - 1, wy + bt, wh - bt, B2)
        for j in range(wy + bt + 2, wy + wh - 1, 3):
            for i in range(bx + 1, bx + bw - 2, 2):
                cv.p(i, j, BW)
    # 창틀
    cv.rect(wx, wy, ww, 1, K)
    cv.vline(wx + 18, wy, wh, '#f8f6f0'); cv.vline(wx + 19, wy, wh, '#bcc4d0')
    cv.hline(wx, wy + 8, ww, '#f8f6f0')
    cv.rect(wx, wy + wh - 1, ww, 1, '#bcc4d0')
    # 유리 반사
    for k in range(6):
        cv.p(173 + k, 20 - k, '#f8fcff'); cv.p(175 + k, 20 - k, '#e8f6fe')
    cv.blend(wx, wy, ww, wh, '#ffffff', 0.08)

    # 매달린 번호 안내판 3개 (창구 1·2·3 위)
    for n, cx in enumerate([40, 88, 136], 1):
        x0 = cx - 14
        cv.vline(x0 + 4, 2, 5, '#9aa2b8'); cv.vline(x0 + 23, 2, 5, '#9aa2b8')
        cv.box(x0, 7, 28, 12, '#f8f6f0')
        cv.hline(x0 + 1, 17, 26, '#dcd8d0')
        cv.rect(x0 + 2, 9, 6, 7, '#3e9a5a')
        text(cv, x0 + 3, 10, str(n), '#f8f6f0')
        cv.hline(x0 + 10, 10, 15, '#3e9a5a'); cv.hline(x0 + 10, 13, 11, '#8cc89c'); cv.hline(x0 + 10, 15, 13, '#8cc89c')

    # 시계
    cv.sprite(59, 5, [
        '..kkkkk..',
        '.kwwwwwk.',
        'kwwwkwwwk',
        'kwwwkwwwk',
        'kwwwkkwwk',
        'kwwwwwwwk',
        'kwwwwwwwk',
        '.kwwwwwk.',
        '..kkkkk..',
    ], {'k': K, 'w': '#f8f6f0'})
    cv.p(63, 4, K)

    # 은행 마크 (동전 모양)
    cv.sprite(108, 9, [
        '..kkkk..',
        '.kyyyyk.',
        'kyYkkyYk',
        'kyyYYyyk',
        'kyYkkyYk',
        '.kYYYYk.',
        '..kkkk..',
    ], {'k': K, 'y': '#f4c846', 'Y': '#c48e28'})

    # 화분 (오른쪽 벽 밑, 창문 앞)
    plant(cv, 192, 10)

    # ---------- ATM (10,2) ----------
    ax, ay = 160, 32
    cv.rect(ax + 1, ay + 14, 15, 2, '#c8bca0')  # 바닥 그림자
    cv.box(ax + 1, ay - 12, 14, 27, '#9aa2b4')
    cv.rect(ax + 2, ay - 11, 12, 5, '#3e9a5a')
    text(cv, ax + 2, ay - 11, 'ATM', '#f8f6f0')
    cv.hline(ax + 2, ay - 6, 12, K)
    cv.box(ax + 3, ay - 4, 10, 8, '#96d2f0')
    cv.rect(ax + 4, ay - 3, 3, 1, '#f8fcff'); cv.p(ax + 4, ay - 2, '#f8fcff')
    cv.hline(ax + 5, ay + 1, 6, '#4278d2')
    cv.rect(ax + 2, ay + 5, 12, 1, '#7a8296')
    cv.rect(ax + 3, ay + 6, 10, 5, '#c8ccd8')
    for i in range(3):
        for j in range(2):
            cv.p(ax + 4 + i * 2, ay + 7 + j * 2, '#4a5070')
    cv.rect(ax + 10, ay + 7, 2, 1, '#f4c846'); cv.rect(ax + 10, ay + 9, 2, 1, '#dc4646')
    cv.vline(ax + 2, ay - 5, 18, '#bcc4d4')
    cv.rect(ax + 2, ay + 12, 12, 2, '#6c7488')

    # ---------- 창구 (3줄, 1~9칸) ----------
    y0 = 48
    x0, x1 = 16, 160
    cv.rect(x0, y0, x1 - x0, 16, K)
    cv.rect(x0, y0 + 1, x1 - x0, 4, '#6cbe72')        # 초록 상판
    cv.hline(x0, y0 + 1, x1 - x0, '#a8e0a0')
    cv.rect(x0, y0 + 5, x1 - x0, 1, '#3e8a4a')
    cv.rect(x0, y0 + 6, x1 - x0, 7, '#f4f2ea')        # 흰 앞판
    cv.hline(x0, y0 + 6, x1 - x0, '#fffdf8')
    cv.rect(x0, y0 + 10, x1 - x0, 2, '#6a74c8')       # 파란 띠
    cv.rect(x0, y0 + 12, x1 - x0, 2, '#d8d4c8')
    cv.hline(x0, y0 + 15, x1 - x0, K)
    cv.vline(x1 - 1, y0, 16, K)
    # 창구 사이 칸막이 이음매
    for x in (63, 111):
        cv.vline(x, y0 + 6, 9, '#c4c0b4')
    # 창구 번호판
    for n, x in enumerate([48, 96, 144], 1):
        cv.rect(x + 1, y0 + 6, 7, 1, '#c4c0b4')
        cv.box(x, y0 - 4, 9, 9, '#f8f6f0')
        cv.hline(x + 1, y0 + 3, 7, '#dcd8d0')
        text(cv, x + 3, y0 - 2, str(n), '#2a3466')
    # 모니터 뒷면 (직원 쪽을 봄)
    for x in (26, 68, 118):
        cv.box(x, 36, 12, 10, '#4a4e60')
        cv.hline(x + 1, 37, 10, '#6a6e82')
        cv.rect(x + 5, 46, 2, 2, K)
    # 서류 받침
    cv.rect(132, 46, 8, 3, '#f8f6f0'); cv.hline(132, 46, 8, K)
    # 유리 칸막이
    for x in (61, 109):
        cv.rect(x, 30, 5, 21, '#bfe4f4')
        cv.vline(x, 30, 21, '#7cb8d8'); cv.vline(x + 4, 30, 21, '#7cb8d8')
        cv.hline(x, 30, 5, '#7cb8d8')
        cv.vline(x + 1, 31, 12, '#f8fcff')
    # 창구 앞 그림자
    cv.blend(16, 64, 144, 2, K, 0.18)

    # ---------- 옆벽·앞벽 ----------
    CAP, CAP2 = '#e8e2f2', '#b8b0cc'
    for x in (12, 208):
        cv.rect(x, 0, 4, 116, CAP)
        cv.vline(x + (3 if x == 12 else 0), 0, 116, CAP2)
    cv.vline(11, 0, 116, K); cv.vline(212, 0, 116, K)
    # 앞벽 윗면
    cv.rect(12, 112, 200, 4, CAP)
    cv.hline(12, 112, 200, CAP2)
    cv.hline(12, 116, 200, K)
    cv.rect(12, 117, 200, 11, K)
    # 앞벽 아래 그림자(바닥)
    cv.blend(16, 108, 192, 4, K, 0.12)

    # 출입문 (6,7): 자동문 + 매트
    dx = 96
    cv.rect(dx - 1, 112, 18, 16, K)
    cv.rect(dx, 112, 16, 16, '#d8d2c4')
    cv.rect(dx + 1, 113, 14, 14, '#5a5670')
    for j in range(115, 126, 2):
        cv.hline(dx + 2, j, 12, '#6e6a86')
    cv.rect(dx - 3, 112, 3, 6, '#9aa2b8'); cv.rect(dx + 16, 112, 3, 6, '#9aa2b8')
    cv.vline(dx - 3, 112, 6, K); cv.vline(dx + 18, 112, 6, K)
    return cv


# ======================================================================
# 교실 224x144 (14x9칸)
#   1 xWWSSSSSWWWWWx  S = 칠판
#   3 xffffffffcccfx  c = 학급 문구 장터 탁자
#   4,6 xffTTffTTffffx  T = 책상
#   7 xffffffDfffffx  D = 문   선생님 (5,2), 반장 (10,2), 짝꿍 (2,5)
# ======================================================================
def classroom():
    cv = Canvas(224, 144)

    # ---------- 나무 바닥 (세로 마루) ----------
    W1, W2, W3, WL, WH = '#c48a52', '#b77e48', '#cf9860', '#8e5a32', '#dcaa72'
    fy0, fy1 = 32, 128
    for x in range(16, 208):
        col = (x - 16) // 8
        base = [W1, W2, W3, W1, W2][col % 5]
        for y in range(fy0, fy1):
            cv.p(x, y, base)
    for col in range(24):
        x = 16 + col * 8
        cv.vline(x, fy0, fy1 - fy0, WL)
        # 마루 이음매 (엇갈림)
        off = (col * 37) % 40
        for jy in range(fy0 + off, fy1, 40):
            cv.hline(x + 1, jy, 7, WL)
        # 나뭇결
        for jy in range(fy0 + (col * 13) % 11, fy1, 11):
            cv.p(x + 3 + col % 3, jy, WH if col % 2 else W2)
            cv.p(x + 3 + col % 3, jy + 1, WH if col % 2 else W2)
    # 왼쪽 창으로 들어오는 햇빛 줄기
    for band, (sy, h) in enumerate([(36, 14), (62, 14), (88, 14), (114, 12)]):
        for j in range(h):
            y = sy + j
            if y >= fy1:
                break
            x0 = 16 + j // 2
            cv.blend(x0, y, 70 - band * 8, 1, '#fff2c8', 0.30)
            cv.blend(x0 + 70 - band * 8, y, 6, 1, '#fff2c8', 0.15)

    # ---------- 뒷벽 ----------
    WALL, WALL2, BLUE, BLUE2 = '#eeeee6', '#dcdcd2', '#9cc8d0', '#7eb0bc'
    cv.rect(16, 0, 192, 32, WALL)
    cv.rect(16, 0, 192, 2, K)
    cv.hline(16, 2, 192, WALL2)
    cv.rect(16, 21, 192, 9, BLUE)
    cv.hline(16, 21, 192, '#c4e2e8')
    cv.hline(16, 28, 192, BLUE2)
    cv.rect(16, 29, 192, 2, '#5e8c98')
    cv.hline(16, 31, 192, K)

    # 칠판 (3~7칸)
    bx, by, bw, bh = 46, 3, 84, 22
    cv.box(bx, by, bw, bh, '#8a5a3a')
    cv.rect(bx + 2, by + 2, bw - 4, bh - 4, '#2f6a4e')
    cv.hline(bx + 2, by + 2, bw - 4, '#3c7a5c')
    # 지운 자국
    for i in range(0, 60, 2):
        cv.p(bx + 8 + i, by + 14 + (i // 6) % 2, '#3e7c60')
    cv.dither(bx + 50, by + 4, 14, 3, '#3e7c60')
    # 분필 글씨: 날짜 + 동그라미 + 줄
    # 날짜(51,7 부터)는 게임이 그날 날짜로 써 넣어요 (js/engine.js drawChalkDate)
    cv.hline(bx + 5, by + 11, 30, '#d6dccc'); cv.hline(bx + 5, by + 14, 22, '#d6dccc')
    cv.sprite(bx + 44, by + 8, [
        '.yyy.',
        'y...y',
        'y...y',
        '.yyy.',
    ], {'y': '#f4e08c'})
    cv.hline(bx + 51, by + 9, 18, '#f0efe6'); cv.hline(bx + 51, by + 12, 12, '#f0b4c0')
    cv.sprite(bx + 70, by + 4, ['w.w', '.w.', 'w.w'], {'w': '#f0efe6'})
    # 분필 받침
    cv.rect(bx + 1, by + bh - 1, bw - 2, 3, '#a8744c')
    cv.hline(bx + 1, by + bh - 1, bw - 2, '#c8946a')
    cv.hline(bx + 1, by + bh + 2, bw - 2, K)
    cv.rect(bx + 10, by + bh - 1, 4, 1, '#f8f6f0'); cv.rect(bx + 16, by + bh - 1, 3, 1, '#f4c846'); cv.rect(bx + 62, by + bh - 1, 6, 2, '#5a6a80')

    # 게시판 (초록 코르크 + 종이)
    def board(x, y, w, h, papers):
        cv.box(x, y, w, h, '#4e8a5a')
        cv.hline(x + 1, y + 1, w - 2, '#6aa274')
        for px, py, pw, ph, c in papers:
            cv.rect(x + px, y + py, pw, ph, c)
            cv.hline(x + px + 1, y + py + 2, pw - 2, '#b8bcc8')
            cv.hline(x + px + 1, y + py + 4, pw - 3, '#b8bcc8')
            cv.p(x + px + pw // 2, y + py, '#dc4646')
    board(18, 4, 26, 16, [(3, 3, 7, 10, '#f8f6f0'), (12, 2, 6, 8, '#fff4c8'), (19, 5, 5, 9, '#f8f6f0')])
    board(132, 4, 28, 16, [(3, 2, 7, 9, '#f8f6f0'), (12, 4, 6, 9, '#ffe0e8'), (20, 2, 6, 11, '#f8f6f0')])

    # 스피커
    for x in (38, 132):
        cv.box(x, 0, 6, 4, '#3a3a48'); cv.rect(x + 2, 1, 2, 1, '#6a6a7a')

    # TV
    cv.box(170, 3, 30, 17, '#2a2a36')
    cv.rect(172, 5, 26, 13, '#3a4058')
    for k in range(5):
        cv.p(175 + k, 15 - k, '#56607e'); cv.p(176 + k, 15 - k, '#56607e')
    cv.rect(183, 20, 4, 1, '#5a5a68')

    # 시계
    cv.sprite(162, 5, [
        '.kkk.',
        'kwkwk',
        'kwkkk',
        'kwwwk',
        '.kkk.',
    ], {'k': K, 'w': '#f8f6f0'})

    # ---------- 왼쪽 벽 창문(블라인드), 오른쪽 벽 복도 창 ----------
    CAP, CAP2, CAP3 = '#f2f0e8', '#c8c4b4', '#dedacc'
    cv.rect(4, 0, 12, 132, CAP); cv.vline(15, 0, 132, CAP2); cv.vline(4, 0, 132, CAP3)
    cv.rect(208, 0, 12, 132, CAP); cv.vline(208, 0, 132, CAP2); cv.vline(219, 0, 132, CAP3)
    cv.vline(3, 0, 132, K); cv.vline(220, 0, 132, K)
    for wy in (34, 60, 86, 112):   # 왼쪽: 햇빛 드는 창 + 블라인드
        cv.rect(6, wy - 1, 9, 17, K)
        cv.rect(7, wy, 7, 15, '#bfe4f4')
        for j in range(wy, wy + 9, 2):
            cv.hline(7, j, 7, '#f4f4ee')
        cv.hline(7, wy + 9, 7, '#c8c4b4')
        cv.p(8, wy + 11, '#f8fcff'); cv.p(9, wy + 12, '#f8fcff'); cv.p(8, wy + 12, '#e8f6fe')
    for wy in (40, 80):            # 오른쪽: 복도 창
        cv.rect(209, wy - 1, 9, 23, K)
        cv.rect(210, wy, 7, 21, '#a8c8d8')
        cv.hline(210, wy + 10, 7, CAP2)
        cv.p(212, wy + 3, '#e8f4fa'); cv.p(213, wy + 2, '#e8f4fa'); cv.p(212, wy + 14, '#e8f4fa')

    # 앞벽 윗면 + 교실 문 (7,7)→(7,8)
    cv.rect(4, 128, 216, 4, CAP); cv.hline(4, 128, 216, CAP2); cv.hline(4, 132, 216, K)
    cv.rect(4, 133, 216, 11, K)
    cv.blend(16, 124, 192, 4, K, 0.10)
    dx = 112
    # 미닫이문 입구
    cv.rect(dx, 128, 16, 16, '#d0c4a8')
    cv.rect(dx + 1, 129, 14, 15, '#a07048')
    cv.vline(dx + 1, 129, 15, '#c08a5a')
    cv.rect(dx + 3, 131, 10, 5, '#bfe4f4'); cv.hline(dx + 3, 131, 10, '#f8fcff')
    cv.rect(dx + 12, 138, 2, 2, '#f4c846')
    cv.vline(dx - 1, 128, 16, K); cv.vline(dx + 16, 128, 16, K)
    # 문 앞 발판
    cv.box(dx + 1, 116, 14, 11, '#7a8a9a')
    for j in range(118, 126, 2):
        cv.hline(dx + 2, j, 12, '#94a2b0')

    # ---------- 책상 (3,4)(4,4)(7,4)(8,4)(3,6)(4,6)(7,6)(8,6) ----------
    def desk(tx, ty, item):
        x0, y0 = tx * T, ty * T
        cv.blend(x0 + 2, y0 + 15, 13, 1, K, 0.25)
        # 의자 등받이 (아래쪽, 학생은 칠판을 봄)
        # 다리
        for lx in (x0 + 2, x0 + 13):
            cv.rect(lx, y0 + 9, 1, 6, '#7a8090')
        cv.rect(x0 + 1, y0 + 1, 14, 9, K)
        cv.rect(x0 + 2, y0 + 2, 12, 6, '#d8a060')
        cv.hline(x0 + 2, y0 + 2, 12, '#ecbe80')
        cv.rect(x0 + 2, y0 + 8, 12, 1, '#a86c38')
        cv.rect(x0 + 3, y0 + 9, 10, 2, '#4a4a58')  # 서랍 칸
        # 의자
        cv.rect(x0 + 4, y0 + 11, 8, 4, K)
        cv.rect(x0 + 5, y0 + 12, 6, 2, '#c88a50')
        cv.hline(x0 + 5, y0 + 12, 6, '#e0a868')
        cv.rect(x0 + 4, y0 + 15, 1, 1, '#7a8090'); cv.rect(x0 + 11, y0 + 15, 1, 1, '#7a8090')
        if item == 'book':
            cv.rect(x0 + 4, y0 + 3, 5, 4, '#4278d2'); cv.vline(x0 + 6, y0 + 3, 4, '#f8f6f0')
        elif item == 'pencil':
            cv.hline(x0 + 5, y0 + 5, 6, '#f4c846'); cv.p(x0 + 11, y0 + 5, '#f2c49c'); cv.p(x0 + 4, y0 + 5, '#f07890')
        elif item == 'case':
            cv.rect(x0 + 8, y0 + 3, 5, 3, '#f07890'); cv.hline(x0 + 8, y0 + 3, 5, '#f6a0b4')
        elif item == 'note':
            cv.rect(x0 + 5, y0 + 3, 6, 4, '#f8f6f0'); cv.hline(x0 + 6, y0 + 4, 4, '#96d2f0'); cv.hline(x0 + 6, y0 + 6, 3, '#96d2f0')

    items = {(3, 4): 'book', (4, 4): None, (7, 4): 'pencil', (8, 4): 'note',
             (3, 6): 'case', (4, 6): 'note', (7, 6): None, (8, 6): 'book'}
    for (tx, ty), it in items.items():
        desk(tx, ty, it)

    # ---------- 학급 문구 장터 탁자 (9~11, 3) ----------
    x0, y0, w = 144, 48, 48
    cv.blend(x0, y0 + 15, w, 2, K, 0.2)
    cv.rect(x0, y0 + 1, w, 14, K)
    cv.rect(x0 + 1, y0 + 2, w - 2, 5, '#fff4dc')        # 식탁보 윗면
    for i in range(x0 + 1, x0 + w - 1, 4):               # 체크무늬
        cv.vline(i, y0 + 2, 5, '#f8c8c8')
    cv.hline(x0 + 1, y0 + 4, w - 2, '#f8c8c8')
    cv.rect(x0 + 1, y0 + 7, w - 2, 7, '#f6a0b4')        # 앞 천
    cv.hline(x0 + 1, y0 + 7, w - 2, '#f8c8d4')
    # 삼각 깃발 장식
    flags = ['#f4c846', '#4278d2', '#6eb45a', '#ee8032', '#8c64c8', '#dc4646']
    cv.hline(x0 + 1, y0 + 8, w - 2, '#c86482')
    for k, fx in enumerate(range(x0 + 2, x0 + w - 4, 6)):
        c = flags[k % len(flags)]
        cv.rect(fx, y0 + 9, 5, 1, c); cv.rect(fx + 1, y0 + 10, 3, 1, c); cv.p(fx + 2, y0 + 11, c)
    cv.vline(x0 + 8, y0 + 12, 2, '#c86482'); cv.vline(x0 + w - 9, y0 + 12, 2, '#c86482')
    # 물건: 연필꽂이, 지우개, 공책, 스티커
    cv.box(x0 + 3, y0 - 5, 6, 8, '#4278d2')                      # 연필꽂이
    cv.vline(x0 + 4, y0 - 9, 5, '#f4c846'); cv.vline(x0 + 6, y0 - 8, 4, '#dc4646'); cv.vline(x0 + 7, y0 - 10, 6, '#6eb45a')
    cv.p(x0 + 4, y0 - 10, '#f2c49c'); cv.p(x0 + 7, y0 - 11, '#f2c49c')
    cv.box(x0 + 11, y0 + 1, 6, 4, '#f8f6f0'); cv.rect(x0 + 12, y0 + 2, 2, 2, '#4278d2')   # 지우개
    cv.box(x0 + 30, y0, 8, 6, '#6eb45a'); cv.hline(x0 + 31, y0 + 2, 6, '#a8e0a0')       # 공책
    cv.box(x0 + 39, y0 - 1, 7, 6, '#f4c846'); cv.p(x0 + 41, y0 + 1, '#ee8032'); cv.p(x0 + 43, y0 + 2, '#dc4646')  # 스티커
    # 가격표
    cv.rect(x0 + 19, y0 + 1, 5, 3, '#f8f6f0'); cv.p(x0 + 21, y0 + 2, '#dc4646')

    return cv



def side_walls(cv, bottom, cap='#f2f0e8', cap2='#c8c4b4', cap3='#dedacc'):
    """두꺼운 옆벽(바깥 4~15, 208~219)과 앞벽 윗면"""
    cv.rect(4, 0, 12, bottom + 4, cap); cv.vline(15, 0, bottom + 4, cap2); cv.vline(4, 0, bottom + 4, cap3)
    cv.rect(208, 0, 12, bottom + 4, cap); cv.vline(208, 0, bottom + 4, cap2); cv.vline(219, 0, bottom + 4, cap3)
    cv.vline(3, 0, bottom + 4, K); cv.vline(220, 0, bottom + 4, K)
    cv.blend(16, bottom - 4, 192, 4, K, 0.10)
    cv.rect(4, bottom, 216, 4, cap); cv.hline(4, bottom, 216, cap2); cv.hline(4, bottom + 4, 216, K)
    cv.rect(4, bottom + 5, 216, cv.h - bottom - 5, K)


def side_window(cv, x, y, h, glass='#bfe4f4', curtain=None):
    cv.rect(x, y - 1, 9, h + 2, K)
    cv.rect(x + 1, y, 7, h, glass)
    cv.hline(x + 1, y + h // 2, 7, '#c8c4b4')
    cv.p(x + 2, y + 2, '#f8fcff'); cv.p(x + 3, y + 1, '#f8fcff'); cv.p(x + 2, y + h // 2 + 3, '#f8fcff')
    if curtain:
        cv.rect(x + 1, y, 7, 3, curtain); cv.rect(x + 1, y + h - 3, 7, 3, curtain)


# ======================================================================
# 체육관 224x144 (14x9칸)
#   1 xWHHWWWWWWWWWx  H = 체육 도구 선반
#   3 xLcccLLLLLLLLx  c = 대여 탁자   도우미 (3,2), 선생님 (10,3)
#   7 xLLLLLLDLLLLLx  D = 문
# ======================================================================
def gym():
    cv = Canvas(224, 144)
    # ---------- 바닥: 단풍나무 마루 + 경기장 선 ----------
    M1, M2, M3, ML = '#eabf84', '#e3b67a', '#efc98f', '#c99a60'
    for y in range(32, 128):
        row = (y - 32) // 4
        for x in range(16, 208):
            cv.p(x, y, [M1, M2, M3, M1, M2][row % 5])
        if (y - 32) % 4 == 3:
            cv.hline(16, y, 192, ML)
    for row in range(24):
        y = 32 + row * 4
        for jx in range(16 + (row * 29) % 48, 208, 48):
            cv.vline(jx, y, 3, ML)
    # 창문 빛 반사 (윤기)
    for k, x0 in enumerate([30, 150]):
        for j in range(32, 128):
            cv.blend(x0 + (j - 32) // 4, j, 26, 1, '#fff6dc', 0.22)
    # 파란 제한구역(양쪽) + 흰 선
    WL = '#f8f6f0'
    BL = '#5a86c8'
    # 제한구역은 마루 결을 살려 파란색으로 다시 칠해요
    for kx in (16, 174):
        for y in range(62, 98):
            for x in range(kx, kx + 34):
                o = cv.get(x, y)
                cv.p(x, y, '#3f62b0' if o[:3] == hx(ML)[:3] else ('#5a82cc' if sum(o[:3]) < 640 else '#6a92d8'))
    cv.hline(16, 61, 34, WL); cv.hline(16, 98, 34, WL); cv.vline(49, 61, 38, WL)
    cv.hline(174, 61, 34, WL); cv.hline(174, 98, 34, WL); cv.vline(174, 61, 38, WL)
    # 자유투 반원
    import math
    for a in range(-90, 91, 2):
        r = math.radians(a)
        cv.p(round(49 + 10 * math.cos(r)), round(80 + 18 * math.sin(r)), WL)
        cv.p(round(174 - 10 * math.cos(r)), round(80 + 18 * math.sin(r)), WL)
    # 3점 선 (진한 남색)
    NV = '#2c3a78'
    for a in range(-90, 91, 1):
        r = math.radians(a)
        cv.p(round(18 + 50 * math.cos(r)), round(80 + 40 * math.sin(r)), NV)
        cv.p(round(205 - 50 * math.cos(r)), round(80 + 40 * math.sin(r)), NV)
    # 가운데 선 + 가운데 원
    cv.vline(112, 32, 96, WL); cv.vline(113, 32, 96, WL)
    for a in range(0, 360, 2):
        r = math.radians(a)
        cv.p(round(112.5 + 14 * math.cos(r)), round(80 + 12 * math.sin(r)), WL)
    cv.blend(106, 76, 14, 9, '#dc4646', 0.35)
    # 경기장 바깥 선
    cv.hline(16, 34, 192, WL); cv.hline(16, 125, 192, WL)

    # ---------- 뒷벽 ----------
    cv.rect(16, 0, 192, 32, '#e8dcc8')
    cv.rect(16, 0, 192, 2, K)
    # 지붕 철골
    cv.rect(16, 2, 192, 4, '#5f8a74')
    for x in range(16, 208, 8):
        cv.p(x, 3, '#3f6a54'); cv.p(x + 1, 4, '#3f6a54'); cv.p(x + 2, 5, '#3f6a54')
        cv.p(x + 7, 3, '#3f6a54'); cv.p(x + 6, 4, '#3f6a54'); cv.p(x + 5, 5, '#3f6a54')
    cv.hline(16, 5, 192, '#3f6a54')
    # 높은 창 (밝은 빛)
    for x0, x1 in [(16, 76), (148, 208)]:
        cv.rect(x0, 7, x1 - x0, 9, '#fbf2d6')
        cv.rect(x0, 7, x1 - x0, 3, '#fff8e6')
        for x in range(x0, x1, 10):
            cv.vline(x, 7, 9, '#b8a888')
        cv.hline(x0, 7, x1 - x0, '#b8a888'); cv.hline(x0, 11, x1 - x0, '#cfc4a8'); cv.hline(x0, 16, x1 - x0, '#b8a888')
    # 나무 벽판
    cv.rect(16, 17, 192, 13, '#d8a96c')
    for x in range(16, 208, 6):
        cv.vline(x, 17, 13, '#c4955a')
    cv.hline(16, 17, 192, '#e8c08a')
    cv.rect(16, 29, 192, 2, '#9a6a3c')
    cv.hline(16, 31, 192, K)

    # 무대 + 학교 그림 현수막 (가운데)
    cv.box(78, 3, 68, 18, '#8a5a3a')
    cv.rect(80, 5, 64, 14, '#9ed4f0')
    cv.rect(80, 5, 64, 4, '#c4e6f8')
    cv.rect(82, 7, 6, 2, '#f8fcff'); cv.rect(130, 6, 8, 2, '#f8fcff')
    cv.rect(80, 14, 64, 5, '#6eb45a')
    cv.rect(98, 8, 28, 9, '#f8f6f0')          # 학교 건물
    cv.rect(98, 8, 28, 1, '#dc4646')
    cv.rect(110, 5, 4, 4, '#f8f6f0'); cv.p(111, 6, '#4278d2'); cv.p(112, 6, '#4278d2')
    for i in range(100, 125, 4):
        cv.rect(i, 10, 2, 2, '#4278d2'); cv.rect(i, 13, 2, 2, '#4278d2')
    cv.rect(110, 14, 4, 3, '#a0643c')
    # 자주색 무대 커튼
    for x in (74, 144):
        cv.rect(x, 2, 6, 20, '#962a2c')
        cv.vline(x + 2, 2, 20, '#b8403c'); cv.vline(x + 4, 2, 20, '#7a1e22')
    cv.hline(72, 2, 80, '#7a1e22')
    # 무대 앞면
    cv.rect(72, 20, 80, 2, '#e8c08a')
    cv.rect(72, 22, 80, 8, '#a87444')
    for x in range(72, 152, 8):
        cv.vline(x, 22, 8, '#8a5a3a')
    cv.hline(72, 30, 80, '#6c3c24')
    # 무대 계단
    cv.rect(104, 25, 16, 5, '#c48e58'); cv.hline(104, 25, 16, '#e8c08a'); cv.hline(104, 27, 16, '#a87444')

    # H: 체육 도구 선반 (2~3칸)
    sx = 33
    cv.box(sx, 8, 30, 23, '#8a5a3a')
    cv.rect(sx + 1, 9, 28, 21, '#5a3a24')
    cv.rect(sx + 1, 19, 28, 2, '#a87444')
    def ball(x, y, c, c2, line=None):
        cv.sprite(x, y, ['.kkk.', 'k112k', 'k122k', 'k222k', '.kkk.'], {'k': K, '1': '#f8f6f0' if c != '#f8f6f0' else '#ffffff', '2': c})
        cv.p(x + 1, y + 1, c2)
        if line:
            cv.vline(x + 2, y + 1, 3, line)
    ball(sx + 2, 13, '#ee8032', '#f6a860', '#7a3a14')
    ball(sx + 7, 13, '#ee8032', '#f6a860', '#7a3a14')
    ball(sx + 12, 13, '#f8f6f0', '#ffffff', '#4278d2')
    ball(sx + 17, 13, '#f4c846', '#f8e08c', '#4278d2')
    ball(sx + 23, 13, '#dc4646', '#f07878')
    ball(sx + 2, 24, '#f8f6f0', '#ffffff', K)
    ball(sx + 7, 24, '#f8f6f0', '#ffffff', K)
    cv.rect(sx + 13, 25, 7, 4, '#dc4646'); cv.rect(sx + 14, 26, 5, 2, '#f07878')   # 줄넘기 상자
    cv.vline(sx + 22, 22, 7, '#f4c846'); cv.vline(sx + 24, 22, 7, '#6eb45a'); cv.vline(sx + 26, 22, 7, '#4278d2')  # 배턴
    # 점수판
    cv.box(18, 8, 13, 9, '#2a2a36')
    text(cv, 19, 10, '12', '#f4c846'); cv.p(26, 11, '#dc4646')

    # 늑목 (오른쪽 벽)
    for x in range(164, 204, 8):
        cv.rect(x, 8, 2, 23, '#c48e58'); cv.vline(x, 8, 23, '#e8c08a')
    for y in range(10, 30, 3):
        cv.hline(164, y, 34, '#a87444')
    # 매트 더미
    cv.box(152, 22, 11, 9, '#4278d2'); cv.hline(153, 25, 9, '#284e96'); cv.hline(153, 23, 9, '#6a9ae0')

    # ---------- 옆벽 + 농구 골대 ----------
    side_walls(cv, 128, '#efe6d6', '#c8bca4', '#ddd2bc')
    for wy in (34, 102):
        side_window(cv, 6, wy, 20, '#fbf2d6', '#962a2c')
        side_window(cv, 209, wy, 20, '#fbf2d6', '#962a2c')
    def hoop(x, flip):
        d = -1 if flip else 1
        bx = x
        cv.rect(bx, 66, 3, 28, K); cv.rect(bx + (1 if not flip else 0), 67, 2, 26, '#f8f6f0')
        cv.rect(bx + (1 if not flip else 0), 76, 2, 8, '#dc4646')
        cx = x + d * 9 + (1 if flip else 2)
        for a in range(0, 360, 20):
            import math
            r = math.radians(a)
            cv.p(round(cx + 5 * math.cos(r)), round(80 + 4 * math.sin(r)), '#ee8032')
        cv.dither(cx - 3, 78, 7, 4, '#f8f6f0')
        cv.rect(cx - (6 if not flip else -4), 79, 2, 2, '#ee8032')
    hoop(13, False)
    hoop(208, True)

    # ---------- 대여 탁자 (2~4, 3) ----------
    x0, y0, w = 32, 48, 48
    cv.blend(x0, y0 + 15, w, 2, K, 0.22)
    cv.rect(x0, y0 + 1, w, 14, K)
    cv.rect(x0 + 1, y0 + 2, w - 2, 4, '#e8eaf0'); cv.hline(x0 + 1, y0 + 2, w - 2, '#ffffff')
    cv.rect(x0 + 1, y0 + 6, w - 2, 8, '#3c7840'); cv.hline(x0 + 1, y0 + 6, w - 2, '#6eb45a')
    cv.vline(x0 + 16, y0 + 7, 7, '#2c5a30'); cv.vline(x0 + 31, y0 + 7, 7, '#2c5a30')
    cv.box(x0 + 18, y0 + 8, 12, 5, '#f8f6f0'); cv.hline(x0 + 20, y0 + 10, 8, '#3c7840')  # 대여 안내 종이
    # 물건: 줄넘기, 호루라기, 기록판, 공 바구니
    cv.sprite(x0 + 3, y0 - 1, ['.rrr.', 'r...r', 'r.r.r', '.r.r.', '..yy.'], {'r': '#dc4646', 'y': '#f4c846'})
    cv.box(x0 + 11, y0 + 1, 4, 3, '#ccd0d8'); cv.p(x0 + 15, y0 + 2, '#f4c846')
    cv.box(x0 + 21, y0 - 3, 9, 8, '#a0643c'); cv.rect(x0 + 22, y0 - 2, 7, 6, '#f8f6f0')
    cv.hline(x0 + 23, y0, 5, '#8c92a0'); cv.hline(x0 + 23, y0 + 2, 4, '#8c92a0'); cv.rect(x0 + 24, y0 - 4, 3, 2, '#8c92a0')
    cv.sprite(x0 + 34, y0 - 4, ['.kkkkkkkkk.', 'kooowwwyyyk', 'kooowwwyyyk', '.kgggggggk.', '..kgggggk..'],
              {'k': K, 'o': '#ee8032', 'w': '#f8f6f0', 'y': '#f4c846', 'g': '#8c92a0'})

    # ---------- 문 (7,7)→(7,8) ----------
    dx = 112
    cv.rect(dx - 8, 128, 32, 16, K)
    cv.rect(dx - 7, 129, 30, 15, '#5f8a74')
    cv.vline(dx + 7, 129, 15, K); cv.vline(dx + 8, 129, 15, K)
    cv.rect(dx - 4, 131, 8, 5, '#bfe4f4'); cv.rect(dx + 12, 131, 8, 5, '#bfe4f4')
    cv.rect(dx + 5, 137, 2, 3, '#ccd0d8'); cv.rect(dx + 9, 137, 2, 3, '#ccd0d8')
    cv.box(dx + 1, 116, 14, 11, '#6c6a7e')
    for j in range(118, 126, 2):
        cv.hline(dx + 2, j, 12, '#8c8aa0')
    return cv


# ======================================================================
# 우리 집 224x144 (14x9칸)
#   2 xfffffffffBBfx  B = 냉장고(10,2), 부엌 조리대(11,2)
#   3~4 T(3,3)(4,3)(3,4)(4,4) = 식탁    m(8~10, 4~5) = 거실 러그
#   7 xffffffDfffffx  D = 현관   엄마 (9,3)
# ======================================================================
def home():
    cv = Canvas(224, 144)
    # ---------- 바닥: 밝은 원목 마루 ----------
    O1, O2, O3, OL, OH = '#e2b783', '#d9ad78', '#e8c090', '#b98a58', '#f0cd9c'
    for y in range(32, 128):
        row = (y - 32) // 6
        for x in range(16, 208):
            cv.p(x, y, [O1, O2, O3, O2][row % 4])
        if (y - 32) % 6 == 5:
            cv.hline(16, y, 192, OL)
    for row in range(16):
        y = 32 + row * 6
        for jx in range(16 + (row * 37) % 56, 208, 56):
            cv.vline(jx, y, 5, OL)
        for gx in range(20 + (row * 23) % 40, 208, 40):
            cv.hline(gx, y + 2, 3, OH)
    # 창으로 들어오는 햇빛
    for j in range(32, 100):
        x0 = 22 + (j - 32) // 3
        cv.blend(x0, j, 26, 1, '#fff4d0', 0.30 if j < 80 else 0.30 * (100 - j) / 20)

    # ---------- 뒷벽: 크림색 벽지 ----------
    WP, WP2 = '#f3e6cc', '#ead9b8'
    cv.rect(16, 0, 192, 32, WP)
    for x in range(18, 208, 6):
        for y in range(3, 27, 2):
            cv.p(x, y, WP2)
    cv.rect(16, 0, 192, 2, K)
    cv.hline(16, 2, 192, '#d8c4a0')
    cv.rect(16, 27, 192, 3, '#a87444'); cv.hline(16, 27, 192, '#c48e58')
    cv.hline(16, 31, 192, K)

    # 창문 + 커튼
    cv.box(21, 4, 26, 19, '#f8f6f0')
    cv.rect(22, 5, 24, 17, '#bfe4f4')
    cv.rect(22, 5, 24, 6, '#d6eefa')
    cv.rect(22, 16, 24, 6, '#9ccf7a'); cv.rect(26, 14, 6, 3, '#7ab85e'); cv.rect(36, 13, 8, 4, '#7ab85e')  # 바깥 나무
    cv.vline(33, 5, 17, '#f8f6f0'); cv.hline(22, 12, 24, '#f8f6f0')
    cv.p(24, 7, '#ffffff'); cv.p(25, 6, '#ffffff'); cv.p(36, 7, '#ffffff')
    cv.rect(20, 23, 28, 2, '#e8e0d0'); cv.hline(20, 24, 28, '#c8bca4')
    for x in (17, 46):
        cv.rect(x, 3, 5, 22, '#e8b4a0'); cv.vline(x + 1, 3, 22, '#f4cbb8'); cv.vline(x + 3, 3, 22, '#cc9480')
    cv.hline(17, 3, 34, '#8a5a3a')

    # 괘종시계
    cv.box(52, 3, 10, 20, '#8a5a3a')
    cv.rect(53, 4, 8, 2, '#a87444')
    cv.sprite(53, 6, ['.kkkkk.', 'kwwkwwk', 'kwwkwwk', 'kwwwkwk', '.kkkkk.'], {'k': K, 'w': '#fffdf6'})
    cv.rect(54, 12, 6, 9, '#5a3a24'); cv.vline(57, 12, 6, '#f4c846'); cv.rect(56, 17, 3, 3, '#f4c846')

    # 모자 걸이 (나무 지그재그 + 밀짚모자)
    for i in range(4):
        x = 66 + i * 6
        cv.p(x, 6, '#a87444'); cv.p(x + 1, 7, '#a87444'); cv.p(x + 2, 8, '#a87444'); cv.p(x + 3, 7, '#a87444'); cv.p(x + 4, 6, '#a87444')
        cv.rect(x + 2, 9, 1, 2, '#8a5a3a')
    cv.sprite(64, 9, ['...kkkk...', '..kyyyyk..', '.kkrrrrkk.', 'kyyyyyyyyk', '.kkkkkkkk.'], {'k': K, 'y': '#f4d878', 'r': '#dc4646'})
    cv.sprite(78, 10, ['.kkkk.', 'kbbbbk', 'kbbbbkk', '.kkkkkk'], {'k': K, 'b': '#4278d2'})

    # 작은 수납장 + 화분
    cv.box(90, 18, 18, 13, '#a87444')
    cv.hline(91, 19, 16, '#c48e58'); cv.vline(98, 20, 10, '#8a5a3a'); cv.p(96, 24, '#f4c846'); cv.p(100, 24, '#f4c846')
    cv.sprite(92, 3, ['....k.k...', '...knkNk..', '..kNnkNnk.', '.knNkNknNk', '..kNnNnk..', '...kNnk...', '....kk....'],
              {'k': K, 'n': '#6eb45a', 'N': '#3c7840'})
    cv.vline(96, 9, 4, '#3c7840')
    cv.box(93, 12, 8, 7, '#f8f6f0'); cv.hline(94, 13, 6, '#e8e4da')
    cv.box(102, 13, 4, 6, '#dc8aa0'); cv.p(103, 12, '#dc4646'); cv.p(104, 11, '#dc4646')

    # TV + 거실장 (7~9칸)
    cv.box(112, 20, 46, 11, '#8a5a3a')
    cv.hline(113, 21, 44, '#c48e58')
    for x in (127, 142):
        cv.vline(x, 22, 8, '#6c3c24')
    cv.p(120, 25, '#f4c846'); cv.p(134, 25, '#f4c846'); cv.p(149, 25, '#f4c846')
    cv.box(118, 5, 34, 15, '#2a2a36')
    cv.rect(120, 7, 30, 11, '#3a4258')
    for k in range(6):
        cv.p(123 + k, 15 - k, '#56607e'); cv.p(124 + k, 15 - k, '#56607e')
    cv.rect(132, 19, 6, 1, K)
    cv.box(152, 13, 5, 8, '#f4c846'); cv.rect(151, 10, 7, 4, '#f8f0d8')   # 스탠드

    # 부엌: 윗장 + 타일 벽
    cv.rect(176, 16, 32, 11, '#f8f6f0')
    for x in range(176, 208, 4):
        cv.vline(x, 16, 11, '#dcdcd4')
    for y in range(16, 27, 4):
        cv.hline(176, y, 32, '#dcdcd4')
    cv.box(176, 2, 32, 12, '#c48e58')
    cv.vline(191, 3, 10, '#8a5a3a'); cv.hline(177, 3, 30, '#e0aa70')
    cv.p(188, 9, '#f4c846'); cv.p(194, 9, '#f4c846')
    cv.blend(176, 14, 32, 2, K, 0.2)
    # 걸린 조리도구
    cv.hline(194, 17, 12, '#8c92a0')
    cv.vline(196, 17, 6, '#6c6a7e'); cv.rect(195, 23, 3, 2, '#6c6a7e')
    cv.vline(201, 17, 4, '#a87444'); cv.rect(199, 21, 5, 4, '#2a2a36'); cv.hline(200, 21, 3, '#4a4a58')

    # B(10,2): 냉장고 (벽까지 키 큼)
    fx = 161
    cv.box(fx, 6, 14, 42, '#dde2ea')
    cv.vline(fx + 1, 7, 40, '#f4f6fa')
    cv.hline(fx + 1, 22, 12, '#9aa2b4')
    cv.rect(fx + 10, 12, 1, 7, '#8c92a0'); cv.rect(fx + 10, 26, 1, 9, '#8c92a0')
    cv.rect(fx + 3, 9, 3, 3, '#f4c846'); cv.rect(fx + 4, 27, 3, 4, '#f8f6f0'); cv.hline(fx + 4, 28, 3, '#dc4646')  # 자석·메모
    cv.blend(fx, 47, 15, 1, K, 0.3)
    # B(11,2): 조리대 (싱크대 + 가스레인지)
    kx = 176
    cv.rect(kx, 31, 16, 17, K)
    cv.rect(kx + 1, 32, 14, 5, '#e8e0d0'); cv.hline(kx + 1, 32, 14, '#f8f6f0')
    cv.box(kx + 2, 33, 6, 4, '#9aa2b4'); cv.rect(kx + 3, 34, 4, 2, '#bfe4f4')   # 싱크
    cv.vline(kx + 5, 29, 4, '#8c92a0'); cv.p(kx + 6, 29, '#8c92a0')
    cv.sprite(kx + 9, 33, ['k.k', '.k.', 'k.k'], {'k': '#4a4a58'})                 # 화구
    cv.rect(kx + 1, 37, 14, 10, '#c48e58'); cv.hline(kx + 1, 37, 14, '#e0aa70')
    cv.vline(kx + 8, 38, 9, '#8a5a3a'); cv.p(kx + 6, 41, '#f4c846'); cv.p(kx + 10, 41, '#f4c846')
    cv.blend(kx, 48, 16, 1, K, 0.3)
    # 주전자
    cv.sprite(kx + 9, 27, ['.kk.', 'krrk', 'krrkk', 'kkkk'], {'k': K, 'r': '#dc4646'})

    # ---------- 거실 러그 m (8~10, 4~5) ----------
    rx, ry, rw, rh = 128, 64, 48, 32
    cv.rect(rx + 1, ry + 1, rw - 2, rh - 2, '#f6a0b4')
    cv.rect(rx + 3, ry + 3, rw - 6, rh - 6, '#f8c8d4')
    cv.rect(rx + 5, ry + 5, rw - 10, rh - 10, '#f6a0b4')
    cv.rect(rx + 6, ry + 6, rw - 12, rh - 12, '#fbd9e2')
    for i in range(rx + 9, rx + rw - 9, 6):
        cv.p(i, ry + 15, '#f07890'); cv.p(i + 1, ry + 16, '#f07890'); cv.p(i, ry + 17, '#f07890'); cv.p(i - 1, ry + 16, '#f07890')
    for i in range(rx + 2, rx + rw - 2, 2):
        cv.p(i, ry, '#f8f0e8'); cv.p(i, ry + rh - 1, '#f8f0e8')

    # ---------- 식탁 T (3~4, 3~4) ----------
    tx, ty = 48, 48
    def chair(x, y, back_up):
        cv.box(x, y, 10, 7, '#a87444')
        cv.hline(x + 1, y + 1, 8, '#c48e58')
        if back_up:
            cv.rect(x, y - 4, 10, 4, K); cv.rect(x + 1, y - 3, 8, 2, '#8a5a3a')
    cv.blend(tx + 3, ty + 29, 28, 3, K, 0.2)
    chair(tx + 5, ty + 1, True); chair(tx + 18, ty + 1, True)
    cv.rect(tx + 2, ty + 6, 28, 20, K)
    cv.rect(tx + 3, ty + 7, 26, 15, '#c48e58')
    for y in range(ty + 9, ty + 22, 4):
        cv.hline(tx + 3, y, 26, '#b47e48')
    cv.hline(tx + 3, ty + 7, 26, '#e0aa70')
    cv.rect(tx + 3, ty + 22, 26, 3, '#8a5a3a')
    cv.rect(tx + 4, ty + 25, 2, 4, '#6c3c24'); cv.rect(tx + 26, ty + 25, 2, 4, '#6c3c24')
    # 식탁 위: 꽃병, 접시, 컵
    cv.box(tx + 14, ty + 9, 4, 6, '#f8f6f0'); cv.p(tx + 15, ty + 7, '#dc4646'); cv.p(tx + 16, ty + 8, '#dc4646'); cv.p(tx + 15, ty + 8, '#6eb45a')
    cv.sprite(tx + 5, ty + 10, ['.kkkk.', 'kwyywk', 'kwyowk', '.kkkk.'], {'k': K, 'w': '#f8f6f0', 'y': '#f4c846', 'o': '#ee8032'})
    cv.sprite(tx + 21, ty + 14, ['.kkkk.', 'kwnnwk', 'kwnnwk', '.kkkk.'], {'k': K, 'w': '#f8f6f0', 'n': '#6eb45a'})
    cv.box(tx + 22, ty + 9, 4, 4, '#96d2f0')
    chair(tx + 5, ty + 24, False); chair(tx + 18, ty + 24, False)
    cv.rect(tx + 5, ty + 27, 10, 4, K); cv.rect(tx + 6, ty + 28, 8, 2, '#8a5a3a')
    cv.rect(tx + 18, ty + 27, 10, 4, K); cv.rect(tx + 19, ty + 28, 8, 2, '#8a5a3a')

    # ---------- 옆벽 + 현관 ----------
    side_walls(cv, 128, '#f2e8d4', '#c8b898', '#e0d2b8')
    side_window(cv, 6, 50, 26, '#bfe4f4', '#e8b4a0')
    # 현관 (7,7): 돌 타일 + 신발
    dx = 112
    cv.rect(dx, 112, 16, 16, '#b8b4ac')
    for j in (112, 120):
        cv.hline(dx, j, 16, '#9a968e')
    cv.vline(dx + 8, 112, 8, '#9a968e'); cv.vline(dx + 4, 120, 8, '#9a968e'); cv.vline(dx + 12, 120, 8, '#9a968e')
    cv.rect(dx, 111, 16, 1, '#8a5a3a')
    cv.sprite(dx + 3, 116, ['.kkk.kkk', 'kwrrkwrrk', 'kwrrkwrrk', 'kkkkkkkk'], {'k': K, 'w': '#f8f6f0', 'r': '#dc4646'})
    cv.sprite(dx + 4, 122, ['.kk..kk', 'kbbkkbbk', 'kkkkkkkk'], {'k': K, 'b': '#4278d2'})
    # 현관문
    cv.rect(dx - 1, 128, 18, 16, K)
    cv.rect(dx, 129, 16, 15, '#8a5a3a')
    cv.vline(dx + 1, 129, 15, '#a87444')
    cv.rect(dx + 3, 131, 10, 10, '#a87444'); cv.rect(dx + 4, 132, 8, 8, '#8a5a3a')
    cv.rect(dx + 12, 136, 2, 2, '#f4c846')
    return cv



# ======================================================================
# 분식점 224x128 (14x8칸)
#   1 xWWSSWWWWSSWWx  S = 메뉴판
#   3 xcccccccccccqx  c = 계산대(음식 진열)   사장님 (6,2), 손님 자리 (6,4)
#   5 xqqTTqqqqTTqqx  T = 손님 탁자
#   7 xxxxxxDxxxxxxx  D = 문
# ======================================================================
def snackbar():
    cv = Canvas(224, 128)
    # ---------- 바닥: 밝은 회색 타일 ----------
    G1, G2, GG, GH = '#dedbd2', '#d4d0c6', '#bdb8ac', '#eeebe4'
    for ty in range(2, 7):
        for tx in range(1, 13):
            x0, y0 = tx * T, ty * T
            cv.rect(x0, y0, T, T, G1 if (tx + ty) % 2 == 0 else G2)
            cv.hline(x0, y0, T, GG); cv.vline(x0, y0, T, GG)
            cv.p(x0 + 2, y0 + 2, GH); cv.p(x0 + 3, y0 + 2, GH)
    # 계산대 안쪽(주방) 바닥은 조금 어둡게
    cv.blend(16, 32, 176, 16, '#6c6a7e', 0.18)
    # 문으로 들어오는 빛
    cv.blend(88, 96, 32, 16, '#fff8e0', 0.18)

    # ---------- 뒷벽: 베이지 벽 + 나무 벽판 ----------
    cv.rect(16, 0, 192, 32, '#ece4d4')
    cv.rect(16, 0, 192, 2, K)
    cv.hline(16, 2, 192, '#d8cebc')
    cv.rect(16, 19, 192, 1, '#8a5a3a')
    cv.rect(16, 20, 192, 10, '#c8935a')
    for x in range(16, 208, 12):
        cv.vline(x, 20, 10, '#a87444')
    cv.hline(16, 20, 192, '#dcaa72')
    cv.rect(16, 30, 192, 1, '#8a5a3a'); cv.hline(16, 31, 192, K)

    # 메뉴판 (노란 판 + 음식 그림 + 빨간 가격 줄)
    def food(x, y, kind):
        if kind == 'tteok':   # 떡볶이
            cv.sprite(x, y, ['.kkkkk.', 'kroworK', 'kowrowk', '.kkkkk.'], {'k': K, 'K': K, 'r': '#dc4646', 'o': '#ee8032', 'w': '#fce8c8'})
        elif kind == 'gimbap':
            cv.sprite(x, y, ['.kkkkk.', 'kgwywgk', 'kgwowgk', '.kkkkk.'], {'k': K, 'g': '#2c3a30', 'w': '#f8f6f0', 'y': '#f4c846', 'o': '#6eb45a'})
        elif kind == 'ramen':
            cv.sprite(x, y, ['.yyyyy.', 'kyoyoyk', 'kwwwwwk', '.kkkkk.'], {'k': K, 'y': '#f4d878', 'o': '#ee8032', 'w': '#f8f6f0'})
        elif kind == 'twigim':
            cv.sprite(x, y, ['..kkk..', '.kyYyk.', 'kyYyYyk', '.kkkkk.'], {'k': K, 'y': '#f4c846', 'Y': '#c48e28'})
        elif kind == 'sundae':
            cv.sprite(x, y, ['.kkkkk.', 'kpPpPpk', 'kPpPpPk', '.kkkkk.'], {'k': K, 'p': '#6a4a5a', 'P': '#4a3040'})
        elif kind == 'eomuk':
            cv.sprite(x, y, ['...t...', '.kEEEk.', '.kEeEk.', '..ktk..'], {'k': K, 't': '#a0643c', 'E': '#d89a5a', 'e': '#ecbe80'})
    def menu(x, y, w, h, items, title):
        cv.box(x, y, w, h, '#f4d23c')
        cv.hline(x + 1, y + 1, w - 2, '#fbe67a')
        cv.rect(x + w // 2 - 6, y + 2, 12, 2, title)
        for k, it in enumerate(items):
            cx = x + 2 + (k % 3) * 10
            cy = y + 5 + (k // 3) * 8
            food(cx + 1, cy, it)
            cv.hline(cx + 2, cy + 5, 5, '#dc4646')
        cv.rect(x + 1, y + h - 2, w - 2, 1, '#c8a82c')
    menu(47, 3, 34, 22, ['tteok', 'gimbap', 'ramen', 'twigim', 'sundae', 'eomuk'], '#dc4646')
    menu(143, 4, 34, 15, ['ramen', 'tteok', 'gimbap'], '#4278d2')
    # 메뉴판 아래 작은 안내문 (포장, 물 셀프)
    cv.box(147, 20, 14, 8, '#f8f6f0'); cv.hline(149, 22, 10, '#dc4646'); cv.hline(149, 24, 8, K)
    cv.box(84, 5, 12, 10, '#f8f6f0'); cv.hline(86, 7, 8, K); cv.hline(86, 9, 8, '#dc4646'); cv.hline(86, 11, 6, K)

    # 에어컨
    cv.box(100, 3, 30, 9, '#f8f6f0')
    cv.hline(101, 4, 28, '#ffffff'); cv.hline(102, 9, 26, '#c8ccd4'); cv.rect(124, 5, 3, 1, '#6eb45a')
    # 벽걸이 선풍기
    def fan(x, y):
        cv.sprite(x, y, [
            '..kkkkk..',
            '.kcwcwck.',
            'kcwkkkwck',
            'kwckbkcwk',
            'kcwkkkwck',
            '.kcwcwck.',
            '..kkkkk..',
            '....k....',
            '...kwk...',
            '...kwk...',
            '...kkk...',
        ], {'k': K, 'c': '#96d2f0', 'w': '#f8f6f0', 'b': '#4278d2'})
    fan(132, 3)
    fan(18, 3)
    # 달력 + 시계
    cv.box(30, 3, 12, 14, '#f8f6f0')
    cv.rect(31, 4, 10, 3, '#dc4646')
    for j in range(8, 16, 2):
        for i in range(32, 41, 2):
            cv.p(i, j, '#8c92a0')
    cv.p(40, 14, '#dc4646')
    # 그릇 선반 (왼쪽 아래)
    cv.rect(18, 22, 26, 2, '#9aa2b4'); cv.hline(18, 22, 26, '#ccd0d8')
    for x in (20, 27, 34):
        cv.sprite(x, 17, ['kkkkkk', 'kwwwwk', '.kwwk.', '.kkkk.'], {'k': K, 'w': '#f8f6f0'})
    cv.rect(18, 28, 26, 2, '#9aa2b4'); cv.hline(18, 28, 26, '#ccd0d8')
    cv.rect(20, 25, 8, 3, '#dc4646'); cv.rect(30, 25, 8, 3, '#f4c846')

    # 스테인리스 냉장고 (11~12칸 벽)
    fx = 178
    cv.box(fx, 2, 29, 30, '#c8ccd4')
    cv.vline(fx + 14, 3, 28, '#8c92a0')
    cv.vline(fx + 1, 3, 28, '#e8ecf2'); cv.vline(fx + 15, 3, 28, '#e8ecf2')
    cv.rect(fx + 11, 10, 2, 8, '#4a4e60'); cv.rect(fx + 17, 10, 2, 8, '#4a4e60')
    cv.rect(fx + 3, 22, 8, 2, '#9aa2b4'); cv.rect(fx + 18, 22, 8, 2, '#9aa2b4')
    # 물·반찬 셀프 통 (냉장고 옆)
    cv.box(164, 21, 10, 10, '#e8ecf2'); cv.rect(166, 23, 6, 3, '#96d2f0'); cv.p(169, 28, '#4278d2')

    # ---------- 계산대 (3줄, 1~11칸): 음식 진열대 ----------
    x0, x1, y0 = 16, 192, 48
    cv.rect(x0, y0, x1 - x0, 16, K)
    cv.rect(x0, y0 + 1, x1 - x0, 6, '#c8ccd4')          # 스테인리스 상판
    cv.hline(x0, y0 + 1, x1 - x0, '#eef0f4')
    cv.hline(x0, y0 + 6, x1 - x0, '#9aa2b4')
    cv.rect(x0, y0 + 7, x1 - x0, 7, '#f8f6f0')          # 앞판
    for k, c in enumerate(['#f4c846', '#6eb45a', '#ee8032', '#f4c846', '#6eb45a', '#ee8032', '#f4c846', '#6eb45a', '#ee8032', '#f4c846', '#6eb45a']):
        cv.rect(x0 + k * 16 + 1, y0 + 10, 14, 4, c)
    cv.hline(x0, y0 + 9, x1 - x0, '#dcdcd4')
    cv.hline(x0, y0 + 15, x1 - x0, K); cv.vline(x1 - 1, y0, 16, K)
    cv.blend(16, 64, 176, 2, K, 0.18)

    def tray(x, w, fill):
        cv.rect(x, y0, w, 7, K)
        cv.rect(x + 1, y0 + 1, w - 2, 5, '#9aa2b4')
        fill(x + 2, y0 + 2, w - 4)
    # 튀김
    def twigim(x, y, w):
        cv.rect(x, y, w, 3, '#e0a848')
        for i in range(x, x + w - 2, 4):
            cv.rect(i, y, 3, 2, '#f4c846'); cv.p(i + 1, y + 2, '#c48e28')
    tray(18, 24, twigim)
    # 순대 + 김밥
    def sundae(x, y, w):
        cv.rect(x, y, w, 3, '#5a3a4a')
        for i in range(x, x + w, 3):
            cv.p(i, y + 1, '#8a6a7a')
    tray(44, 14, sundae)
    for k in range(3):
        cv.sprite(60 + k * 6, y0 - 1, ['.kkk.', 'kgygk', 'kgogk', '.kkk.'], {'k': K, 'g': '#2c3a30', 'y': '#f4c846', 'o': '#ee8032'})
    # 떡볶이 큰 판 (사장님 앞)
    def tteok(x, y, w):
        cv.rect(x, y, w, 3, '#dc4646')
        for i in range(x, x + w - 3, 3):
            cv.rect(i + (i // 3) % 2, y + (i // 5) % 2, 2, 1, '#fce8c8')
        for i in range(x + 1, x + w, 7):
            cv.p(i, y + 2, '#f4c846')
    tray(80, 44, tteok)
    # 소복하게 쌓인 떡볶이
    for i in range(83, 121, 2):
        h = 2 if 88 <= i <= 114 else 1
        cv.rect(i, y0 + 1 - h, 2, h, '#dc4646' if (i // 2) % 3 else '#fce8c8')
    for i in range(84, 120, 5):
        cv.p(i, y0 - 1, '#fce8c8')
    cv.vline(122, y0 - 6, 7, '#a87444'); cv.rect(120, y0 - 7, 5, 2, '#c48e58')   # 주걱
    # 어묵 국물 (꼬치)
    def eomuk(x, y, w):
        cv.rect(x, y, w, 3, '#b8823e')
        cv.hline(x, y, w, '#d4a05a')
    tray(128, 26, eomuk)
    for i in range(131, 152, 4):
        cv.vline(i, y0 - 6, 8, '#c48e58')
        cv.rect(i - 1, y0 + 1, 3, 2, '#e8c090')
    # 밥솥
    cv.box(162, y0 - 10, 16, 14, '#c8ccd4')
    cv.rect(163, y0 - 9, 14, 3, '#e8ecf2'); cv.rect(168, y0 - 12, 4, 2, K)
    cv.rect(166, y0 - 4, 8, 3, '#4a4e60'); cv.p(172, y0 - 3, '#dc4646')
    # 수저통·컵
    cv.box(181, y0 - 4, 7, 8, '#8c92a0')
    for i in (182, 184, 186):
        cv.vline(i, y0 - 8, 4, '#ccd0d8')

    # ---------- 손님 탁자 T (3~4,5) (9~10,5) ----------
    def table(tx):
        x, y = tx * T, 80
        def chair(cx, cy, back):
            cv.box(cx, cy, 10, 6, '#c8a070')
            cv.rect(cx + 1, cy + 1, 8, 4, '#6c3c24'); cv.hline(cx + 1, cy + 1, 8, '#8a5a3a')
            if back:
                cv.rect(cx, cy - 4, 10, 4, K); cv.rect(cx + 1, cy - 3, 8, 2, '#d8b080')
        cv.blend(x + 3, y + 13, 28, 3, K, 0.2)
        chair(x + 4, y - 3, True); chair(x + 18, y - 3, True)
        cv.rect(x + 1, y + 1, 30, 11, K)
        cv.rect(x + 2, y + 2, 28, 7, '#a8dcd0')        # 민트색 상판
        cv.hline(x + 2, y + 2, 28, '#d0f0e8')
        cv.rect(x + 2, y + 9, 28, 2, '#78b0a4')
        cv.rect(x + 14, y + 11, 4, 3, '#8c92a0')
        # 수저통, 휴지, 물컵
        cv.box(x + 4, y + 2, 4, 5, '#8c92a0'); cv.vline(x + 5, y, 2, '#ccd0d8'); cv.vline(x + 6, y - 1, 3, '#ccd0d8')
        cv.box(x + 10, y + 3, 4, 4, '#f8f6f0')
        cv.box(x + 24, y + 3, 4, 4, '#bfe4f4')
        chair(x + 4, y + 11, False); chair(x + 18, y + 11, False)
    table(3)
    table(9)
    # 왼쪽 탁자 위 떡볶이 한 접시
    cv.sprite(64, 82, ['.kkkkk.', 'kwrorwk', '.kkkkk.'], {'k': K, 'w': '#f8f6f0', 'r': '#dc4646', 'o': '#fce8c8'})

    # ---------- 옆벽·앞벽 ----------
    CAP, CAP2 = '#efe8da', '#c8bca4'
    for x in (12, 208):
        cv.rect(x, 0, 4, 116, CAP)
        cv.vline(x + (3 if x == 12 else 0), 0, 116, CAP2)
    cv.vline(11, 0, 116, K); cv.vline(212, 0, 116, K)
    cv.rect(12, 112, 200, 4, CAP); cv.hline(12, 112, 200, CAP2); cv.hline(12, 116, 200, K)
    cv.rect(12, 117, 200, 11, K)
    cv.blend(16, 108, 192, 4, K, 0.12)
    # 출입문 (6,7)
    dx = 96
    cv.rect(dx - 1, 112, 18, 16, K)
    cv.rect(dx, 112, 16, 16, '#d8d2c4')
    cv.rect(dx + 1, 113, 14, 14, '#7a6a5a')
    for j in range(115, 126, 2):
        cv.hline(dx + 2, j, 12, '#8e7e6c')
    cv.rect(dx - 3, 112, 3, 6, '#ccd0d8'); cv.rect(dx + 16, 112, 3, 6, '#ccd0d8')
    cv.vline(dx - 3, 112, 6, K); cv.vline(dx + 18, 112, 6, K)
    return cv



# ======================================================================
# 운동장 256x176 (16x11칸)
#   0, 10줄과 0, 15칸 = 나무(막힘)   위쪽 줄은 학교 건물로 그림
#   1 taaaaaaaaUUUUUat  U = 운동회 부스 천막
#   3 taaaaaaaaacccaat  c = 부스 탁자   도우미 (11,2), 선생님 (4,3)
#   5~7 g = 잔디 (3~11칸)              9 D = 나가는 곳 (8,9)
# ======================================================================
def field():
    import math, random
    rnd = random.Random(7)
    cv = Canvas(256, 176, '#3c7840')
    # ---------- 흙 운동장 ----------
    A1, A2, A3 = '#e6cf98', '#dcc288', '#f0dcaa'
    cv.rect(16, 16, 224, 144, A1)
    for _ in range(420):
        x, y = rnd.randrange(16, 240), rnd.randrange(16, 160)
        cv.p(x, y, A2 if rnd.random() < 0.7 else A3)
    for _ in range(40):
        x, y = rnd.randrange(16, 238), rnd.randrange(16, 158)
        cv.rect(x, y, 2, 1, '#c8ae74')

    # 트랙 선 (잔디 둘레 둥근 사각형 2줄)
    def oval(x0, y0, x1, y1, r, c):
        for x in range(x0 + r, x1 - r + 1):
            cv.p(x, y0, c); cv.p(x, y1, c)
        for y in range(y0 + r, y1 - r + 1):
            cv.p(x0, y, c); cv.p(x1, y, c)
        for a in range(0, 91, 2):
            t = math.radians(a)
            dx, dy = round(r * math.cos(t)), round(r * math.sin(t))
            cv.p(x1 - r + dx, y1 - r + dy, c); cv.p(x0 + r - dx, y1 - r + dy, c)
            cv.p(x1 - r + dx, y0 + r - dy, c); cv.p(x0 + r - dx, y0 + r - dy, c)
    oval(36, 70, 203, 137, 14, '#fbf6e8')
    oval(28, 62, 211, 145, 20, '#fbf6e8')
    # 출발선
    cv.rect(120, 138, 1, 7, '#fbf6e8'); cv.rect(122, 138, 1, 7, '#fbf6e8')

    # ---------- 인조 잔디 (3~11칸, 5~7줄) ----------
    gx0, gy0, gx1, gy1 = 48, 80, 192, 128
    for x in range(gx0, gx1):
        c = '#6eb45a' if ((x - gx0) // 16) % 2 == 0 else '#5ea24e'
        cv.rect(x, gy0, 1, gy1 - gy0, c)
    for _ in range(120):
        x, y = rnd.randrange(gx0, gx1), rnd.randrange(gy0, gy1)
        cv.p(x, y, '#82c46a' if rnd.random() < 0.5 else '#4e9244')
    W = '#f8f6f0'
    cv.hline(gx0 + 2, gy0 + 2, gx1 - gx0 - 4, W); cv.hline(gx0 + 2, gy1 - 3, gx1 - gx0 - 4, W)
    cv.vline(gx0 + 2, gy0 + 2, gy1 - gy0 - 4, W); cv.vline(gx1 - 3, gy0 + 2, gy1 - gy0 - 4, W)
    cv.vline(120, gy0 + 2, gy1 - gy0 - 4, W)
    for a in range(0, 360, 3):
        t = math.radians(a)
        cv.p(round(120 + 11 * math.cos(t)), round(104 + 10 * math.sin(t)), W)
    cv.rect(119, 103, 3, 2, W)
    for gx, d in ((gx0 + 2, 1), (gx1 - 3, -1)):        # 골대 앞 구역 + 작은 골대
        bx = gx if d == 1 else gx - 14
        cv.hline(bx, 94, 15, W); cv.hline(bx, 114, 15, W); cv.vline(gx + d * 14, 94, 21, W)
        nx = gx - 4 if d == 1 else gx + 1
        cv.rect(nx, 98, 4, 13, K); cv.rect(nx + (1 if d == 1 else 0), 99, 3, 11, W)
        cv.dither(nx + (1 if d == 1 else 0), 99, 3, 11, '#ccd0d8')
    # 잔디 위 공
    cv.sprite(150, 116, ['.kkk.', 'kwkwk', 'kkwkk', 'kwkwk', '.kkk.'], {'k': K, 'w': W})

    # ---------- 위쪽: 학교 건물 ----------
    cv.rect(0, 0, 256, 16, '#b8604a')                    # 벽돌
    for y in range(1, 14, 3):
        cv.hline(0, y, 256, '#a4523e')
    for y in range(0, 14, 3):
        for x in range((y % 2) * 4, 256, 8):
            cv.vline(x, y + 1, 2, '#a4523e')
    cv.rect(0, 0, 256, 3, '#f4c846'); cv.hline(0, 3, 256, '#c48e28')   # 노란 띠
    for x in range(6, 256, 14):                          # 창문
        if 104 <= x <= 146:
            continue
        cv.box(x, 5, 9, 7, '#bfe4f4'); cv.vline(x + 4, 6, 5, W); cv.p(x + 1, 6, '#ffffff')
    # 가운데 현관 + 구령대 지붕 + 시계
    cv.rect(106, 3, 44, 13, '#d8d4cc')
    cv.rect(104, 4, 48, 3, '#4a4e60'); cv.hline(104, 4, 48, '#6a6e82')
    cv.rect(116, 8, 24, 8, '#96d2f0'); cv.vline(127, 8, 8, '#d8d4cc'); cv.vline(128, 8, 8, '#d8d4cc')
    cv.box(108, 8, 6, 8, '#8c92a0'); cv.box(142, 8, 6, 8, '#8c92a0')
    cv.sprite(125, 0, ['.kkkk.', 'kwwkwk', 'kwwkwk', 'kwwwwk', '.kkkk.'], {'k': K, 'w': W})
    cv.hline(0, 15, 256, '#6c3c24')
    # 국기 게양대
    cv.vline(22, 0, 16, '#ccd0d8'); cv.vline(23, 0, 16, '#8c92a0')
    cv.sprite(24, 1, ['wwwwwww', 'wkwrwkw', 'wwrbwww', 'wkwbwkw', 'wwwwwww'], {'w': W, 'k': K, 'r': '#dc4646', 'b': '#4278d2'})
    # 학교 앞 화단 그림자
    cv.blend(16, 16, 224, 2, K, 0.18)

    # ---------- 둘레 나무 ----------
    def tree(x, y, v):
        cv.blend(x + 2, y + 13, 13, 3, K, 0.25)
        cv.sprite(x, y, [
            '.....kkkkk......',
            '...kk33332kk....',
            '..k3332222221k..',
            '.k33322222221k..',
            '.k3322222222211k',
            'k33222222222211k',
            'k32222222222111k',
            'k32222222221111k',
            '.k2222222211111k',
            '.k122222211111k.',
            '..k11111111kkk..',
            '...kkkkttkk.....',
            '.......tt.......',
            '......kttk......',
        ] if v == 0 else [
            '......kkkk......',
            '....kk3332kk....',
            '...k33322221k...',
            '..k3332222221k..',
            '..k3322222211k..',
            '.k332222222211k.',
            '.k322222222111k.',
            '.k222222221111k.',
            '..k1222221111k..',
            '...kk111111kk...',
            '.....kkttkk.....',
            '.......tt.......',
            '......ktttk.....',
            '................',
        ], {'k': K, '1': '#2c5a30', '2': '#3c7840', '3': '#6eb45a', 't': '#6c3c24'})
    cv.rect(0, 16, 16, 160, '#4e9244'); cv.rect(240, 16, 16, 160, '#4e9244'); cv.rect(16, 160, 224, 16, '#4e9244')
    # 울타리
    for x in range(0, 256, 4):
        cv.vline(x, 158, 3, '#f8f6f0')
    cv.hline(0, 159, 256, '#ccd0d8')
    for y in range(16, 176, 16):
        tree(0, y + 1, (y // 16) % 2)
        tree(240, y + 1, (y // 16 + 1) % 2)
    for x in range(16, 240, 16):
        if x == 128:
            continue
        tree(x, 161, (x // 16) % 2)
    # 교문 (8,10)
    cv.rect(128, 158, 16, 18, A1)
    cv.blend(128, 158, 16, 18, '#c8ae74', 0.4)
    for x in (124, 144):
        cv.box(x, 156, 5, 20, '#d8d4cc'); cv.rect(x, 155, 5, 2, '#8c92a0')

    # ---------- 만국기 (줄에 매단 작은 깃발) ----------
    flags = ['#dc4646', '#4278d2', '#f4c846', '#6eb45a', '#8c64c8', '#ee8032', '#f8f6f0']
    def bunting(xa, ya, xb, yb, sag, k0):
        pts = []
        n = xb - xa
        for i in range(n + 1):
            t = i / n
            y = round(ya + (yb - ya) * t + sag * 4 * t * (1 - t))
            pts.append((xa + i, y))
            cv.p(xa + i, y, '#6c6a7e')
        for k, (x, y) in enumerate(pts[4:-4:7]):
            c = flags[(k + k0) % len(flags)]
            cv.rect(x - 2, y + 1, 5, 2, c); cv.rect(x - 1, y + 3, 3, 1, c); cv.p(x, y + 4, c)
            cv.p(x - 2, y + 1, K) if c == '#f8f6f0' else None
    bunting(14, 18, 140, 22, 10, 0)
    bunting(14, 40, 140, 22, 8, 3)

    # ---------- 운동회 부스 천막 U (9~13, 1) ----------
    ux0, ux1 = 144, 224
    cv.blend(ux0, 32, ux1 - ux0, 4, K, 0.15)
    cv.rect(ux0, 16, ux1 - ux0, 13, K)
    stripes = ['#f8f6f0', '#f4c846', '#f8f6f0', '#ee8032', '#f8f6f0', '#dc4646']
    for k, x in enumerate(range(ux0 + 1, ux1 - 1, 8)):
        cv.rect(x, 17, 8, 10, stripes[k % len(stripes)])
        cv.vline(x, 17, 10, '#d8d2c4' if stripes[k % len(stripes)] == '#f8f6f0' else '#c86a2a')
    cv.hline(ux0 + 1, 17, ux1 - ux0 - 2, '#ffffff')
    for k, x in enumerate(range(ux0 + 1, ux1 - 1, 8)):     # 물결 끝단
        c = stripes[k % len(stripes)]
        cv.rect(x + 1, 27, 6, 2, c); cv.hline(x + 2, 29, 4, c); cv.hline(x + 2, 30, 4, K)
        cv.p(x, 27, K); cv.p(x + 7, 27, K)
    cv.rect(ux0, 27, 1, 3, '#8c92a0'); cv.rect(ux1 - 1, 27, 1, 3, '#8c92a0')
    cv.box(176, 18, 16, 7, W); cv.rect(178, 20, 12, 1, '#dc4646'); cv.rect(179, 22, 10, 1, '#4278d2')   # 부스 이름표

    # ---------- 부스 탁자 c (10~12, 3) ----------
    x0, y0, w = 160, 48, 48
    cv.blend(x0, y0 + 15, w, 2, K, 0.22)
    cv.rect(x0, y0 + 1, w, 14, K)
    cv.rect(x0 + 1, y0 + 2, w - 2, 5, W); cv.hline(x0 + 1, y0 + 2, w - 2, '#ffffff')
    cv.rect(x0 + 1, y0 + 7, w - 2, 7, '#4278d2'); cv.hline(x0 + 1, y0 + 7, w - 2, '#6a9ae0')
    for k, fx in enumerate(range(x0 + 3, x0 + w - 4, 7)):
        c = flags[k % 6]
        cv.rect(fx, y0 + 9, 4, 1, c); cv.rect(fx + 1, y0 + 10, 2, 1, c)
    # 물병, 메달, 응원봉, 바구니
    for k in range(3):
        cv.box(x0 + 3 + k * 4, y0 - 4, 4, 8, '#bfe4f4'); cv.rect(x0 + 4 + k * 4, y0 - 5, 2, 1, '#4278d2')
    cv.sprite(x0 + 17, y0, ['r.b', '.r.', 'kyk', 'yYy', 'kyk'], {'r': '#dc4646', 'b': '#4278d2', 'k': K, 'y': '#f4c846', 'Y': '#c48e28'})
    cv.sprite(x0 + 23, y0, ['b.r', '.b.', 'kgk', 'gGg', 'kgk'], {'r': '#dc4646', 'b': '#4278d2', 'k': K, 'g': '#ccd0d8', 'G': '#8c92a0'})
    cv.rect(x0 + 30, y0 - 3, 2, 7, '#dc4646'); cv.rect(x0 + 33, y0 - 4, 2, 8, '#4278d2'); cv.rect(x0 + 36, y0 - 3, 2, 7, '#f4c846')
    cv.box(x0 + 39, y0 - 2, 7, 6, '#c48e58'); cv.p(x0 + 41, y0 - 3, '#ee8032'); cv.p(x0 + 43, y0 - 3, W)
    return cv



# ======================================================================
# [초안] 편의점 224x128 (14x8칸) — 배치 그림 기준, 칸 지도는 아직 게임에 없음
#   0~1 벽 진열대(1~5, 9~12칸) + 음료 냉장고(6~8칸)
#   3,5 진열대 섬 (2~3, 6~7칸)   5 키오스크(1,5), 계산대(9~11,5)
#   점원 (10,4), 손님 자리 (10,6), 장바구니 (12,6), 문 (6,7)
# ======================================================================
PRODUCTS = ['#dc4646', '#f4c846', '#4278d2', '#6eb45a', '#ee8032', '#f6a0b4', '#8c64c8', '#96d2f0', '#f8f6f0']


def products(cv, x, y, w, h, seed):
    """진열대 한 칸에 물건 줄 세우기"""
    i = x
    k = seed
    while i < x + w:
        pw = 2 + (k * 7) % 3
        pw = min(pw, x + w - i)
        c = PRODUCTS[(k * 5 + seed) % len(PRODUCTS)]
        ph = h - (k % 2)
        cv.rect(i, y + h - ph, pw, ph, c)
        cv.p(i, y + h - ph, '#ffffff' if c != '#f8f6f0' else '#dcdcd4')
        i += pw + (1 if k % 4 == 0 else 0)
        k += 1


def convenience():
    cv = Canvas(224, 128)
    MINT, MINT2 = '#7cc4c8', '#5aa6ac'
    # ---------- 바닥: 흰 타일 ----------
    F1, F2, FG = '#f2f2ee', '#e8e8e2', '#d4d4cc'
    for ty in range(2, 7):
        for tx in range(1, 13):
            x0, y0 = tx * T, ty * T
            cv.rect(x0, y0, T, T, F1 if (tx + ty) % 2 == 0 else F2)
            cv.hline(x0, y0, T, FG); cv.vline(x0, y0, T, FG)
            cv.p(x0 + 2, y0 + 2, '#ffffff'); cv.p(x0 + 3, y0 + 2, '#ffffff')
    # 형광등 반사 (바닥에 비친 길쭉한 빛)
    for x in (40, 112, 184):
        for j in range(36, 108, 24):
            cv.hline(x - 6, j, 12, '#ffffff'); cv.hline(x - 4, j + 1, 8, '#ffffff')

    # ---------- 뒷벽: 흰 벽 + 민트 띠 ----------
    cv.rect(16, 0, 192, 32, '#f8f8f4')
    cv.rect(16, 0, 192, 1, K)
    cv.rect(16, 1, 192, 2, MINT); cv.hline(16, 3, 192, MINT2)

    # 벽 진열대 (1~5칸, 9~12칸)
    def wall_shelf(x0, x1, seed):
        cv.rect(x0, 4, x1 - x0, 28, K)
        cv.rect(x0 + 1, 5, x1 - x0 - 2, 26, '#e6e2d8')
        for k, sy in enumerate((6, 13, 20)):
            products(cv, x0 + 2, sy, x1 - x0 - 4, 5, seed + k * 3)
            cv.rect(x0 + 1, sy + 5, x1 - x0 - 2, 2, '#f8f6f0')        # 선반 + 가격표 줄
            cv.hline(x0 + 1, sy + 6, x1 - x0 - 2, '#c8c4b8')
            for px in range(x0 + 4, x1 - 3, 9):
                cv.p(px, sy + 5, '#f4c846')
        cv.rect(x0 + 1, 27, x1 - x0 - 2, 4, '#dcd8cc')                 # 아래 받침
        cv.hline(x0 + 1, 27, x1 - x0 - 2, '#c8c4b8')
        cv.hline(x0, 31, x1 - x0, K)
    wall_shelf(16, 96, 1)
    wall_shelf(144, 208, 4)

    # 음료 냉장고 (6~8칸) + 24 간판
    cv.rect(96, 1, 48, 31, K)
    cv.rect(97, 2, 46, 3, '#6eb45a'); cv.hline(97, 2, 46, '#a8e0a0')
    cv.rect(97, 5, 46, 6, '#f8f6f0')
    text(cv, 100, 6, '24', '#dc4646')
    cv.rect(110, 7, 18, 3, '#6eb45a')
    for k in range(3):
        dx = 97 + k * 16
        cv.rect(dx, 11, 15, 20, '#bfe4f4')
        cv.vline(dx + 15, 11, 20, K)
        for row, by in enumerate((12, 18, 24)):
            for b in range(4):
                c = PRODUCTS[(k * 4 + b + row * 2) % 7]
                bx = dx + 1 + b * 3 + (row % 2)
                cv.rect(bx, by + 1, 2, 4, c); cv.p(bx, by, '#ccd0d8')
            cv.hline(dx, by + 5, 15, '#8cbcd4')
        cv.vline(dx + 1, 11, 20, '#e8f6fe')
        cv.rect(dx + 12, 18, 1, 5, '#8c92a0')                           # 손잡이
    cv.blend(97, 11, 46, 20, '#ffffff', 0.12)
    cv.hline(96, 31, 48, K)

    # ---------- 진열대 섬 (2~3, 6~7칸 / 3·5줄) ----------
    def island(tx, ty, seed):
        x, y, w = tx * T, ty * T, 32
        cv.blend(x + 2, y + 15, w, 2, K, 0.2)
        cv.rect(x, y, w, 15, K)
        cv.rect(x + 1, y + 1, w - 2, 2, '#f8f6f0')                     # 위 덮개
        products(cv, x + 2, y + 3, w - 4, 4, seed)
        cv.rect(x + 1, y + 7, w - 2, 1, '#c8c4b8')
        products(cv, x + 2, y + 8, w - 4, 4, seed + 5)
        cv.rect(x + 1, y + 12, w - 2, 2, '#dcd8cc')
        cv.p(x + 5, y + 7, '#f4c846'); cv.p(x + 16, y + 7, '#f4c846'); cv.p(x + 26, y + 7, '#f4c846')
    island(2, 3, 2); island(6, 3, 7); island(2, 5, 11); island(6, 5, 3)

    # ---------- 키오스크 (1,5) ----------
    kx, ky = 18, 66
    cv.blend(kx, ky + 28, 13, 2, K, 0.25)
    cv.box(kx, ky, 12, 30, '#f8f6f0')
    cv.box(kx + 1, ky + 2, 10, 12, '#2a2a36')
    cv.rect(kx + 2, ky + 3, 8, 10, '#4278d2')
    cv.rect(kx + 3, ky + 4, 6, 2, '#96d2f0'); cv.rect(kx + 3, ky + 7, 2, 2, '#f4c846'); cv.rect(kx + 6, ky + 7, 2, 2, '#f6a0b4'); cv.rect(kx + 3, ky + 10, 5, 1, '#f8f6f0')
    cv.rect(kx + 3, ky + 16, 6, 1, K); cv.rect(kx + 4, ky + 18, 4, 2, '#8c92a0')   # 카드 넣는 곳
    cv.rect(kx + 1, ky + 22, 10, 7, MINT); cv.hline(kx + 1, ky + 22, 10, '#a8dcdc')

    # ---------- 계산대 (9~11, 5) ----------
    x0, y0, w = 144, 80, 48
    cv.blend(x0, y0 + 15, w, 2, K, 0.22)
    cv.rect(x0, y0, w, 15, K)
    cv.rect(x0 + 1, y0 + 1, w - 2, 5, MINT); cv.hline(x0 + 1, y0 + 1, w - 2, '#a8dcdc')
    cv.hline(x0 + 1, y0 + 5, w - 2, MINT2)
    cv.rect(x0 + 1, y0 + 6, w - 2, 8, '#f8f6f0'); cv.hline(x0 + 1, y0 + 6, w - 2, '#ffffff')
    cv.vline(x0 + 16, y0 + 7, 7, '#dcdcd4'); cv.vline(x0 + 32, y0 + 7, 7, '#dcdcd4')
    cv.rect(x0 + 1, y0 + 12, w - 2, 2, '#6eb45a')
    # 따뜻한 간식 진열장 (왼쪽)
    cv.box(x0 + 2, y0 - 8, 13, 11, '#ccd0d8')
    cv.rect(x0 + 3, y0 - 7, 11, 9, '#fff0c8')
    cv.hline(x0 + 3, y0 - 3, 11, '#9aa2b4')
    cv.rect(x0 + 4, y0 - 6, 3, 2, '#e0a848'); cv.rect(x0 + 8, y0 - 6, 4, 2, '#c48e28'); cv.rect(x0 + 4, y0 - 2, 4, 2, '#dc4646'); cv.rect(x0 + 9, y0 - 2, 3, 2, '#e0a848')
    cv.p(x0 + 4, y0 - 7, '#ffffff')
    # 계산기(POS) — 점원 앞
    cv.box(x0 + 21, y0 - 7, 10, 7, '#3a3a48')
    cv.rect(x0 + 22, y0 - 6, 8, 5, '#96d2f0'); cv.hline(x0 + 23, y0 - 4, 5, '#4278d2')
    cv.rect(x0 + 24, y0, 4, 2, '#3a3a48')
    cv.box(x0 + 18, y0 + 1, 4, 3, '#4a4e60')                            # 카드 단말기
    # 사탕·껌 진열 (오른쪽)
    cv.box(x0 + 35, y0 - 5, 11, 8, '#f8f6f0')
    products(cv, x0 + 36, y0 - 4, 9, 2, 6); products(cv, x0 + 36, y0, 9, 2, 2)
    cv.sprite(x0 + 41, y0 - 11, ['.kkk.', 'kcpck', 'kpcpk', '.kkk.', '.krk.', '.kkk.'], {'k': K, 'c': '#96d2f0', 'p': '#f6a0b4', 'r': '#dc4646'})  # 뽑기

    # ---------- 장바구니 (12,6) ----------
    bx, by = 194, 98
    cv.blend(bx, by + 8, 12, 2, K, 0.2)
    for k in range(3):
        yy = by + 4 - k * 2
        cv.rect(bx, yy, 11, 5, K); cv.rect(bx + 1, yy + 1, 9, 3, '#dc4646'); cv.hline(bx + 1, yy + 1, 9, '#f07878')
    cv.sprite(bx + 1, by - 4, ['.kkkkkkk.', 'k.......k', 'k.......k'], {'k': K})   # 손잡이

    # ---------- 옆벽·앞벽·자동문 ----------
    CAP, CAP2 = '#eef0ec', '#b8c4c0'
    for x in (12, 208):
        cv.rect(x, 0, 4, 116, CAP)
        cv.vline(x + (3 if x == 12 else 0), 0, 116, CAP2)
    cv.vline(11, 0, 116, K); cv.vline(212, 0, 116, K)
    cv.rect(12, 112, 200, 4, CAP); cv.hline(12, 112, 200, CAP2); cv.hline(12, 116, 200, K)
    cv.rect(12, 117, 200, 11, K)
    cv.blend(16, 108, 192, 4, K, 0.10)
    cv.rect(96, 108, 16, 4, MINT)                                       # 입구 안내선
    dx = 96
    cv.rect(dx - 1, 112, 18, 16, K)
    cv.rect(dx, 112, 16, 16, '#d8dcd8')
    cv.rect(dx + 1, 113, 14, 14, '#5a6670')
    for j in range(115, 126, 2):
        cv.hline(dx + 2, j, 12, '#6e7a86')
    cv.rect(dx - 3, 112, 3, 6, '#bfe4f4'); cv.rect(dx + 16, 112, 3, 6, '#bfe4f4')
    cv.vline(dx - 3, 112, 6, K); cv.vline(dx + 18, 112, 6, K)
    return cv



def hangul(cv, x, y, s, c, outline=None):
    """Unifont(16px 도트 글꼴)로 글자 찍기. 글자 높이 약 14px"""
    from PIL import ImageDraw, ImageFont
    f = ImageFont.truetype('/usr/share/fonts/opentype/unifont/unifont.otf', 16)
    im = Image.new('1', (len(s) * 16 + 4, 18), 0)
    d = ImageDraw.Draw(im); d.fontmode = '1'
    d.text((0, 0), s, font=f, fill=1)
    bb = im.getbbox()
    pts = [(i - bb[0], j - bb[1]) for j in range(bb[1], bb[3]) for i in range(bb[0], bb[2]) if im.getpixel((i, j))]
    if outline:
        for i, j in pts:
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1)):
                cv.p(x + i + di, y + j + dj, outline)
    for i, j in pts:
        cv.p(x + i, y + j, c)
    return bb[2] - bb[0], bb[3] - bb[1]


def hangul_size(s):
    from PIL import ImageDraw, ImageFont
    f = ImageFont.truetype('/usr/share/fonts/opentype/unifont/unifont.otf', 16)
    im = Image.new('1', (len(s) * 16 + 4, 18), 0)
    d = ImageDraw.Draw(im); d.fontmode = '1'
    d.text((0, 0), s, font=f, fill=1)
    bb = im.getbbox()
    return bb[2] - bb[0], bb[3] - bb[1]


# ======================================================================
# [초안] 대형마트 256x176 (16x11칸) — 칸 지도는 아직 게임에 없음 (제안안은 docs/room-drafts/README.md)
#   0~1 벽: 음료 냉장고(1~4) / MART 간판 + 유제품 냉장 진열대(5~9) / 벽 선반(10~14)
#   3 식품(2~3), 생활용품(6~7), 과일(10~11) 진열대 — 2줄에 매달린 표지판
#   4~5 세로 진열대 (4칸, 8칸), 채소 매대 (13칸)
#   7 벨트 계산대 3곳: 1번(2~4), 2번(6~8), 3번(10~12, 점원 11,6)
#   키오스크(14,7) 손님 자리(11,8) 카트(3,9) 문(7,9)
# ======================================================================
def mart():
    cv = Canvas(256, 176)
    TEAL, TEAL2, TEAL3, ICE = '#2a9ea8', '#1e7a84', '#7cd0d6', '#cdeef2'
    # ---------- 바닥: 베이지 타일 ----------
    F1, F2, FG = '#f2e2c8', '#ead8ba', '#d8c2a0'
    for ty in range(2, 10):
        for tx in range(1, 15):
            x0, y0 = tx * T, ty * T
            cv.rect(x0, y0, T, T, F1 if (tx + ty) % 2 == 0 else F2)
            cv.hline(x0, y0, T, FG); cv.vline(x0, y0, T, FG)
            cv.p(x0 + 2, y0 + 2, '#fbf2e2'); cv.p(x0 + 3, y0 + 2, '#fbf2e2')
    # 계산대 앞 통로 안내선 (노란 줄)
    for x in range(16, 240, 6):
        cv.rect(x, 130, 3, 1, '#e8b830')

    # ---------- 뒷벽: 갈색 벽 ----------
    cv.rect(16, 0, 224, 32, '#c89a6e')
    for y in range(4, 30, 6):
        cv.hline(16, y, 224, '#bc8e62')
    cv.rect(16, 0, 224, 2, K)
    cv.hline(16, 2, 224, '#dcb48a')

    # 음료 냉장고 (1~4칸): 유리문 4개
    for k in range(4):
        dx = 16 + k * 16
        cv.rect(dx, 3, 16, 29, K)
        cv.rect(dx + 1, 4, 14, 3, TEAL); cv.hline(dx + 1, 4, 14, TEAL3)
        cv.rect(dx + 1, 7, 14, 23, ICE)
        for row, by in enumerate((8, 14, 20)):
            for b in range(4):
                c = ['#dc4646', '#6eb45a', '#f4c846', '#4278d2', '#f8f6f0', '#ee8032'][(k + b + row) % 6]
                bx = dx + 2 + b * 3
                cv.rect(bx, by + 1, 2, 4, c); cv.p(bx, by, '#8c92a0')
            cv.hline(dx + 1, by + 5, 14, '#8cc4d0')
        cv.vline(dx + 2, 7, 22, '#ffffff')
        cv.rect(dx + 12, 15, 1, 6, '#8c92a0')
        cv.rect(dx + 1, 27, 14, 3, TEAL2)
    # 가운데: MART 간판 + 유제품 냉장 진열대 (5~9칸)
    cv.box(86, 2, 68, 17, '#dc4646')
    cv.hline(87, 3, 66, '#f07878'); cv.hline(87, 17, 66, '#a83636')
    w, h = hangul_size('MART')
    hangul(cv, 120 - w // 2, 3, 'MART', '#f4c846')
    cv.rect(80, 19, 80, 13, K)
    cv.rect(81, 20, 78, 2, TEAL); cv.hline(81, 20, 78, TEAL3)
    for row, by in enumerate((22, 26)):
        cv.rect(81, by, 78, 4, '#e8f4f8')
        i = 82
        k = row
        while i < 157:
            c = ['#f8f6f0', '#96d2f0', '#f6a0b4', '#f4c846', '#f8f6f0', '#6eb45a'][k % 6]
            cv.rect(i, by, 3, 3, c); cv.p(i, by, '#4278d2' if c == '#f8f6f0' else '#ffffff')
            i += 4; k += 1
        cv.hline(81, by + 3, 78, '#9ab8c4')
    cv.blend(81, 22, 78, 8, '#ffffff', 0.10)
    cv.hline(80, 31, 80, K)
    # 오른쪽 벽 선반 (10~14칸, 하늘색)
    cv.rect(160, 3, 80, 29, K)
    cv.rect(161, 4, 78, 27, '#bfe4f0')
    for k, sy in enumerate((5, 12, 19)):
        products(cv, 162, sy, 76, 5, 3 + k * 4)
        cv.rect(161, sy + 5, 78, 2, '#8cc4d8'); cv.hline(161, sy + 6, 78, '#5aa0bc')
    cv.rect(161, 26, 78, 5, '#a87444'); cv.hline(161, 26, 78, '#c48e58')
    cv.hline(16, 31, 224, K)

    # ---------- 진열대 섬 (3줄): 식품 · 생활용품 / 과일 매대 ----------
    def gondola(tx, seed):
        x, y, w = tx * T, 48, 32
        cv.blend(x + 2, y + 15, w, 2, K, 0.2)
        cv.rect(x, y, w, 15, K)
        cv.rect(x + 1, y + 1, w - 2, 2, '#bfe4f0')
        products(cv, x + 2, y + 3, w - 4, 4, seed)
        cv.rect(x + 1, y + 7, w - 2, 1, '#5aa0bc')
        products(cv, x + 2, y + 8, w - 4, 4, seed + 5)
        cv.rect(x + 1, y + 12, w - 2, 2, '#a87444')
    gondola(2, 2)
    # 생활용품: 세제통·휴지 묶음
    x, y = 96, 48
    cv.blend(x + 2, y + 15, 32, 2, K, 0.2)
    cv.rect(x, y, 32, 15, K)
    cv.rect(x + 1, y + 1, 30, 2, '#bfe4f0')
    for k in range(5):
        c = ['#4278d2', '#f6a0b4', '#6eb45a', '#96d2f0', '#8c64c8'][k]
        cv.rect(x + 2 + k * 6, y + 3, 5, 4, c); cv.rect(x + 3 + k * 6, y + 2, 2, 1, '#f8f6f0')
    cv.rect(x + 1, y + 7, 30, 1, '#5aa0bc')
    for k in range(4):
        cv.rect(x + 2 + k * 7, y + 8, 6, 4, '#f8f6f0'); cv.hline(x + 2 + k * 7, y + 10, 6, '#96d2f0')
    cv.rect(x + 1, y + 12, 30, 2, '#a87444')
    # 과일: 나무 상자 매대
    x, y = 160, 48
    cv.blend(x + 2, y + 15, 32, 2, K, 0.2)
    cv.rect(x, y, 32, 15, K)
    cv.rect(x + 1, y + 1, 30, 13, '#a87444')
    fruits = [('#dc4646', '#f07878'), ('#ee8032', '#f6a860'), ('#f4c846', '#f8e08c'), ('#8c64c8', '#b494e0')]
    for k, (c, hl) in enumerate(fruits):
        bx = x + 2 + k * 7 + (k // 2)
        cv.rect(bx, y + 2, 7, 8, '#6c3c24')
        for j in range(3):
            for i2 in range(3):
                cv.rect(bx + 1 + i2 * 2, y + 3 + j * 2, 2, 2, c); cv.p(bx + 1 + i2 * 2, y + 3 + j * 2, hl)
    cv.rect(x + 1, y + 10, 30, 4, '#c48e58'); cv.hline(x + 1, y + 10, 30, '#e0aa70')
    for i2 in range(x + 4, x + 30, 8):
        cv.vline(i2, y + 11, 3, '#8a5a3a')
    cv.box(x + 24, y - 3, 7, 5, '#f8f6f0'); cv.p(x + 27, y - 1, '#dc4646')   # 가격표

    # 매달린 구역 표지판 (2줄)
    def sign(cx, label, fill, edge):
        w, h = hangul_size(label)
        sw = w + 8
        x0 = cx - sw // 2
        cv.vline(x0 + 3, 30, 2, '#6c6a7e'); cv.vline(x0 + sw - 4, 30, 2, '#6c6a7e')
        cv.rect(x0, 31, sw, 17, K)
        cv.rect(x0 + 1, 32, sw - 2, 15, fill)
        cv.hline(x0 + 1, 32, sw - 2, '#ffffff'); cv.hline(x0 + 1, 46, sw - 2, edge)
        hangul(cv, x0 + 4, 33, label, K)
    sign(48, '식품', '#f4c846', '#c48e28')
    sign(112, '생활용품', '#96d2f0', '#4a9ac8')
    sign(176, '과일', '#f6a0b4', '#c86482')

    # ---------- 세로 진열대 (4칸, 8칸 / 4~5줄) ----------
    def vshelf(tx, seed):
        x, y = tx * T, 64
        cv.blend(x + 2, y + 31, 13, 2, K, 0.2)
        cv.rect(x + 1, y, 14, 31, K)
        cv.rect(x + 2, y + 1, 12, 21, '#bfe4f0')
        cv.vline(x + 7, y + 1, 21, '#5aa0bc'); cv.vline(x + 8, y + 1, 21, '#5aa0bc')
        for j in range(y + 2, y + 21, 3):                       # 양옆으로 보이는 물건 윗면
            cv.rect(x + 2, j, 5, 2, PRODUCTS[(j + seed) % 8])
            cv.rect(x + 9, j, 5, 2, PRODUCTS[(j + seed + 3) % 8])
        cv.rect(x + 2, y + 22, 12, 1, '#5aa0bc')               # 앞쪽 끝 진열면
        products(cv, x + 3, y + 23, 10, 3, seed + 2)
        cv.rect(x + 2, y + 26, 12, 1, '#5aa0bc')
        products(cv, x + 3, y + 27, 10, 2, seed + 6)
        cv.rect(x + 2, y + 29, 12, 1, '#a87444')
    vshelf(4, 1)
    vshelf(8, 5)

    # 채소 매대 (13칸, 4~5줄): 세로 나무 상자
    x, y = 208, 64
    cv.blend(x + 2, y + 31, 13, 2, K, 0.2)
    cv.rect(x + 1, y, 14, 31, K)
    cv.rect(x + 2, y + 1, 12, 29, '#a87444')
    veg = [('#6eb45a', '#a8e0a0'), ('#ee8032', '#f6a860'), ('#dc4646', '#f07878'), ('#3c7840', '#6eb45a')]
    for k, (c, hl) in enumerate(veg):
        by = y + 2 + k * 7
        cv.rect(x + 3, by, 10, 6, '#6c3c24')
        for j in range(2):
            for i2 in range(4):
                cv.rect(x + 4 + i2 * 2, by + 1 + j * 2, 2, 2, c); cv.p(x + 4 + i2 * 2, by + 1 + j * 2, hl)
    cv.box(x + 9, y - 2, 6, 5, '#f8f6f0'); cv.p(x + 11, y, '#6eb45a')

    # ---------- 벨트 계산대 3곳 (7줄) ----------
    def lane(c0, num, open_, items):
        x, y = c0 * T, 112
        cv.blend(x, y + 15, 48, 2, K, 0.22)
        # 벨트 부분 (2칸)
        cv.rect(x, y + 1, 48, 14, K)
        cv.rect(x + 1, y + 2, 30, 2, ICE)                      # 벨트 옆 테두리
        cv.rect(x + 1, y + 4, 30, 4, '#4a4e5a')                # 검은 벨트
        for i2 in range(x + 2, x + 31, 3):
            cv.vline(i2, y + 4, 4, '#5e6270')
        cv.hline(x + 1, y + 8, 30, ICE)
        cv.rect(x + 1, y + 9, 30, 5, TEAL); cv.hline(x + 1, y + 9, 30, TEAL3)   # 청록 앞판
        cv.rect(x + 3, y + 3, 1, 6, '#f8f6f0') if not items else None
        # 계산 자리 (3번째 칸)
        rx = x + 32
        cv.rect(rx, y + 2, 15, 6, '#e8ecf2'); cv.hline(rx, y + 2, 15, '#ffffff')
        cv.rect(rx + 2, y + 4, 5, 3, '#96d2f0'); cv.hline(rx + 2, y + 4, 5, '#d8f0fa')   # 스캐너 유리
        cv.rect(rx + 9, y + 3, 4, 3, '#4a4e60')                 # 카드 단말기
        cv.rect(rx, y + 9, 15, 5, TEAL2); cv.hline(rx, y + 9, 15, TEAL)
        cv.vline(rx - 1, y + 2, 12, K)
        # 화면 (기둥 위)
        cv.vline(rx + 12, y - 3, 6, '#6c6a7e')
        cv.box(rx + 8, y - 9, 8, 7, '#3a3a48'); cv.rect(rx + 9, y - 8, 6, 5, '#96d2f0' if open_ else '#5a6070')
        # 계산대 번호 기둥 + 불빛
        cv.vline(x + 1, y - 10, 12, '#8c92a0')
        cv.box(x - 1, y - 16, 7, 8, '#f8f6f0')
        text(cv, x + 1, y - 15, str(num), K)
        cv.rect(x, y - 18, 5, 2, '#6eb45a' if open_ else '#dc4646')
        # 계산대 끝 사탕·껌 진열
        cv.box(x + 18, y - 6, 10, 7, '#f8f6f0')
        products(cv, x + 19, y - 5, 8, 2, num); products(cv, x + 19, y - 2, 8, 2, num + 4)
        # 벨트 위 물건 + 칸막이 막대
        for ix, c, wdt, hgt in items:
            cv.rect(x + ix, y + 7 - hgt, wdt, hgt, K)
            cv.rect(x + ix + 1, y + 8 - hgt, wdt - 2, hgt - 1, c)
            cv.p(x + ix + 1, y + 8 - hgt, '#ffffff')
        if items:
            cv.rect(x + 2, y + 4, 2, 3, '#f4c846')
    lane(2, 1, False, [])
    lane(6, 2, False, [])
    lane(10, 3, True, [(5, '#dc4646', 5, 5), (11, '#f8f6f0', 4, 6), (16, '#f4c846', 6, 4), (23, '#6eb45a', 5, 5)])

    # ---------- 셀프 계산 키오스크 (14,7) ----------
    kx, ky = 226, 98
    cv.blend(kx, ky + 28, 13, 2, K, 0.25)
    cv.box(kx, ky, 12, 29, '#f8f6f0')
    cv.box(kx + 1, ky + 2, 10, 9, '#2a2a36')
    cv.rect(kx + 2, ky + 3, 8, 7, '#6eb45a'); cv.rect(kx + 3, ky + 4, 6, 1, '#f8f6f0'); cv.rect(kx + 3, ky + 6, 3, 2, '#f4c846')
    cv.rect(kx + 2, ky + 13, 8, 3, '#96d2f0'); cv.hline(kx + 2, ky + 13, 8, '#d8f0fa')   # 스캐너
    cv.rect(kx + 1, ky + 18, 10, 10, TEAL); cv.hline(kx + 1, ky + 18, 10, TEAL3)
    cv.rect(kx + 3, ky + 20, 6, 1, K)

    # ---------- 카트 (3,9) ----------
    def cart(x, y):
        cv.sprite(x, y, [
            'rr...........',
            '.kkkkkkkkkkk.',
            '.kgkgkgkgkgk.',
            '.kkkkkkkkkkk.',
            '..kgkgkgkgk..',
            '..kkkkkkkkk..',
            '...k.....k...',
            '..kkkkkkkkk..',
            '..kk.....kk..',
        ], {'k': '#6c6a7e', 'g': '#ccd0d8', 'r': '#dc4646'})
    cv.blend(49, 156, 14, 2, K, 0.2)
    cart(49, 146); cart(51, 148)

    # ---------- 옆벽·앞벽·문 (7,9)→(7,10) ----------
    CAP, CAP2 = '#efe4d2', '#c4b090'
    for x in (12, 240):
        cv.rect(x, 0, 4, 164, CAP)
        cv.vline(x + (3 if x == 12 else 0), 0, 164, CAP2)
    cv.vline(11, 0, 164, K); cv.vline(244, 0, 164, K)
    cv.rect(12, 160, 232, 4, CAP); cv.hline(12, 160, 232, CAP2); cv.hline(12, 164, 232, K)
    cv.rect(12, 165, 232, 11, K)
    cv.blend(16, 156, 224, 4, K, 0.10)
    dx = 112
    cv.box(dx + 1, 146, 14, 12, '#6c6a7e')                       # 문 앞 매트
    for j in range(148, 157, 2):
        cv.hline(dx + 2, j, 12, '#8c8aa0')
    cv.rect(dx - 1, 160, 18, 16, K)
    cv.rect(dx, 160, 16, 16, '#d8dcd8')
    cv.rect(dx + 1, 161, 14, 15, '#5a6670')
    for j in range(163, 175, 2):
        cv.hline(dx + 2, j, 12, '#6e7a86')
    for gx in (dx - 4, dx + 17):                                  # 도난 방지 기둥
        cv.rect(gx, 154, 3, 10, '#ccd0d8'); cv.vline(gx, 154, 10, K); cv.p(gx + 1, 155, '#6eb45a')
    return cv


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    b = bank(); b.save(OUT / 'bank.png')
    c = classroom(); c.save(OUT / 'classroom.png')
    g = gym(); g.save(OUT / 'gym.png')
    h = home(); h.save(OUT / 'home.png')
    sb = snackbar(); sb.save(OUT / 'snackbar.png')
    fd = field(); fd.save(OUT / 'field.png')
    print('saved', *[OUT / n for n in ('bank.png', 'classroom.png', 'gym.png', 'home.png', 'snackbar.png', 'field.png')])
    DRAFT.mkdir(parents=True, exist_ok=True)
    cs = convenience(); cs.save(DRAFT / 'convenience.png'); cs.save(DRAFT / 'convenience_x4.png', 4)
    mt = mart(); mt.save(DRAFT / 'mart.png'); mt.save(DRAFT / 'mart_x4.png', 4)
    print('draft', DRAFT / 'convenience.png', DRAFT / 'mart.png')
