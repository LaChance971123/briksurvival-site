"""UX acceptance checks: preserved content and routes, clearer hierarchy and state."""
from pathlib import Path
import json
from lxml import html
R=Path(__file__).resolve().parents[1];D=R/'dist'
def page(name):return html.fromstring((D/name).read_text())
for p in D.rglob('*.html'):
 d=html.fromstring(p.read_text())
 assert len(d.xpath('//h1'))==1,p
 assert not d.xpath('//details[@class="subject-menu"]'),p
for g in (json.loads(p.read_text()) for p in (R/'content/guides').glob('*.json')):
 folder={'Preparedness guide':'preparedness','Field guide':'guides'}.get(g['content_type'],'emergencies')
 d=page(f'{folder}/{g["slug"]}/index.html');text=d.text_content()
 assert g['tldr'] in text,g['slug']
 for _,instruction in g['steps']:assert instruction in text,g['slug']
 nodes=list(d.iter());action=d.xpath('//*[@id="do-now"]')[0];tools=d.xpath('//div[@class="guide-actions"]')[0]
 assert nodes.index(action)<nodes.index(tools),g['slug']
 assert d.xpath('//*[@id="sources"]//a[starts-with(@href,"/contact/?guide=")]'),g['slug']
 assert len(d.xpath('//nav[@class="rail-panel"]/a'))<=12,g['slug']
d=page('topics/index.html');assert len(d.xpath('//div[@class="wrap az-list"]//li/a'))==138
assert d.xpath('//details[@id="common-phrases" and not(@open)]')
d=page('preparedness/index.html');assert d.xpath('//details[contains(@class,"preparation-directory") and not(@open)]')
for cat in json.loads((R/'content/taxonomy.json').read_text()):
 d=page('library/'+cat['id']+'/index.html');assert d.xpath('//nav[@class="browse-breadcrumb"]/span[@aria-current="page"]/text()')==[cat['title']]
assert len(page('emergencies/index.html').xpath('//div[@class="situation-links"]/a'))==8
assert 'New imports and purchases are paused' in page('planner/index.html').text_content()
assert not page('planner/app/index.html').xpath('//section[h2[text()="First time on iPhone?"]]')
assert page('privacy/index.html').xpath('//*[@id="privacy-summary"]//a')
print('PASS: unchanged guide actions, compact outlines, direct situations, true breadcrumbs, A–Z disclosure and consistent availability.')
