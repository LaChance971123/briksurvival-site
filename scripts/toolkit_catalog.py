"""Public sales metadata only. Premium manuscripts and files belong elsewhere."""
import json
import re
from decimal import Decimal
from html import escape as e
from urllib.parse import parse_qs, urlsplit

FIELDS = {
    'id', 'slug', 'kind', 'status', 'title', 'summary', 'components',
    'guide_slugs', 'included_product_ids', 'price', 'currency', 'edition',
    'payhip_product_id', 'checkout_url', 'delivery_verified',
}


def load_catalog(root):
    catalog = json.loads((root / 'content/toolkits.json').read_text())
    if set(catalog) != {'schema_version', 'featured_product_id', 'products'} or catalog['schema_version'] != 1:
        raise ValueError('Unsupported public toolkit catalogue schema')
    guides = {p.stem for p in (root / 'content/guides').glob('*.json')}
    by_id, slugs, mapped = {}, set(), set()
    for product in catalog['products']:
        if set(product) != FIELDS:
            raise ValueError('Catalogue entries may contain public sales metadata only')
        for key in ('id', 'slug'):
            if not isinstance(product[key], str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', product[key]):
                raise ValueError(f'Invalid product {key}')
        if product['id'] in by_id or product['slug'] in slugs:
            raise ValueError('Duplicate product ID or route')
        if product['kind'] not in ('topic', 'collection') or product['status'] not in ('planned', 'files-ready', 'ready', 'retired'):
            raise ValueError('Invalid product kind or status')
        if product['currency'] != 'USD' or not isinstance(product['delivery_verified'], bool):
            raise ValueError('Invalid currency or delivery verification')
        for key in ('title', 'summary'):
            if not isinstance(product[key], str) or not product[key].strip():
                raise ValueError(f'Product needs public {key}')
        for key in ('edition', 'payhip_product_id', 'checkout_url'):
            if product[key] is not None and (not isinstance(product[key], str) or not product[key].strip()):
                raise ValueError(f'Invalid {key}')
        for key in ('components', 'guide_slugs', 'included_product_ids'):
            if not isinstance(product[key], list) or any(not isinstance(x, str) or not x.strip() for x in product[key]):
                raise ValueError(f'Invalid {key}')
            if len(set(product[key])) != len(product[key]):
                raise ValueError(f'Duplicate {key}')
        if not set(product['guide_slugs']) <= guides:
            raise ValueError('Topic toolkit refers to an unknown free guide')
        if product['kind'] == 'topic':
            if mapped.intersection(product['guide_slugs']):
                raise ValueError('A guide may have only one primary topic toolkit')
            mapped.update(product['guide_slugs'])
        if product['price'] is not None:
            price = Decimal(str(product['price']))
            if not price.is_finite() or price <= 0 or price != price.quantize(Decimal('.01')):
                raise ValueError('Product price must be a positive two-decimal amount')
        if product['status'] == 'ready':
            if not all([product['price'], product['edition'], product['components'], product['payhip_product_id'], product['checkout_url'], product['delivery_verified']]):
                raise ValueError('Ready products need files verified in Payhip, an edition, price and checkout')
            url = urlsplit(product['checkout_url'])
            query = parse_qs(url.query)
            if (url.scheme != 'https' or url.netloc != 'payhip.com' or url.path != '/buy'
                    or url.fragment or set(query) != {'link'}
                    or query['link'] != [product['payhip_product_id']]
                    or not re.fullmatch(r'[A-Za-z0-9]+', product['payhip_product_id'])):
                raise ValueError('Checkout must be the matching HTTPS Payhip direct checkout URL')
        elif any([product['checkout_url'], product['payhip_product_id'], product['delivery_verified']]):
            raise ValueError('Unreleased or retired products cannot expose an active purchase link')
        by_id[product['id']] = product
        slugs.add(product['slug'])
    if catalog['featured_product_id'] not in by_id:
        raise ValueError('Missing featured product')
    featured = by_id[catalog['featured_product_id']]
    if featured['kind'] != 'collection' or featured['status'] == 'retired':
        raise ValueError('Featured product must be an active collection')
    for product in by_id.values():
        included = product['included_product_ids']
        if product['kind'] == 'topic' and included:
            raise ValueError('Topic products cannot contain other products')
        for product_id in included:
            member = by_id.get(product_id)
            if not member or member['kind'] != 'topic' or member['status'] == 'retired':
                raise ValueError('Collection membership must reference active topic products')
            if product['status'] == 'ready' and member['status'] != 'ready':
                raise ValueError('A ready collection cannot include unfinished products')
        if product['kind'] == 'collection' and product['status'] == 'ready' and not included:
            raise ValueError('A ready collection must list its included topic products')
    return catalog


def product_route(product):
    return '/toolkits/' + product['slug'] + '/'


def purchase_control(product):
    if product['status'] == 'ready':
        price = f"${Decimal(str(product['price'])):.2f}"
        return (f'<a class="button button-primary" data-payhip-checkout href="{e(product["checkout_url"], quote=True)}">'
                f'Buy {e(product["title"])} · {price}</a>'
                '<p class="toolkit-purchase-note">One-time purchase · Checkout and file delivery through Payhip</p>')
    if product['status'] == 'files-ready':
        return '<p class="toolkit-status">Files complete · Checkout opening soon</p><p class="toolkit-purchase-note">Purchasing will open after Payhip checkout and delivery are verified.</p>'
    return '<p class="toolkit-status">In development · Not available to purchase</p>'


def guide_cta(guide, catalog):
    product = next((p for p in catalog['products'] if p['kind'] == 'topic'
                    and p['status'] != 'retired' and guide['slug'] in p['guide_slugs']), None)
    if product:
        heading = product['title']
        description = product['summary']
        destination = product_route(product)
        label = 'Explore this topic toolkit'
    else:
        featured = next(p for p in catalog['products'] if p['id'] == catalog['featured_product_id'])
        heading = 'Turn the guidance into your household plan.'
        if featured['status'] == 'ready':
            description = featured['summary'] + ' This online guide stays free to read.'
            destination, label = product_route(featured), 'Explore the complete toolkit'
        else:
            availability = 'Available topic toolkits use Payhip for checkout and downloads.' if any(p['kind'] == 'topic' and p['status'] == 'ready' for p in catalog['products']) else 'Checkout is opening soon.'
            description = 'Explore four completed topic packages with printable guides, checklists and practical worksheets. ' + availability + ' This online guide stays free to read.'
            destination, label = '/toolkits/', 'Explore the toolkits'
    return (f'<section class="wrap guide-toolkit" aria-label="Preparation toolkits"><div>'
            f'<p class="kicker">PREPARE BEFORE YOU NEED IT</p><h2>{e(heading)}</h2><p>{e(description)}</p>'
            f'</div><a class="button button-outline" href="{destination}">{label}</a></section>')


def homepage_section(catalog):
    topics = [p for p in catalog['products'] if p['kind']=='topic' and p['status']!='retired']
    status = 'Topic toolkits available now' if any(p['status']=='ready' for p in topics) else 'Files complete · Checkout opening soon'
    cards = ''.join(f'<article class="toolkit-card"><p class="kicker">TOPIC TOOLKIT / {"AVAILABLE" if p["status"]=="ready" else "FILES COMPLETE"}</p><h3>{e(p["title"])}</h3><p>{e(p["summary"])}</p><a class="text-link" href="{product_route(p)}">See what is included →</a></article>' for p in topics)
    return ('<section class="section wrap access-section toolkit-feature" id="guide-access" aria-labelledby="access-title"><div class="access-copy"><p class="kicker">OSPREY ZERO / PREPARATION TOOLKITS</p><h2 id="access-title">A plan you can use.<br><span>Tools you can keep.</span></h2><p>Four completed topic packages bring the guidance together with polished checklists, shopping lists, contact cards and clearly marked Excel calculators. A4 and US Letter resources have their own organized folders.</p><p class="toolkit-status">'+status+'</p><a class="button button-primary" href="/toolkits/">Explore all four toolkits</a><p>The complete collection is being assembled after the individual kits. The Household Planner is a separate product.</p><a class="text-link" href="/planner/">Explore the Household Planner →</a></div><div class="release-kit-grid">'+cards+'</div></section>')
