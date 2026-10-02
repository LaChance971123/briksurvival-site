"""Check public artifacts, metadata, font embedding and offline package boundaries."""
import json,re,zipfile
from pathlib import Path
from lxml import html
from pypdf import PdfReader
R=Path(__file__).resolve().parents[1];O=R/'dist'
assert (O/'offline/sw.js').exists()
assert not (O/'content').exists() and not (O/'scripts').exists()
assert not list(O.rglob('*.ttf')) and not (O/'Assets/brik-logo.png').exists()
assert (O/'Assets/oz-share.png').exists()
seen=[]
for p in O.rglob('*.html'):
 h=html.fromstring(p.read_text());assert len(h.xpath('//h1'))==1,p
 if p.name not in ['404.html','blackout-checklist-confirmed.html']:
  assert len(h.xpath('//link[@rel="canonical"]'))==1,p
  assert len(h.xpath('//meta[@property="og:image"]'))==1,p
  schema=h.xpath('//script[@type="application/ld+json"]/text()');assert len(schema)==1,p;json.loads(schema[0])
 assert not h.xpath('//link[contains(@href,"fonts.googleapis.com")]'),p
 for form in h.xpath('//form[@data-signup]'):assert form.xpath('.//*[@data-form-status]'),p
 seen.append(p)
for p in (O/'downloads').glob('*-field-guide.pdf'):
 r=PdfReader(p);fonts={str(f.get_object().get('/BaseFont')) for pg in r.pages for f in pg['/Resources']['/Font'].get_object().values()};assert any('DMSans' in f for f in fonts),p;assert any('SpaceGrotesk' in f for f in fonts),p;assert any('IBMPlexMono' in f for f in fonts),p
 assert all(len(pg.extract_text().strip())>100 for pg in r.pages),p
with zipfile.ZipFile(O/'downloads/osprey-zero-offline-library.zip') as z:
 assert 'START-HERE.html' in z.namelist()
 assert sum(x.endswith('.html') for x in z.namelist())==87
 for p in [x for x in z.namelist() if x.endswith('.html')]:
  text=z.read(p).decode();assert 'ads.js' not in text and 'fonts.googleapis.com' not in text
  h=html.fromstring(text)
  for link in h.xpath('//@href'):
   if not link.startswith('http'):assert link in z.namelist(),(p,link)
reader=(R/'offline/reader.js').read_text();assert "scope:'/offline/'" in reader
assert '11941494' in (R/'sw.js').read_text(),'Root advertising worker must remain intact'
print(f'PASS: {len(seen)} public pages, typography embedded in every full PDF, ZIP links and offline/ad worker isolation.')
