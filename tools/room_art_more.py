"""방 그림(도트) 초안: 편의점, 전통시장, 미용실
사용법: python3 tools/room_art_more.py
결과: assets/rooms/convenience.png (224x128), market.png (256x144), hairshop.png (224x128)

- 기본 도구(Canvas, 글자, 화분)는 tools/room_art.py 것을 그대로 씁니다.
- 1칸 = 16x16픽셀. 걸을 수 있는 곳·막힌 곳은 js/engine.js 의 칸 지도(convenienceMap, marketMap, hairshopMap)를 따릅니다.
- 사람은 게임이 따로 그리니 그림에 넣지 않습니다.
"""
import random
from room_art import Canvas, K, T, OUT, text, plant


def tile_floor(cv, x0, y0, x1, y1, c1, c2, line, hi=None):
    """바둑판 타일 바닥 (칸 단위 범위)"""
    for ty in range(y0, y1):
        for tx in range(x0, x1):
            x, y = tx * T, ty * T
            cv.rect(x, y, T, T, c1 if (tx + ty) % 2 == 0 else c2)
            cv.hline(x, y, T, line); cv.vline(x, y, T, line)
            if hi:
                cv.p(x + 2, y + 2, hi); cv.p(x + 3, y + 2, hi)


def room_shell(cv, w_tiles, h_tiles, door_x, wall, wall2, cap='#efe8da', cap2='#c8bca4'):
    """뒷벽(0~1줄), 옆벽, 앞벽과 문 (분식점 그림과 같은 방식)"""
    W, H = w_tiles * T, h_tiles * T
    cv.rect(16, 0, W - 32, 32, wall)
    cv.rect(16, 0, W - 32, 2, K)
    cv.hline(16, 2, W - 32, wall2)
    cv.rect(16, 30, W - 32, 1, wall2); cv.hline(16, 31, W - 32, K)
    for x in (12, W - 16):
        cv.rect(x, 0, 4, H - 12, cap)
        cv.vline(x + (3 if x == 12 else 0), 0, H - 12, cap2)
    cv.vline(11, 0, H - 12, K); cv.vline(W - 12, 0, H - 12, K)
    cv.rect(12, H - 16, W - 24, 4, cap); cv.hline(12, H - 16, W - 24, cap2); cv.hline(12, H - 12, W - 24, K)
    cv.rect(12, H - 11, W - 24, 11, K)
    cv.blend(16, H - 20, W - 32, 4, K, 0.12)
    dx = door_x * T
    cv.rect(dx - 1, H - 16, 18, 16, K)
    cv.rect(dx, H - 16, 16, 16, '#d8d2c4')
    cv.rect(dx + 1, H - 15, 14, 14, '#7a6a5a')
    for j in range(H - 13, H - 2, 2):
        cv.hline(dx + 2, j, 12, '#8e7e6c')
    cv.rect(dx - 3, H - 16, 3, 6, '#ccd0d8'); cv.rect(dx + 16, H - 16, 3, 6, '#ccd0d8')
    # 문으로 들어오는 빛
    cv.blend(dx, H - 32, 16, 16, '#fff8e0', 0.18)


GOODS = ['#dc4646', '#ee8032', '#f4c846', '#6eb45a', '#4278d2', '#8c64c8', '#f6a0b4', '#f8f6f0', '#96d2f0']


def shelf(cv, tx, ty, w_tiles, seed, h=16, top_y=None):
    """물건이 가득한 진열대 (칸 단위). 위에서 본 모습 + 앞면 칸칸이 물건"""
    rnd = random.Random(seed)
    x, y = tx * T, (top_y if top_y is not None else ty * T)
    w = w_tiles * T
    cv.blend(x + 2, y + h - 1, w - 2, 3, K, 0.22)
    cv.rect(x, y, w, h, K)
    cv.rect(x + 1, y + 1, w - 2, h - 2, '#e8e4da')
    for row in range(2):
        sy = y + 2 + row * 7
        cv.hline(x + 1, sy + 6, w - 2, '#bcb6a8')
        px = x + 2
        while px < x + w - 4:
            bw = rnd.choice([2, 3, 3, 4])
            c = rnd.choice(GOODS)
            cv.rect(px, sy + 1, bw, 5, c)
            cv.hline(px, sy + 1, bw, '#ffffff' if c != '#f8f6f0' else '#dedacc')
            cv.vline(px + bw, sy + 1, 5, K)
            px += bw + 1


def counter(cv, tx, ty, w_tiles, top='#f4c846', front='#c48e28', edge='#a06a24'):
    x, y, w = tx * T, ty * T, w_tiles * T
    cv.blend(x + 2, y + 14, w, 3, K, 0.2)
    cv.rect(x, y, w, 15, K)
    cv.rect(x + 1, y + 1, w - 2, 4, top)
    cv.rect(x + 1, y + 5, w - 2, 9, front)
    cv.hline(x + 1, y + 5, w - 2, edge)


def convenience():
    """편의점 224x128 (14x8칸)
      1 xHHHHHWWWHHHHx   H = 진열대(벽쪽)   W = 벽(냉장고·창문)
      3 xqHHqqHHqqqqqx   가운데 진열대
      5 xKHHqqHHqcccqx   K = 셀프 계산대   c = 계산대 (점원 10,4)
      7 xxxxxxDxxxxxxx   D = 문
    """
    cv = Canvas(224, 128)
    tile_floor(cv, 1, 2, 13, 7, '#f2f4f6', '#e6eaee', '#cfd6dc', '#ffffff')
    room_shell(cv, 14, 8, 6, '#eef6f8', '#c8dce4')
    # 뒷벽: 초록 띠 + 24 간판
    cv.rect(16, 3, 192, 3, '#6eb45a'); cv.hline(16, 6, 192, '#3c7840')
    cv.box(96, 8, 32, 11, '#f8f6f0'); text(cv, 100, 11, '24', '#dc4646'); cv.rect(110, 11, 14, 5, '#6eb45a')
    # 벽쪽 진열대 (1~5칸, 9~12칸)
    shelf(cv, 1, 1, 5, 11, h=30, top_y=2)
    shelf(cv, 9, 1, 4, 12, h=30, top_y=2)
    # 가운데 냉장고 (6~8칸, 1줄): 음료가 보이는 유리문
    cv.rect(96, 18, 48, 14, K)
    for i in range(3):
        gx = 97 + i * 16
        cv.rect(gx, 19, 15, 12, '#bfe4f4')
        for j in range(3):
            cv.rect(gx + 2 + j * 4, 22, 3, 7, GOODS[(i * 3 + j) % len(GOODS)])
        cv.vline(gx + 14, 19, 12, '#96d2f0')
    # 가운데 진열대 (2~3칸, 6~7칸) × 3, 5줄
    for ty, seed in ((3, 21), (5, 22)):
        shelf(cv, 2, ty, 2, seed + 1)
        shelf(cv, 6, ty, 2, seed + 2)
    # 셀프 계산대 (1,5)
    x, y = 16, 80
    cv.rect(x + 3, y, 10, 16, K); cv.rect(x + 4, y + 1, 8, 14, '#f8f6f0')
    cv.rect(x + 5, y + 2, 6, 6, '#4278d2'); cv.rect(x + 6, y + 3, 4, 3, '#96d2f0')
    cv.hline(x + 6, y + 10, 4, K); cv.rect(x + 6, y + 12, 4, 2, '#f4c846')
    # 계산대 (9~11칸, 5줄) + 계산기·바구니
    counter(cv, 9, 5, 3, '#f8f6f0', '#6eb45a', '#3c7840')
    cv.box(150, 79, 10, 6, '#3a3850'); cv.rect(152, 80, 6, 2, '#bfe4b0')
    cv.box(170, 80, 9, 5, '#dc4646')
    # 바닥 장바구니 더미
    cv.box(194, 98, 10, 7, '#dc4646'); cv.hline(195, 100, 8, '#f8f6f0')
    return cv


def market():
    """전통시장 256x144 (16x9칸, 바깥)
      0, 8줄 = 나무   1 tUUUUUssssUUUUUt  U = 가게 천막
      3 tscccssssssccc st  c = 가게 판매대 (채소 가게 3,2 / 떡집 12,2)
      5 tsHssssssssssHst  H = 과일·채소 상자   7 D = 나가는 곳 (7,7)
    """
    cv = Canvas(256, 144, '#9fd27e')
    # 돌길
    for ty in range(1, 8):
        for tx in range(1, 15):
            x, y = tx * T, ty * T
            cv.rect(x, y, T, T, '#d8ccb4' if (tx + ty) % 2 else '#e2d6c0')
            cv.hline(x, y + 15, T, '#c0b298'); cv.vline(x + 15, y, T, '#c0b298')
            if (tx * 7 + ty * 3) % 5 == 0:
                cv.rect(x + 5, y + 6, 3, 2, '#cdbfa4')
    # 나무 테두리
    def tree(x, y):
        cv.rect(x + 3, y + 1, 10, 11, K); cv.rect(x + 4, y + 2, 8, 9, '#3c7840'); cv.rect(x + 5, y + 3, 4, 4, '#6eb45a')
        cv.rect(x + 6, y + 11, 4, 4, K); cv.rect(x + 7, y + 11, 2, 4, '#a0643c')
    for tx in range(16):
        tree(tx * T, 0); tree(tx * T, 128)
    for ty in range(1, 8):
        tree(0, ty * T); tree(240, ty * T)
    # 가게 두 곳: 천막 + 판매대 + 물건
    def stall(tx0, w, c1, c2, goods, sign):
        x = tx0 * T
        cv.rect(x, 16, w * T, 14, K)
        for i in range(w * 4):
            cv.rect(x + i * 4, 17, 4, 11, c1 if i % 2 == 0 else c2)
        for i in range(w * 4):
            cv.rect(x + i * 4 + 1, 28, 2, 2, c1 if i % 2 == 0 else c2)
        # 간판
        cv.box(x + w * T // 2 - 14, 18, 28, 9, '#f8f6f0')
        cv.rect(x + w * T // 2 - 11, 21, 22, 3, sign)
        # 판매대 (3줄)
        counter(cv, tx0 + 1, 3, 3, '#e8c898', '#a0643c', '#6c3c24')
        for i, c in enumerate(goods):
            gx = (tx0 + 1) * T + 3 + i * 9
            cv.rect(gx, 47, 7, 3, K); cv.rect(gx + 1, 46, 5, 3, c); cv.p(gx + 2, 46, '#ffffff')
    stall(1, 5, '#6eb45a', '#f8f6f0', ['#dc4646', '#6eb45a', '#f4c846', '#ee8032', '#dc4646'], '#3c7840')
    stall(10, 5, '#dc4646', '#f8f6f0', ['#f6a0b4', '#f8f6f0', '#6eb45a', '#f6a0b4', '#c48e28'], '#962a2c')
    # 과일·채소 상자 (2,5) (13,5)
    def crate(tx, ty, c):
        x, y = tx * T, ty * T
        cv.blend(x + 1, y + 14, 15, 2, K, 0.25)
        cv.rect(x + 1, y + 4, 14, 11, K); cv.rect(x + 2, y + 5, 12, 9, '#c48e28')
        cv.hline(x + 2, y + 9, 12, '#a06a24')
        for i in range(4):
            cv.rect(x + 2 + i * 3, y + 2, 3, 3, c); cv.p(x + 3 + i * 3, y + 2, '#ffffff')
    crate(2, 5, '#dc4646'); crate(13, 5, '#6eb45a')
    # 나가는 곳 (7,7): 돌길이 밝아지는 입구
    cv.rect(112, 112, 16, 16, '#f2ead8'); cv.hline(112, 112, 16, '#c0b298')
    cv.rect(114, 124, 12, 3, '#a0643c')
    # 등(조명) 줄
    for x in range(24, 232, 16):
        cv.rect(x, 34, 3, 3, K); cv.p(x + 1, 35, '#f4c846')
    return cv


def hairshop():
    """미용실 224x128 (14x8칸)
      1 xWMMWMMWWWWWWx   M = 거울(벽)
      2 xqCqqCqqqqqqqx   C = 미용 의자
      3 xqqqqqqqqcccqx   c = 안내 데스크 (미용사 10,2)
      5 xqTTqqqqqqqqqx   T = 기다리는 소파
      7 xxxxxxDxxxxxxx
    """
    cv = Canvas(224, 128)
    # 체크무늬 바닥
    for ty in range(2, 7):
        for tx in range(1, 13):
            x, y = tx * T, ty * T
            for j in range(2):
                for i in range(2):
                    cv.rect(x + i * 8, y + j * 8, 8, 8, '#f8f6f0' if (i + j) % 2 == 0 else '#3a3850')
    cv.blend(16, 32, 192, 80, '#fbeaf0', 0.55)
    room_shell(cv, 14, 8, 6, '#fbeaf0', '#e8c4d0')
    # 분홍 줄무늬 벽지
    for x in range(16, 208, 8):
        cv.vline(x, 3, 27, '#f6d0dc')
    # 거울 두 개 (2~3칸, 5~6칸)
    for mx in (32, 80):
        cv.rect(mx + 2, 2, 28, 28, K); cv.rect(mx + 3, 3, 26, 26, '#bfe4f4')
        cv.rect(mx + 5, 5, 6, 3, '#f8f6f0'); cv.vline(mx + 22, 8, 14, '#96d2f0')
        cv.rect(mx + 4, 26, 24, 3, '#e8e4da')
        cv.box(mx + 6, 23, 4, 4, '#f6a0b4'); cv.box(mx + 20, 22, 3, 5, '#4278d2')   # 샴푸·스프레이
    # 미용 의자 (2,2) (5,2)
    for cx in (32, 80):
        cv.blend(cx + 2, 46, 14, 3, K, 0.25)
        cv.rect(cx + 3, 34, 10, 11, K); cv.rect(cx + 4, 35, 8, 6, '#dc4646'); cv.rect(cx + 4, 41, 8, 2, '#962a2c')
        cv.rect(cx + 7, 45, 2, 3, '#8c92a0'); cv.rect(cx + 4, 47, 8, 1, '#8c92a0')
    # 이발소 기둥 (왼쪽 벽)
    for j in range(4, 28, 4):
        cv.rect(18, j, 4, 2, '#dc4646'); cv.rect(18, j + 2, 4, 2, '#4278d2')
    # 안내 데스크 (9~11칸, 3줄) + 예약 노트, 꽃
    counter(cv, 9, 3, 3, '#f8f6f0', '#f6a0b4', '#c86482')
    cv.box(150, 47, 10, 5, '#f8f6f0'); cv.hline(152, 49, 6, K)
    cv.rect(172, 44, 4, 5, '#6eb45a'); cv.rect(171, 42, 6, 3, '#f6a0b4')
    # 기다리는 소파 (2~3칸, 5줄) + 잡지
    cv.blend(34, 94, 30, 3, K, 0.2)
    cv.rect(32, 82, 32, 13, K); cv.rect(33, 83, 30, 5, '#8c64c8'); cv.rect(33, 88, 30, 6, '#a888dc'); cv.hline(33, 88, 30, '#6a4aa8')
    cv.box(70, 86, 8, 6, '#f4c846')
    plant(cv, 192, 72)
    return cv


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (('convenience', convenience), ('market', market), ('hairshop', hairshop)):
        fn().save(OUT / f'{name}.png')
        print('saved', OUT / f'{name}.png')
