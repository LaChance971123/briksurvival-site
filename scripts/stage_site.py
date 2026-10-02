"""Publish an allowlisted static output, never the source checkout."""
from pathlib import Path
import shutil
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
