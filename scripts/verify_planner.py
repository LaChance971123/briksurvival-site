"""Check paid-app separation, scoped caching and the ad-free web entry."""
from pathlib import Path
import json
from lxml import html
R=Path(__file__).resolve().parents[1];D=R/'dist';A=D/'planner/app'
assert set(p.name for p in A.iterdir()) == {'index.html','launcher.js','launcher.css','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','body.woff2','display.woff2','LICENSES.txt'}
page=html.fromstring((A/'index.html').read_text())
assert not page.xpath('//script[contains(@src,"ads.js")]')
assert page.xpath('//input[@id="app-file" and @type="file"]')
assert page.xpath('//meta[@name="robots" and contains(@content,"noindex")]')
code=(A/'launcher.js').read_text();worker=(A/'sw.js').read_text()
assert 'crypto.subtle.digest' in code and 'APPROVED.includes' in code
assert 'app.html' in code and "navigator.serviceWorker.register('./sw.js')" in code
assert 'oz-planner-launcher-v1' in code and 'oz-offline-' not in code+worker
assert 'pathname.startsWith' in worker and "new URL('./',self.location.href).pathname" in worker
assert '/search-index.json' not in worker and '/library/' not in worker
assert len((A/'index.html').read_bytes()) < 20000 and len(code)<20000, 'Paid app must never be embedded in public launcher'
manifest=json.loads((A/'manifest.webmanifest').read_text());assert manifest['scope']=='./' and manifest['start_url']=='./'
assert '/planner/app/' in (D/'_headers').read_text()
assert "frame-src 'self' blob:" in (D/'_headers').read_text()
assert not any('C01-Household-Planner' in p.name for p in D.rglob('*'))
print('PASS: paid planner file excluded, local verification, scoped worker and ad-free launcher.')
