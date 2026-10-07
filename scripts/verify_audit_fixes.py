"""Guard public claims and private contact configuration introduced by the audit."""
from pathlib import Path
from lxml import html
R=Path(__file__).resolve().parents[1];D=R/'dist'
about=(D/'about/index.html').read_text();assert 'Topic toolkits are available through Payhip' not in about;assert 'Purchases are paused' in about
planner=(D/'planner/index.html').read_text();assert 'final contents will be confirmed' in planner;assert 'The four topic kits include' not in planner
home=html.fromstring((D/'index.html').read_text());assert home.xpath('//ol[@class="home-start-grid"]//a[@href="/preparedness/household-emergency-plan/"]'), 'Free household-plan entry remains available'
assert home.xpath('//aside[contains(@class,"static-guide-preview")]//a[@href="/emergencies/power-outage/"]'), 'Hero preview opens its real guide'
contact=html.fromstring((D/'contact/index.html').read_text());f=contact.xpath('//form[@name="private-contact"]')[0]
assert f.get('data-netlify')=='true' and f.get('method')=='POST' and f.get('netlify-honeypot')=='bot-field'
assert f.xpath('.//input[@name="form-name"]/@value')==['private-contact']
for name in ['name','email','topic','message']:
 el=f.xpath('.//*[@name=$value]',value=name)[0];assert contact.xpath('//label[@for=$value]',value=el.get('id'))
assert f.xpath('.//*[@data-form-status and @role="status"]')
privacy=(D/'privacy/index.html').read_text();assert 'If JavaScript or tab storage is unavailable' in privacy;assert 'href="/contact/"' in privacy
assert 'private contact channel is awaiting configuration' not in privacy
assert 'contact/index.html' in (R/'scripts/publication.py').read_text()
assert 'https://ospreyzero.com/contact/' in (D/'sitemap.xml').read_text()
print('PASS: paused sales claims, free plan entry, labelled private contact and accurate search privacy.')
