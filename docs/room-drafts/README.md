# 방 그림 초안 (확인 전)

여기 그림은 아직 게임에 쓰지 않습니다. 확인을 받은 뒤 `assets/rooms/`로 옮기고 `manifest.json`과 칸 지도(`js/engine.js`)를 함께 추가합니다.

| 초안 | 크기 | 상태 |
|---|---|---|
| `convenience.png` (편의점) | 224×128 | 확인 대기 |
| `mart.png` (대형마트) | 256×176 | 확인 대기 |
| `hairshop.png` (미용실) | 224×128 | 확인 대기 |

- `*_x4.png`는 보기 편하게 4배로 키운 그림입니다.
- 다시 만들기: `python3 tools/room_art.py`

## 대형마트 칸 지도 제안 (16×11)

```
 0 xxxxxxxxxxxxxxxx
 1 xSSSSSSSSSSSSSSx   벽: 음료 냉장고 · MART 간판과 유제품 진열대 · 벽 선반
 2 xmmmmmmmmmmmmmmx
 3 xmGGmmGGmmPPmmmx   G 진열대(식품 2~3, 생활용품 6~7)  P 과일 매대(10~11)
 4 xmmmVmmmVmmmmCmx   V 세로 진열대(4, 8)  C 채소 매대(13)
 5 xmmmVmmmVmmmmCmx
 6 xmmmmmmmmmmmmmmx   점원 (11,6)
 7 xmLLRmLLRmLLRmKx   벨트 계산대 1번(2~4) 2번(6~8) 3번(10~12, 점원 있음)  K 셀프 키오스크(14)
 8 xmmmmmmmmmmmmmmx   손님 자리 (11,8)
 9 xmmYmmmDmmmmmmmx   Y 카트(3,9)  D 문(7,9)
10 xxxxxxxxxxxxxxxx
```

- 배치 그림에서 그대로 둔 곳: 점원, 계산대(10~12,7), 손님 자리, 식품·생활·과일 진열대(2,3)(6,3)(10,3), 키오스크, 카트, 문
- 바꾼 곳: 5줄 가로 진열대 3개 → 세로 진열대 2개(4·8칸) + 채소 매대(13칸), 계산대 2곳 추가(1·2번, 불 꺼진 상태)

## 미용실 칸 지도 제안 (14×8)

```
0 xxxxxxxxxxxxxx
1 xWWWWWWWWWWWWx   벽: 삼색 기둥 · 거울과 화장대 2개 · 샴푸대 · 시계 · 제품 선반
2 xqHqqHqSSqqqqx   H 미용 의자(2, 5)  S 샴푸 의자(7~8)  미용사 (10,2)
3 xqqqqqqqqcccqx   계산대 (9~11)
4 xqqqqqqqqqqqqx   손님 자리 (10,4)
5 xqVVTqqqqqqqPx   V 대기 소파(2~3)  T 잡지 탁자(4)  P 화분(12)
6 xqqqqqqqqqqqqx
7 xxxxxxDxxxxxxx   문 (6,7)
```

- 배치 그림에서 그대로 둔 곳: 미용사, 계산대, 손님 자리, 미용 의자 2개, 소파, 탁자, 화분, 문
- 새로 넣은 곳: 샴푸 의자(7~8, 2)
