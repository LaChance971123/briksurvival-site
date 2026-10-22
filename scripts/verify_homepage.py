"""Homepage keeps a clear route to guidance before secondary context."""
from pathlib import Path
from lxml import html
R=Path(__file__).resolve().parents[1];text=(R/'dist/index.html').read_text();p=html.fromstring(text)
assert len(p.xpath('//h1'))==1
assert len(p.xpath('//input[@type="search"]'))==1
assert p.xpath('//*[@id="emergency-search"]/@aria-controls')==['home-search-results']
assert p.xpath('//nav[@id="primary-nav"]/a/@href')==['/emergencies/','/preparedness/','/library/','/briefing/','/search/']
assert p.xpath('//section[contains(@class,"entry-paths")]/a/@href')==['/emergencies/','/preparedness/','/library/']
assert len(p.xpath('//a[contains(@class,"home-situation")]'))==6
assert text.index('id="emergency-search"')<text.index('class="wrap entry-paths"')<text.index('id="find-help"')<text.index('data-briefing="home"')
assert len(p.xpath('//*[@data-briefing="home"]'))==1
assert not p.xpath('//*[@data-briefing-globe] | //script[contains(@src,"briefing-globe.js")]')
assert not p.xpath('//main//form[@data-signup] | //main//*[@data-payhip-checkout] | //article[@class="home-kit-card"]')
assert not p.xpath('//main//a[starts-with(@href,"/toolkits/")] | //main//a[starts-with(@href,"/planner/")]')
assert p.xpath('//footer//a[@href="/planner/app/"]')
assert p.xpath('//*[@data-briefing-status and @role="status"]')
assert p.xpath('//*[@data-briefing-fallback]//a[@href="/preparedness/household-emergency-plan/"]')
assert p.xpath('//noscript//a[@href="/library/"]')
print('PASS: one search, three paths, six situations, compact briefing and preserved customer access.')
