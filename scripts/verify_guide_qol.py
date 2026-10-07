"""Generated guide controls, headings and readiness-aware reference shelf."""
import json
from pathlib import Path
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
guides = [json.loads(path.read_text()) for path in (ROOT / 'content/guides').glob('*.json')]
by_slug = {g['slug']: g for g in guides}

def route(g):
    folder = {'Preparedness guide': 'preparedness', 'Field guide': 'guides'}.get(g['content_type'], 'emergencies')
    return f'/{folder}/{g["slug"]}/'

for guide in guides:
    d = html.fromstring((DIST / route(guide).strip('/') / 'index.html').read_text())
    assert d.xpath('//header[@class="guide-heading"]/a[@class="guide-start-link" and @href="#do-now"]'), guide['slug']
    assert d.xpath('//button[@data-print-guide and @hidden]'), guide['slug']
    assert d.xpath('//nav[@class="rail-panel" and @aria-label="On this page"]'), guide['slug']
    assert d.xpath('//details[@class="guide-toc"]//a[@href="#quick-answer"]'), guide['slug']
    sections = ['#' + value for value in d.xpath('//div[@class="guide-main"]//section[@id]/@id')]
    nav = d.xpath('//nav[@class="guide-jumps"]/a/@href')
    assert [value for value in sections if value in nav] == nav, (guide['slug'], 'navigation must follow reading order')
    expected = [route(by_slug[link['slug']]) for link in guide.get('contextual_links', [])]
    assert d.xpath('//*[@id="do-now"]//nav[@class="guide-contextual-links"]/a/@href') == expected, guide['slug']

for route_name in ['emergencies', 'preparedness', 'guides', 'resources']:
    d = html.fromstring((DIST / route_name / 'index.html').read_text())
    levels = [int(h.tag[1]) for h in d.xpath('//main//*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6]')]
    assert levels[0] == 1
    assert all(second <= first + 1 for first, second in zip(levels, levels[1:])), (route_name, 'heading levels must not skip')

catalog = json.loads((ROOT / 'content/toolkits.json').read_text())
if not any(product['kind'] == 'topic' and product['status'] == 'ready' for product in catalog['products']):
    d = html.fromstring((DIST / 'resources/index.html').read_text())
    copy = ' '.join(d.xpath('//*[contains(@class,"reference-toolkit-note")]//text()'))
    assert 'Purchases are paused' in copy and 'Checkout is opening soon' not in copy
print('PASS: immediate action links, semantic ordered contents, contextual destinations, hub heading levels and truthful reference shelf.')
