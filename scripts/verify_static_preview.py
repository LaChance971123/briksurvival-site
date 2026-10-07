"""Keep search and choices contiguous before the one static sample."""
import json
from pathlib import Path
from lxml import html
R=Path(__file__).resolve().parents[1]
s=(R/'index.html').read_text();d=html.fromstring(s)
a=d.xpath('//aside[contains(@class,"static-guide-preview")]')
assert len(a)==1
assert len(a[0].xpath('.//a[@href="/emergencies/power-outage/"]'))==1
assert not d.xpath('//*[@data-field-book or @data-book-page or @data-book-controls]')
assert 'field-book.js' not in s and 'SWIPE TO EXPLORE' not in s
assert s.index('id="emergency-search"')<s.index('id="home-search-results"')<s.index('class="hero-urgent"')<s.index('home-situation-grid')<s.index('home-subject-grid')<s.index('class="wrap home-static-sample"')
g=json.loads((R/'content/guides/power-outage.json').read_text())
for title,body in g['steps'][:2]:assert title in a[0].text_content() and body in a[0].text_content()
assert not (R/'field-book.js').exists()
print('PASS: one static source-accurate preview after complete search/topic flow; carousel removed.')

assert 'Practical guidance for emergencies and everyday preparedness.' in s
assert not d.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," home-hero-actions ")]')
assert len(d.xpath('//*[@id="emergency-search"]'))==1

assert s.index('id="encyclopedia-title"') < s.index('id="start-title"') < s.index('class="wrap home-static-sample"') < s.index('id="access-title"')
assert 'oz-reveal-ready' not in (R/'app.js').read_text()
assert not d.xpath('//div[@class="home-kit-preview"]')
assert d.xpath('//a[@href="/planner/app/"]')
