"""One reproducible public build and verification pipeline for local, CI and Netlify."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
commands = [
    [sys.executable, 'scripts/build_library.py'],
    [sys.executable, 'scripts/refine_site.py'],
    [sys.executable, 'scripts/release_paths.py'],
    [sys.executable, 'scripts/build_homepage.py'],
    [sys.executable, 'scripts/polish_release.py'],
    [sys.executable, 'scripts/stage_site.py'],
    [sys.executable, 'scripts/verify_library.py'],
    [sys.executable, 'scripts/verify_navigation.py'],
    [sys.executable, 'scripts/verify_guide_depth.py'],
    [sys.executable, 'scripts/verify_equipment_editorial.py'],
    [sys.executable, 'scripts/verify_homepage.py'],
    ['node', 'scripts/verify_search.cjs'],
    ['node', 'scripts/verify_search_privacy.cjs'],
    [sys.executable, 'scripts/verify_audit_fixes.py'],
    ['node', 'scripts/verify_ads.cjs'],
    ['node', 'scripts/verify_offline_retirement.cjs'],
    *[['node', '--check', name] for name in ('app.js', 'search.js', 'ads.js', 'offline/sw.js','planner/app/launcher.js','planner/app/sw.js')],
    [sys.executable, 'scripts/verify_release.py'],
    [sys.executable, 'scripts/verify_toolkits.py'],
    [sys.executable, 'scripts/verify_planner.py'],
]
for command in commands:
    subprocess.run(command, cwd=ROOT, check=True)
print('PASS: complete public build and migration checks.')
