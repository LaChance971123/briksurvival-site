"""Publish only explicitly registered public pages and assets."""
from pathlib import Path
import shutil
import json
from publication import public_files, check_path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
files = public_files(ROOT)
sources = {name: check_path(ROOT, name) for name in files}
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
for name, source in sorted(sources.items()):
    destination = OUT / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

# Push alone needs dynamic inline script elements, on the existing five hubs.
POLICIES = json.loads((ROOT / 'config/security-policy.json').read_text())
PUSH_HUBS = {'/library', '/preparedness', '/topics', '/resources', '/about'}
headers = []
for page in sorted(OUT.rglob('*.html')):
    relative = page.relative_to(OUT).as_posix()
    route = '/' + relative
    paths = [route]
    if page.name == 'index.html':
        canonical = '/' + str(page.parent.relative_to(OUT)).replace('.', '').strip('/')
        paths.extend([canonical + '/' if canonical != '/' else '/', canonical])
    else:
        canonical = route
    policy = POLICIES['push_hubs' if canonical in PUSH_HUBS else 'default']
    for path in sorted(set(paths)):
        if path:
            headers.append(path + '\n  Content-Security-Policy: ' + policy + '\n')
(OUT / '_headers').write_text('\n'.join(headers))
print(f'Staged {len(files)} allowlisted public files; paid files and source folders excluded.')
