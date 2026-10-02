"""Publish an allowlisted static output, never the source checkout."""
from pathlib import Path
import shutil
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist'
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir()
for folder in ['Assets','downloads']:
 shutil.copytree(ROOT/folder,OUT/folder)
for p in ROOT.rglob('*.html'):
 if any(x in p.relative_to(ROOT).parts for x in ['dist','templates','.git','node_modules']) or p.name=='indexv3.html':continue
 dest=OUT/p.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
for name in ['app.js','ads.js','search.js','styles.css','search-index.json','sitemap.xml','robots.txt','sw.js']:
 shutil.copy2(ROOT/name,OUT/name)
print('Staged public site; source content and build scripts excluded.')

# Emit one CSP per HTML route. Push alone requires dynamic inline script elements.
# Keep the default strict policy on every other page; never use overlapping CSP rules.
POLICIES=json.loads((ROOT/'config/security-policy.json').read_text())
PUSH_HUBS={'/library','/preparedness','/topics','/resources','/about'}
headers=[]
for page in sorted(OUT.rglob('*.html')):
 relative=page.relative_to(OUT).as_posix()
 route='/'+relative
 paths=[route]
 if page.name=='index.html':
  canonical='/'+str(page.parent.relative_to(OUT)).replace('.', '').strip('/')
  paths.extend([canonical+'/' if canonical!='/' else '/',canonical])
 else:canonical=route
 policy=POLICIES['push_hubs' if canonical in PUSH_HUBS else 'default']
 for path in sorted(set(paths)):
  if path:headers.append(path+'\n  Content-Security-Policy: '+policy+'\n')
(OUT/'_headers').write_text('\n'.join(headers))
print('Staged per-route CSP; inline script elements allowed only on five push hubs.')
