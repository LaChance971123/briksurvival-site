"""Public-source boundary and deterministic editorial mappings for briefings."""
from pathlib import Path
import json,re
from lxml import html
R=Path(__file__).resolve().parents[1]
for name in ['briefing/index.html','briefing/event/index.html']:
 p=html.fromstring((R/'dist'/name).read_text())
 assert len(p.xpath('//h1'))==1,name
 assert not p.xpath('//script[contains(@src,"ads.js")]'),name
 assert p.xpath('//script[contains(@src,"briefing.js")]'),name
 assert p.xpath('//link[contains(@href,"briefing.css")]'),name
 assert 'not live' in p.text_content().lower(),name
assert not (R/'dist/server').exists()
assert not (R/'dist/netlify').exists()
assert not (R/'dist/node_modules').exists()
js=(R/'briefing.js').read_text()
assert not re.search(r'setInterval\s*\(',js), 'No browser polling'
assert 'geolocation' not in js, 'No device location'
assert '/api/briefing' in js
assert 'innerHTML' not in js, 'Source text must use DOM textContent'
editorial=(R/'server/briefing/editorial.mjs').read_text()
for route in re.findall(r"'(/(?:emergencies|preparedness)/[^']+/)'",editorial):
 assert (R/route.strip('/')/'index.html').exists(),route
seed=json.loads((R/'server/briefing/bootstrap.json').read_text())
assert seed['schemaVersion']==1
assert seed['snapshot']['schedule']['cron']=='0 0,12 * * *'
for event in seed['snapshot']['events']:
 assert event['source']['kind'] in ['official','news']
 assert event['url'].startswith('https://')
 assert event['publishedAt'] and event['lastCheckedAt']
 assert 2<=len(event['guides'])<=4
 for guide in event['guides']:assert (R/guide['url'].strip('/')/'index.html').exists(),guide
 if event['source']['kind']=='news':
  assert event['attribution'] and event['source']['rightsUrl'] and event['source']['licenseUrl']
print('PASS: briefing routes, no advertising, source safety, exact guides and public boundary.')
