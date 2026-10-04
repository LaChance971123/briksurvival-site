"""Verify the approved equipment rewrite retains useful structure and illustrations."""
import json
from pathlib import Path
from lxml import html

R = Path(__file__).resolve().parents[1]
slugs = ['firearm-safety-basics', 'firearm-storage', 'ammunition-storage',
         'cartridges-calibers-explained', 'suppressor-fundamentals',
         'night-vision-basics', 'thermal-imaging-basics']
for slug in slugs:
    g = json.loads((R / 'content/guides' / f'{slug}.json').read_text())
    d = html.fromstring((R / 'dist/preparedness' / slug / 'index.html').read_text())
    assert g['equipment_layout'] and len(g['sections']) >= 6, slug
    assert d.xpath('//*[@id="do-now"]/h2/text()') == ['Quick checklist.'], slug
    assert len(d.xpath('//table[@class="guide-table"]')) >= 2, slug
    rendered = ' '.join(d.xpath('//main//text()'))
    for generic in ['Keep unresolved legal', 'No tactical instruction', 'do not use it for weapon targeting',
                    'If help is unavailable.', 'Build your plan.', 'This guide does not cover tactical use']:
        assert generic not in rendered, (slug, generic)
    for section_id, field in [('without-help', 'fallback_heading'), ('household', 'household_heading'),
                              ('next', 'next_heading'), ('watch', 'watch_heading')]:
        assert d.xpath('//*[@id=$sid]/h2/text()', sid=section_id) == [g[field] + '.'], slug
    for reference in g['sections']:
        assert all(url.startswith('https://') for _, url in reference['references']), slug

for slug, kind in [('cartridges-calibers-explained', 'cartridge'),
                   ('firearm-safety-basics', 'firearm'), ('suppressor-fundamentals', 'sound')]:
    d = html.fromstring((R / 'dist/preparedness' / slug / 'index.html').read_text())
    assert len(d.xpath('//figure[@class="guide-illustration"]/svg[@role="img"]')) == 1, kind
    assert d.xpath('//figure[@class="guide-illustration"]/svg/@viewbox') == ['0 0 530 305'], kind

cartridge = (R / 'dist/preparedness/cartridges-calibers-explained/index.html').read_text()
for name in ['.22 Long Rifle', '.22 Winchester Magnum', '9mm Luger', '.380 Auto', '.38 Special',
             '.45 Auto', '.223 Remington', '5.56×45', '.308 Winchester', '7.62×51', '7.62×39', 'Shell length']:
    assert name in cartridge, name
print('PASS: seven equipment guides, cartridge profiles, specific checklists and accessible vector illustrations.')
