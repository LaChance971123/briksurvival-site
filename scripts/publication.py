"""Explicit public-file boundary; never recursively publish arbitrary source files."""
import json
from toolkit_catalog import load_catalog, product_route

STATIC_PAGES = {
    'index.html', 'contact/index.html', 'about/index.html', 'privacy/index.html', 'thanks/index.html', 'resources/index.html',
    '404.html', 'blackout-checklist-confirmed.html', 'retired-downloads.html',
    'reading-list/index.html', 'offline/index.html', 'toolkits/index.html', 'planner/index.html', 'planner/app/index.html',
}
STATIC_FILES = {
    'app.js', 'field-book.js', 'ads.js', 'search.js', 'styles.css', 'search-index.json',
    'sitemap.xml', 'robots.txt', 'sw.js', 'offline/sw.js',
    *{'planner/app/'+name for name in ('launcher.js','launcher.css','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','body.woff2','display.woff2','LICENSES.txt')},
}


def public_pages(root):
    pages = set(STATIC_PAGES)
    for path in (root / 'content/guides').glob('*.json'):
        guide = json.loads(path.read_text())
        section = {'Emergency guide': 'emergencies', 'Preparedness guide': 'preparedness', 'Field guide': 'guides'}[guide['content_type']]
        pages.add(f'{section}/{guide["slug"]}/index.html')
    for category in json.loads((root / 'content/taxonomy.json').read_text()):
        pages.add(f'library/{category["id"]}/index.html')
    pages.update(f'{section}/index.html' for section in ('library', 'emergencies', 'preparedness', 'guides', 'topics', 'search'))
    pages.add('emergencies/severe-weather/index.html')
    for product in load_catalog(root)['products']:
        if product['status'] != 'retired':
            pages.add(product_route(product).strip('/') + '/index.html')
    return pages


def public_files(root):
    assets = json.loads((root / 'config/public-assets.json').read_text())
    if any(not isinstance(name, str) or not name.startswith('Assets/') for name in assets):
        raise ValueError('The asset allowlist may contain only local Assets/ paths')
    return public_pages(root) | STATIC_FILES | set(assets)


def check_path(root, relative):
    path = root / relative
    if relative.startswith('/') or '..' in path.relative_to(root).parts or path.resolve() != path.absolute():
        raise ValueError(f'Public paths must be local, explicit files: {relative}')
    if set(path.relative_to(root).parts).intersection({'premium', 'private', 'paid-content', 'product-files', 'content', 'config', 'scripts', 'templates'}):
        raise ValueError('Private products and source folders cannot enter the public output')
    if path.suffix.lower() in {'.pdf', '.zip', '.docx', '.xlsx', '.env'}:
        raise ValueError('Premium documents and secrets cannot enter the public output')
    if not path.is_file():
        raise FileNotFoundError(f'Missing public file: {relative}')
    return path
