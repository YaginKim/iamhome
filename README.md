# 다녀오겠습니다

> 낯선 길, 낯선 사람, 낯선 계산대. 그래도 한 걸음

특수교육 대상 학생을 위한 동네 심부름 어드벤처 웹게임입니다. 기획 내용은 [docs/기획서.md](docs/기획서.md)에 있습니다.

## 실행

빌드 과정이 없는 정적 사이트입니다. 폴더에서 아무 웹 서버나 켜면 됩니다.

```bash
python3 -m http.server 8000
```

그다음 브라우저에서 `http://localhost:8000`을 엽니다. 파일을 더블클릭해서 열면 데이터 파일을 읽지 못하니 꼭 서버로 여세요.

## 고치는 곳

- 품목과 가격: `data/items.csv`
- 난이도 규칙과 돈: `data/config.json`
- 대사: `data/lines.csv`
- 녹음 파일: `voice/` (방법은 `voice/README.md`)
- 도트 그림: `js/sprites.js` (글자 하나가 픽셀 하나)
