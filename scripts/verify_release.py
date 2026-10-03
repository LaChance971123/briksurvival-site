"""Validate public artifacts, metadata and retirement boundaries."""
import json
import re
import subprocess
import tomllib
from pathlib import Path
from lxml import html
from publication import public_files

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
actual = {p.relative_to(OUT).as_posix() for p in OUT.rglob('*') if p.is_file()}
assert actual == public_files(ROOT) | {'_headers'}, actual.symmetric_difference(public_files(ROOT) | {'_headers'})
assert not (OUT / 'downloads').exists()
assert not any(p.suffix.lower() in {'.pdf', '.zip', '.ttf', '.docx', '.xlsx'} for p in OUT.rglob('*'))
assert set(p.name for p in (OUT / 'offline').iterdir()) == {'index.html', 'sw.js'}
for folder in ['content', 'scripts', 'config', 'templates', 'premium', 'private', 'paid-content', 'product-files']:
    assert not (OUT / folder).exists(), folder
tracked = subprocess.check_output(['git', 'ls-files', '--cached'], cwd=ROOT, text=True).splitlines()
assert not any(Path(name).suffix.lower() in {'.pdf', '.zip', '.docx', '.xlsx'} and name != 'tools/qpdf/qpdf.zip' for name in tracked), 'Product documents must not be tracked in the public repository'
assert not any(set(Path(name).parts).intersection({'premium','private','paid-content','product-files'}) for name in tracked)
for path in (ROOT / 'content/guides').glob('*.json'):
    guide = json.loads(path.read_text())
    bodies = {guide.get(k, '').strip() for k in ['tldr','next','watch','without_help','household','pack_now']}
    bodies.update(body.strip() for _, body in guide['steps'])
    for key in ['decisions', 'faqs']:
        for _, body in guide.get(key, []):
            assert body.strip() not in bodies, (path, 'Repeated section')
            bodies.add(body.strip())
pages = list(OUT.rglob('*.html'))
for path in pages:
    text = path.read_text()
    document = html.fromstring(text)
    assert len(document.xpath('//h1')) == 1, path
    if path.name != '404.html':
        assert len(document.xpath('//link[@rel="canonical"]')) == 1, path
        assert len(document.xpath('//meta[@property="og:image"]')) == 1, path
        schemas = document.xpath('//script[@type="application/ld+json"]/text()')
        assert len(schemas) == 1, path
        json.loads(schemas[0])
    assert not document.xpath('//link[contains(@href,"fonts.googleapis.com")]'), path
    assert not document.xpath('//a[@download] | //*[@data-print]'), path
    assert not re.search(r'Free downloads|Download checklist|Save the offline library|Get the offline collections now', text), path
    for form in document.xpath('//form[@data-signup]'):
        assert form.xpath('.//*[@data-form-status]') and form.xpath('.//*[@name="bot-field"]'), path
manifest = json.loads((OUT / 'Assets/site.webmanifest').read_text())
assert manifest['start_url'] == '/' and manifest['display'] == 'browser'
assert '11941494' in (OUT / 'sw.js').read_text(), 'Root advertising worker must remain intact'
assert (ROOT / 'sw.js').read_bytes() == (OUT / 'sw.js').read_bytes()
sitemap = (OUT / 'sitemap.xml').read_text()
assert '/toolkits/' in sitemap and '/offline/' not in sitemap and '/downloads/' not in sitemap
config = tomllib.loads((ROOT / 'netlify.toml').read_text())
rules = {r['from']: r for r in config['redirects']}
assert rules['/downloads/*']['status'] == 404 and rules['/downloads/*']['force']
assert rules['/offline/*']['status'] == 404 and not rules['/offline/*']['force']
for path in ['/offline/guides.json', '/offline/reader.js']:
    assert rules[path]['status'] == 404 and rules[path]['force']
assert config['build']['publish'] == 'dist' and 'scripts/build_site.py' in config['build']['command']
print(f'PASS: {len(pages)} public pages, exact publishing allowlist, metadata and retired document boundaries.')
