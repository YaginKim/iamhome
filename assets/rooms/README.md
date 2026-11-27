# 방 그림

방(가게·은행·교실 등) 안쪽 바닥·벽·가구를 한 장으로 그린 PNG입니다. 사람은 게임이 따로 그립니다.

| 파일 | 지도 id | 크기 |
|---|---|---|
| `home.png` | `home` | 224×144 |
| `bank.png` | `bank_in` | 224×128 |
| `classroom.png` | `classroom` | 224×144 |
| `gym.png` | `gym` | 224×144 |

- `manifest.json`에 적힌 방만 그림을 읽고, 나머지 방은 예전처럼 칸 그림으로 그립니다.
- 다시 만들기: `python3 tools/room_art.py`
- 크기와 칸 위치는 `docs/room-templates/`를 참고하세요. 가구 위치를 바꾸면 `js/engine.js`의 칸 지도도 같이 바꿔야 합니다.
