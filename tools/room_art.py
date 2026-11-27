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


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    b = bank(); b.save(OUT / 'bank.png')
    c = classroom(); c.save(OUT / 'classroom.png')
    print('saved', OUT / 'bank.png', OUT / 'classroom.png')
