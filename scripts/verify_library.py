"""Check free guide structure, internal links and the public search index."""
import json
from pathlib import Path
from urllib.parse import urlsplit
from lxml import html
from publication import public_pages

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
errors = []
for name in sorted(public_pages(ROOT)):
    page = OUT / name
    document = html.fromstring(page.read_text())
    for link in document.xpath('//@href | //@src | //form/@action'):
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith('/'):
            continue
        target = OUT / parsed.path.strip('/')
        if not target.is_file() and not (target / 'index.html').is_file():
            errors.append((name, parsed.path))
    assert not document.xpath('//a[@download] | //*[@data-print] | //*[@id="offline-save"]'), name
    assert not document.xpath('//a[starts-with(@href,"/downloads/") or starts-with(@href,"/offline/")]'), name

index = json.loads((OUT / 'search-index.json').read_text())
guide_types = {'Emergency guide', 'Preparedness guide', 'Field guide'}
guides = [item for item in index if item['content_type'] in guide_types]
assert len(guides) == len(list((ROOT / 'content/guides').glob('*.json')))
assert len({item['url'] for item in guides}) == len(guides)
assert not any(item['url'].startswith(('/downloads/', '/offline/')) for item in index)
assert not any(item['content_type'] in {'Checklist', 'Shopping list', 'Full guide PDF'} for item in index)
for guide in guides:
    text = (OUT / guide['url'].strip('/') / 'index.html').read_text()
    assert text.index('id="quick-answer"') < text.index('class="guide-resources"') < text.index('id="do-now"'), guide['title']
    assert 'Trusted reference' in text and 'id="without-help"' in text and 'id="household"' in text, guide['title']
    assert text.index('id="sources"') < text.index('class="wrap guide-toolkit"'), guide['title']
assert not errors, errors
home = (OUT / 'index.html').read_text()
assert home.count('type="search"') == 1 and 'hero-query' not in home
print(f'PASS: {len(guides)} free guides, {len(index)} indexed pages/references, internal links and late toolkit CTAs.')
