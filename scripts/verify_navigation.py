"""Verify real section targets and discoverability, including no-JS fallbacks."""
from pathlib import Path
from urllib.parse import urlsplit
from lxml import html
from publication import public_pages
R=Path(__file__).resolve().parents[1];out=R/'dist'
for name in public_pages(R):
 document=html.fromstring((out/name).read_text())
 ids=document.xpath('//@id');assert len(ids)==len(set(ids)),('duplicate id',name)
 for href in document.xpath('//a/@href'):
  u=urlsplit(href)
  if u.scheme or u.netloc or not u.fragment:continue
  target=(out/u.path.strip('/')/'index.html') if u.path and u.path.endswith('/') else (out/u.path.strip('/')) if u.path else out/name
  if target.is_file():assert html.fromstring(target.read_text()).xpath('//*[@id=$value]',value=u.fragment),('missing anchor',name,href)
 if document.xpath('//*[@data-save-guide]'):
  assert document.xpath('//a[@href="/reading-list/"]'),name
  assert document.xpath('//details[contains(@class,"guide-toc")]/summary'),name
  for section in document.xpath('//section[contains(@class,"guide-deep-dive")]'):
   assert document.xpath('//a[@href=$value]',value='#'+section.get('id')),name
d=html.fromstring((out/'library/index.html').read_text())
assert len(d.xpath('//details[@class="subject-family"]'))==7
subjects=d.xpath('//div[@class="family-links"]/a/@href')
import json
assert set(subjects)=={'/library/'+c['id']+'/' for c in json.loads((R/'content/taxonomy.json').read_text())}
assert not d.xpath('//nav[@class="browse-modes"]')
d=html.fromstring((out/'preparedness/index.html').read_text())
assert len(d.xpath('//ol[@class="prepare-steps"]/li'))==4
assert d.xpath('//details[@class="prepare-more"]')
print('PASS: guide contents, unique anchors, seven subject families, complete category access and four-step preparation path.')
