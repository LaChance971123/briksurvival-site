"""Build only the public launcher for an independent, advertising-free project."""
from pathlib import Path
from urllib.parse import urlsplit
import os, shutil, re
ROOT=Path(__file__).resolve().parents[1]
origin=os.environ.get('PLANNER_ORIGIN') or os.environ.get('URL','')
u=urlsplit(origin)
if u.scheme!='https' or not u.hostname or u.path not in ('','/') or u.username or u.password or u.query or u.fragment or u.hostname in ('ospreyzero.com','www.ospreyzero.com','ospreyzero.netlify.app','briksurvival.com','www.briksurvival.com'):
    raise SystemExit('Set PLANNER_ORIGIN or URL to the dedicated HTTPS planner origin.')
origin=origin.rstrip('/')
out=ROOT/'planner-host/dist'
if out.exists(): shutil.rmtree(out)
shutil.copytree(ROOT/'planner/app',out)
p=out/'launcher.js';p.write_text(p.read_text().replace('const ISOLATED_ORIGIN = null;',f'const ISOLATED_ORIGIN = {__import__("json").dumps(origin)};'))
p=out/'index.html';s=p.read_text().replace('https://ospreyzero.com/planner/app/',origin+'/').replace('href="/planner/"','href="https://ospreyzero.com/planner/"').replace('href="/"','href="https://ospreyzero.com/"');p.write_text(s)
policy="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
(out/'_headers').write_text('/*\n  Content-Security-Policy: '+policy+"\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: geolocation=(), microphone=(), camera=()\n  Strict-Transport-Security: max-age=31536000\n  X-Robots-Tag: noindex\n/sw.js\n  Cache-Control: no-cache\n  Service-Worker-Allowed: /\n")
# A separate site must never publish advertising, public guides or paid app files.
assert len(list(out.iterdir()))==12
assert not (out/'ads.js').exists()
print('Prepared isolated public planner launcher:',out)
