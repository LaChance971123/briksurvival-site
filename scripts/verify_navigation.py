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
for name in ('library/index.html','library/vehicle-travel/index.html'):
 d=html.fromstring((out/name).read_text());assert d.xpath('//details[@class="subject-menu"]//a[@href="/library/"]')
 assert len(d.xpath('//nav[@class="browse-modes"]/a'))==5
print('PASS: guide contents, unique anchors, subcategory breadcrumbs, reading links and browse modes.')
