"""Homepage search and guide-discovery flow, without decorative previews."""
from pathlib import Path
from lxml import html
R=Path(__file__).resolve().parents[1]
s=(R/'index.html').read_text();d=html.fromstring(s)
assert not d.xpath('//*[contains(@class,"static-guide-preview") or @data-field-book or @data-book-controls]')
assert not d.xpath('//datalist')
assert s.index('id="emergency-search"') < s.index('id="home-search-results"') < s.index('class="hero-urgent"') < s.index('home-situation-grid') < s.index('home-subject-grid') < s.index('id="start-title"') < s.index('id="access-title"')
assert d.xpath('//*[@id="common-title" and text()="Emergency guides"]')
assert len(d.xpath('//*[@id="emergency-search"]'))==1
assert 'Practical guidance for emergencies and everyday preparedness.' in s
assert 'oz-reveal-ready' not in (R/'app.js').read_text()
assert not d.xpath('//div[@class="home-kit-preview"]')
assert d.xpath('//a[@href="/planner/app/"]')
print('PASS: no guide preview, clear section names, single search and uninterrupted discovery flow.')
