"""배포 전에 실행: 모든 코드·스타일 파일 주소에 같은 버전 표시(?v=...)를 붙여서
휴대폰·태블릿이 예전 파일을 기억하고 있어도 새 파일을 받게 합니다.
사용법: python3 tools/bump-version.py
"""
import re, time, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
v = time.strftime('%Y%m%d%H%M')
idx = root / 'index.html'
s = idx.read_text(encoding='utf-8')
s = re.sub(r'(href="css/style\.css)(\?v=\w+)?"', rf'\1?v={v}"', s)
s = re.sub(r'(src="js/game\.js)(\?v=\w+)?"', rf'\1?v={v}"', s)
idx.write_text(s, encoding='utf-8')
for f in (root / 'js').glob('*.js'):
    t = f.read_text(encoding='utf-8')
    t2 = re.sub(r"""(from\s+['"]\./[\w-]+\.js)(\?v=\w+)?(['"])""", rf'\1?v={v}\3', t)
    if t2 != t:
        f.write_text(t2, encoding='utf-8')
print('version', v)
