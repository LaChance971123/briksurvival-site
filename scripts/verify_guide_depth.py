"""Publishing checks for rich guide content, table accessibility and search coverage."""
import json
from pathlib import Path
from lxml import html
from guide_content import text, resource_url

ROOT = Path(__file__).resolve().parents[1]
index = json.loads((ROOT / 'search-index.json').read_text())
if isinstance(index, dict):
    index = index.get('items', index.get('pages', []))
rich = 0
for file in (ROOT / 'content/guides').glob('*.json'):
    g = json.loads(file.read_text())
    sections = g.get('sections', [])
    if not any(isinstance(s, dict) for s in sections):
        continue
    rich += 1
    route = ('preparedness' if g['content_type'] == 'Preparedness guide' else 'guides' if g['content_type'] == 'Field guide' else 'emergencies')
    d = html.fromstring((ROOT / 'dist' / route / g['slug'] / 'index.html').read_text())
    entry = next(x for x in index if x['url'] == f'/{route}/{g["slug"]}/')
    assert len(d.xpath('//section[contains(@class,"guide-deep-dive")]')) == len(sections), file
    for section in sections:
        if not isinstance(section, dict):
            continue
        for block in section['blocks']:
            # Deep paragraphs and individual table cells must reach the browser-local search index.
            if block['type'] == 'paragraph':
                assert block['text'] in entry['text'], (file, 'unsearchable paragraph')
            if block['type'] == 'table':
                for row in block['rows']:
                    assert all(cell in entry['text'] for cell in row), (file, 'unsearchable table')
            if block['type'] == 'illustration':
                assert block['caption'] in entry['text'] and block['description'] in entry['text'], file
            if block['type'] == 'resources':
                for item in block['items']:
                    url = resource_url(item['url'])
                    assert item['label'] in entry['text'] and item['description'] in entry['text'], (file, 'unsearchable practical resource')
                    links = d.xpath('//nav[@class="resource-grid"]/a[@class="resource-button" and @href=$url]', url=url)
                    assert any(link.get('target') == '_blank' and link.get('rel') == 'noopener noreferrer'
                               and item['label'] in link.text_content() and item['description'] in link.text_content()
                               for link in links), (file, 'missing practical resource card')
    for table in d.xpath('//table[@class="guide-table"]'):
        assert table.xpath('./caption') and table.xpath('./thead/tr/th[@scope="col"]'), file
        assert all(row.xpath('./th[@scope="row"]') for row in table.xpath('./tbody/tr')), file
        assert table.getparent().get('tabindex') == '0', file
    for figure in d.xpath('//figure[@class="guide-process"]'):
        assert figure.xpath('./figcaption') and figure.xpath('./ol/li/h3'), file
    for figure in d.xpath('//figure[@class="guide-illustration"]'):
        assert figure.xpath('./figcaption') and figure.xpath('./svg[@role="img"]'), file
        assert figure.xpath('./svg/title') and figure.xpath('./svg/desc'), file
    assert d.xpath('//*[@id="quick-answer"]') and d.xpath('//*[@id="do-now"]'), file
    # Substantial useful detail must exist in the body, not only repeated header/sidebar text.
    assert len(text(sections).split()) >= 900, (file, 'insufficient detail')
assert rich >= 6
print(f'PASS: {rich} substantial rich guides, accessible tables/diagrams and complete search coverage.')
