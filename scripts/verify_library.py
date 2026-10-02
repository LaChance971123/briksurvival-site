"""Check published routes, source metadata, quick answers and downloadable PDFs."""
import json
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
errors=[]
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  for key in ['href','src']:
   x=urlsplit(a.get(key,''))
   if x.scheme or x.netloc or not x.path.startswith('/'):continue
   target=ROOT/x.path.strip('/')
   if not target.exists() and not (target/'index.html').exists():errors.append((str(self.file),x.path))
for f in ROOT.rglob('*.html'):
 if f.name=='indexv3.html' or 'templates' in f.parts:continue
 parser=Links();parser.file=f;parser.feed(f.read_text())
index=json.loads((ROOT/'search-index.json').read_text())
guides=[x for x in index if x['content_type'] in ['Emergency guide','Preparedness guide','Field guide']]
assert len({g['url'] for g in guides})==len(guides)
for g in guides:
 s=(ROOT/g['url'].strip('/')/'index.html').read_text()
 assert s.index('id="quick-answer"')<s.index('class="guide-resources"')<s.index('id="do-now"'),g['title']
 assert 'Download checklist' in s and 'Official guidance' in s,g['title']
for g in index:
 if g['url'].startswith('/downloads/'):
  r=PdfReader(ROOT/g['url'].lstrip('/'));text=''.join(p.extract_text() for p in r.pages)
  assert g['title'].split(' checklist')[0].split(' shopping list')[0] in text
assert not errors,errors
print(f'PASS: {len(guides)} guides, {len(index)} indexed resources, all internal links and PDFs.')
