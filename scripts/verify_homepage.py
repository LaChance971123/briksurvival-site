"""Keep the homepage's navigation, search and storefront promises consistent."""
from pathlib import Path
from lxml import html
from toolkit_catalog import load_catalog
R=Path(__file__).resolve().parents[1];p=html.fromstring((R/'dist/index.html').read_text())
assert len(p.xpath('//h1'))==1
hero=p.xpath('//section[contains(@class,"home-hero")]')[0]
assert hero[0].get('class')=='home-hero-stage', 'The hero leads; topics follow it'
assert list(hero).index(p.xpath('//*[@class="hero-urgent"]')[0])>0
assert p.xpath('//*[@class="home-hero-intro"]//*[@id="emergency-search"]'), 'Search stays in primary hero column'
assert len(p.xpath('//input[@type="search"]'))==1
assert p.xpath('//*[@id="emergency-search"]/@aria-controls')==['home-search-results']
assert len(p.xpath('//nav[@id="primary-nav"]/a[not(contains(@class,"nav-mobile-briefing"))]'))==4
assert len(p.xpath('//nav[@id="primary-nav"]/a[@class="nav-mobile-briefing" and @href="/briefing/"]'))==1
assert len(p.xpath('//a[contains(@class,"home-situation")]'))==6
assert len(p.xpath('//div[@class="home-subject-grid"]/a'))==14
text=(R/'dist/index.html').read_text();assert text.index('id="find-help"')<text.index('id="encyclopedia-title"')<text.index('id="start-title"')<text.index('id="guide-access"')
topics=[x for x in load_catalog(R)['products'] if x['kind']=='topic' and x['status']!='retired']
assert len(p.xpath('//article[@class="home-kit-card"]'))==len(topics)
assert len(p.xpath('//*[@data-payhip-checkout]'))==sum(x['status']=='ready' for x in topics)
for image in p.xpath('//div[@class="home-kit-preview"]/img'):
 assert (R/'dist'/image.get('src').lstrip('/')).is_file()
 assert image.get('width') and image.get('height') and image.get('loading')=='lazy'
assert not p.xpath('//a[substring(@href,string-length(@href)-3)=".pdf"]')
assert len(p.xpath('//form[@data-signup]//input[@type="email"]'))==1
assert 'Email delivery is being set up' in text
assert all(url in text for url in ['https://www.tiktok.com/@osprey_zero','https://www.instagram.com/ospreyzero/','https://www.youtube.com/@OspreyZero'])
print('PASS: single homepage search, concise navigation, emergency-first order, actual covers, honest checkout and signup.')
