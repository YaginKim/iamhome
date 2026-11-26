# 녹음 파일 넣는 곳

1. `data/lines.csv`에서 바꾸고 싶은 대사의 `id`를 찾습니다. 예: `home.mom.hello`
2. 그 대사를 녹음해서 `voice/home.mom.hello.mp3`로 저장합니다.
3. `voice/manifest.json` 목록에 id를 추가합니다. 예: `["home.mom.hello"]`

목록에 있는 대사는 녹음 파일로 나오고, 나머지 대사는 그대로 TTS가 읽습니다.
가격처럼 매번 바뀌는 문장은 TTS로만 나옵니다.
