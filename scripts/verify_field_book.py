"""SSR/asset/accessibility boundaries for the progressive featured guide book."""
import json
from pathlib import Path
from lxml import html
R=Path(__file__).resolve().parents[1]
p=html.fromstring((R/'dist/index.html').read_text())
book=p.xpath('//*[@data-field-book]')[0]
pages=book.xpath('.//*[@data-book-page]')
slugs=['power-outage','water-disruption','hurricane','home-fire','severe-bleeding']
assert len(pages)==5
assert pages[0].get('hidden') is None
for n,(page,slug) in enumerate(zip(pages,slugs)):
 guide=json.loads((R/f'content/guides/{slug}.json').read_text())
 assert page.get('id')==f'field-page-{n+1}'
 assert page.get('data-title')==guide['title']
 assert page.xpath('.//a/@href')==[f'/emergencies/{slug}/']
 for step,text in zip(guide['steps'][:2],page.xpath('.//ol/li//p/text()')):assert step[1]==text,slug
 if n:assert page.get('hidden') is not None and page.get('inert') is not None and page.get('aria-hidden')=='true'
 assert str(n+1)+' of 5' in page.get('aria-label')
assert len(book.xpath('.//button[@data-book-go]'))==5
assert book.xpath('.//*[@data-book-controls and @hidden]')
assert len(book.xpath('.//noscript//a'))==5
assert book.xpath('.//*[@data-book-status and @aria-live="polite"]')
assert p.xpath('//script[starts-with(@src,"/field-book.js")]')
assert (R/'dist/field-book.js').read_bytes()==(R/'field-book.js').read_bytes()
assert 'pan-y' in (R/'styles.css').read_text()
print('PASS: five canonical guide excerpts, no-JS links, inert hidden panels, explicit controls and shipped controller.')
