"""Read-only release gate for actual CDN document policies; no location is sent.

Run after a deploy: python scripts/verify_daily_brief_headers.py https://<deploy-host>
This is separate from the offline build because it verifies the deployed headers.
"""
import sys
import urllib.request
from urllib.parse import urlsplit

base = sys.argv[1].rstrip('/') if len(sys.argv) == 2 else ''
origin = urlsplit(base)
if origin.scheme != 'https' or not origin.netloc or origin.path or origin.query or origin.fragment:
    raise SystemExit('Supply one HTTPS origin, without a path, query or fragment.')

allowed = ('/briefing', '/briefing/', '/briefing/index.html')
denied = ('/', '/search/', '/briefing/event/', '/privacy/', '/preparedness/')
for route in (*allowed, *denied):
    request = urllib.request.Request(base + route, method='HEAD')
    with urllib.request.urlopen(request, timeout=20) as response:
        assert response.status == 200, (route, response.status)
        assert urlsplit(response.url).netloc == origin.netloc, (route, 'Unexpected host redirect')
        values = response.headers.get_all('Permissions-Policy', [])
        assert len(values) == 1, (route, 'Expected one complete Permissions-Policy', values)
        directives = [part.strip() for part in values[0].split(',')]
        expected = 'geolocation=(self)' if route in allowed else 'geolocation=()'
        assert sorted(directives) == sorted([expected, 'microphone=()', 'camera=()']), (route, directives)
        assert response.headers.get('X-Frame-Options') == 'DENY', route
        assert response.headers.get('X-Content-Type-Options') == 'nosniff', route
        assert response.headers.get('Strict-Transport-Security'), route
        assert response.headers.get('Content-Security-Policy'), route
        print('PASS', route, values[0])
print('PASS: only the Daily Brief index aliases may request same-origin location.')
